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
// Named Configuration Constants
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
    autoReturnGracePeriodMs: 300,   // ms before auto-rotate re-engages after gesture

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
    tapWindowMs: 800,               // widened from 500ms
    inputDebounceMs: 150,           // debounce delay

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
            warm: [0.6, 1.0, 0.1], // adjusted warm slightly
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
// [1.2] mediaQuery Caching
// ─────────────────────────────────────────────
let isMotionReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', e => {
    isMotionReduced = e.matches;
});

// ─────────────────────────────────────────────
// Web Worker for Offloaded Physics Calculation
// ─────────────────────────────────────────────
let physicsWorker = null;

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
uniform float uTanHalfFov; // [4.2] Uniform instead of magic constant 0.7673

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
    float maxViewDist = -mvPosition.z * uTanHalfFov;
    float tSpectrum = clamp(viewDist / maxViewDist, 0.0, 1.0);
    
    // Map spectrum factor 0..1 to hue 0..0.666 (Red -> Orange -> Yellow -> Green -> Cyan -> Blue)
    vec3 spectrumColor = hueToRgb(tSpectrum * 0.666);

    vColor = mix(baseColor, spectrumColor, uExplosionProgress);

    // Size attenuation - corrected for device pixel ratio
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
    currentText: 'Bring your message!',
    currentTheme: 'ember',
    currentFont: 'Outfit',
    activePreset: null,  // Tracks which preset chip is currently selected

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
    isWorkerBusy: false,
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
    toastTimer: null,
    isDragging: false,
    prevMouseX: 0,
    prevMouseY: 0,
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
    uExplosionProgress: { value: 0.0 },
    uTanHalfFov: { value: Math.tan(75 * Math.PI / 360) } // [4.2] Uniform instead of magic constant
};

// ─────────────────────────────────────────────
// Toast Message Notification (UX Toast UI)
// ─────────────────────────────────────────────
function showToast(message) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(interaction.toastTimer);
    interaction.toastTimer = setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// ─────────────────────────────────────────────
// Screen Reader Accessibility Announcements
// ─────────────────────────────────────────────
function announceToScreenReader(message) {
    const el = document.getElementById('sr-announce');
    if (el) {
        el.textContent = message;
    }
}

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
// Particle Setup (Font Check + Capped Count + Worker Sync)
// ─────────────────────────────────────────────
let setupRequestId = 0;

