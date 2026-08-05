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
    DynamicDrawUsage,
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

    // Explosion coloring & recovery (fixed across presets)
    // heatDistance: world distance at which a particle is fully "hot" (red).
    // Computed as 1/3 of the visible screen height at the default camera depth:
    // (1/3) * 2 * initialZ * tan(fov/2), where fov = 75 and initialZ = 35.
    heatDistance: (2 / 3) * 35 * Math.tan(75 * Math.PI / 360),
    // maxContractionVelocity: recovery duration = distance / velocity, so bigger
    // explosions take proportionally longer to recover (world units per second).
    maxContractionVelocity: 7,
    contractionDurationMin: 0.8,
    contractionDurationMax: 10,

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
uniform float uExplosionActive;
uniform float uHeatDistance;
uniform vec3 uHeatCold;
uniform vec3 uHeatWarm;
uniform vec3 uHeatHot;

attribute vec3 homePosition;

varying vec3 vColor;

void main() {
    // Smooth heatmap based on mouse proximity and dynamic colors (used while idle).
    float r = clamp(distance(uMouse, position) / uMouseInfluence, 0.0, 1.0);
    vec3 baseColor = (r < 0.5)
        ? mix(uColorHot, uColorWarm, r * 2.0)
        : mix(uColorWarm, uColorCold, (r - 0.5) * 2.0);

    // Movement heatmap: cooler (blue) near the particle's OWN initial position, hotter
    // (red) the further it has been displaced, with yellow in between. Independent of
    // screen/message center, zoom and rotation because homePosition is in the same
    // local space as position. Uses a fixed blue-yellow-red palette for every preset.
    float movement = length(position - homePosition);
    float heat = smoothstep(0.05, uHeatDistance, movement);
    vec3 movementColor = (heat < 0.5)
        ? mix(uHeatCold, uHeatWarm, heat * 2.0)
        : mix(uHeatWarm, uHeatHot, (heat - 0.5) * 2.0);

    // During an explosion every particle is colored purely by displacement (no idle
    // theme/mouse white bleeding in); otherwise fall back to the mouse heatmap.
    vColor = mix(baseColor, movementColor, step(0.5, uExplosionActive));

    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;

    // Size attenuation - corrected for device pixel ratio
    gl_PointSize = uPointSize * uPixelRatio * (${CONFIG.pointSizeAttenuationScale.toFixed(1)} / -mvPosition.z);
}
`;

const fragmentShader = `
varying vec3 vColor;

