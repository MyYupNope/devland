import {
    Clock,
    PerspectiveCamera,
    Scene,
    WebGLRenderer,
    Points,
    BufferGeometry,
    BufferAttribute,
    ShaderMaterial,
    AdditiveBlending,
    Vector3,
    Vector2,
    Matrix4,
    MathUtils
} from 'three';

// ─────────────────────────────────────────────
// [4.4] Named Configuration Constants
// ─────────────────────────────────────────────
const CONFIG = {
    // Camera
    initialZ: 35,
    zoomMin: 10,
    zoomMax: 120,
    zoomSpeed: 0.8,
    zoomLerp: 0.08,
    rotationStep: 0.03,
    rotationAutoReturnLerp: 0.02,
    autoReturnGracePeriodMs: 300,   // [2.5] ms before auto-rotate re-engages after gesture

    // Canvas text rasterization
    canvasWidth: 800,
    canvasHeight: 150,
    fontSize: 44,
    pixelStep: 2,
    pixelThreshold: 120,
    targetWorldWidth: 80.0,

    // Particles
    density: 8,
    jitterXY: 0.08,
    jitterZ: 2.5, // Increased slightly from 1.6 for more dramatic Z-depth!

    // Explosion speeds
    explosionSpeedMin: 0.4,
    explosionSpeedRange: 0.8,

    // Mouse repulsion
    mouseInfluence: 7.0,
    repulsionStrength: 3.5,

    // Spring physics
    springK: 0.12,
    springDamping: 0.82,

    // Interaction
    tapCount: 5,
    tapWindowMs: 800,               // [3.1] widened from 500ms
    inputDebounceMs: 150,           // [1.5] debounce delay

    // Rendering
    pointSize: 0.5,
    pointSizeAttenuationScale: 120.0,
    clearColor: 0x020205,
    maxPixelRatio: 2,

    // Themes
    themes: {
        ember: {
            hot: [1.0, 0.0, 0.0],
            warm: [1.0, 1.0, 0.0],
            cold: [1.0, 1.0, 1.0]
        },
        arctic: {
            hot: [0.0, 0.4, 1.0],
            warm: [0.2, 0.8, 1.0],
            cold: [0.9, 0.95, 1.0]
        },
        toxic: {
            hot: [0.1, 0.8, 0.1],
            warm: [0.6, 1.0, 0.2],
            cold: [0.7, 1.0, 0.8]
        },
        neon: {
            hot: [1.0, 0.0, 0.5],
            warm: [0.6, 0.1, 1.0],
            cold: [0.5, 0.9, 1.0]
        },
        sakura: {
            hot: [1.0, 0.2, 0.4],
            warm: [1.0, 0.6, 0.7],
            cold: [1.0, 1.0, 1.0]
        }
    },

    // Unique preset configurations for custom particle physics and Web Audio properties
    presets: {
        KINETIC: {
            theme: 'neon',
            font: 'Fira Code',
            expansionDuration: 0.7,
            contractionDuration: 1.8,
            explosionMaxDistMultiplier: 25.0,
            soundPitch: 190,
            soundDuration: 0.9,
            soundType: 'sawtooth'
        },
        GALAXY: {
            theme: 'arctic',
            font: 'Outfit',
            expansionDuration: 3.5,
            contractionDuration: 6.0,
            explosionMaxDistMultiplier: 12.0,
            soundPitch: 85,
            soundDuration: 2.4,
            soundType: 'sine'
        },
        BREEZE: {
            theme: 'sakura',
            font: 'Pacifico',
            expansionDuration: 4.0,
            contractionDuration: 5.0,
            explosionMaxDistMultiplier: 6.5,
            soundPitch: 155,
            soundDuration: 2.0,
            soundType: 'triangle'
        },
        EXPLODE: {
            theme: 'ember',
            font: 'Playfair Display',
            expansionDuration: 1.1,
            contractionDuration: 3.8,
            explosionMaxDistMultiplier: 36.0,
            soundPitch: 110,
            soundDuration: 1.6,
            soundType: 'sine'
        },
        DEFAULT: {
            expansionDuration: 2.0,
            contractionDuration: 4.0,
            explosionMaxDistMultiplier: 15.0,
            soundPitch: 140,
            soundDuration: 1.5,
            soundType: 'sine'
        }
    }
};