async function setupParticles(text, shouldScatter = false) {
    setupRequestId++;
    const currentRequestId = setupRequestId;

    // [4.4] Pre-load custom fonts asynchronously to prevent fallback rendering pops
    const fontSpec = `bold ${CONFIG.fontSize}px "${state.currentFont}"`;
    if (!document.fonts.check(fontSpec)) {
        try {
            await document.fonts.load(fontSpec);
        } catch (err) {
            console.warn(`Failed to pre-load custom font "${state.currentFont}":`, err);
        }
    }

    // If another setup request started while waiting for fonts, drop this stale execution
    if (currentRequestId !== setupRequestId) return;

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
    if (!points) {
        showToast('Text must contain at least one visible character!');
        return;
    }

    const { density, jitterXY, jitterZ, explosionSpeedMin, explosionSpeedRange } = CONFIG;
    let count = points.length * density;
    let step = 1;

    // [1.3] Subsample points if overall particle count budget is exceeded
    const maxParticles = 30000;
    if (count > maxParticles) {
        const targetPoints = Math.floor(maxParticles / density);
        step = Math.max(1, Math.ceil(points.length / targetPoints));
    }

    const filteredPoints = [];
    for (let i = 0; i < points.length; i += step) {
        filteredPoints.push(points[i]);
    }

    const finalCount = filteredPoints.length * density;

    physics.posHome    = new Float32Array(finalCount * 3);
    physics.posLive    = new Float32Array(finalCount * 3);
    physics.springDisp = new Float32Array(finalCount * 3);
    physics.springVel  = new Float32Array(finalCount * 3);
    physics.randomDir  = new Float32Array(finalCount * 3);
    physics.randomSpeed = new Float32Array(finalCount);

    for (let i = 0; i < filteredPoints.length; i++) {
        const p = filteredPoints[i];
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

    // [1.1] Sync initialized positions to the Web Worker
    if (physicsWorker) {
        physicsWorker.postMessage({
            type: 'init',
            data: {
                posHome: physics.posHome,
                randomDir: physics.randomDir,
                randomSpeed: physics.randomSpeed
            }
        });
        physics.isWorkerBusy = false;
    }
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
    announceToScreenReader(`Explosion triggered for "${state.currentText}"`);
}

// ─────────────────────────────────────────────
// URL Parameter Synchronisation (Undo/Redo Support)
// ─────────────────────────────────────────────
function updateURLParams(text, theme, font, shouldPush = true) {
    const url = new URL(window.location);
    url.searchParams.set('t', text);
    url.searchParams.set('theme', theme);
    url.searchParams.set('font', font);
    if (shouldPush) {
        window.history.pushState({}, '', url);
    } else {
        window.history.replaceState({}, '', url);
    }
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

// Apply active preset's settings, or pick a random preset if none is selected.
// Used by dblclick / Space / multi-tap shortcuts.
function applyActiveOrRandomPreset() {
    if (state.activePreset) {
        // Settings already loaded when user clicked the preset chip — nothing to do.
        return;
    }
    // No preset selected: pick a random named preset (exclude DEFAULT).
    const namedPresets = Object.keys(CONFIG.presets).filter(k => k !== 'DEFAULT');
    const pick = namedPresets[Math.floor(Math.random() * namedPresets.length)];
    const preset = CONFIG.presets[pick];
    state.expansionDuration = preset.expansionDuration;
    state.contractionDuration = preset.contractionDuration;
    state.explosionMaxDistMultiplier = preset.explosionMaxDistMultiplier;
    state.soundPitch = preset.soundPitch;
    state.soundDuration = preset.soundDuration;
    state.soundType = preset.soundType;
}

function selectTheme(themeName, shouldPush = true) {
    const theme = CONFIG.themes[themeName] || CONFIG.themes.ember;
    state.currentTheme = themeName;
    uniforms.uColorHot.value.set(theme.hot[0], theme.hot[1], theme.hot[2]);
    uniforms.uColorWarm.value.set(theme.warm[0], theme.warm[1], theme.warm[2]);
    uniforms.uColorCold.value.set(theme.cold[0], theme.cold[1], theme.cold[2]);

    const themeSelect = document.getElementById('theme-select');
    if (themeSelect) themeSelect.value = themeName;

    updateURLParams(state.currentText, state.currentTheme, state.currentFont, shouldPush);
    announceToScreenReader(`Theme changed to ${themeName}`);
}

async function selectFont(fontName, shouldPush = true, shouldScatter = false) {
    state.currentFont = fontName;
    const fontSelect = document.getElementById('font-select');
    if (fontSelect) fontSelect.value = fontName;

    await setupParticles(state.currentText, shouldScatter);
    updateURLParams(state.currentText, state.currentTheme, state.currentFont, shouldPush);
    announceToScreenReader(`Font changed to ${fontName}`);
}

async function updateText(text, shouldPush = true) {
    const val = text.trim();
    const finalVal = val.length > 0 ? val : 'Bring your message!';
    state.currentText = finalVal;

    await setupParticles(finalVal, false);
    updateURLParams(state.currentText, state.currentTheme, state.currentFont, shouldPush);
    announceToScreenReader(`Text updated to "${state.currentText}"`);
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
async function applyPresetExplosion(presetName, shouldScatter = true) {
    const preset = CONFIG.presets[presetName] || CONFIG.presets.DEFAULT;
    
    state.expansionDuration = preset.expansionDuration;
    state.contractionDuration = preset.contractionDuration;
    state.explosionMaxDistMultiplier = preset.explosionMaxDistMultiplier;
    state.soundPitch = preset.soundPitch;
    state.soundDuration = preset.soundDuration;
    state.soundType = preset.soundType;

    // Apply specific theme and font to reinforce the preset identity
    if (preset.theme) selectTheme(preset.theme, true);
    if (preset.font) {
        await selectFont(preset.font, true, shouldScatter);
    } else {
        await setupParticles(state.currentText, shouldScatter);
    }
}

// ─────────────────────────────────────────────
// Pointer & Gesture Handlers
// ─────────────────────────────────────────────
function onPointerDown(e) {
    if (e.target.closest('#control-panel')) return;

    // Desktop mouse drag rotation start
    if (e.pointerType === 'mouse') {
        interaction.isDragging = true;
        interaction.prevMouseX = e.clientX;
        interaction.prevMouseY = e.clientY;
    }

    if (e.pointerType === 'touch' && !e.isPrimary) return;

    const now = performance.now();
    interaction.clickCount = (now - interaction.lastClickTime < CONFIG.tapWindowMs)
        ? interaction.clickCount + 1
        : 1;
    interaction.lastClickTime = now;

    if (interaction.clickCount >= CONFIG.tapCount) {
        applyActiveOrRandomPreset(); // Use active preset or random if none selected
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

// Reset desktop drag variables
function onPointerUp(e) {
    if (e.pointerType === 'mouse') {
        interaction.isDragging = false;
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
    state.activePreset = presetName;
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
    state.activePreset = null;
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
            interaction.inputDebounceTimer = setTimeout(async () => {
                await updateText(textInput.value);
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
        fontSelect.addEventListener('change', async () => {
            clearActivePresets();
            resetToDefaultExplosion();
            await selectFont(fontSelect.value);
        });
    }

    // Capture functionality ([1.4] safe with preserveDrawingBuffer: false because we run in the same tick)
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
        chip.addEventListener('click', async () => {
            const presetVal = chip.getAttribute('data-text');
            
            // Set custom explosion dynamics and sound properties
            await applyPresetExplosion(presetVal);
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
        if (!isKeyRotating && !interaction.lastPinchDist && !gestureGraceActive && !interaction.isDragging) {
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

    // Spring mechanics variables calculation
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

    // [1.1] Offload dense spring calculation loop to Web Worker (with CPU Fallback)
    if (physicsWorker) {
        if (!physics.isWorkerBusy) {
            physics.isWorkerBusy = true;
            physicsWorker.postMessage({
                type: 'update',
                data: {
                    posLive: physics.posLive,
                    springDisp: physics.springDisp,
                    springVel: physics.springVel,
                    count, dt, time, elapsed,
                    isMotionReduced,
                    mouseLocal: { x: ml.x, y: ml.y, z: ml.z },
                    kFrame, dampFrame,
                    expansionDuration: state.expansionDuration,
                    contractionDuration: state.contractionDuration,
                    explosionMaxDistMultiplier: state.explosionMaxDistMultiplier,
                    mouseInfluence,
                    repulsionStr
                }
            });
        }
    } else {
        // Local CPU Fallback (Main Thread)
        for (let i = 0; i < count; i++) {
            const ix = i * 3, iy = ix + 1, iz = ix + 2;
            let bx = posHome[ix], by = posHome[iy], bz = posHome[iz];

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
                    const t = elapsed / state.expansionDuration;
                    dist = maxDist * t * (2.0 - t);
                } else {
                    const t = (elapsed - state.expansionDuration) / state.contractionDuration;
                    dist = maxDist * (1.0 - t * t * t);
                }
                bx += rx * dist;
                by += ry * dist;
                bz += rz * dist;
            }

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

            springVel[ix] = (springVel[ix] + (tdx - springDisp[ix]) * kFrame) * dampFrame;
            springVel[iy] = (springVel[iy] + (tdy - springDisp[iy]) * kFrame) * dampFrame;
            springVel[iz] = (springVel[iz] + (tdz - springDisp[iz]) * kFrame) * dampFrame;

            springDisp[ix] += springVel[ix];
            springDisp[iy] += springVel[iy];
            springDisp[iz] += springVel[iz];

            pos[ix] = bx + springDisp[ix];
            pos[iy] = by + springDisp[iy];
            pos[iz] = bz + springDisp[iz];
        }
        posAttr.needsUpdate = true;
    }

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
    
    // [1.4] preserveDrawingBuffer defaulted to false for optimized frame double-buffering
    render.renderer = new WebGLRenderer({
        antialias: true,
        alpha: false,
        powerPreference: 'high-performance',
        preserveDrawingBuffer: false
    });
    render.renderer.setClearColor(CONFIG.clearColor, 1);
    render.renderer.setSize(window.innerWidth, window.innerHeight);
    render.renderer.setPixelRatio(dpr);
    uniforms.uPixelRatio.value = dpr;

    const canvas = render.renderer.domElement;
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', 'Kinetic particle sculpture — interactive particle animation');
    document.body.appendChild(canvas);

    // Initialize physics Web Worker
    try {
        physicsWorker = new Worker(new URL('./physics.worker.js', import.meta.url), {
            type: 'module'
        });
        physicsWorker.onmessage = function (e) {
            const { type, posLive, springDisp, springVel } = e.data;
            if (type === 'update') {
                physics.posLive = posLive;
                physics.springDisp = springDisp;
                physics.springVel = springVel;
                
                if (render.particles) {
                    const posAttr = render.particles.geometry.attributes.position;
                    posAttr.array = physics.posLive;
                    posAttr.needsUpdate = true;
                }
                physics.isWorkerBusy = false;
            }
        };
    } catch (err) {
        console.error('Failed to initialize physics Web Worker:', err);
    }

    // Wait for font assets before rasterizing text
    await document.fonts.ready.catch(() => {});

    // Parse URL params for persistent sculpture sharing
    const urlParams = new URLSearchParams(window.location.search);
    const initialText = urlParams.get('t') || 'Bring your message!';
    const initialTheme = urlParams.get('theme') || 'ember';
    const initialFont = urlParams.get('font') || 'Outfit';

    state.currentText = initialText;
    state.currentTheme = initialTheme;
    state.currentFont = initialFont;

    // Apply initial state & check if text matches a preset
    const upperText = initialText.toUpperCase();
    if (CONFIG.presets[upperText] && upperText !== 'DEFAULT') {
        await applyPresetExplosion(upperText, false);
        setActivePreset(upperText);
    } else {
        selectTheme(initialTheme, false);
        await setupParticles(state.currentText, false);
    }
    setupUI();

    // Event Listeners
    window.addEventListener('pointermove', e => {
        updateMouse(e.clientX, e.clientY);
        if (interaction.isDragging && e.pointerType === 'mouse') {
            const dx = e.clientX - interaction.prevMouseX;
            const dy = e.clientY - interaction.prevMouseY;
            if (render.particles) {
                render.particles.rotation.y += dx * 0.005;
                render.particles.rotation.x += dy * 0.005;
            }
            interaction.prevMouseX = e.clientX;
            interaction.prevMouseY = e.clientY;
            interaction.lastGestureEndTime = performance.now();
        }
    });
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
    window.addEventListener('pointerleave', () => {
        interaction.mouseWorld.set(-1000, -1000, 0);
        uniforms.uMouse.value.set(-1000, -1000, 0);
        interaction.isDragging = false;
    });
    window.addEventListener('dblclick', e => {
        if (e.target.closest('#control-panel')) return;
        applyActiveOrRandomPreset(); // Use active preset or random if none selected
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
                applyActiveOrRandomPreset(); // Use active preset or random if none selected
                triggerExplosion();
            }
        }
    });
    window.addEventListener('keyup', e => interaction.keys[e.key] = false);

    // [2.3] State History navigation back/forward support
    window.addEventListener('popstate', async () => {
        const params = new URLSearchParams(window.location.search);
        const t = params.get('t') || 'Bring your message!';
        const theme = params.get('theme') || 'ember';
        const font = params.get('font') || 'Outfit';

        state.currentText = t;
        state.currentTheme = theme;
        state.currentFont = font;

        const textInput = document.getElementById('text-input');
        if (textInput) {
            textInput.value = t;
            updateCharCounter(t);
        }

        // Apply state updates silently to prevent loop recursion
        selectTheme(theme, false);
        await selectFont(font, false);

        const upper = t.toUpperCase();
        if (CONFIG.presets[upper] && upper !== 'DEFAULT') {
            setActivePreset(upper);
        } else {
            clearActivePresets();
        }
    });

    // URL debug auto-explode parameter
    if (import.meta.env.DEV) {
        if (urlParams.get('explode') === 'true') {
            setTimeout(triggerExplosion, 1000);
        }
    }

    animate();
}

init();