void main() {
    // Soft circular falloff so points look smooth without MSAA (antialias: false).
    vec2 cxy = 2.0 * gl_PointCoord - 1.0;
    float r = dot(cxy, cxy);
    if (r > 1.0) discard;
    float alpha = 0.9 * (1.0 - smoothstep(0.0, 1.0, r));
    gl_FragColor = vec4(vColor, alpha);
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

    // Dynamic per-explosion properties
    expansionDuration: CONFIG.presets.DEFAULT.expansionDuration,
    contractionDuration: CONFIG.presets.DEFAULT.contractionDuration,
    explosionMaxDistMultiplier: CONFIG.presets.DEFAULT.explosionMaxDistMultiplier,
    activeExpansionDuration: null,
    activeContractionDuration: null,
    activeMaxDist: null,
    soundPitch: CONFIG.presets.DEFAULT.soundPitch,
    soundDuration: CONFIG.presets.DEFAULT.soundDuration,
    soundType: CONFIG.presets.DEFAULT.soundType,

    get totalExplosionDuration() {
        const exp = this.activeExpansionDuration || this.expansionDuration;
        const con = this.activeContractionDuration || this.contractionDuration;
        return exp + con;
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
    posLive: null,      // Resident geometry buffer (never transferred)
    springDisp: null,   // Spring displacement
    springVel: null,    // Spring velocity
    randomDir: null,    // Explosion direction per particle
    randomSpeed: null,  // Explosion speed per particle
    slots: [],          // Double-buffered working sets transferred to the worker
    sendQueue: [],      // FIFO of slots currently in flight at the worker
    seq: 0,             // Monotonic token echoed by the worker to pair replies
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
    toastTimer: null,
    isDragging: false,
    prevMouseX: 0,
    prevMouseY: 0,
    pendingPointer: null, // Coalesced latest pointer coords, consumed once per frame
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
    uExplosionActive: { value: 0.0 },
    // Fixed motion-heat distance for every preset (red = 1/3 screen height at rest).
    uHeatDistance: { value: CONFIG.heatDistance },
    // Fixed motion heatmap used by every preset: cold = blue, mid = yellow, hot = red.
    uHeatCold: { value: new Vector3(0.1, 0.4, 1.0) },
    uHeatWarm: { value: new Vector3(1.0, 1.0, 0.1) },
    uHeatHot: { value: new Vector3(1.0, 0.1, 0.1) }
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
// Cached broadband noise buffer shared by every explosion's body/crackle layers.
let noiseBuffer = null;
function createNoiseBuffer(ctx) {
    if (noiseBuffer) return noiseBuffer;
    const length = ctx.sampleRate * 2;
    noiseBuffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
        data[i] = Math.random() * 2 - 1;
    }
    return noiseBuffer;
}

function playExplosionSound() {
    try {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }

        const now  = audioCtx.currentTime;
        const dur  = state.soundDuration * (0.85 + Math.random() * 0.3);
        const pitch = state.soundPitch * (0.85 + Math.random() * 0.3);
        const type = state.soundType;

        // Sawtooth presets behave as bigger/harsher booms; sine as deep & clean.
        const heavy = type === 'sawtooth';

        // Master stage: everything funnels through one gain with a short attack so
        // the blast starts punchy but never clicks, and decays to a clean stop.
        const master = audioCtx.createGain();
        master.gain.setValueAtTime(0.0001, now);
        master.gain.exponentialRampToValueAtTime(0.9, now + 0.014);
        master.gain.setValueAtTime(0.9, now + dur * 0.45);
        master.gain.exponentialRampToValueAtTime(0.0001, now + dur);
        master.connect(audioCtx.destination);

        // Low-end hygiene: trim subsonic rumble so the thump stays tight.
        const lowCut = audioCtx.createBiquadFilter();
        lowCut.type = 'highpass';
        lowCut.frequency.value = 20;
        lowCut.connect(master);

        const toDisconnect = [master, lowCut];

        // ── 1) Sub thump: the low "boom" that gives the blast weight. ──────────────
        const subFreq = Math.max(26, pitch * 0.5);
        const thump = audioCtx.createOscillator();
        const thumpGain = audioCtx.createGain();
        thump.type = 'sine';
        thump.frequency.setValueAtTime(subFreq * 2.4, now);
        thump.frequency.exponentialRampToValueAtTime(subFreq, now + 0.18);
        thumpGain.gain.setValueAtTime(0.95, now);
        thumpGain.gain.exponentialRampToValueAtTime(0.0001, now + Math.min(0.4, dur * 0.55));
        thump.connect(thumpGain);
        thumpGain.connect(lowCut);
        thump.start(now);
        thump.stop(now + 0.45);
        toDisconnect.push(thump, thumpGain);

        // ── 2) Body: the broadband rumble = noise through a sweeping lowpass. ─────
        const body = audioCtx.createBufferSource();
        body.buffer = createNoiseBuffer(audioCtx);
        body.loop = true;
        const bodyFilt = audioCtx.createBiquadFilter();
        bodyFilt.type = 'lowpass';
        bodyFilt.frequency.setValueAtTime(heavy ? pitch * 4.5 : pitch * 2.8, now);
        bodyFilt.frequency.exponentialRampToValueAtTime(Math.max(45, pitch * 0.5), now + dur);
        bodyFilt.Q.value = 0.8;
        const bodyGain = audioCtx.createGain();
        const bodyLevel = heavy ? 0.6 : type === 'sine' ? 0.46 : 0.54;
        bodyGain.gain.setValueAtTime(0.0001, now);
        bodyGain.gain.exponentialRampToValueAtTime(bodyLevel, now + 0.025);
        bodyGain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
        body.connect(bodyFilt);
        bodyFilt.connect(bodyGain);
        bodyGain.connect(lowCut);
        body.start(now);
        body.stop(now + dur + 0.06);
        toDisconnect.push(body, bodyFilt, bodyGain);

        // ── 3) Transient tone: a fast pitch-swept sine that punches the leading edge.
        const tone = audioCtx.createOscillator();
        const toneFilter = audioCtx.createBiquadFilter();
        const toneGain = audioCtx.createGain();
        tone.type = 'sine';
        tone.frequency.setValueAtTime(heavy ? pitch * 6 : pitch * 4, now);
        tone.frequency.exponentialRampToValueAtTime(pitch * 0.9, now + 0.12);
        toneFilter.type = 'lowpass';
        toneFilter.frequency.value = heavy ? 3000 : 2200;
        toneGain.gain.setValueAtTime(0.28, now);
        toneGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
        tone.connect(toneFilter);
        toneFilter.connect(toneGain);
        toneGain.connect(lowCut);
        tone.start(now);
        tone.stop(now + 0.2);
        toDisconnect.push(tone, toneFilter, toneGain);

        // ── 4) Crackle: a short high-passed noise burst for the snapping tail. ────
        const crackle = audioCtx.createBufferSource();
        crackle.buffer = createNoiseBuffer(audioCtx);
        crackle.loop = true;
        const crackFilt = audioCtx.createBiquadFilter();
        crackFilt.type = 'highpass';
        crackFilt.frequency.value = heavy ? 2600 : 1800;
        const crackGain = audioCtx.createGain();
        crackGain.gain.setValueAtTime(0.15, now);
        crackGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
        crackle.connect(crackFilt);
        crackFilt.connect(crackGain);
        crackGain.connect(master);
        crackle.start(now);
        crackle.stop(now + 0.22);
        toDisconnect.push(crackle, crackFilt, crackGain);

        // Release all nodes once the explosion has fully decayed.
        setTimeout(() => {
            for (const node of toDisconnect) {
                try { node.disconnect(); } catch (_) { /* already ended */ }
            }
        }, (dur + 0.15) * 1000);

    } catch (err) {
        console.warn('Audio synthesis initialized with error:', err);
    }
}