// ─────────────────────────────────────────────
// Shaders
// ─────────────────────────────────────────────
const vertexShader = `
uniform vec3 uMouse;
uniform float uMouseInfluence;
uniform float uPointSize;
uniform float uPixelRatio;
uniform vec3 uColorHot;
uniform vec3 uColorWarm;
uniform vec3 uColorCold;
uniform float uExplosionProgress;

varying vec3 vColor;

// Helper to convert hue (0.0 to 1.0) to RGB rainbow spectrum
vec3 hueToRgb(float h) {
    float r = abs(h * 6.0 - 3.0) - 1.0;
    float g = 2.0 - abs(h * 6.0 - 2.0);
    float b = 2.0 - abs(h * 6.0 - 4.0);
    return clamp(vec3(r, g, b), 0.0, 1.0);
}

void main() {
    // Smooth heatmap based on mouse proximity and dynamic colors
    float r = clamp(distance(uMouse, position) / uMouseInfluence, 0.0, 1.0);
    vec3 baseColor = (r < 0.5)
        ? mix(uColorHot, uColorWarm, r * 2.0)
        : mix(uColorWarm, uColorCold, (r - 0.5) * 2.0);

    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;

    // View-space color spectrum (red in center, blue at window limits)
    float viewDist = length(mvPosition.xy);
    // Camera fov is 75 deg, so tan(75/2) = 0.7673
    float maxViewDist = -mvPosition.z * 0.7673;
    float tSpectrum = clamp(viewDist / maxViewDist, 0.0, 1.0);
    
    // Map spectrum factor 0..1 to hue 0..0.666 (Red -> Orange -> Yellow -> Green -> Cyan -> Blue)
    vec3 spectrumColor = hueToRgb(tSpectrum * 0.666);

    vColor = mix(baseColor, spectrumColor, uExplosionProgress);

    // Size attenuation - corrected for device pixel ratio [2.2]
    gl_PointSize = uPointSize * uPixelRatio * (${CONFIG.pointSizeAttenuationScale.toFixed(1)} / -mvPosition.z);
}
`;

const fragmentShader = `
varying vec3 vColor;

void main() {
    gl_FragColor = vec4(vColor, 0.9);
}
`;

// ─────────────────────────────────────────────
// State grouped into named objects
// ─────────────────────────────────────────────

// Global configuration state
const state = {
    currentText: 'Define your message!',
    currentTheme: 'ember',
    currentFont: 'Outfit',

    // Unique explosion properties dynamically set by presets
    expansionDuration: CONFIG.presets.DEFAULT.expansionDuration,
    contractionDuration: CONFIG.presets.DEFAULT.contractionDuration,
    explosionMaxDistMultiplier: CONFIG.presets.DEFAULT.explosionMaxDistMultiplier,
    soundPitch: CONFIG.presets.DEFAULT.soundPitch,
    soundDuration: CONFIG.presets.DEFAULT.soundDuration,
    soundType: CONFIG.presets.DEFAULT.soundType,

    get totalExplosionDuration() {
        return this.expansionDuration + this.contractionDuration;
    }
};

// Rendering state
const render = {
    scene: null,
    camera: null,
    renderer: null,
    particles: null,
    clock: new Clock(),
    targetZ: CONFIG.initialZ,
    prevTime: 0,
    prevDt: 0,
    prevKFrame: 0,
    prevDampFrame: 0,
};

// Physics state
const physics = {
    posHome: null,      // Rest positions
    posLive: null,      // Live geometry buffer
    springDisp: null,   // Spring displacement
    springVel: null,    // Spring velocity
    randomDir: null,    // Explosion direction per particle
    randomSpeed: null,  // Explosion speed per particle
    explosionStartTime: -1,
};

// Interaction / UI state
const interaction = {
    keys: {},
    mouseWorld: new Vector3(-1000, -1000, 0),
    mouseLocal: new Vector3(),
    invMatrix: new Matrix4(),
    clickCount: 0,
    lastClickTime: 0,
    lastPinchDist: null,
    lastMidpoint: new Vector2(),
    lastGestureEndTime: 0,
    inputDebounceTimer: null,
};

