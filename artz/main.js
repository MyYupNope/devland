import {
    Clock,
    OrthographicCamera,
    Scene,
    WebGLRenderer,
    Points,
    BufferGeometry,
    BufferAttribute,
    ShaderMaterial,
    AdditiveBlending,
    NormalBlending,
    DynamicDrawUsage,
    Vector3,
    Vector2,
    Matrix4,
    MathUtils
} from 'three';

// ─────────────────────────────────────────────
// Named Configuration Constants
// ─────────────────────────────────────────────
// Frustum angle that mirrors the old perspective camera's framing.
const CAMERA_ANGLE_DEG = 75;

const CONFIG = {
    // Camera
    initialZ: 35,
    cameraAngleDeg: CAMERA_ANGLE_DEG, // Orthographic frustum angle that mirrors the old perspective view
    zoomMin: 10,
    zoomMax: 120,
    // Message-type auto-zoom: emojis render at the farthest zoom (smallest
    // display), while text fills most of the desktop stage. Both are overridden
    // once the user zooms manually.
    textAutoZoom: 45,
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

    // Emoji MESSAGE options (picked from the UI list). Emojis render at high
    // resolution with an edge + interior sampling pass so both the silhouette
    // and inner details (eyes, holes, rings) stay recognizable.
    emojiOptions: [
        '😀', '😂', '😍', '🥰', '😎', '🤔', '😭', '😡', '😱', '🥳',
        '👍', '👎', '👏', '🙏', '👌', '💪', '❤️', '🔥', '✨', '🎉'
    ],
    emojiRasterSize: 320,     // canvas edge for a single emoji (px)
    emojiFontSize: 280,       // glyph size within the emoji raster (px)
    emojiEdgeStep: 1,         // feature/silhouette edge samples (full density)
    emojiInteriorStep: 2,     // interior fill samples (halves density, keeps detail)
    emojiDensityOverride: 1,  // one particle per sampled cell → max detail under the cap
    emojiColorEdgeThreshold: 64, // max RGB-channel delta that marks an internal color boundary
    emojiJitterXY: 0.03,      // flatter layout so thin features (tears, eyes) stay continuous
    emojiJitterZ: 0.6,        // shallow depth band: keeps volume without breaking detail
    emojiDepthCue: 0.06,      // near-flat depth shading for emoji particles
    emojiPointSize: 1.6,      // sprite base size covering interior sample cells
    emojiMotionMix: 0.35,     // how much of the explosion heat palette blends into emoji colors

    // Particles
    density: 8,
    jitterXY: 0.08,
    jitterZ: 2.5, // Depth thickness. Safe with the orthographic camera: parallel
                  // projection has no keystone shear, so edge glyphs stay straight
                  // while the sculpture still has 3D volume.

    // Explosion speeds
    explosionSpeedMin: 0.4,
    explosionSpeedRange: 0.8,

    // Explosion coloring & recovery (fixed across presets)
    // heatDistance: world distance at which a particle is fully "hot" (red).
    // Computed as 1/3 of the visible screen height at the default camera depth:
    // (1/3) * 2 * initialZ * tan(fov/2), where fov = 75 and initialZ = 35.
    heatDistance: (2 / 3) * 35 * Math.tan(CAMERA_ANGLE_DEG * Math.PI / 360),
    // maxContractionVelocity: recovery duration = distance / velocity, so bigger
    // explosions take proportionally longer to recover (world units per second).
    maxContractionVelocity: 7,
    contractionDurationMin: 0.8,
    contractionDurationMax: 10,
    contractionDurationFloor: 0.3,
    afterglowDuration: 0.2,

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

    // Unique preset configurations for custom particle physics and Web Audio properties.
    // Pattern styles: 0 = uniform sphere (Explode), 1 = tangential vortex (Galaxy),
    // 2 = coherent wind gust (Breeze), 3 = crisp starburst rays (Kinetic).
    presets: {
        KINETIC: {
            theme: 'neon',
            font: 'Fira Code',
            expansionDuration: 1.1,
            contractionDuration: 1.8,
            explosionMaxDistMultiplier: 25.0,
            motionStyle: 3, // starburst rays
            spokes: 12,
            spokeJitter: 0.03,
            trailStrength: 0.6,
            heat: {
                cold: [0.85, 0.9, 1.0],
                warm: [1.0, 0.95, 0.8],
                hot: [1.0, 1.0, 1.0]
            },
            emberBudget: 90,
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
            motionStyle: 1, // tangential vortex
            spinSpeed: 2.0,
            diskFlatten: 0.25,
            trailStrength: 0.35,
            heat: {
                cold: [0.05, 0.15, 0.55],
                warm: [0.25, 0.65, 1.0],
                hot: [0.85, 0.95, 1.0]
            },
            emberBudget: 70,
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
            motionStyle: 2, // coherent wind gust
            gustCoherence: 0.75,
            swayAmp: 0.35,
            swayFreq: 0.5,
            trailStrength: 0.08,
            heat: {
                cold: [0.05, 0.35, 0.2],
                warm: [0.45, 0.85, 0.35],
                hot: [0.85, 1.0, 0.6]
            },
            emberBudget: 40,
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
            motionStyle: 0, // uniform sphere
            trailStrength: 0.3,
            heat: {
                cold: [0.45, 0.05, 0.05],
                warm: [1.0, 0.45, 0.08],
                hot: [1.0, 0.85, 0.4]
            },
            emberBudget: 140,
            soundPitch: 110,
            soundDuration: 1.6,
            soundType: 'sine'
        },
        DEFAULT: {
            expansionDuration: 2.0,
            contractionDuration: 4.0,
            explosionMaxDistMultiplier: 15.0,
            motionStyle: -1, // random per blast
            spokes: 12,
            spokeJitter: 0.03,
            spinSpeed: 0,
            diskFlatten: 0,
            gustCoherence: 0,
            swayAmp: 0,
            swayFreq: 0,
            trailStrength: 0.25,
            heat: {
                cold: [0.1, 0.4, 1.0],
                warm: [1.0, 1.0, 0.1],
                hot: [1.0, 0.1, 0.1]
            },
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

// Number of leading particles whose generated blast directions are echoed back from
// the worker to the main thread (and kept by the CPU fallback) for the pattern
// regression tests. Deterministic pattern verification with zero timing sensitivity.
const DIRECTIONS_VERIFY = 384;

// Tracks the actual travel radius in the CPU-fallback path (worker path uses its own).
let fallbackMaxTravelSq = 0;

// ─────────────────────────────────────────────
// Shaders
// ─────────────────────────────────────────────
const vertexShader = `
uniform vec3 uMouse;
uniform float uMouseInfluence;
uniform float uPointSize;
uniform float uPixelRatio;
uniform float uPointScale;
uniform float uDepthCue;
uniform vec3 uColorHot;
uniform vec3 uColorWarm;
uniform vec3 uColorCold;
uniform float uExplosionProgress;
uniform float uExplosionActive;
uniform float uHeatDistance;
uniform vec3 uHeatCold;
uniform vec3 uHeatWarm;
uniform vec3 uHeatHot;
uniform float uAudioBass;
uniform float uAudioMid;
uniform float uAudioHigh;
uniform float uAudioEnvelope;
uniform float uEmojiMode;
uniform float uEmojiMotionMix;

attribute vec3 homePosition;
attribute vec4 sourceColor;
attribute float sampleSize;

varying vec3 vColor;
varying float vCoverage;

void main() {
    // Smooth heatmap based on mouse proximity and dynamic colors (used while idle).
    float r = clamp(distance(uMouse, position) / uMouseInfluence, 0.0, 1.0);
    vec3 themeColor = (r < 0.5)
        ? mix(uColorHot, uColorWarm, r * 2.0)
        : mix(uColorWarm, uColorCold, (r - 0.5) * 2.0);

    // Emoji mode keeps the sampled glyph color (eyes, tears, mouth, hearts stay
    // readable); text mode keeps the theme heatmap exactly as before.
    vec3 baseColor = mix(themeColor, sourceColor.rgb, uEmojiMode);

    // Movement heatmap: cooler (blue) near the particle's OWN initial position, hotter
    // (red) the further it has been displaced, with yellow in between. Independent of
    // screen/message center, zoom and rotation because homePosition is in the same
    // local space as position. Uses a fixed blue-yellow-red palette for every preset.
    float movement = length(position - homePosition);
    float heat = smoothstep(0.05, uHeatDistance, movement);
    vec3 movementColor = (heat < 0.5)
        ? mix(uHeatCold, uHeatWarm, heat * 2.0)
        : mix(uHeatWarm, uHeatHot, (heat - 0.5) * 2.0);

    // During an explosion every particle is colored by displacement. Emojis blend
    // the motion palette into their source color (uEmojiMotionMix) instead of
    // replacing it, so the glyph stays recognizable while the blast reads as heat.
    vec3 motionColor = mix(movementColor, sourceColor.rgb, uEmojiMode * uEmojiMotionMix);
    vColor = mix(baseColor, motionColor, uExplosionActive);

    // Audio-reactive brightness: mid/high energy brighten the particles, the envelope
    // gives a broad pulse while the blast is sounding.
    float audioBright = 1.0 + 0.35 * uAudioMid + 0.25 * uAudioHigh;
    vColor *= audioBright * (0.85 + 0.30 * uAudioEnvelope);

    // Depth cue: nearer particles (positive z depth) read slightly larger and
    // brighter, so the face-on sculpture still reads volumetric under the
    // orthographic projection. Emojis use a near-flat depth cue so small internal
    // details keep a consistent size/brightness.
    float depthCue = 1.0 + uDepthCue * homePosition.z;
    vColor *= depthCue;

    vCoverage = sourceColor.a;

    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;

    // Size attenuation - corrected for device pixel ratio. Under the orthographic
    // projection mvPosition.z is constant, so the perspective divisor is replaced
    // by the per-frame uPointScale uniform (same visual size at every zoom level).
    // Each particle is sized by the source raster cell it represents, so interior
    // cells (sampleSize 2) cover their grid and feature edges stay sharp (size 1).
    gl_PointSize = uPointSize * uPixelRatio * uPointScale * depthCue * sampleSize;
    // Hotter (more displaced) particles grow slightly to emphasize the leading edge;
    // high-frequency audio sparkle also nudges size up.
    gl_PointSize *= (1.0 + 0.5 * heat * uExplosionActive + 0.2 * uAudioHigh);
}
`;

const fragmentShader = `
uniform float uEmojiMode;
varying vec3 vColor;
varying float vCoverage;

void main() {
    // Soft circular falloff so points look smooth without MSAA (antialias: false).
    vec2 cxy = 2.0 * gl_PointCoord - 1.0;
    float r = dot(cxy, cxy);
    if (r > 1.0) discard;
    float alpha = 0.9 * (1.0 - smoothstep(0.0, 1.0, r));
    // Emoji particles fade with their source coverage, keeping anti-aliased glyph
    // edges soft; text particles stay fully opaque as before.
    alpha *= mix(1.0, vCoverage, uEmojiMode);
    gl_FragColor = vec4(vColor, alpha);
}
`;

// Trail streaks: additive after-images that chase the live positions, so fast
// particles leave coloured trails matching their displacement heat.
const trailVertexShader = `
uniform vec3 uHeatCold;
uniform vec3 uHeatWarm;
uniform vec3 uHeatHot;
uniform float uHeatDistance;
uniform float uPointSize;
uniform float uPointSizeTrail;
uniform float uPixelRatio;
uniform float uPointScale;
uniform float uTrailStrength;

attribute vec3 homePosition;
attribute vec3 livePosition;

varying vec3 vColor;
varying float vSpeed;

void main() {
    float movement = length(position - homePosition);
    float heat = smoothstep(0.05, uHeatDistance, movement);
    vec3 heatMap = (heat < 0.5)
        ? mix(uHeatCold, uHeatWarm, heat * 2.0)
        : mix(uHeatWarm, uHeatHot, (heat - 0.5) * 2.0);

    vSpeed = clamp(length(livePosition - position) / uHeatDistance, 0.0, 1.0);
    vColor = heatMap;

    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = uPointSizeTrail * uPixelRatio * uPointScale * (0.5 + 1.4 * vSpeed);
}
`;

const trailFragmentShader = `
uniform float uTrailStrength;
varying vec3 vColor;
varying float vSpeed;

void main() {
    vec2 cxy = 2.0 * gl_PointCoord - 1.0;
    float r = dot(cxy, cxy);
    if (r > 1.0) discard;
    float alpha = (1.0 - smoothstep(0.0, 1.0, r)) * vSpeed * vSpeed * uTrailStrength;
    gl_FragColor = vec4(vColor, alpha);
}
`;

// Secondary ember sparks that burst from the fastest particles at peak expansion.
const emberVertexShader = `
attribute float aLife;
varying float vLife;

void main() {
    vLife = aLife;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = 3.0 * aLife;
}
`;

const emberFragmentShader = `
varying float vLife;
void main() {
    vec2 cxy = 2.0 * gl_PointCoord - 1.0;
    float r = dot(cxy, cxy);
    if (r > 1.0) discard;
    float a = (1.0 - r) * 0.9 * vLife;
    gl_FragColor = vec4(1.0, 0.75, 0.35, a);
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
    activeEmoji: null,   // Set when an emoji is picked from the list; cleared by typing

    // Dynamic per-explosion properties
    expansionDuration: CONFIG.presets.DEFAULT.expansionDuration,
    contractionDuration: CONFIG.presets.DEFAULT.contractionDuration,
    explosionMaxDistMultiplier: CONFIG.presets.DEFAULT.explosionMaxDistMultiplier,
    motionStyle: CONFIG.presets.DEFAULT.motionStyle,
    activeExpansionDuration: null,
    activeContractionDuration: null,
    activeMaxDist: null,
    actualTravelRadius: 0,   // measured max distance particles actually travelled
    travelApplied: false,    // true once contraction duration is derived from actual travel
    embersSpawned: false,    // true once embers are spawned at peak expansion
    afterglowStartTime: null,
    soundPitch: CONFIG.presets.DEFAULT.soundPitch,
    soundDuration: CONFIG.presets.DEFAULT.soundDuration,
    soundType: CONFIG.presets.DEFAULT.soundType,
    trailStrength: CONFIG.presets.DEFAULT.trailStrength,
    // Per-preset explosion pattern tuning (used by generation + the time-dependent
    // spin/sway applied in both physics paths).
    pattern: {
        spokes: CONFIG.presets.DEFAULT.spokes,
        spokeJitter: CONFIG.presets.DEFAULT.spokeJitter,
        spinSpeed: CONFIG.presets.DEFAULT.spinSpeed,
        diskFlatten: CONFIG.presets.DEFAULT.diskFlatten,
        gustCoherence: CONFIG.presets.DEFAULT.gustCoherence,
        swayAmp: CONFIG.presets.DEFAULT.swayAmp,
        swayFreq: CONFIG.presets.DEFAULT.swayFreq
    },
    heatCold: [0.1, 0.4, 1.0],
    heatWarm: [1.0, 1.0, 0.1],
    heatHot: [1.0, 0.1, 0.1],

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
    trailPoints: null,
    trailData: null,
    trailLive: null,
    trailPosAttr: null,
    trailLiveAttr: null,
    emberPoints: null,
    emberData: null,
    emberVel: null,
    emberLife: null,
    emberPosAttr: null,
    emberLifeAttr: null,
    targetZ: CONFIG.initialZ,
    autoFit: true, // Keeps the full message fitting the stage until the user zooms manually
    prevTime: 0,
    prevDt: 0,
    prevKFrame: 0,
    prevDampFrame: 0,
};

// Physics state
const physics = {
    posHome: null,      // Rest positions
    posLive: null,      // Resident geometry buffer (never transferred)
    explosionOrigin: null, // Per-particle position at the start of the current blast
    springDisp: null,   // Spring displacement
    springVel: null,    // Spring velocity
    randomDir: null,    // Explosion direction per particle
    randomSpeed: null,  // Explosion speed per particle
    slots: [],          // Double-buffered working sets transferred to the worker
    sendQueue: [],      // FIFO of slots currently in flight at the worker
    seq: 0,             // Monotonic token echoed by the worker to pair replies
    sourceGeneration: 0, // Reject worker results from an older text layout
    motionToken: 0,     // Reject worker results from an older blast/recovery phase
    explosionStartTime: -1,
    positionsDirty: false, // true when a fresh worker result (or fallback step) moved particles
    usingFallback: false,  // true when the CPU fallback replaces a dead/unavailable worker
    randomized: null,      // { dirs, style } echo of the active blast's generated directions
};

// Particle budget: full density with the worker, a reduced cap for the main-thread
// CPU fallback so it stays within the frame budget on weaker machines.
function currentParticleCap() {
    return physicsWorker ? 30000 : 15000;
}

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
    flashTimer: null,
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
    uPointScale: { value: CONFIG.pointSizeAttenuationScale / CONFIG.initialZ },
    uDepthCue: { value: 0.28 },
    uColorHot: { value: new Vector3(1.0, 0.0, 0.0) },
    uColorWarm: { value: new Vector3(1.0, 1.0, 0.0) },
    uColorCold: { value: new Vector3(1.0, 1.0, 1.0) },
    uExplosionProgress: { value: 0.0 },
    uExplosionActive: { value: 0.0 },
    // Fixed motion-heat distance for every preset (red = 1/3 screen height at rest).
    uHeatDistance: { value: CONFIG.heatDistance },
    // Per-preset motion heatmap (cold = far, mid = mid, hot = leading edge).
    // The active preset's palette is applied on selection via applyPresetPhysics().
    uHeatCold: { value: new Vector3(0.1, 0.4, 1.0) },
    uHeatWarm: { value: new Vector3(1.0, 1.0, 0.1) },
    uHeatHot: { value: new Vector3(1.0, 0.1, 0.1) },
    // Audio-reactive energy bands (from the shared analyser).
    uAudioBass: { value: 0.0 },
    uAudioMid: { value: 0.0 },
    uAudioHigh: { value: 0.0 },
    uAudioEnvelope: { value: 0.0 },
    // Trail renderer uniforms.
    uPointSizeTrail: { value: 0.4 },
    uTrailStrength: { value: 0.25 },
    // Emoji source-color mode (0 = theme/heat palette, 1 = sampled glyph colors).
    uEmojiMode: { value: 0 },
    uEmojiMotionMix: { value: CONFIG.emojiMotionMix }
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
// Impact Flash (procedural, no assets)
// ─────────────────────────────────────────────
function flashImpact() {
    const el = document.getElementById('flash');
    if (!el) return;
    el.classList.remove('active');
    // Force reflow so the transition restarts on rapid triggers.
    void el.offsetWidth;
    el.classList.add('active');
    clearTimeout(interaction.flashTimer);
    interaction.flashTimer = setTimeout(() => el.classList.remove('active'), 120);
}

// ─────────────────────────────────────────────
// Audio Synthesis (Web Audio API)
// ─────────────────────────────────────────────
let audioCtx = null;
let audioMaster = null;    // Shared output gain (all layers route through this)
let audioAnalyser = null;  // Analyser for audio-reactive visuals
let audioFreqData = null;
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

// Lazily build the shared audio graph: master gain -> analyser -> destination.
function ensureAudioGraph() {
    if (audioCtx && audioMaster) return;
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    audioMaster = audioCtx.createGain();
    audioMaster.gain.value = 1.0;
    audioAnalyser = audioCtx.createAnalyser();
    audioAnalyser.fftSize = 256;
    audioAnalyser.smoothingTimeConstant = 0.6;
    audioMaster.connect(audioAnalyser);
    audioAnalyser.connect(audioCtx.destination);
    audioFreqData = new Uint8Array(audioAnalyser.frequencyBinCount);
}

// Read coarse frequency bands each frame and expose them as shader uniforms so the
// sculpture visually reacts to the sound it generates.
function updateAudioReactive() {
    if (!audioAnalyser || !audioCtx || !audioFreqData) return;
    if (audioCtx.state !== 'running') {
        uniforms.uAudioEnvelope.value = 0;
        return;
    }
    audioAnalyser.getByteFrequencyData(audioFreqData);
    const n = audioFreqData.length;
    function band(from, to) {
        let s = 0, c = 0;
        const a = Math.max(0, Math.floor(from * n));
        const b = Math.min(n, Math.floor(to * n));
        for (let i = a; i < b; i++) { s += audioFreqData[i] / 255; c++; }
        return c ? s / c : 0;
    }
    const bass = band(0.02, 0.25);
    const mid  = band(0.25, 0.55);
    const high = band(0.55, 0.92);
    // Smooth each band toward its target.
    uniforms.uAudioBass.value += (bass - uniforms.uAudioBass.value) * 0.5;
    uniforms.uAudioMid.value  += (mid  - uniforms.uAudioMid.value)  * 0.5;
    uniforms.uAudioHigh.value += (high - uniforms.uAudioHigh.value) * 0.5;
    const env = Math.min(1, bass * 1.3 + mid * 0.5 + high * 0.6);
    uniforms.uAudioEnvelope.value += (env - uniforms.uAudioEnvelope.value) * 0.6;
}

function playExplosionSound(recoveryEstimate = 0) {
    try {
        ensureAudioGraph();
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }

        const now  = audioCtx.currentTime;
        // Length scales with the recovery time so bigger explosions sound larger.
        const dur  = Math.max(state.soundDuration * (0.85 + Math.random() * 0.3), recoveryEstimate * 0.7);
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
        master.connect(audioMaster);

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

// Low, swelling rumble that plays during the contraction phase, tuned to the actual
// recovery duration so larger explosions audibly resolve more slowly.
function scheduleContractionRumble(duration) {
    try {
        ensureAudioGraph();
        if (!audioCtx) return;
        const now = audioCtx.currentTime;
        const len = Math.max(0.3, duration * 0.55);

        const osc = audioCtx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(85, now);
        osc.frequency.exponentialRampToValueAtTime(32, now + len);

        const gain = audioCtx.createGain();
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(0.16, now + Math.min(0.25, len * 0.3));
        gain.gain.exponentialRampToValueAtTime(0.0001, now + len);

        osc.connect(gain);
        gain.connect(audioMaster);
        osc.start(now);
        osc.stop(now + len + 0.05);

        setTimeout(() => {
            try { osc.disconnect(); gain.disconnect(); } catch (_) { /* ended */ }
        }, (len + 0.1) * 1000);
    } catch (err) {
        console.warn('Rumble synthesis error:', err);
    }
}
const loadedFonts = new Set(['Outfit']);

// ─────────────────────────────────────────────
// Font Loading Optimization
// ─────────────────────────────────────────────
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
    const W = CONFIG.canvasWidth, H = CONFIG.canvasHeight;
    const step = CONFIG.pixelStep, thr = CONFIG.pixelThreshold;

    // Pass 1: count sampled points and the bounding box, so we can allocate one flat
    // buffer up front and compute the centre/scale once (avoid per-point object churn).
    let rawCount = 0;
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;

    for (let y = 0; y < H; y += step) {
        for (let x = 0; x < W; x += step) {
            if (imgData[(y * W + x) * 4] > thr) {
                rawCount++;
                if (x < minX) minX = x;
                if (x > maxX) maxX = x;
                if (y < minY) minY = y;
                if (y > maxY) maxY = y;
            }
        }
    }

    if (rawCount === 0) return null;

    const scale = CONFIG.targetWorldWidth / Math.max(maxX - minX, 1);
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;

    // Pass 2: fill a flat interleaved (x, y, z) triple buffer.
    const flat = new Float32Array(rawCount * 3);
    let fi = 0;
    for (let y = 0; y < H; y += step) {
        for (let x = 0; x < W; x += step) {
            if (imgData[(y * W + x) * 4] > thr) {
                flat[fi++] = (x - cx) * scale;
                flat[fi++] = (cy - y) * scale;
                flat[fi++] = 0;
            }
        }
    }
    return flat;
}

// ─────────────────────────────────────────────
// Emoji Rasterization (high-detail two-pass sampling)
// ─────────────────────────────────────────────
let emojiCanvas = null;
let emojiCtx = null;

function sampleEmojiPoints(emoji) {
    if (!emojiCanvas) {
        emojiCanvas = document.createElement('canvas');
        emojiCtx = emojiCanvas.getContext('2d', { willReadFrequently: true });
    }
    const canvas = emojiCanvas;
    const ctx = emojiCtx;

    const size = CONFIG.emojiRasterSize;
    canvas.width = size;
    canvas.height = size;
    // Transparent background: the glyph's own alpha becomes the occupancy mask,
    // and the sampled RGB keeps the emoji's real colors (black eyes/mouth are
    // then real features instead of holes in an opaque black canvas). Color emoji
    // ignore fillStyle; monochrome fallback glyphs render white instead of black.
    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = 'white';
    ctx.font = `${CONFIG.emojiFontSize}px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(emoji, size / 2, size / 2 + size * 0.02);

    const imgData = ctx.getImageData(0, 0, size, size).data;
    const iStep = CONFIG.emojiInteriorStep;
    const eStep = CONFIG.emojiEdgeStep;
    const alphaThr = CONFIG.pixelThreshold;     // coverage mask (0-255)
    const colorThr = CONFIG.emojiColorEdgeThreshold; // RGB channel delta for internal color edges

    // Coverage of a pixel: alpha > threshold counts as filled; anti-aliased edge
    // pixels keep their partial alpha as coverage data for the fragment shader.
    const alphaOf = (x, y) => imgData[(y * size + x) * 4 + 3];
    const filled = (x, y) => alphaOf(x, y) > alphaThr;
    const isEdge = (x, y) => {
        if ((x > 0 && !filled(x - 1, y)) || (x < size - 1 && !filled(x + 1, y))) return true;
        if ((y > 0 && !filled(x, y - 1)) || (y < size - 1 && !filled(x, y + 1))) return true;
        return false;
    };
    // Internal color boundary: an adjacent filled pixel whose color differs enough
    // (e.g. blue tears against a yellow face, dark pupil against skin).
    const isColorEdge = (x, y) => {
        const i = (y * size + x) * 4;
        const r = imgData[i], g = imgData[i + 1], b = imgData[i + 2];
        const neighbor = (nx, ny) => {
            if (nx < 0 || ny < 0 || nx >= size || ny >= size) return false;
            if (!filled(nx, ny)) return false;
            const j = (ny * size + nx) * 4;
            const dr = Math.abs(r - imgData[j]);
            const dg = Math.abs(g - imgData[j + 1]);
            const db = Math.abs(b - imgData[j + 2]);
            return dr > colorThr || dg > colorThr || db > colorThr;
        };
        return neighbor(x - 1, y) || neighbor(x + 1, y) || neighbor(x, y - 1) || neighbor(x, y + 1);
    };

    // Pass 1 (features): silhouette edges AND internal color boundaries at full
    // density, retaining their true RGB and partial coverage.
    const points = [];
    const colors = [];
    const covers = [];
    const sizes = [];
    const edgeSet = new Set();
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    for (let y = 0; y < size; y += eStep) {
        for (let x = 0; x < size; x += eStep) {
            if (filled(x, y)) {
                if (isEdge(x, y) || isColorEdge(x, y)) {
                    const i = (y * size + x) * 4;
                    points.push(x, y);
                    colors.push(imgData[i], imgData[i + 1], imgData[i + 2]);
                    covers.push(alphaOf(x, y));
                    sizes.push(1); // 1-raster-pixel feature sample
                    edgeSet.add(y * size + x);
                }
                if (x < minX) minX = x;
                if (x > maxX) maxX = x;
                if (y < minY) minY = y;
                if (y > maxY) maxY = y;
            }
        }
    }
    if (points.length === 0) return null;

    // Pass 2 (content): interior cells at reduced resolution, averaging the cell's
    // RGBA so flat color regions stay faithful without noisy single-pixel samples.
    const pointCount = points.length / 2;
    for (let y = 0; y < size; y += iStep) {
        for (let x = 0; x < size; x += iStep) {
            if (edgeSet.has(y * size + x)) continue;
            if (!filled(x, y)) continue;
            const x1 = Math.min(x + iStep - 1, size - 1);
            const y1 = Math.min(y + iStep - 1, size - 1);
            let sr = 0, sg = 0, sb = 0, sa = 0, n = 0;
            for (let cy = y; cy <= y1; cy++) {
                for (let cx = x; cx <= x1; cx++) {
                    const i = (cy * size + cx) * 4;
                    if (imgData[i + 3] > alphaThr) {
                        sr += imgData[i];
                        sg += imgData[i + 1];
                        sb += imgData[i + 2];
                        sa += imgData[i + 3];
                        n++;
                    }
                }
            }
            if (n === 0) continue;
            points.push(x, y);
            colors.push(sr / n | 0, sg / n | 0, sb / n | 0);
            covers.push(sa / n | 0);
            sizes.push(iStep); // interior sample represents an iStep-pixel cell
        }
    }

    const scale = CONFIG.targetWorldWidth / Math.max(maxX - minX, 1);
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;

    // Structured result: flat positions + aligned RGBA (normalized bytes) +
    // coverage + per-sample cell size, plus how many leading samples are features
    // (kept first so the budget reduction below can drop interiors before features).
    const flat = new Float32Array((points.length / 2) * 3);
    let fi = 0;
    for (let i = 0; i < points.length; i += 2) {
        flat[fi++] = (points[i] - cx) * scale;
        flat[fi++] = (cy - points[i + 1]) * scale;
        flat[fi++] = 0;
    }
    return {
        flat,
        colors: new Uint8Array(colors),
        covers: new Uint8Array(covers),
        sizes: new Uint8Array(sizes),
        featureCount: pointCount,
        bounds: { w: maxX - minX, h: maxY - minY }
    };
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
    physics.sourceGeneration++;
    physics.motionToken++;
    physics.randomized = null;

    // Living-morph support: capture the current rendered positions so that (when the
    // particle count is unchanged) the particles can flow from the old message into
    // the new one, rather than blinking out and back in.
    const isMorph = !!render.particles;
    let oldLive = null;
    if (isMorph) {
        const pa = render.particles.geometry.attributes.position;
        oldLive = pa ? pa.array : null;
    }

    // Emojis picked from the list render through the high-detail emoji rasterizer;
    // anything typed (or loaded) as regular text keeps the standard text path.
    const isEmojiMessage = state.activeEmoji === text && CONFIG.emojiOptions.includes(text);
    const emojiData = isEmojiMessage ? sampleEmojiPoints(text) : null;
    const points = emojiData ? emojiData.flat : sampleTextPoints(text);
    if (!points) {
        showToast('Text must contain at least one visible character!');
        return;
    }

    // One particle per sampled cell for emojis (max recognizable detail under the
    // particle cap) instead of the text path's density-clone stacking.
    const { jitterXY, jitterZ, explosionSpeedMin, explosionSpeedRange } = CONFIG;
    const density = isEmojiMessage ? CONFIG.emojiDensityOverride : CONFIG.density;
    let pointCount = points.length / 3;
    let step = 1;

    // Subsample points if overall particle count budget is exceeded. Emojis use a
    // feature-aware reduction: silhouette/color-boundary samples are kept first,
    // and only interior fill is strided, so narrow tears/eyes/mouth survive the cap.
    const maxParticles = currentParticleCap();
    const maxPoints = Math.floor(maxParticles / density);
    let flat = points;
    let srcColors = null;   // Uint8Array RGBA (emoji) — normalized byte colors
    let srcCovers = null;   // Uint8Array source coverage
    let srcSizes = null;    // Uint8Array raster cell size per sample (1 edge / 2 interior)
    if (isEmojiMessage) {
        srcColors = emojiData.colors;
        srcCovers = emojiData.covers;
        srcSizes = emojiData.sizes;
        if (pointCount > maxPoints) {
            const keep = [];
            const featureCount = emojiData.featureCount;
            const keepFeatures = Math.min(featureCount, Math.floor(maxPoints * 0.6));
            const featStep = Math.max(1, Math.ceil(featureCount / keepFeatures));
            for (let i = 0; i < featureCount; i += featStep) keep.push(i);
            const interiorBudget = Math.max(0, maxPoints - keep.length);
            if (interiorBudget > 0) {
                const interiorCount = pointCount - featureCount;
                const intStep = Math.max(1, Math.ceil(interiorCount / interiorBudget));
                for (let i = featureCount; i < pointCount; i += intStep) keep.push(i);
            }

            const cFlat = new Float32Array(keep.length * 3);
            // Compacted arrays keep the sampler's RGB-per-point (3 bytes) layout
            // plus separate covers/sizes, so the fill loop's i*3 reads stay aligned.
            const cColors = new Uint8Array(keep.length * 3);
            const cCovers = new Uint8Array(keep.length);
            const cSizes = new Uint8Array(keep.length);
            for (let k = 0; k < keep.length; k++) {
                const i = keep[k];
                cFlat[k * 3] = flat[i * 3];
                cFlat[k * 3 + 1] = flat[i * 3 + 1];
                cFlat[k * 3 + 2] = flat[i * 3 + 2];
                cColors[k * 3] = srcColors[i * 3];
                cColors[k * 3 + 1] = srcColors[i * 3 + 1];
                cColors[k * 3 + 2] = srcColors[i * 3 + 2];
                cCovers[k] = srcCovers[i];
                cSizes[k] = srcSizes[i];
            }
            flat = cFlat;
            srcColors = cColors;
            srcCovers = cCovers;
            srcSizes = cSizes;
            pointCount = keep.length;
        }
    } else {
        const count = pointCount * density;
        if (count > maxParticles) {
            step = Math.max(1, Math.ceil(pointCount / maxPoints));
        }
    }

    const sampledCount = Math.ceil(pointCount / step);
    const finalCount = sampledCount * density;

    physics.posHome    = new Float32Array(finalCount * 3);
    physics.posLive    = new Float32Array(finalCount * 3);
    physics.explosionOrigin = new Float32Array(finalCount * 3);
    physics.springDisp = new Float32Array(finalCount * 3);
    physics.springVel  = new Float32Array(finalCount * 3);
    physics.randomDir  = new Float32Array(finalCount * 3);
    physics.randomSpeed = new Float32Array(finalCount);

    // Per-particle source appearance: RGBA + raster-cell size. Emojis carry their
    // sampled glyph colors/coverage; text is white/opaque unit-size cells.
    const srcColorArr = new Uint8Array(finalCount * 4);
    const srcSizeArr = new Uint8Array(finalCount);

    // Build fresh double-buffered worker working sets below (after resident buffers
    // are populated), since any prior in-flight slots have been transferred away.

    // Emojis keep their 2D glyph continuity: much lower XY/Z jitter than text so
    // thin internal details (tears, eyes, mouth lines) stay continuous.
    const jx = isEmojiMessage ? CONFIG.emojiJitterXY : jitterXY;
    const jz = isEmojiMessage ? CONFIG.emojiJitterZ : jitterZ;

    let si = 0;
    for (let i = 0; i < pointCount; i += step, si++) {
        const px = flat[i * 3], py = flat[i * 3 + 1], pz = flat[i * 3 + 2];
        for (let d = 0; d < density; d++) {
            const idx = si * density + d;
            const ix = idx * 3, iy = ix + 1, iz = ix + 2;

            const hx = px + (Math.random() - 0.5) * jx;
            const hy = py + (Math.random() - 0.5) * jx;
            const hz = pz + (Math.random() - 0.5) * jz;

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

            // Source appearance aligned with this particle (density clones share it).
            // srcColors is RGB-per-point (3 bytes); the shader attribute is RGBA (4).
            if (srcColors) {
                srcColorArr[idx * 4]     = srcColors[i * 3];
                srcColorArr[idx * 4 + 1] = srcColors[i * 3 + 1];
                srcColorArr[idx * 4 + 2] = srcColors[i * 3 + 2];
                srcColorArr[idx * 4 + 3] = srcCovers[i];
                srcSizeArr[idx] = srcSizes[i];
            } else {
                srcColorArr[idx * 4]     = 255;
                srcColorArr[idx * 4 + 1] = 255;
                srcColorArr[idx * 4 + 2] = 255;
                srcColorArr[idx * 4 + 3] = 255;
                srcSizeArr[idx] = 1;
            }
        }
    }

    // Refit the camera to the new content: message changes re-zoom to the
    // message type's level (emoji smallest / text stage-filling), pre-user-zoom.
    if (render.autoFit) updateStageLayout();

    // Morph transition: when particle counts match, start particles at their OLD
    // positions so the spring pulls them smoothly into the new glyph. Otherwise use
    // the scatter cloud set above for a dissolve-and-reform morph.
    if (isMorph && !shouldScatter && oldLive && oldLive.length === physics.posLive.length) {
        physics.posLive.set(oldLive);
        physics.springDisp.fill(0);
        physics.springVel.fill(0);
    }
    physics.explosionOrigin.set(physics.posLive);

    // Rebuild double-buffered worker working sets ("slots") to match the current arrays.
    physics.slots = [];
    physics.sendQueue = [];
    for (let s = 0; s < 2; s++) {
        const slot = {
            posLive: new Float32Array(finalCount * 3),
            springDisp: new Float32Array(finalCount * 3),
            springVel: new Float32Array(finalCount * 3),
            inFlight: false,
            needsReset: false
        };
        slot.posLive.set(physics.posLive);
        slot.springDisp.set(physics.springDisp);
        slot.springVel.set(physics.springVel);
        physics.slots.push(slot);
    }
    // Reuse the existing geometry when morphing so the sculpture never disappears;
    // otherwise create it on the first build.
    const isFirstBuild = !render.particles;
    const geo = isFirstBuild
        ? new BufferGeometry()
        : render.particles.geometry;

const posAttr = new BufferAttribute(physics.posLive, 3);
    posAttr.setUsage(DynamicDrawUsage);
    geo.setAttribute('position', posAttr);
    // Per-particle rest/glyph positions, used by the shader to color by displacement.
    geo.setAttribute('homePosition', new BufferAttribute(physics.posHome, 3));
    // Source appearance: emoji glyph colors + coverage (normalized bytes) and the
    // raster-cell size each particle represents (drives sprite size).
    geo.setAttribute('sourceColor', new BufferAttribute(srcColorArr, 4, true));
    geo.setAttribute('sampleSize', new BufferAttribute(srcSizeArr, 1));

    if (isFirstBuild) {
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

    // Emoji layout uses the sampled glyph colors with normal alpha blending (so
    // dark pupils/mouth render) and a crisp, low-jitter, low-depth-cue profile.
    // Text keeps the theme/heat additive style unchanged.
    uniforms.uEmojiMode.value = isEmojiMessage ? 1 : 0;
    uniforms.uPointSize.value = isEmojiMessage ? CONFIG.emojiPointSize : CONFIG.pointSize;
    uniforms.uDepthCue.value = isEmojiMessage ? CONFIG.emojiDepthCue : 0.28;
    render.particles.material.blending = isEmojiMessage ? NormalBlending : AdditiveBlending;
    render.particles.material.needsUpdate = true;
    // New layouts always begin face-on so the text itself is not presented at an
    // inherited angle from a previous interaction.
    render.particles.rotation.set(0, 0, 0);

    // Sync initialized positions to the Web Worker. Pass CLONED copies so the worker
    // owns its arrays and the main-thread arrays stay attached for the resident
    // geometry attributes (homePosition) and the CPU fallback (never transferred).
    if (physicsWorker) {
        physicsWorker.postMessage({
            type: 'init',
            data: {
                posHome: physics.posHome.slice(),
                explosionOrigin: physics.explosionOrigin.slice(),
                randomDir: physics.randomDir.slice(),
                randomSpeed: physics.randomSpeed.slice(),
                sourceGeneration: physics.sourceGeneration
            }
        });
    }

    buildTrailsAndEmbers();
}

// Build (or rebuild) the trail-streak and ember-spark secondary layers to match the
// current particle pool. Reused across morphs; never disposed mid-frame.
function buildTrailsAndEmbers() {
    const n = physics.posLive.length;

    // ── Trail streak layer ──────────────────────────────────────────────
    render.trailData = new Float32Array(n);
    render.trailLive = new Float32Array(n);
    render.trailData.set(physics.posLive);
    render.trailLive.set(physics.posLive);

    const tPosAttr = new BufferAttribute(render.trailData, 3);
    tPosAttr.setUsage(DynamicDrawUsage);
    const tLiveAttr = new BufferAttribute(render.trailLive, 3);
    tLiveAttr.setUsage(DynamicDrawUsage);

    if (render.trailPoints) {
        render.scene.remove(render.trailPoints);
        // Release the previous layer's GPU resources so repeated text/font changes do
        // not leak geometries/materials until the next garbage collection.
        render.trailPoints.geometry.dispose();
        render.trailPoints.material.dispose();
    }
    const tgeo = new BufferGeometry();
    tgeo.setAttribute('position', tPosAttr);
    tgeo.setAttribute('livePosition', tLiveAttr);
    tgeo.setAttribute('homePosition', new BufferAttribute(physics.posHome, 3));
    render.trailPoints = new Points(tgeo, new ShaderMaterial({
        uniforms,
        vertexShader: trailVertexShader,
        fragmentShader: trailFragmentShader,
        blending: AdditiveBlending,
        depthWrite: false,
        transparent: true
    }));
    render.trailPoints.frustumCulled = false;
    render.scene.add(render.trailPoints);
    render.trailPosAttr = tPosAttr;
    render.trailLiveAttr = tLiveAttr;

    // ── Ember spark layer (capped) ──────────────────────────────────────
    const EC = 300;
    render.emberData = new Float32Array(EC * 3);
    render.emberVel = new Float32Array(EC * 3);
    render.emberLife = new Float32Array(EC);
    render.emberCount = EC;

    const ePosAttr = new BufferAttribute(render.emberData, 3);
    ePosAttr.setUsage(DynamicDrawUsage);
    const eLifeAttr = new BufferAttribute(render.emberLife, 1);
    eLifeAttr.setUsage(DynamicDrawUsage);

    if (render.emberPoints) {
        render.scene.remove(render.emberPoints);
        render.emberPoints.geometry.dispose();
        render.emberPoints.material.dispose();
    }
    const egeo = new BufferGeometry();
    egeo.setAttribute('position', ePosAttr);
    egeo.setAttribute('aLife', eLifeAttr);
    render.emberPoints = new Points(egeo, new ShaderMaterial({
        uniforms: {},
        vertexShader: emberVertexShader,
        fragmentShader: emberFragmentShader,
        blending: AdditiveBlending,
        depthWrite: false,
        transparent: true
    }));
    render.emberPoints.renderOrder = 2;
    render.scene.add(render.emberPoints);
    render.emberPosAttr = ePosAttr;
    render.emberLifeAttr = eLifeAttr;
}

// Chase the live positions so fast particles leave coloured streaks behind them.
function updateTrails(kFactor) {
    if (!render.particles || !render.trailData) return;
    if (isMotionReduced && render.trailPoints) { render.trailPoints.visible = false; return; }
    if (render.trailPoints) render.trailPoints.visible = true;

    // Skip the full-buffer chase when no fresh physics result moved the particles this
    // frame (positions unchanged => trails have already converged). This avoids scanning
    // and uploading both full-size trail attributes every single frame while idle.
    if (!physics.positionsDirty) return;
    physics.positionsDirty = false;

    const pos = render.particles.geometry.attributes.position.array;
    const tPos = render.trailData;
    const tLive = render.trailLive;
    const k = 0.22;
    for (let i = 0; i < pos.length; i++) {
        tPos[i] += (pos[i] - tPos[i]) * k;
        tLive[i] = pos[i];
    }
    render.trailPosAttr.needsUpdate = true;
    render.trailLiveAttr.needsUpdate = true;
}

// Burst ember sparks outward from the expanded particle field at peak, so the sparks
// feel connected to the main sculpture instead of detaching from its centre.
function spawnEmbers() {
    if (!render.emberData || !render.particles) return;
    if (isMotionReduced) return;

    // Scale the spark budget per preset.
    const preset = (state.activePreset && CONFIG.presets[state.activePreset]) || null;
    const budget = preset ? (preset.emberBudget || 90) : 90;
    const E = Math.min(render.emberCount, budget);
    const pos = render.particles.geometry.attributes.position.array;
    const home = physics.explosionOrigin || physics.posHome;
    const n3 = pos.length;

    // Choose source particles on the outer shell of the explosion (displaced from home).
    const candidates = [];
    for (let i = 0; i < n3 / 3; i++) {
        const i3 = i * 3;
        const dx = pos[i3] - home[i3];
        const dy = pos[i3 + 1] - home[i3 + 1];
        const dz = pos[i3 + 2] - home[i3 + 2];
        const d2 = dx * dx + dy * dy + dz * dz;
        if (d2 > 1.0) candidates.push(i);
    }
    if (candidates.length === 0) return;

    for (let i = 0; i < E; i++) {
        const i3 = i * 3;
        const src = candidates[(Math.random() * candidates.length) | 0];
        const s3 = src * 3;
        // Inherit the source particle's current position and outward direction.
        render.emberData[i3]     = pos[s3];
        render.emberData[i3 + 1] = pos[s3 + 1];
        render.emberData[i3 + 2] = pos[s3 + 2];

        const ox = pos[s3] - home[s3];
        const oy = pos[s3 + 1] - home[s3 + 1];
        const oz = pos[s3 + 2] - home[s3 + 2];
        const olen = Math.sqrt(ox * ox + oy * oy + oz * oz) || 1;
        const push = 3 + Math.random() * 14;
        // Outward direction + small tangential jitter.
        render.emberVel[i3]     = (ox / olen) * push + (Math.random() - 0.5) * 4;
        render.emberVel[i3 + 1] = (oy / olen) * push + (Math.random() - 0.5) * 4;
        render.emberVel[i3 + 2] = (oz / olen) * push * 0.5 + (Math.random() - 0.5) * 2;
        render.emberLife[i] = 0.35 + Math.random() * 0.45;
    }
}

function updateEmbers(dt) {
    if (!render.emberData) return;
    if (isMotionReduced && render.emberPoints) { render.emberPoints.visible = false; return; }
    if (render.emberPoints) render.emberPoints.visible = true;

    const E = render.emberCount;
    for (let i = 0; i < E; i++) {
        if (render.emberLife[i] <= 0) continue;
        const i3 = i * 3;
        render.emberData[i3]     += render.emberVel[i3] * dt;
        render.emberData[i3 + 1] += render.emberVel[i3 + 1] * dt;
        render.emberData[i3 + 2] += render.emberVel[i3 + 2] * dt;
        // Gently pull embers toward gravity/down + drag.
        render.emberVel[i3 + 1] -= 8 * dt;
        render.emberVel[i3]     *= Math.pow(0.02, dt);
        render.emberVel[i3 + 1] *= Math.pow(0.02, dt);
        render.emberVel[i3 + 2] *= Math.pow(0.02, dt);
        render.emberLife[i] -= dt;
        if (render.emberLife[i] <= 0) render.emberLife[i] = 0;
    }
    render.emberPosAttr.needsUpdate = true;
    render.emberLifeAttr.needsUpdate = true;
}

// ─────────────────────────────────────────────
// Mouse Utilities & Optimization
// ─────────────────────────────────────────────
const _vec = new Vector3();
const _dir = new Vector3();

function updateMouse(clientX, clientY) {
    const rect = render.renderer.domElement.getBoundingClientRect();
    const nx = ((clientX - rect.left) / rect.width) * 2 - 1;
    const ny = -((clientY - rect.top) / rect.height) * 2 + 1;

    if (render.camera.isOrthographicCamera) {
        // Orthographic cameras project along parallel rays: unprojecting the
        // NDC point lands directly on the world z=0 plane of the sculpture.
        _vec.set(nx, ny, 0).unproject(render.camera);
        interaction.mouseWorld.copy(_vec);
        interaction.mouseWorld.z = 0;
        return;
    }

    _vec.set(nx, ny, 0.5).unproject(render.camera);
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
    const pattern = state.pattern;
    const home = physics.posHome;

    // Pick a randomized explosion pattern for this blast. Pattern styles:
    // 0: uniform sphere (Explode), 1: tangential vortex (Galaxy),
    // 2: coherent wind gust (Breeze), 3: crisp starburst rays (Kinetic).
    // Respect a pinned preset style when one is active.
    const style = (typeof state.motionStyle === 'number' && state.motionStyle >= 0)
        ? state.motionStyle
        : Math.floor(Math.random() * 4);

    // Shared gust direction for style 2 (mostly horizontal, slight vertical drift).
    const gustAngle = Math.random() * Math.PI * 2;
    let gx = Math.cos(gustAngle);
    let gy = Math.sin(gustAngle);
    let gz = (Math.random() - 0.5) * 0.4;
    const glen = Math.sqrt(gx * gx + gy * gy + gz * gz) || 1;
    gx /= glen; gy /= glen; gz /= glen;

    // Fibonacci-sphere spoke lattice for style 3 (deterministic per spoke index).
    const spokes = Math.max(2, pattern.spokes || 12);
    const jitter = (pattern.spokeJitter != null) ? pattern.spokeJitter : 0.03;
    const golden = Math.PI * (3 - Math.sqrt(5));

    for (let i = 0; i < count; i++) {
        const ix = i * 3, iy = ix + 1, iz = ix + 2;

        let rx, ry, rz;

        if (style === 1) {
            // Tangential vortex: velocity follows the tangent of the particle's own
            // home position, so the field circulates around the message centre.
            const hx = home[ix], hy = home[iy];
            const r2 = hx * hx + hy * hy;
            let tx, ty;
            if (r2 > 1e-6) {
                const inv = 1 / Math.sqrt(r2);
                tx = -hy * inv;
                ty =  hx * inv;
            } else {
                const a = Math.random() * Math.PI * 2;
                tx = Math.cos(a); ty = Math.sin(a);
            }
            const sign = Math.random() < 0.5 ? 1 : -1;
            const flatten = pattern.diskFlatten || 0;
            rx = tx * sign;
            ry = ty * sign;
            rz = home[iz] * flatten;
            // Small tangential wobble so the disk feels alive.
            rx += (Math.random() - 0.5) * 0.2;
            ry += (Math.random() - 0.5) * 0.2;
        } else if (style === 2) {
            // Coherent gust: the shared gust direction blended with per-particle
            // randomness — the whole sculpture visibly flows one way.
            const coherence = pattern.gustCoherence || 0;
            const rand = 1 - coherence;
            rx = gx * coherence + (Math.random() * 2 - 1) * rand;
            ry = gy * coherence + (Math.random() * 2 - 1) * rand;
            rz = gz * coherence + (Math.random() * 2 - 1) * rand;
        } else if (style === 3) {
            // Starburst rays: each particle snaps onto one of `spokes` crisp 3D
            // directions with tiny angular jitter, so the blast reads as rays.
            const sp = i % spokes;
            const sa = sp * golden;
            const sb = Math.acos(Math.max(-1, Math.min(1, 1 - 2 * (sp + 0.5) / spokes)));
            const sx = Math.sin(sb) * Math.cos(sa);
            const sy = Math.sin(sb) * Math.sin(sa);
            const sz = Math.cos(sb);
            rx = sx + (Math.random() - 0.5) * 2 * jitter;
            ry = sy + (Math.random() - 0.5) * 2 * jitter;
            rz = sz + (Math.random() - 0.5) * 2 * jitter;
        } else {
            // Uniform sphere (style 0): fully symmetric explosion.
            const theta = Math.random() * Math.PI * 2;
            const phi   = Math.acos((Math.random() * 2) - 1);
            rx = Math.sin(phi) * Math.cos(theta);
            ry = Math.sin(phi) * Math.sin(theta);
            rz = Math.cos(phi);
        }

        const len = Math.sqrt(rx * rx + ry * ry + rz * rz) || 1;
        rx /= len; ry /= len; rz /= len;

        if (style === 2) {
            // Wind speeds are soft and varied so the gust feels like a breeze.
            physics.randomSpeed[i] = (explosionSpeedMin + Math.random() * explosionSpeedRange) * (0.8 + Math.random() * 0.4);
        } else if (style === 3) {
            // Rays travel fast and uniformly so the spokes stay crisp.
            physics.randomSpeed[i] = (explosionSpeedMin + Math.random() * explosionSpeedRange) * (1.5 + Math.random() * 0.7);
        } else {
            const speedVar = 0.75 + Math.random() * 0.55;
            physics.randomSpeed[i] = (explosionSpeedMin + Math.random() * explosionSpeedRange) * speedVar;
        }

        physics.randomDir[ix] = rx;
        physics.randomDir[iy] = ry;
        physics.randomDir[iz] = rz;
    }

    // Echo a leading slice of the generated directions for the pattern tests.
    physics.randomized = {
        dirs: physics.randomDir.slice(0, DIRECTIONS_VERIFY * 3),
        style
    };
}

function captureExplosionOrigin() {
    if (!render.particles || !physics.explosionOrigin) return;
    const current = render.particles.geometry.attributes.position.array;
    if (current.length !== physics.explosionOrigin.length) return;

    physics.explosionOrigin.set(current);
    physics.posLive.set(current);
    physics.springDisp.fill(0);
    physics.springVel.fill(0);
    physics.motionToken++;

    // The worker's double-buffered slots also hold the previous state (e.g. preset
    // scatter spring displacement). Reset free slots now; flag in-flight ones (their
    // buffers are detached while at the worker) so the dispatch loop resets them. This
    // prevents one slot leaking scatter-scale spring motion into the new blast.
    for (const slot of physics.slots) {
        if (slot.inFlight) {
            slot.needsReset = true;
        } else {
            slot.posLive.set(current);
            slot.springDisp.fill(0);
            slot.springVel.fill(0);
            slot.needsReset = false;
        }
    }
}

function triggerExplosion() {
    if (physics.explosionStartTime >= 0) return;

    // Every particle explodes from the position the user actually sees, not from
    // the screen center or its eventual text position.
    captureExplosionOrigin();

    // Reset per-blast state
    state.actualTravelRadius = 0;
    state.travelApplied = false;
    state.embersSpawned = false;
    state.afterglowStartTime = null;
    fallbackMaxTravelSq = 0;

    // Randomize active timing and distance multipliers per blast
    state.activeMaxDist = state.explosionMaxDistMultiplier * (0.8 + Math.random() * 0.4);
    state.activeExpansionDuration = state.expansionDuration * (0.85 + Math.random() * 0.3);

    // Initial recovery estimate (replaced at peak by the measured travel radius).
    state.activeContractionDuration = Math.max(
        state.activeMaxDist / CONFIG.maxContractionVelocity,
        CONFIG.contractionDurationFloor
    );

    const estimatedRecovery = state.activeContractionDuration;

    if (physicsWorker) {
        // Re-randomize particle trajectory vectors/speeds inside the worker, so the
        // 30k-particle trig loop never hitches the main thread at blast time.
        physicsWorker.postMessage({
            type: 'randomize',
            data: {
                explosionSpeedMin: CONFIG.explosionSpeedMin,
                explosionSpeedRange: CONFIG.explosionSpeedRange,
                motionStyle: state.motionStyle,
                pattern: state.pattern,
                explosionOrigin: physics.explosionOrigin.slice(),
                motionToken: physics.motionToken,
                sourceGeneration: physics.sourceGeneration
            }
        });
    } else {
        randomizeExplosionVectors();
    }

    physics.explosionStartTime = render.clock.getElapsedTime();
    flashImpact();
    playExplosionSound(estimatedRecovery);
    announceToScreenReader(`Explosion triggered for "${state.currentText}"`);
}

function explosionAnchorWeight(elapsed, expansionDuration, contractionDuration) {
    if (elapsed <= 0) return 0;
    if (elapsed < expansionDuration) return 1;
    const t = Math.min(1, (elapsed - expansionDuration) / contractionDuration);
    return Math.max(0, 1 - t * t * t);
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
// Copy a preset's explosion physics/pattern/visual tuning into state and apply the
// explosion-only visual uniforms. The user's theme/font always stay untouched.
function applyPresetPhysics(preset) {
    state.expansionDuration = preset.expansionDuration;
    state.contractionDuration = preset.contractionDuration;
    state.explosionMaxDistMultiplier = preset.explosionMaxDistMultiplier;
    state.motionStyle = (preset.motionStyle != null) ? preset.motionStyle : -1;
    state.soundPitch = preset.soundPitch;
    state.soundDuration = preset.soundDuration;
    state.soundType = preset.soundType;
    state.trailStrength = (preset.trailStrength != null) ? preset.trailStrength : 0.25;

    state.pattern = {
        spokes:       (preset.spokes != null)       ? preset.spokes       : 12,
        spokeJitter:  (preset.spokeJitter != null)  ? preset.spokeJitter  : 0.03,
        spinSpeed:    (preset.spinSpeed != null)    ? preset.spinSpeed    : 0,
        diskFlatten:  (preset.diskFlatten != null)  ? preset.diskFlatten  : 0,
        gustCoherence:(preset.gustCoherence != null)? preset.gustCoherence: 0,
        swayAmp:      (preset.swayAmp != null)      ? preset.swayAmp      : 0,
        swayFreq:     (preset.swayFreq != null)     ? preset.swayFreq     : 0
    };

    state.heatCold = preset.heat ? preset.heat.cold : [0.1, 0.4, 1.0];
    state.heatWarm = preset.heat ? preset.heat.warm : [1.0, 1.0, 0.1];
    state.heatHot  = preset.heat ? preset.heat.hot  : [1.0, 0.1, 0.1];

    uniforms.uHeatCold.value.set(...state.heatCold);
    uniforms.uHeatWarm.value.set(...state.heatWarm);
    uniforms.uHeatHot.value.set(...state.heatHot);
    uniforms.uTrailStrength.value = state.trailStrength;
}

function resetToDefaultExplosion() {
    applyPresetPhysics(CONFIG.presets.DEFAULT);
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
    applyPresetPhysics(CONFIG.presets[pick]);
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

    // Count Unicode code points so a single emoji reads as 1/25 (its UTF-16 pair
    // would otherwise count as 2).
    const len = [...text].length;
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
    applyPresetPhysics(CONFIG.presets[presetName] || CONFIG.presets.DEFAULT);

    // Presets drive explosion behaviour only — theme and font stay as the user set them.
    await setupParticles(state.currentText, shouldScatter);
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
        if (interaction.lastPinchDist) {
            render.targetZ -= (dist - interaction.lastPinchDist) * 0.15;
            render.autoFit = false;
        }
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

// Stage sizing + camera framing relative to the space not occupied by the menu.
function updateStageLayout() {
    const stage = document.getElementById('stage');
    const w = Math.max(stage.clientWidth, 1);
    const h = Math.max(stage.clientHeight, 1);
    render.camera.aspect = w / h;

    // Recompute the frustum from the current camera depth (matches animate(), so
    // the aspect is kept in sync even before the next frame).
    const halfHeight = render.camera.position.z * Math.tan(CONFIG.cameraAngleDeg * Math.PI / 360);
    const halfWidth  = halfHeight * render.camera.aspect;
    render.camera.left   = -halfWidth;
    render.camera.right  =  halfWidth;
    render.camera.top    =  halfHeight;
    render.camera.bottom = -halfHeight;
    render.camera.updateProjectionMatrix();

    render.renderer.setSize(w, h, false); // CSS (stage) controls the element size
    const dpr = Math.min(window.devicePixelRatio, CONFIG.maxPixelRatio);
    render.renderer.setPixelRatio(dpr);
    uniforms.uPixelRatio.value = dpr;

    // Auto-zoom by message type, until the user zooms manually: emojis render at
    // the farthest zoom (smallest display), text fills most of the desktop stage.
    if (render.autoFit && stage.getBoundingClientRect().left > 0) {
        if (state.activeEmoji && CONFIG.emojiOptions.includes(state.currentText)) {
            render.targetZ = CONFIG.zoomMax;
        } else {
            render.targetZ = CONFIG.textAutoZoom;
        }
    }
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

// Highlight the picked emoji chip (or clear all when null)
function setEmojiActive(emoji) {
    const chips = document.querySelectorAll('.emoji-chip');
    chips.forEach(chip => {
        chip.classList.toggle('active', chip.getAttribute('data-emoji') === emoji);
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
            state.activeEmoji = null; // Typing reverts to the regular text path
            setEmojiActive(null);
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

    // Capture functionality ([1.4] safe with preserveDrawingBuffer: false because we run in the same tick).
    // Uses toBlob() instead of toDataURL() so PNG encoding runs off the main thread and
    // we avoid allocating a large base64 string (lower peak memory, no UI freeze).
    if (captureBtn) {
        captureBtn.addEventListener('click', () => {
            render.renderer.render(render.scene, render.camera);
            render.renderer.domElement.toBlob((blob) => {
                if (!blob) return;
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                const name = state.currentText.replace(/[^a-z0-9]/gi, '_').toLowerCase();
                link.download = `artz-sculpture-${name || 'kinetic'}.png`;
                link.href = url;
                link.click();
                setTimeout(() => URL.revokeObjectURL(url), 1000);
            }, 'image/png');
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

    // Emoji quick-picks: substitute the MESSAGE with a high-detail emoji sculpture
    const emojiChips = document.querySelectorAll('.emoji-chip');
    emojiChips.forEach(chip => {
        chip.addEventListener('click', async () => {
            const emoji = chip.getAttribute('data-emoji');
            if (!emoji) return;

            clearActivePresets();
            resetToDefaultExplosion();
            state.activeEmoji = emoji;
            setEmojiActive(emoji);

            const textInput = document.getElementById('text-input');
            if (textInput) {
                textInput.value = emoji;
                updateCharCounter(emoji);
            }

            // Quiet morph rebuild (no forced explosion) that updates the share URL.
            await updateText(emoji);
        });
    });
}

// ─────────────────────────────────────────────
// Animation Loop
// ─────────────────────────────────────────────
// Terminate a broken worker and switch to the CPU fallback without freezing the
// simulation. Unsticks any in-flight double-buffer slots that will never return.
function teardownWorker() {
    if (!physicsWorker) return;
    try { physicsWorker.terminate(); } catch (_) { /* already dead */ }
    physicsWorker = null;
    physics.usingFallback = true;
    for (const slot of physics.slots) slot.inFlight = false;
    physics.sendQueue.length = 0;
}

// DPR caps per adaptive quality level (index 0 = lowest resolution / cheapest fill-rate).
const QUALITY_DPR = [1.0, 1.25, 1.5, 2.0];
let adaptiveQuality = { level: QUALITY_DPR.length - 1, slowStreak: 0, fastStreak: 0 };

function applyQualityLevel(level) {
    const dpr = Math.min(window.devicePixelRatio, QUALITY_DPR[level]);
    render.renderer.setPixelRatio(dpr);
    uniforms.uPixelRatio.value = dpr;
}

// React to sustained frame time with hysteresis: drop DPR after a run of slow frames,
// restore it only after a long comfortable run, so resolution doesn't flutter.
function updateAdaptiveQuality(frameMs) {
    const aq = adaptiveQuality;
    if (frameMs > 28) {
        aq.slowStreak++;
        aq.fastStreak = 0;
        if (aq.slowStreak >= 30) {
            aq.slowStreak = 0;
            if (aq.level > 0) { aq.level--; applyQualityLevel(aq.level); }
        }
    } else if (frameMs < 16) {
        aq.fastStreak++;
        aq.slowStreak = 0;
        const maxLevel = QUALITY_DPR.length - 1;
        if (aq.fastStreak >= 120 && aq.level < maxLevel
            && Math.min(window.devicePixelRatio, QUALITY_DPR[aq.level + 1]) > Math.min(window.devicePixelRatio, QUALITY_DPR[aq.level])) {
            aq.fastStreak = 0;
            aq.level++;
            applyQualityLevel(aq.level);
        }
    } else {
        aq.slowStreak = 0;
        aq.fastStreak = 0;
    }
}

function animate() {
    const frameStart = performance.now();
    requestAnimationFrame(animate);

    const time = render.clock.getElapsedTime();
    const dt = Math.min(time - render.prevTime, 0.05); // cap at 50ms to prevent browser tab freeze math jumps
    render.prevTime = time;

    updateAudioReactive();

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
    if (keys['+'] || keys['=']) {
        render.targetZ -= CONFIG.zoomSpeed;
        render.autoFit = false;
    }
    if (keys['-']) {
        render.targetZ += CONFIG.zoomSpeed;
        render.autoFit = false;
    }
    render.targetZ = MathUtils.clamp(render.targetZ, CONFIG.zoomMin, CONFIG.zoomMax);
    camera.position.z = MathUtils.lerp(camera.position.z, render.targetZ, CONFIG.zoomLerp);

    // Orthographic framing: keep the exact view scale the perspective camera had by
    // deriving the frustum height from the camera depth. This eliminates the
    // perspective keystone shear that used to lean off-center glyphs toward the
    // screen center, so true z-depth renders without distortion at any zoom.
    const halfHeight = camera.position.z * Math.tan(CONFIG.cameraAngleDeg * Math.PI / 360);
    const halfWidth  = halfHeight * camera.aspect;
    camera.left   = -halfWidth;
    camera.right  =  halfWidth;
    camera.top    =  halfHeight;
    camera.bottom = -halfHeight;
    camera.updateProjectionMatrix();
    uniforms.uPointScale.value = CONFIG.pointSizeAttenuationScale / camera.position.z;

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
    const { posHome, explosionOrigin, springDisp, springVel, randomDir, randomSpeed } = physics;
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
            // Blast fully finished -> begin the afterglow fade back to idle colors.
            physics.explosionStartTime = -1;
            physics.motionToken++;
            springDisp.fill(0);
            springVel.fill(0);
            state.afterglowStartTime = time;
            elapsed = -1;
        } else {
            // At peak, lock the contraction duration to the ACTUAL distance travelled
            // so recovery genuinely reflects how far particles flew.
            if (elapsed >= activeExpDuration && !state.travelApplied) {
                const travel = state.actualTravelRadius;
                state.activeContractionDuration = Math.max(
                    travel / CONFIG.maxContractionVelocity,
                    CONFIG.contractionDurationFloor
                );
                state.travelApplied = true;
                scheduleContractionRumble(state.activeContractionDuration);
            }
            // Spawn embers once, at peak, from the expanded particle field.
            if (elapsed >= activeExpDuration && !state.embersSpawned) {
                state.embersSpawned = true;
                spawnEmbers();
            }
            const contrDur = state.activeContractionDuration || state.contractionDuration;
            if (elapsed < activeExpDuration) {
                progress = elapsed / activeExpDuration;
            } else {
                progress = 1.0 - (elapsed - activeExpDuration) / contrDur;
            }
        }
    }
    uniforms.uExplosionProgress.value = progress;

    // Explosion color blend: 1 for the whole blast (including recovery), then a brief
    // afterglow fade back to idle theme colors so particles don't snap.
    let activeBlend;
    if (physics.explosionStartTime >= 0) {
        activeBlend = 1.0;
    } else if (state.afterglowStartTime != null) {
        activeBlend = Math.max(0, 1 - (time - state.afterglowStartTime) / CONFIG.afterglowDuration);
        if (activeBlend <= 0) state.afterglowStartTime = null;
    } else {
        activeBlend = 0.0;
    }
    uniforms.uExplosionActive.value = activeBlend;
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
            if (slot.needsReset) {
                slot.posLive.set(physics.explosionOrigin);
                slot.springDisp.fill(0);
                slot.springVel.fill(0);
                slot.needsReset = false;
            }
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
                    repulsionStr,
                    sourceGeneration: physics.sourceGeneration,
                    motionToken: physics.motionToken
                },
                seq: slot.seq
            }, [slot.posLive.buffer, slot.springDisp.buffer, slot.springVel.buffer]);
        }
    } else {
        // Local CPU Fallback (Main Thread)
        // Per-frame rotation of the pattern's base directions: Galaxy spins around Z,
        // Breeze sways gently. One sin/cos pair per frame, then cheap per-particle math.
        const pat = state.pattern;
        const spinAngle = (elapsed > 0 && pat.spinSpeed) ? elapsed * pat.spinSpeed : 0;
        const swayAngle = (elapsed > 0 && pat.swayAmp) ? pat.swayAmp * Math.sin(elapsed * pat.swayFreq) : 0;
        const spinCos = Math.cos(spinAngle), spinSin = Math.sin(spinAngle);
        const swayCos = Math.cos(swayAngle), swaySin = Math.sin(swayAngle);
        for (let i = 0; i < count; i++) {
            const ix = i * 3, iy = ix + 1, iz = ix + 2;
            const anchor = elapsed > 0
                ? explosionAnchorWeight(elapsed, activeExpDuration, activeContrDuration)
                : 0;
            const origin = explosionOrigin || posHome;
            let bx = posHome[ix] + (origin[ix] - posHome[ix]) * anchor;
            let by = posHome[iy] + (origin[iy] - posHome[iy]) * anchor;
            let bz = posHome[iz] + (origin[iz] - posHome[iz]) * anchor;

            if (elapsed > 0.0) {
                const maxDist = randomSpeed[i] * activeMaxDistMult;
                let rx = randomDir[ix], ry = randomDir[iy], rz = randomDir[iz];
                if (state.motionStyle === 1) {
                    const nrx = rx * spinCos - ry * spinSin;
                    const nry = rx * spinSin + ry * spinCos;
                    rx = nrx; ry = nry;
                } else if (state.motionStyle === 2) {
                    const nrx = rx * swayCos - ry * swaySin;
                    const nry = rx * swaySin + ry * swayCos;
                    rx = nrx; ry = nry;
                }
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

            if (elapsed > 0.0) {
                const tx = pos[ix] - origin[ix];
                const ty = pos[iy] - origin[iy];
                const tz = pos[iz] - origin[iz];
                const td2 = tx * tx + ty * ty + tz * tz;
                if (td2 > fallbackMaxTravelSq) fallbackMaxTravelSq = td2;
            }
        }
        state.actualTravelRadius = Math.sqrt(fallbackMaxTravelSq);
        posAttr.needsUpdate = true;
        physics.positionsDirty = true;
    }

    updateTrails();
    updateEmbers(dt);

    render.renderer.render(render.scene, camera);

    // Adapt rendering resolution to sustained frame-time pressure (cheap, no particle
    // rebuild required).
    updateAdaptiveQuality(performance.now() - frameStart);
}

// ─────────────────────────────────────────────
// Initialisation
// ─────────────────────────────────────────────
async function init() {
    render.scene  = new Scene();
    render.camera = new OrthographicCamera(-1, 1, 1, -1, -600, 600);
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

    const canvas = render.renderer.domElement;
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', 'Kinetic particle sculpture — interactive particle animation');
    document.getElementById('stage').appendChild(canvas);

    // Size the renderer/camera to the stage (space excluding the menu) and apply
    // the initial auto-fit zoom before the sculpture is built.
    updateStageLayout();

    // Initialize physics Web Worker. `?noworker=1` forces the CPU fallback so the
    // fallback path can be exercised by the browser test suite.
    const disableWorkerForTest = new URLSearchParams(window.location.search).get('noworker') === '1';
    if (!disableWorkerForTest) {
        try {
            physicsWorker = new Worker(new URL('./physics.worker.js', import.meta.url), {
                type: 'module'
            });
        physicsWorker.onmessage = function (e) {
            const {
                type,
                seq,
                posLive,
                springDisp,
                springVel,
                travelRadius,
                sourceGeneration,
                motionToken
            } = e.data;
            if (type === 'randomized') {
                // The worker echoes a slice of the blast directions it generated so the
                // pattern regression tests can verify them without timing sensitivity.
                if (e.data.style === state.motionStyle) {
                    physics.randomized = { dirs: e.data.dirs, style: e.data.style };
                }
                return;
            }
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

                // Results from an older layout or blast phase must never overwrite
                // the current geometry after a rebuild or a new explosion.
                if (sourceGeneration !== physics.sourceGeneration || motionToken !== physics.motionToken) {
                    return;
                }

                // Track the actual distance particles travelled (used for recovery).
                if (typeof travelRadius === 'number' && travelRadius > 0) {
                    state.actualTravelRadius = travelRadius;
                }

                // The resident geometry buffers are never transferred, so they stay valid
                // during rendering. Copy the freshly computed slot into them.
                const posAttr = render.particles && render.particles.geometry.attributes.position;
                if (posAttr && posAttr.array.length === posLive.length) {
                    posAttr.array.set(posLive);
                    posAttr.needsUpdate = true;
                    physics.positionsDirty = true;
                }
            }
        };
        // Runtime worker failures must not leave the simulation frozen: tear the worker
        // down and switch to the CPU fallback (main-thread arrays remain valid because
        // they are never transferred to the worker).
        physicsWorker.onerror = () => {
            console.error('Physics worker error — switching to CPU fallback.');
            teardownWorker();
        };
        physicsWorker.onmessageerror = () => {
            console.error('Physics worker message error — switching to CPU fallback.');
            teardownWorker();
        };
    } catch (err) {
        console.error('Failed to initialize physics Web Worker:', err);
    }
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

    // A shared URL whose message is a list emoji keeps the high-detail rendering.
    if (CONFIG.emojiOptions.includes(initialText)) state.activeEmoji = initialText;

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
    window.addEventListener('resize', updateStageLayout);
    
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
        state.activeEmoji = CONFIG.emojiOptions.includes(t) ? t : null;

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
        setEmojiActive(state.activeEmoji);
    });

    // URL debug auto-explode parameter
    if (import.meta.env.DEV) {
        if (urlParams.get('explode') === 'true') {
            setTimeout(triggerExplosion, 1000);
        }
    }

    animate();
}

// ─────────────────────────────────────────────
// Test/Debug hook (used by the Playwright browser suite; harmless in production)
// ─────────────────────────────────────────────
window.__artzDebug = {
    _render: () => render,
    get particleCount() { return physics.posLive ? physics.posLive.length / 3 : 0; },
    get usingWorker() { return !!physicsWorker; },
    get geometryCount() {
        return render.renderer ? render.renderer.info.memory.geometries : -1;
    },
    get textureCount() {
        return render.renderer ? render.renderer.info.memory.textures : -1;
    },
    get renderCalls() {
        return render.renderer ? render.renderer.info.render.calls : -1;
    },
    snapshot(limit = 96) {
        const position = render.particles?.geometry.attributes.position.array;
        const home = physics.posHome;
        const origin = physics.explosionOrigin;
        const count = Math.min(limit * 3, position?.length || 0);
        return {
            position: position ? Array.from(position.slice(0, count)) : [],
            home: home ? Array.from(home.slice(0, count)) : [],
            explosionOrigin: origin ? Array.from(origin.slice(0, count)) : [],
            rotation: render.particles
                ? [render.particles.rotation.x, render.particles.rotation.y, render.particles.rotation.z]
                : [0, 0, 0],
            sourceGeneration: physics.sourceGeneration,
            motionToken: physics.motionToken,
            explosionActive: physics.explosionStartTime >= 0,
            elapsed: physics.explosionStartTime >= 0
                ? render.clock.getElapsedTime() - physics.explosionStartTime
                : -1,
            expDuration: state.activeExpansionDuration || state.expansionDuration,
            conDuration: state.activeContractionDuration || state.contractionDuration,
            randomized: physics.randomized
                ? { style: physics.randomized.style, dirs: Array.from(physics.randomized.dirs) }
                : { style: -1, dirs: [] }
        };
    },
    triggerExplosion,
};

init();