// ─────────────────────────────────────────────
// Font Loading Optimization
// ─────────────────────────────────────────────
const loadedFonts = new Set(['Outfit']);

async function ensureFontLoaded(fontFamily) {
    if (loadedFonts.has(fontFamily)) return;
    const fontUrls = {
        'Fira Code': 'https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;600&display=swap',
        'Pacifico': 'https://fonts.googleapis.com/css2?family=Pacifico&display=swap',
        'Playfair Display': 'https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400&display=swap'
    };
    if (fontUrls[fontFamily]) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = fontUrls[fontFamily];
        document.head.appendChild(link);
        loadedFonts.add(fontFamily);
    }
}

// ─────────────────────────────────────────────
// Text Rasterization (Reusing single offscreen canvas)
// ─────────────────────────────────────────────
let offscreenCanvas = null;
let offscreenCtx = null;

function sampleTextPoints(text) {
    if (!offscreenCanvas) {
        offscreenCanvas = document.createElement('canvas');
        offscreenCtx = offscreenCanvas.getContext('2d', { willReadFrequently: true });
    }
    const canvas = offscreenCanvas;
    const ctx = offscreenCtx;

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

    // Pre-load custom fonts asynchronously on demand
    await ensureFontLoaded(state.currentFont);
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

    // Subsample points if overall particle count budget is exceeded
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

    // Build fresh double-buffered worker working sets below (after resident buffers
    // are populated), since any prior in-flight slots have been transferred away.

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

    // Double-buffered worker working sets ("slots"): these buffers are transferred to
    // the physics worker. They are kept SEPARATE from the resident geometry buffers
    // above, because transferring detaches the buffer and would otherwise leave the
    // geometry's position attribute empty/detached during rendering (=> NaN radius).
    // Two slots allow the worker to keep computing while the main thread renders the
    // most recent completed result, so a slow worker no longer freezes the simulation.
    physics.slots = [];
    physics.sendQueue = [];
    for (let s = 0; s < 2; s++) {
        const slot = {
            posLive: new Float32Array(finalCount * 3),
            springDisp: new Float32Array(finalCount * 3),
            springVel: new Float32Array(finalCount * 3),
            inFlight: false
        };
        slot.posLive.set(physics.posLive);
        slot.springDisp.set(physics.springDisp);
        slot.springVel.set(physics.springVel);
        physics.slots.push(slot);
    }

    const geo = new BufferGeometry();
    const posAttr = new BufferAttribute(physics.posLive, 3);
    posAttr.setUsage(DynamicDrawUsage);
    geo.setAttribute('position', posAttr);
    // Static per-particle rest positions, used by the shader to color by displacement.
    geo.setAttribute('homePosition', new BufferAttribute(physics.posHome, 3));

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

    // Sync initialized positions to the Web Worker
    if (physicsWorker) {
        physicsWorker.postMessage({
            type: 'init',
            data: {
                posHome: physics.posHome,
                randomDir: physics.randomDir,
                randomSpeed: physics.randomSpeed
            }
        });
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
// Explosion Vector & Parameter Randomization
// ─────────────────────────────────────────────
function randomizeExplosionVectors() {
    if (!physics.randomDir || !physics.randomSpeed) return;
    const count = physics.randomSpeed.length;
    const { explosionSpeedMin, explosionSpeedRange } = CONFIG;

    // Pick a randomized explosion pattern for this blast (0: Spherical Chaos, 1: Vortex Swirl, 2: Directional Blast, 3: Cluster Burst)
    const style = Math.floor(Math.random() * 4);
    const biasX = (Math.random() - 0.5) * 2;
    const biasY = (Math.random() - 0.5) * 2;
    const biasZ = (Math.random() - 0.5) * 2;
    const swirlPower = (Math.random() - 0.5) * 2.5;

    for (let i = 0; i < count; i++) {
        const ix = i * 3, iy = ix + 1, iz = ix + 2;

        let theta = Math.random() * Math.PI * 2;
        let phi   = Math.acos((Math.random() * 2) - 1);

        let rx = Math.sin(phi) * Math.cos(theta);
        let ry = Math.sin(phi) * Math.sin(theta);
        let rz = Math.cos(phi);

        if (style === 1) {
            // Vortex Swirl pattern around Z axis
            const currentAngle = Math.atan2(ry, rx) + swirlPower;
            const radius = Math.sqrt(rx * rx + ry * ry);
            rx = Math.cos(currentAngle) * radius;
            ry = Math.sin(currentAngle) * radius;
        } else if (style === 2) {
            // Directional Blast pattern
            rx = rx * 0.35 + biasX * 0.65;
            ry = ry * 0.35 + biasY * 0.65;
            rz = rz * 0.35 + biasZ * 0.65;
            const len = Math.sqrt(rx * rx + ry * ry + rz * rz) || 1;
            rx /= len; ry /= len; rz /= len;
        } else if (style === 3) {
            // Cluster Burst pattern
            const cluster = 0.5 + 0.5 * Math.sin(i * 0.08);
            physics.randomSpeed[i] = (explosionSpeedMin + Math.random() * explosionSpeedRange) * (0.4 + cluster);
        }

        if (style !== 3) {
            const speedVar = 0.75 + Math.random() * 0.55;
            physics.randomSpeed[i] = (explosionSpeedMin + Math.random() * explosionSpeedRange) * speedVar;
        }

        physics.randomDir[ix] = rx;
        physics.randomDir[iy] = ry;
        physics.randomDir[iz] = rz;
    }
}

function triggerExplosion() {
    if (physics.explosionStartTime >= 0) return;

    // Randomize active timing and distance multipliers per blast
    state.activeMaxDist = state.explosionMaxDistMultiplier * (0.8 + Math.random() * 0.4);
    state.activeExpansionDuration = state.expansionDuration * (0.85 + Math.random() * 0.3);

    // Recovery is purely distance-driven with a capped velocity: bigger explosions
    // (larger activeMaxDist) take proportionally longer to contract and are clearly
    // recognisable as slower to recover.
    state.activeContractionDuration = MathUtils.clamp(
        state.activeMaxDist / CONFIG.maxContractionVelocity,
        CONFIG.contractionDurationMin,
        CONFIG.contractionDurationMax
    );

    if (physicsWorker) {
        // Re-randomize particle trajectory vectors/speeds inside the worker, so the
        // 30k-particle trig loop never hitches the main thread at blast time.
        physicsWorker.postMessage({
            type: 'randomize',
            data: {
                explosionSpeedMin: CONFIG.explosionSpeedMin,
                explosionSpeedRange: CONFIG.explosionSpeedRange
            }
        });
    } else {
        randomizeExplosionVectors();
    }

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

    // Consume the coalesced pointer (once per frame) — unproject + drag math run here.
    if (interaction.pendingPointer) {
        const p = interaction.pendingPointer;
        updateMouse(p.clientX, p.clientY);
        if (interaction.isDragging && p.pointerType === 'mouse') {
            const dx = p.clientX - interaction.prevMouseX;
            const dy = p.clientY - interaction.prevMouseY;
            if (render.particles) {
                render.particles.rotation.y += dx * 0.005;
                render.particles.rotation.x += dy * 0.005;
            }
            interaction.prevMouseX = p.clientX;
            interaction.prevMouseY = p.clientY;
            interaction.lastGestureEndTime = performance.now();
        }
        interaction.pendingPointer = null;
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
    const activeExpDuration = state.activeExpansionDuration || state.expansionDuration;
    const activeContrDuration = state.activeContractionDuration || state.contractionDuration;
    const activeMaxDistMult = state.activeMaxDist || state.explosionMaxDistMultiplier;

    if (physics.explosionStartTime > 0) {
        elapsed = time - physics.explosionStartTime;
        if (elapsed > state.totalExplosionDuration) {
            physics.explosionStartTime = -1;
            elapsed = -1;
        } else {
            // Calculate progress (0.0 -> 1.0 -> 0.0)
            if (elapsed < activeExpDuration) {
                progress = elapsed / activeExpDuration;
            } else {
                progress = 1.0 - (elapsed - activeExpDuration) / activeContrDuration;
            }
        }
    }
    uniforms.uExplosionProgress.value = progress;
    // Explosion active flag: while a blast is in flight every particle is colored
    // purely by displacement (fixed #2 thresholds); otherwise idle colors resume.
    uniforms.uExplosionActive.value = (physics.explosionStartTime >= 0) ? 1.0 : 0.0;
    if (render.particles) {
        render.particles.frustumCulled = (progress === 0.0);
    }

    // Offload dense spring calculation loop to Web Worker (with CPU Fallback).
    // Double-buffered dispatch: send any free slot (no busy-wait), so a momentarily
    // slow worker never drops or freezes the simulation — it simply falls a frame
    // behind while the main thread renders the most recent completed result.
    if (physicsWorker) {
        let slot = null;
        for (const s of physics.slots) {
            if (!s.inFlight) { slot = s; break; }
        }
        if (slot) {
            slot.inFlight = true;
            slot.seq = physics.seq++;
            physics.sendQueue.push(slot);
            physicsWorker.postMessage({
                type: 'update',
                data: {
                    posLive: slot.posLive,
                    springDisp: slot.springDisp,
                    springVel: slot.springVel,
                    count, dt, time, elapsed,
                    isMotionReduced,
                    mouseLocal: { x: ml.x, y: ml.y, z: ml.z },
                    kFrame, dampFrame,
                    expansionDuration: activeExpDuration,
                    contractionDuration: activeContrDuration,
                    explosionMaxDistMultiplier: activeMaxDistMult,
                    mouseInfluence,
                    repulsionStr
                },
                seq: slot.seq
            }, [slot.posLive.buffer, slot.springDisp.buffer, slot.springVel.buffer]);
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
                const maxDist = randomSpeed[i] * activeMaxDistMult;
                const rx = randomDir[ix], ry = randomDir[iy], rz = randomDir[iz];
                let dist;
                if (elapsed < activeExpDuration) {
                    const t = elapsed / activeExpDuration;
                    dist = maxDist * t * (2.0 - t);
                } else {
                    const t = (elapsed - activeExpDuration) / activeContrDuration;
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
    // [4] antialias:false — point sprites get their smooth edges from the shader's soft
    // circular falloff (see fragmentShader), so full-framebuffer MSAA here is wasted cost.
    render.renderer = new WebGLRenderer({
        antialias: false,
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
            const { type, seq, posLive, springDisp, springVel } = e.data;
            if (type === 'update') {
                // Pair the reply with the matching in-flight slot via its sequence token.
                // Stale replies (e.g. from a buffer set invalidated by a text change) are
                // discarded without corrupting the slot queue.
                let idx = -1;
                for (let i = 0; i < physics.sendQueue.length; i++) {
                    if (physics.sendQueue[i].seq === seq) { idx = i; break; }
                }
                if (idx === -1) return;

                const slot = physics.sendQueue.splice(idx, 1)[0];
                slot.inFlight = false;
                slot.posLive = posLive;
                slot.springDisp = springDisp;
                slot.springVel = springVel;

                // The resident geometry buffers are never transferred, so they stay valid
                // during rendering. Copy the freshly computed slot into them.
                const posAttr = render.particles && render.particles.geometry.attributes.position;
                if (posAttr && posAttr.array.length === posLive.length) {
                    posAttr.array.set(posLive);
                    posAttr.needsUpdate = true;
                }
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
    // pointermove only records the latest coordinates; the actual unproject + drag
    // math runs once per frame in animate(), so high-Hz input never fires per-event work.
    window.addEventListener('pointermove', e => {
        interaction.pendingPointer = {
            clientX: e.clientX,
            clientY: e.clientY,
            pointerType: e.pointerType
        };
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