// Shader uniforms
const uniforms = {
    uMouse: { value: new Vector3(-1000, -1000, 0) },
    uMouseInfluence: { value: CONFIG.mouseInfluence },
    uPointSize: { value: CONFIG.pointSize },
    uPixelRatio: { value: 1.0 },
    uColorHot: { value: new Vector3(1.0, 0.0, 0.0) },
    uColorWarm: { value: new Vector3(1.0, 1.0, 0.0) },
    uColorCold: { value: new Vector3(1.0, 1.0, 1.0) },
    uExplosionProgress: { value: 0.0 }
};

// ─────────────────────────────────────────────
// Audio Synthesis (Web Audio API)
// ─────────────────────────────────────────────
let audioCtx = null;
function playExplosionSound() {
    try {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }

        const now = audioCtx.currentTime;

        // Base explosion bass boom
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        const filter = audioCtx.createBiquadFilter();

        osc.type = state.soundType;
        osc.frequency.setValueAtTime(state.soundPitch, now);
        osc.frequency.exponentialRampToValueAtTime(30, now + state.soundDuration * 0.8);

        // Adjust lowpass frequency sweeps depending on wave type (sawtooth gets higher sweeps)
        const lowpassFreq = state.soundType === 'sawtooth' ? 1200 : 700;
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(lowpassFreq, now);
        filter.frequency.exponentialRampToValueAtTime(80, now + state.soundDuration * 0.9);

        // Scale gain slightly lower for harsh sawtooth presets
        const soundGain = state.soundType === 'sawtooth' ? 0.22 : 0.4;
        gain.gain.setValueAtTime(soundGain, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + state.soundDuration);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(audioCtx.destination);

        osc.start(now);
        osc.stop(now + state.soundDuration);

        // Crackle / high-frequency burst
        const osc2 = audioCtx.createOscillator();
        const gain2 = audioCtx.createGain();

        osc2.type = 'triangle';
        osc2.frequency.setValueAtTime(state.soundPitch * 2, now);
        osc2.frequency.exponentialRampToValueAtTime(90, now + 0.35);

        gain2.gain.setValueAtTime(0.12, now);
        gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

        osc2.connect(gain2);
        gain2.connect(audioCtx.destination);

        osc2.start(now);
        osc2.stop(now + 0.4);

    } catch (err) {
        console.warn('Audio synthesis initialized with error:', err);
    }
}

// ─────────────────────────────────────────────
// Text Rasterization
// ─────────────────────────────────────────────
function sampleTextPoints(text) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    canvas.width  = CONFIG.canvasWidth;
    canvas.height = CONFIG.canvasHeight;
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, CONFIG.canvasWidth, CONFIG.canvasHeight);
    ctx.fillStyle = 'white';
    ctx.font = `bold ${CONFIG.fontSize}px "${state.currentFont}", sans-serif`;
    ctx.textAlign   = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, CONFIG.canvasWidth / 2, CONFIG.canvasHeight / 2);

    const imgData = ctx.getImageData(0, 0, CONFIG.canvasWidth, CONFIG.canvasHeight).data;
    const rawPoints = [];

    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;

    for (let y = 0; y < CONFIG.canvasHeight; y += CONFIG.pixelStep) {
        for (let x = 0; x < CONFIG.canvasWidth; x += CONFIG.pixelStep) {
            const index = (y * CONFIG.canvasWidth + x) * 4;
            if (imgData[index] > CONFIG.pixelThreshold) {
                rawPoints.push({ x, y });
                if (x < minX) minX = x;
                if (x > maxX) maxX = x;
                if (y < minY) minY = y;
                if (y > maxY) maxY = y;
            }
        }
    }

    if (rawPoints.length === 0) return null;

    const scale = CONFIG.targetWorldWidth / Math.max(maxX - minX, 1);
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;

    return rawPoints.map(p => ({
        x: (p.x - cx) * scale,
        y: (cy - p.y) * scale,
        z: 0,
    }));
}

// ─────────────────────────────────────────────
// Particle Setup
// ─────────────────────────────────────────────
function setupParticles(text, shouldScatter = false) {
    // Dispose old GPU resources before removing to prevent VRAM leak
    if (render.particles) {
        render.particles.geometry.dispose();
        if (render.particles.material) {
            render.particles.material.dispose();
        }
        render.scene.remove(render.particles);
        render.particles = null;
    }

    const points = sampleTextPoints(text);
    if (!points) return;

    const { density, jitterXY, jitterZ, explosionSpeedMin, explosionSpeedRange } = CONFIG;
    const count = points.length * density;

    physics.posHome    = new Float32Array(count * 3);
    physics.posLive    = new Float32Array(count * 3);
    physics.springDisp = new Float32Array(count * 3);
    physics.springVel  = new Float32Array(count * 3);
    physics.randomDir  = new Float32Array(count * 3);
    physics.randomSpeed = new Float32Array(count);

    for (let i = 0; i < points.length; i++) {
        const p = points[i];
        for (let d = 0; d < density; d++) {
            const idx = i * density + d;
            const ix = idx * 3, iy = ix + 1, iz = ix + 2;

            const hx = p.x + (Math.random() - 0.5) * jitterXY;
            const hy = p.y + (Math.random() - 0.5) * jitterXY;
            const hz = p.z + (Math.random() - 0.5) * jitterZ;

            physics.posHome[ix] = hx;
            physics.posHome[iy] = hy;
            physics.posHome[iz] = hz;

            // Particle Birth Animation: Scatter initial live positions only if requested
            const ox = shouldScatter ? (Math.random() - 0.5) * 45 : 0;
            const oy = shouldScatter ? (Math.random() - 0.5) * 45 : 0;
            const oz = shouldScatter ? (Math.random() - 0.5) * 35 : 0;

            physics.posLive[ix] = hx + ox;
            physics.posLive[iy] = hy + oy;
            physics.posLive[iz] = hz + oz;

            physics.springDisp[ix] = ox;
            physics.springDisp[iy] = oy;
            physics.springDisp[iz] = oz;

            // Spherical distribution for explosion direction
            const theta = Math.random() * Math.PI * 2;
            const phi   = Math.acos((Math.random() * 2) - 1);
            physics.randomDir[ix] = Math.sin(phi) * Math.cos(theta);
            physics.randomDir[iy] = Math.sin(phi) * Math.sin(theta);
            physics.randomDir[iz] = Math.cos(phi);

            physics.randomSpeed[idx] = explosionSpeedMin + Math.random() * explosionSpeedRange;
        }
    }

    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(physics.posLive, 3));

    const mat = new ShaderMaterial({
        uniforms,
        vertexShader,
        fragmentShader,
        blending: AdditiveBlending,
        depthWrite: false,
        transparent: true,
    });

    render.particles = new Points(geo, mat);
    render.scene.add(render.particles);
}

// ─────────────────────────────────────────────
// Mouse Utilities & Optimization
// ─────────────────────────────────────────────
const _vec = new Vector3();
const _dir = new Vector3();

function updateMouse(clientX, clientY) {
    _vec.set(
        (clientX / window.innerWidth) * 2 - 1,
        -(clientY / window.innerHeight) * 2 + 1,
        0.5
    ).unproject(render.camera);
    _dir.copy(_vec).sub(render.camera.position).normalize();
    interaction.mouseWorld.copy(render.camera.position)
        .add(_dir.multiplyScalar(-render.camera.position.z / _dir.z));
}

// ─────────────────────────────────────────────
// Explosion Trigger
// ─────────────────────────────────────────────
function triggerExplosion() {
    if (physics.explosionStartTime >= 0) return;
    physics.explosionStartTime = render.clock.getElapsedTime();
    playExplosionSound();
}

// ─────────────────────────────────────────────
// URL Parameter Synchronisation
// ─────────────────────────────────────────────
function updateURLParams(text, theme, font) {
    const url = new URL(window.location);
    url.searchParams.set('t', text);
    url.searchParams.set('theme', theme);
    url.searchParams.set('font', font);
    window.history.replaceState({}, '', url);
}

// ─────────────────────────────────────────────
// Custom UI Event Handlers
// ─────────────────────────────────────────────
function resetToDefaultExplosion() {
    const preset = CONFIG.presets.DEFAULT;
    state.expansionDuration = preset.expansionDuration;
    state.contractionDuration = preset.contractionDuration;
    state.explosionMaxDistMultiplier = preset.explosionMaxDistMultiplier;
    state.soundPitch = preset.soundPitch;
    state.soundDuration = preset.soundDuration;
    state.soundType = preset.soundType;
}

function selectTheme(themeName) {
    const theme = CONFIG.themes[themeName] || CONFIG.themes.ember;
    state.currentTheme = themeName;
    uniforms.uColorHot.value.set(theme.hot[0], theme.hot[1], theme.hot[2]);
    uniforms.uColorWarm.value.set(theme.warm[0], theme.warm[1], theme.warm[2]);
    uniforms.uColorCold.value.set(theme.cold[0], theme.cold[1], theme.cold[2]);

    const themeSelect = document.getElementById('theme-select');
    if (themeSelect) themeSelect.value = themeName;

    updateURLParams(state.currentText, state.currentTheme, state.currentFont);
}

function selectFont(fontName) {
    state.currentFont = fontName;
    const fontSelect = document.getElementById('font-select');
    if (fontSelect) fontSelect.value = fontName;

    setupParticles(state.currentText, false);
    updateURLParams(state.currentText, state.currentTheme, state.currentFont);
}

function updateText(text) {
    const val = text.trim();
    const finalVal = val.length > 0 ? val : 'Define your message!';
    state.currentText = finalVal;

    setupParticles(finalVal, false);
    updateURLParams(state.currentText, state.currentTheme, state.currentFont);
}

function updateCharCounter(text) {
    const counter = document.getElementById('char-counter');
    if (!counter) return;

    const len = text.length;
    counter.textContent = `${len}/25`;

    counter.classList.remove('warning', 'danger');
    if (len >= 25) {
        counter.classList.add('danger');
    } else if (len >= 20) {
        counter.classList.add('warning');
    }
}

// Set explosion custom physics + sound parameters per preset
function applyPresetExplosion(presetName) {
    const preset = CONFIG.presets[presetName] || CONFIG.presets.DEFAULT;
    
    state.expansionDuration = preset.expansionDuration;
    state.contractionDuration = preset.contractionDuration;
    state.explosionMaxDistMultiplier = preset.explosionMaxDistMultiplier;
    state.soundPitch = preset.soundPitch;
    state.soundDuration = preset.soundDuration;
    state.soundType = preset.soundType;

    // Apply specific theme and font to reinforce the preset identity
    if (preset.theme) selectTheme(preset.theme);
    if (preset.font) selectFont(preset.font);
}

// ─────────────────────────────────────────────
// Pointer & Gesture Handlers
// ─────────────────────────────────────────────
function onPointerDown(e) {
    if (e.target.closest('#control-panel')) return;
    if (e.pointerType === 'touch' && !e.isPrimary) return;

    const now = performance.now();
    interaction.clickCount = (now - interaction.lastClickTime < CONFIG.tapWindowMs)
        ? interaction.clickCount + 1
        : 1;
    interaction.lastClickTime = now;

    if (interaction.clickCount >= CONFIG.tapCount) {
        resetToDefaultExplosion(); // Double-click/Taps use default balance
        triggerExplosion();
        interaction.clickCount = 0;
    }
}

function onTouchStart(e) {
    if (e.target.closest('#control-panel')) return;
    if (e.touches.length === 1) {
        updateMouse(e.touches[0].clientX, e.touches[0].clientY);
    } else if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        interaction.lastPinchDist = Math.sqrt(dx * dx + dy * dy);
        interaction.lastMidpoint.set(
            (e.touches[0].clientX + e.touches[1].clientX) / 2,
            (e.touches[0].clientY + e.touches[1].clientY) / 2
        );
    }
}

function onTouchMove(e) {
    if (e.target.closest('#control-panel')) return;
    e.preventDefault();

    if (e.touches.length === 1) {
        updateMouse(e.touches[0].clientX, e.touches[0].clientY);
    } else if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (interaction.lastPinchDist) render.targetZ -= (dist - interaction.lastPinchDist) * 0.15;
        interaction.lastPinchDist = dist;

        const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        if (render.particles) {
            render.particles.rotation.y += (midX - interaction.lastMidpoint.x) * 0.005;
            render.particles.rotation.x += (midY - interaction.lastMidpoint.y) * 0.005;
        }
        interaction.lastMidpoint.set(midX, midY);
    }
}

function onTouchEnd() {
    interaction.lastPinchDist = null;
    interaction.lastGestureEndTime = performance.now();
}

function onResize() {
    render.camera.aspect = window.innerWidth / window.innerHeight;
    render.camera.updateProjectionMatrix();
    render.renderer.setSize(window.innerWidth, window.innerHeight);
    const dpr = Math.min(window.devicePixelRatio, CONFIG.maxPixelRatio);
    render.renderer.setPixelRatio(dpr);
    uniforms.uPixelRatio.value = dpr;
}

// Highlight the active preset button, clear others
function setActivePreset(presetName) {
    const chips = document.querySelectorAll('.preset-chip');
    chips.forEach(chip => {
        if (chip.getAttribute('data-text') === presetName) {
            chip.classList.add('active');
        } else {
            chip.classList.remove('active');
        }
    });
}

// Clear all preset highlights
function clearActivePresets() {
    const chips = document.querySelectorAll('.preset-chip');
    chips.forEach(chip => {
        chip.classList.remove('active');
    });
}

// ─────────────────────────────────────────────
// UI Setup
// ─────────────────────────────────────────────
function setupUI() {
    const textInput = document.getElementById('text-input');
    const themeSelect = document.getElementById('theme-select');
    const fontSelect = document.getElementById('font-select');
    const captureBtn = document.getElementById('capture-btn');

    // Sync state to UI elements
    if (textInput) {
        textInput.value = state.currentText;
        updateCharCounter(state.currentText);

        textInput.addEventListener('input', () => {
            clearActivePresets(); // Typing clears preset active marks
            resetToDefaultExplosion(); // Typing resets preset physics details
            updateCharCounter(textInput.value);
            clearTimeout(interaction.inputDebounceTimer);
            interaction.inputDebounceTimer = setTimeout(() => {
                updateText(textInput.value);
            }, CONFIG.inputDebounceMs);
        });
    }

    if (themeSelect) {
        themeSelect.value = state.currentTheme;
        themeSelect.addEventListener('change', () => {
            clearActivePresets();
            resetToDefaultExplosion();
            selectTheme(themeSelect.value);
        });
    }

    if (fontSelect) {
        fontSelect.value = state.currentFont;
        fontSelect.addEventListener('change', () => {
            clearActivePresets();
            resetToDefaultExplosion();
            selectFont(fontSelect.value);
        });
    }

    // Capture functionality
    if (captureBtn) {
        captureBtn.addEventListener('click', () => {
            render.renderer.render(render.scene, render.camera);
            const dataURL = render.renderer.domElement.toDataURL('image/png');
            const link = document.createElement('a');
            const name = state.currentText.replace(/[^a-z0-9]/gi, '_').toLowerCase();
            link.download = `artz-sculpture-${name || 'kinetic'}.png`;
            link.href = dataURL;
            link.click();
        });
    }

    // Presets Row
    const chips = document.querySelectorAll('.preset-chip');
    chips.forEach(chip => {
        chip.addEventListener('click', () => {
            const presetVal = chip.getAttribute('data-text');
            
            // Set custom explosion dynamics and sound properties
            applyPresetExplosion(presetVal);
            setActivePreset(presetVal); // Highlight the selected preset chip
            
            // Trigger the unique explosion
            triggerExplosion();
        });
    });
}

// ─────────────────────────────────────────────
// Animation Loop
// ─────────────────────────────────────────────
function animate() {
    requestAnimationFrame(animate);

    const time = render.clock.getElapsedTime();
    const dt = Math.min(time - render.prevTime, 0.05); // cap at 50ms to prevent browser tab freeze math jumps
    render.prevTime = time;

    const { keys, invMatrix, lastGestureEndTime } = interaction;
    const { particles, camera } = render;

    // Keyboard rotation & controls
    if (particles) {
        if (keys.ArrowUp)    particles.rotation.x -= CONFIG.rotationStep;
        if (keys.ArrowDown)  particles.rotation.x += CONFIG.rotationStep;
        if (keys.ArrowLeft)  particles.rotation.y -= CONFIG.rotationStep;
        if (keys.ArrowRight) particles.rotation.y += CONFIG.rotationStep;

        const isKeyRotating = keys.ArrowUp || keys.ArrowDown || keys.ArrowLeft || keys.ArrowRight;
        const gestureGraceActive = (performance.now() - lastGestureEndTime) < CONFIG.autoReturnGracePeriodMs;
        if (!isKeyRotating && !interaction.lastPinchDist && !gestureGraceActive) {
            const lr = CONFIG.rotationAutoReturnLerp;
            particles.rotation.x = MathUtils.lerp(particles.rotation.x, 0, lr);
            particles.rotation.y = MathUtils.lerp(particles.rotation.y, 0, lr);
        }
    }

    // Zoom controls
    if (keys['+'] || keys['=']) render.targetZ -= CONFIG.zoomSpeed;
    if (keys['-']) render.targetZ += CONFIG.zoomSpeed;
    render.targetZ = MathUtils.clamp(render.targetZ, CONFIG.zoomMin, CONFIG.zoomMax);
    camera.position.z = MathUtils.lerp(camera.position.z, render.targetZ, CONFIG.zoomLerp);

    if (!particles) {
        render.renderer.render(render.scene, camera);
        return;
    }

    // Transform mouse coordinate system to local space
    invMatrix.copy(particles.matrixWorld).invert();
    interaction.mouseLocal.copy(interaction.mouseWorld).applyMatrix4(invMatrix);
    uniforms.uMouse.value.copy(interaction.mouseLocal);

    // ── CPU Physics Loop ───────────────────────────────────────
    const posAttr = particles.geometry.attributes.position;
    const pos = posAttr.array;
    const count = posAttr.count;
    const { posHome, springDisp, springVel, randomDir, randomSpeed } = physics;
    const mouseInfluence  = CONFIG.mouseInfluence;
    const mouseInfluence2 = mouseInfluence * mouseInfluence;
    const repulsionStr    = CONFIG.repulsionStrength;
    const ml = interaction.mouseLocal;

    // Damp calculations cached unless frame-time delta fluctuates significantly
    let kFrame, dampFrame;
    if (Math.abs(dt - render.prevDt) < 0.0001) {
        kFrame = render.prevKFrame;
        dampFrame = render.prevDampFrame;
    } else {
        kFrame = CONFIG.springK * (dt * 60);
        dampFrame = Math.pow(CONFIG.springDamping, dt * 60);
        render.prevDt = dt;
        render.prevKFrame = kFrame;
        render.prevDampFrame = dampFrame;
    }

    // Explosion calculations & progress interpolation
    let elapsed = -1;
    let progress = 0.0;
    if (physics.explosionStartTime > 0) {
        elapsed = time - physics.explosionStartTime;
        if (elapsed > state.totalExplosionDuration) {
            physics.explosionStartTime = -1;
            elapsed = -1;
        } else {
            // Calculate progress (0.0 -> 1.0 -> 0.0)
            if (elapsed < state.expansionDuration) {
                progress = elapsed / state.expansionDuration;
            } else {
                progress = 1.0 - (elapsed - state.expansionDuration) / state.contractionDuration;
            }
        }
    }
    uniforms.uExplosionProgress.value = progress;

    // Support reduced-motion mode (accessibility)
    const isMotionReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    for (let i = 0; i < count; i++) {
        const ix = i * 3, iy = ix + 1, iz = ix + 2;

        // 1. Base position (home + breathing wave if allowed + explosion offset)
        let bx = posHome[ix], by = posHome[iy], bz = posHome[iz];

        // Gentle floating breathing ripple to make the sculpture feel alive
        if (!isMotionReduced) {
            const breathingScale = time * 1.3 + i * 0.005;
            bx += Math.sin(breathingScale) * 0.12;
            by += Math.cos(breathingScale * 0.8) * 0.08;
            bz += Math.sin(breathingScale * 0.5) * 0.15;
        }

        if (elapsed > 0.0) {
            const maxDist = randomSpeed[i] * state.explosionMaxDistMultiplier;
            const rx = randomDir[ix], ry = randomDir[iy], rz = randomDir[iz];

            let dist;
            if (elapsed < state.expansionDuration) {
                // Expansion: quadratic ease-out
                const t = elapsed / state.expansionDuration;
                dist = maxDist * t * (2.0 - t);
            } else {
                // Contraction: cubic ease-in
                const t = (elapsed - state.expansionDuration) / state.contractionDuration;
                dist = maxDist * (1.0 - t * t * t);
            }
            bx += rx * dist;
            by += ry * dist;
            bz += rz * dist;
        }

        // 2. Mouse repulsion calculations with early-exit squared comparison
        const cur_x = pos[ix], cur_y = pos[iy], cur_z = pos[iz];
        const ddx = cur_x - ml.x;
        const ddy = cur_y - ml.y;
        const ddz = cur_z - ml.z;
        const d2 = ddx * ddx + ddy * ddy + ddz * ddz;

        let tdx = 0, tdy = 0, tdz = 0;
        if (d2 < mouseInfluence2 && d2 > 0.00001) {
            const d    = Math.sqrt(d2);
            const invD = 1.0 / d;
            const force = (mouseInfluence - d) / mouseInfluence;
            const push  = repulsionStr * force;
            tdx = ddx * invD * push;
            tdy = ddy * invD * push;
            tdz = ddz * invD * push;
        }

        // 3. Elastic spring physics - frame-rate-independent
        springVel[ix] = (springVel[ix] + (tdx - springDisp[ix]) * kFrame) * dampFrame;
        springVel[iy] = (springVel[iy] + (tdy - springDisp[iy]) * kFrame) * dampFrame;
        springVel[iz] = (springVel[iz] + (tdz - springDisp[iz]) * kFrame) * dampFrame;

        springDisp[ix] += springVel[ix];
        springDisp[iy] += springVel[iy];
        springDisp[iz] += springVel[iz];

        // 4. Write final updated coordinates
        pos[ix] = bx + springDisp[ix];
        pos[iy] = by + springDisp[iy];
        pos[iz] = bz + springDisp[iz];
    }

    posAttr.needsUpdate = true;
    render.renderer.render(render.scene, camera);
}

// ─────────────────────────────────────────────
// Initialisation
// ─────────────────────────────────────────────
async function init() {
    render.scene  = new Scene();
    render.camera = new PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    render.camera.position.z = render.targetZ;

    const dpr = Math.min(window.devicePixelRatio, CONFIG.maxPixelRatio);
    
    // Set preserveDrawingBuffer to true to enable screenshot captures
    render.renderer = new WebGLRenderer({
        antialias: true,
        alpha: false,
        powerPreference: 'high-performance',
        preserveDrawingBuffer: true
    });
    render.renderer.setClearColor(CONFIG.clearColor, 1);
    render.renderer.setSize(window.innerWidth, window.innerHeight);
    render.renderer.setPixelRatio(dpr);
    uniforms.uPixelRatio.value = dpr;

    const canvas = render.renderer.domElement;
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', 'Kinetic particle sculpture — interactive particle animation');
    document.body.appendChild(canvas);

    // [2.1] Wait for font assets before rasterizing text
    await document.fonts.ready.catch(() => {});

    // Parse URL params for persistent sculpture sharing
    const urlParams = new URLSearchParams(window.location.search);
    const initialText = urlParams.get('t') || 'Define your message!';
    const initialTheme = urlParams.get('theme') || 'ember';
    const initialFont = urlParams.get('font') || 'Outfit';

    state.currentText = initialText;
    state.currentTheme = initialTheme;
    state.currentFont = initialFont;

    // Apply initial state & check if text matches a preset
    const upperText = initialText.toUpperCase();
    if (CONFIG.presets[upperText] && upperText !== 'DEFAULT') {
        applyPresetExplosion(upperText);
        setActivePreset(upperText);
    } else {
        selectTheme(initialTheme);
        setupParticles(state.currentText, false);
    }
    setupUI();

    // Event Listeners
    window.addEventListener('pointermove', e => updateMouse(e.clientX, e.clientY));
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointerleave', () => {
        interaction.mouseWorld.set(-1000, -1000, 0);
        uniforms.uMouse.value.set(-1000, -1000, 0);
    });
    window.addEventListener('dblclick', e => {
        if (e.target.closest('#control-panel')) return;
        resetToDefaultExplosion(); // Double-clicks use default settings
        triggerExplosion();
    });
    window.addEventListener('touchstart', onTouchStart, { passive: false });
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd);
    window.addEventListener('resize', onResize);
    
    window.addEventListener('keydown', e => {
        interaction.keys[e.key] = true;
        if (e.code === 'Space') {
            if (document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'SELECT') {
                e.preventDefault();
                resetToDefaultExplosion(); // Keyboard spacebar uses default settings
                triggerExplosion();
            }
        }
    });
    window.addEventListener('keyup', e => interaction.keys[e.key] = false);

    // [3.4] URL debug auto-explode parameter
    if (import.meta.env.DEV) {
        if (urlParams.get('explode') === 'true') {
            setTimeout(triggerExplosion, 1000);
        }
    }

    animate();
}

init();
