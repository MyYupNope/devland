import {
    particleVertexShader,
    particleFragmentShader,
    trailVertexShader,
    trailFragmentShader,
    emberVertexShader,
    emberFragmentShader
} from './shaders.js';
import {
    playExplosionSound,
    playContractionRumble
} from './audio.js';
import {
    tornadoRadius,
    evaluateTornadoParticle,
    evaluateBreezeParticle,
    evaluateExplosionParticle
} from './physics-math.js';
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
    MathUtils,
    CanvasTexture,
    LinearFilter
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
    emojiRasterSize: 320,
    emojiFitPadX: 52,
    emojiFitPadY: 52,
    emojiPixelStep: 2,     // canvas edge for a single emoji (px)
    emojiFontSize: 280,       // glyph size within the emoji raster (px)
    emojiEdgeStep: 1,         // feature/silhouette edge samples (full density)
    emojiInteriorStep: 2,     // interior fill samples (halves density, keeps detail)
    emojiDensityOverride: 1,  // one particle per sampled cell → max detail under the cap
    emojiColorEdgeThreshold: 64, // max RGB-channel delta that marks an internal color boundary
    emojiJitterXY: 0.03,      // flatter layout so thin features (tears, eyes) stay continuous
    emojiJitterZ: 0.5,        // per-layer jitter (much smaller than layer spacing)
    emojiDepthCue: 0.06,      // near-flat depth shading for emoji particles
    emojiPointSize: 1.6,      // sprite base size covering interior sample cells
    emojiMotionMix: 0.35,     // how much of the explosion heat palette blends into emoji colors
    emojiDepthLayers: 5,      // number of Z-slices to replicate emoji points across (Approach A)
    emojiDepthRange: 6.0,     // total depth extent of the emoji volume in world units
    emojiIdleRotSpeed: 0.006, // slow idle Y-rotation speed (rad/s) to reveal depth at rest

    // Uploaded image MESSAGE options. Images are contained in a square raster so
    // their aspect ratio is preserved while the largest dimension fits the stage.
    imageRasterSize: 320,
    imagePixelStep: 2,
    imageAlphaThreshold: 16,
    imageJitterXY: 0.03,
    imageJitterZ: 0.5,        // per-layer jitter (smaller than layer spacing)
    imageDepthCue: 0.06,
    imagePointSize: 1.2,
    imageDepthLayers: 4,      // number of Z-slices to replicate image points across
    imageDepthRange: 5.0,     // total depth extent of the image volume in world units
    // Initial image framing: keep a fair distance from the left menu side and the
    // bottom instructions overlay (pixels of cleared stage each side). Uniform
    // camera distance means the image's aspect ratio is never distorted.
    imageFitPadX: 120,
    imageFitPadY: 120,

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
    // Pattern styles: 0 = uniform sphere (Explode), 1 = screen-space funnel
    // (Tornado), 2 = coherent wind gust (Breeze), 3 = crisp starburst rays (Kinetic).
    presets: {
        KINETIC: {
            expansionDuration: 1.1,
            driftDuration: 3.0,
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
        TORNADO: {
            expansionDuration: 3.5,
            vortexDuration: 4.5,
            equilibriumDuration: 3.5,
            contractionDuration: 3.5,
            explosionMaxDistMultiplier: 26.0,
            motionStyle: 1, // 4-phase ~15s tornado: Phase 1 Ground Accretion -> Phase 2 Organic Funnel -> Phase 3 Mature Canopy -> Phase 4 Dissipation
            spinSpeed: 4.8,
            funnelHeight: 46,
            funnelBottom: -22,
            funnelCrownRadius: 22.0,
            funnelWaistRadius: 4.5,
            funnelTailRadius: 1.8,
            funnelWaistT: 0.38,
            funnelCrownT: 0.82,
            funnelFadeStart: 0.03,
            funnelFadeEnd: 0.30,
            trailStrength: 0.75,
            heat: {
                cold: [0.08, 0.18, 0.45],  // Deep storm blue
                warm: [0.92, 0.82, 0.28],  // Luminous golden accretion filament (Image 2)
                hot: [1.0, 0.98, 0.90]     // White-hot lightning vortex core highlight
            },
            emberBudget: 90,
            soundPitch: 75,
            soundDuration: 15.0,
            soundType: 'sawtooth'
        },
                                                                        BREEZE: {
            expansionDuration: 1.0,
            groundPauseDuration: 2.0,
            liftDuration: 3.6,
            settleDuration: 3.6,
            contractionDuration: 1.6,
            explosionMaxDistMultiplier: 38.0,
            motionStyle: 2, // 4-phase breeze: Straight Fall (1.0s) -> 2s Ground Rest (1.0-3.0s) -> Forward Breeze (3.0-6.6s) -> Reverse Breeze to Floor (6.6-10.2s) -> Reverse Drop Elevation Home (10.2-11.8s)
            gustCoherence: 0.94,
            windSpeed: 36.0,
            trailStrength: 0.65,
            heat: {
                cold: [0.15, 0.35, 0.65],  // Oceanic breeze blue
                warm: [0.85, 0.45, 0.35],  // Warm terracotta ground scatter (Image 1 & 2)
                hot: [0.95, 0.92, 0.85]     // Crisp sunlight highlight
            },
            emberBudget: 0,
            soundPitch: 95,
            soundDuration: 11.8,
            soundType: 'sine'
        },
        EXPLODE: {
            expansionDuration: 1.2,
            driftDuration: 3.0,
            contractionDuration: 1.8,
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
            expansionDuration: 1.2,
            driftDuration: 3.0,
            contractionDuration: 1.8,
            explosionMaxDistMultiplier: 15.0,
            motionStyle: -1, // random per blast
            spokes: 12,
            spokeJitter: 0.03,
            spinSpeed: 0,
            funnelHeight: 0,
            funnelBottom: 0,
            funnelCrownRadius: 0,
            funnelWaistRadius: 0,
            funnelTailRadius: 0,
            funnelWaistT: 0,
            funnelCrownT: 0,
            funnelFadeStart: 0,
            funnelFadeEnd: 0,
            gustCoherence: 0,
            swayAmp: 0,
            swayFreq: 0,
            gustAmp: 0,
            gustFreq: 0,
            windDrift: 0,
            turbulence: 0,
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

// Shared gust direction and perpendicular plane for Breeze wave undulations
let gustX = 1, gustY = 0, gustZ = 0;
let activeBreezeConfig = null;
let gustPerpX = 0, gustPerpY = 1, gustPerpZ = 0;
let activeGustX = 1, activeGustY = 0;

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
uniform float uExplosionActive;
uniform float uTornadoActive;
uniform float uTornadoFadeStart;
uniform float uTornadoFadeEnd;
uniform float uHeatDistance;
uniform vec3 uHeatCold;
uniform vec3 uHeatWarm;
uniform vec3 uHeatHot;
uniform float uAudioMid;
uniform float uAudioHigh;
uniform float uAudioEnvelope;
uniform float uEmojiMode;
uniform float uEmojiMotionMix;

attribute vec3 homePosition;
attribute vec4 sourceColor;
attribute float sampleSize;
attribute float funnelT;
attribute vec2 aSourceUV;

varying vec3 vColor;
varying float vCoverage;
varying float vTornadoFade;
varying vec2 vSourceUV;

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
    vSourceUV = aSourceUV;

    // Safe fade for the funnel tail: clamped instead of smoothstep so equal uniform
    // edges (non-Tornado presets) can never produce undefined values that poison alpha.
    float funnelFade = clamp(
        (funnelT - uTornadoFadeStart) / max(uTornadoFadeEnd - uTornadoFadeStart, 1e-4),
        0.0, 1.0);
    vTornadoFade = mix(1.0, 0.14 + 0.86 * funnelFade, uTornadoActive);

    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;

    // Size attenuation - corrected for device pixel ratio. Under the orthographic
    // projection mvPosition.z is constant, so the perspective divisor is replaced
    // by the per-frame uPointScale uniform (same visual size at every zoom level).
    // Each particle is sized by the source raster cell it represents, so interior
    // cells (sampleSize 2) cover their grid and feature edges stay sharp (size 1).
    float effectiveSampleSize = mix(sampleSize, 1.0, uEmojiMode);
    gl_PointSize = uPointSize * uPixelRatio * uPointScale * depthCue * effectiveSampleSize;
    // Hotter (more displaced) particles grow slightly to emphasize the leading edge;
    // high-frequency audio sparkle also nudges size up.
    gl_PointSize *= (1.0 + 0.5 * heat * uExplosionActive + 0.2 * uAudioHigh);
    gl_PointSize *= mix(1.0, 0.76 + 0.24 * funnelFade, uTornadoActive);
}
`;

const fragmentShader = `
uniform float uEmojiMode;
uniform float uUseSourceTexture;
uniform sampler2D uSourceTexture;
varying vec3 vColor;
varying float vCoverage;
varying float vTornadoFade;
varying vec2 vSourceUV;

void main() {
    // Soft circular falloff with a solid bright core for lively, luminous dots
    vec2 cxy = 2.0 * gl_PointCoord - 1.0;
    float r = dot(cxy, cxy);
    if (r > 1.0) discard;
    float softEdge = 1.0 - smoothstep(0.3, 1.0, r);

    // Approach C: sample the source canvas texture at this particle's UV coordinate.
    // Enhanced vibrancy & brightness boost so emojis and images feel luminous and alive.
    if (uUseSourceTexture > 0.5) {
        vec4 texel = texture2D(uSourceTexture, vSourceUV);
        vec3 vibrantColor = min(vec3(1.0), texel.rgb * 1.20);
        vec3 blendedColor = mix(vibrantColor, vColor, uEmojiMode * (1.0 - uUseSourceTexture + 0.001));
        float texAlpha = texel.a * softEdge * vTornadoFade;
        gl_FragColor = vec4(blendedColor, texAlpha);
        return;
    }

    float alpha = 0.9 * softEdge;
    // Emoji particles fade with their source coverage, keeping anti-aliased glyph
    // edges soft; text particles stay fully opaque as before.
    alpha *= mix(1.0, vCoverage, uEmojiMode);
    alpha *= vTornadoFade;
    gl_FragColor = vec4(vColor, alpha);
}
`;

// Trail streaks: additive after-images that chase the live positions, so fast
// particles leave coloured trails matching their displacement heat.
// Secondary ember sparks that burst from the fastest particles at peak expansion.
// ─────────────────────────────────────────────
// State grouped into named objects
// ─────────────────────────────────────────────

// Global configuration state
const state = {
    currentText: 'Bring your message!',
    currentTheme: 'ember',
    currentFont: 'Outfit',
    messageMode: 'text',
    activeImage: null,
    imageName: '',
    activePreset: null,  // Tracks which preset chip is currently selected
    activeEmoji: null,   // Set when an emoji is picked from the list; cleared by typing

    // Dynamic per-explosion properties
    expansionDuration: CONFIG.presets.DEFAULT.expansionDuration,
    driftDuration: CONFIG.presets.DEFAULT.driftDuration || 3.0,
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
        spokes:       CONFIG.presets.DEFAULT.spokes,
        spokeJitter:  CONFIG.presets.DEFAULT.spokeJitter,
        spinSpeed:    CONFIG.presets.DEFAULT.spinSpeed,
        funnelHeight: CONFIG.presets.DEFAULT.funnelHeight,
        funnelBottom: CONFIG.presets.DEFAULT.funnelBottom,
        funnelCrownRadius: CONFIG.presets.DEFAULT.funnelCrownRadius,
        funnelWaistRadius: CONFIG.presets.DEFAULT.funnelWaistRadius,
        funnelTailRadius: CONFIG.presets.DEFAULT.funnelTailRadius,
        funnelWaistT: CONFIG.presets.DEFAULT.funnelWaistT,
        funnelCrownT: CONFIG.presets.DEFAULT.funnelCrownT,
        funnelFadeStart: CONFIG.presets.DEFAULT.funnelFadeStart,
        funnelFadeEnd: CONFIG.presets.DEFAULT.funnelFadeEnd,
        gustCoherence: CONFIG.presets.DEFAULT.gustCoherence,
        swayAmp:      CONFIG.presets.DEFAULT.swayAmp,
        swayFreq:     CONFIG.presets.DEFAULT.swayFreq,
        gustAmp:      CONFIG.presets.DEFAULT.gustAmp,
        gustFreq:     CONFIG.presets.DEFAULT.gustFreq,
        windDrift:    CONFIG.presets.DEFAULT.windDrift,
        turbulence:   CONFIG.presets.DEFAULT.turbulence
    },
    heatCold: [0.1, 0.4, 1.0],
    heatWarm: [1.0, 1.0, 0.1],
    heatHot: [1.0, 0.1, 0.1],

    get totalExplosionDuration() {
        const style = (physics && physics.activeStyle >= 0) ? physics.activeStyle : this.motionStyle;
        if (style === 1) {
            // 4-Phase ~15s Tornado Simulation
            const exp = this.expansionDuration || 3.5;
            const vortex = (this.pattern && this.pattern.vortexDuration) ? this.pattern.vortexDuration : 4.5;
            const equil = (this.pattern && this.pattern.equilibriumDuration) ? this.pattern.equilibriumDuration : 3.5;
            const con = this.contractionDuration || 3.5;
            return exp + vortex + equil + con; // 15.0s
        }
        if (style === 2) {
            // 4-Phase Breeze: Straight Fall (1.0s) + Ground Pause (2.0s) + Forward Breeze (3.6s) + Reverse Breeze (3.6s) + Elevation (1.6s) = 11.8s
            return 11.8;
        }
        const exp = this.activeExpansionDuration || this.expansionDuration;
        const con = this.activeContractionDuration || this.contractionDuration;
        const drift = (style === 0 || style === 3 || style === -1) ? 3.0 : 0.0;
        return exp + drift + con;
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
    funnelT: null,      // Stable vertical role for the Tornado funnel
    funnelRadialX: null, // Stable radial role in the screen/depth XZ plane
    funnelRadialZ: null,
    activeStyle: -1,    // Actual style selected for the current blast
    slots: [],          // Double-buffered working sets transferred to the worker
    sendQueue: [],      // FIFO of slots currently in flight at the worker
    seq: 0,             // Monotonic token echoed by the worker to pair replies
    sourceGeneration: 0, // Reject worker results from an older text layout
    motionToken: 0,     // Reject worker results from an older blast/recovery phase
    explosionStartTime: -1,
    positionsDirty: false, // true when a fresh worker result (or fallback step) moved particles
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
    uExplosionActive: { value: 0.0 },
    uTornadoActive: { value: 0.0 },
    uTornadoFadeStart: { value: 0.03 },
    uTornadoFadeEnd: { value: 0.30 },
    // Fixed motion-heat distance for every preset (red = 1/3 screen height at rest).
    uHeatDistance: { value: CONFIG.heatDistance },
    // Per-preset motion heatmap (cold = far, mid = mid, hot = leading edge).
    // The active preset's palette is applied on selection via applyPresetPhysics().
    uHeatCold: { value: new Vector3(0.1, 0.4, 1.0) },
    uHeatWarm: { value: new Vector3(1.0, 1.0, 0.1) },
    uHeatHot: { value: new Vector3(1.0, 0.1, 0.1) },
    // Audio-reactive energy bands (from the shared analyser).
    uAudioMid: { value: 0.0 },
    uAudioHigh: { value: 0.0 },
    uAudioEnvelope: { value: 0.0 },
    // Trail renderer uniforms.
    uPointSizeTrail: { value: 0.4 },
    uTrailStrength: { value: 0.25 },
    // Emoji source-color mode (0 = theme/heat palette, 1 = sampled glyph colors).
    uEmojiMode: { value: 0 },
    uEmojiMotionMix: { value: CONFIG.emojiMotionMix },
    // Approach C: source texture sampling (0 = disabled, 1 = full texture)
    uUseSourceTexture: { value: 0.0 },
    uSourceTexture: { value: null }
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
    uniforms.uAudioMid.value  += (mid  - uniforms.uAudioMid.value)  * 0.5;
    uniforms.uAudioHigh.value += (high - uniforms.uAudioHigh.value) * 0.5;
    const env = Math.min(1, bass * 1.3 + mid * 0.5 + high * 0.6);
    uniforms.uAudioEnvelope.value += (env - uniforms.uAudioEnvelope.value) * 0.6;
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
// Uploaded Image Rasterization
// ─────────────────────────────────────────────
let imageCanvas = null;
let imageCtx = null;

function sampleImagePoints(image) {
    if (!image) return null;
    const sourceWidth = image.naturalWidth || image.width;
    const sourceHeight = image.naturalHeight || image.height;
    if (!sourceWidth || !sourceHeight) return null;

    if (!imageCanvas) {
        imageCanvas = document.createElement('canvas');
        imageCtx = imageCanvas.getContext('2d', { willReadFrequently: true });
    }

    const size = CONFIG.imageRasterSize;
    const canvas = imageCanvas;
    const ctx = imageCtx;
    canvas.width = size;
    canvas.height = size;
    ctx.clearRect(0, 0, size, size);
    ctx.imageSmoothingEnabled = true;

    const padding = Math.round(size * 0.04);
    const drawScale = Math.min(
        (size - padding * 2) / sourceWidth,
        (size - padding * 2) / sourceHeight
    );
    const drawWidth = Math.max(1, Math.round(sourceWidth * drawScale));
    const drawHeight = Math.max(1, Math.round(sourceHeight * drawScale));
    const drawX = Math.round((size - drawWidth) / 2);
    const drawY = Math.round((size - drawHeight) / 2);
    ctx.drawImage(image, drawX, drawY, drawWidth, drawHeight);

    const imgData = ctx.getImageData(0, 0, size, size).data;
    const step = CONFIG.imagePixelStep;
    const alphaThreshold = CONFIG.imageAlphaThreshold;
    const basePoints = [];
    const colors = [];
    const covers = [];
    const sizes = [];
    const isEdgeList = [];
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;

    const alphaOf = (x, y) => {
        if (x < 0 || y < 0 || x >= size || y >= size) return 0;
        return imgData[(y * size + x) * 4 + 3];
    };

    for (let y = 0; y < size; y += step) {
        for (let x = 0; x < size; x += step) {
            const i = (y * size + x) * 4;
            const alpha = imgData[i + 3];
            if (alpha <= alphaThreshold) continue;

            basePoints.push(x, y);
            colors.push(imgData[i], imgData[i + 1], imgData[i + 2]);
            covers.push(alpha);
            sizes.push(1);

            const isBoundary = alphaOf(x - step, y) <= alphaThreshold
                || alphaOf(x + step, y) <= alphaThreshold
                || alphaOf(x, y - step) <= alphaThreshold
                || alphaOf(x, y + step) <= alphaThreshold;
            isEdgeList.push(isBoundary);

            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
        }
    }

    if (basePoints.length === 0) return null;

    const sourceWidthPx = Math.max(maxX - minX, 1);
    const sourceHeightPx = Math.max(maxY - minY, 1);
    const scale = CONFIG.targetWorldWidth / Math.max(sourceWidthPx, sourceHeightPx);
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;

    const depthRange = CONFIG.imageDepthRange || 5.0;
    const halfD = depthRange * 0.5;
    const baseCount = basePoints.length / 2;

    const outPts = [];
    const outUVs = [];
    const outColors = [];
    const outCovers = [];
    const outSizes = [];

    // 1. Back Face (drawn first)
    for (let i = 0; i < baseCount; i += 8) {
        const px = basePoints[i * 2], py = basePoints[i * 2 + 1];
        outPts.push((px - cx) * scale, (cy - py) * scale, -halfD);
        outUVs.push(px / size, 1.0 - (py / size));
        outColors.push(colors[i * 3], colors[i * 3 + 1], colors[i * 3 + 2]);
        outCovers.push(covers[i]);
        outSizes.push(sizes[i]);
    }

    // 2. Extrusion Side Rims (drawn second)
    for (let i = 0; i < baseCount; i++) {
        if (!isEdgeList[i]) continue;
        const px = basePoints[i * 2], py = basePoints[i * 2 + 1];
        const r = colors[i * 3], g = colors[i * 3 + 1], b = colors[i * 3 + 2];
        const a = covers[i], s = sizes[i];
        const u = px / size, v = 1.0 - (py / size);
        const wx = (px - cx) * scale, wy = (cy - py) * scale;

        outPts.push(wx, wy, -halfD * 0.33);
        outUVs.push(u, v);
        outColors.push(r, g, b);
        outCovers.push(a);
        outSizes.push(s);

        outPts.push(wx, wy, halfD * 0.33);
        outUVs.push(u, v);
        outColors.push(r, g, b);
        outCovers.push(a);
        outSizes.push(s);
    }

    // 3. Front Face (drawn LAST, on top of everything)
    for (let i = 0; i < baseCount; i++) {
        const px = basePoints[i * 2], py = basePoints[i * 2 + 1];
        outPts.push((px - cx) * scale, (cy - py) * scale, halfD);
        outUVs.push(px / size, 1.0 - (py / size));
        outColors.push(colors[i * 3], colors[i * 3 + 1], colors[i * 3 + 2]);
        outCovers.push(covers[i]);
        outSizes.push(sizes[i]);
    }

    const flat = new Float32Array(outPts);
    const uvs = new Float32Array(outUVs);
    const colorsOut = new Uint8Array(outColors);
    const coversOut = new Uint8Array(outCovers);
    const sizesOut = new Uint8Array(outSizes);

    return {
        flat,
        uvs,
        colors: colorsOut,
        covers: coversOut,
        sizes: sizesOut,
        featureCount: baseCount,
        frontCount: baseCount,
        bounds: { w: sourceWidthPx, h: sourceHeightPx },
        sourceCanvas: canvas
    };
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
    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = 'white';
    ctx.font = `${CONFIG.emojiFontSize}px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(emoji, size / 2, size / 2 + size * 0.02);

    const imgData = ctx.getImageData(0, 0, size, size).data;
    const step = CONFIG.emojiPixelStep || 2;
    const alphaThr = CONFIG.pixelThreshold;     // coverage mask (0-255)

    const basePoints = [];
    const colors = [];
    const covers = [];
    const sizes = [];
    const isEdgeList = [];
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;

    const alphaOf = (x, y) => {
        if (x < 0 || y < 0 || x >= size || y >= size) return 0;
        return imgData[(y * size + x) * 4 + 3];
    };

    // Single uniform raster grid sampling across the entire emoji (equal density everywhere)
    for (let y = 0; y < size; y += step) {
        for (let x = 0; x < size; x += step) {
            const i = (y * size + x) * 4;
            const alpha = imgData[i + 3];
            if (alpha <= alphaThr) continue;

            basePoints.push(x, y);
            colors.push(imgData[i], imgData[i + 1], imgData[i + 2]);
            covers.push(alpha);
            sizes.push(1); // Uniform dot size across all regions

            const isBoundary = alphaOf(x - step, y) <= alphaThr
                || alphaOf(x + step, y) <= alphaThr
                || alphaOf(x, y - step) <= alphaThr
                || alphaOf(x, y + step) <= alphaThr;
            isEdgeList.push(isBoundary);

            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
        }
    }

    if (basePoints.length === 0) return null;

    const scale = CONFIG.targetWorldWidth / Math.max(maxX - minX, 1);
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;

    const depthRange = CONFIG.emojiDepthRange || 5.0;
    const halfD = depthRange * 0.5;
    const baseCount = basePoints.length / 2;

    const outPts = [];
    const outUVs = [];
    const outColors = [];
    const outCovers = [];
    const outSizes = [];

    // 1. Back Face (z = -halfD, sampled at 4px stride, drawn first behind)
    for (let i = 0; i < baseCount; i += 4) {
        const px = basePoints[i * 2], py = basePoints[i * 2 + 1];
        outPts.push((px - cx) * scale, (cy - py) * scale, -halfD);
        outUVs.push(px / size, 1.0 - (py / size));
        outColors.push(colors[i * 3], colors[i * 3 + 1], colors[i * 3 + 2]);
        outCovers.push(covers[i]);
        outSizes.push(1);
    }

    // 2. Extrusion Side Rims (silhouette perimeter pixels along depth)
    for (let i = 0; i < baseCount; i++) {
        if (!isEdgeList[i]) continue;
        const px = basePoints[i * 2], py = basePoints[i * 2 + 1];
        const r = colors[i * 3], g = colors[i * 3 + 1], b = colors[i * 3 + 2];
        const a = covers[i];
        const u = px / size, v = 1.0 - (py / size);
        const wx = (px - cx) * scale, wy = (cy - py) * scale;

        outPts.push(wx, wy, -halfD * 0.33);
        outUVs.push(u, v);
        outColors.push(r, g, b);
        outCovers.push(a);
        outSizes.push(1);

        outPts.push(wx, wy, halfD * 0.33);
        outUVs.push(u, v);
        outColors.push(r, g, b);
        outCovers.push(a);
        outSizes.push(1);
    }

    // 3. Front Face (z = +halfD, 100% full uniform density, drawn last on top)
    for (let i = 0; i < baseCount; i++) {
        const px = basePoints[i * 2], py = basePoints[i * 2 + 1];
        outPts.push((px - cx) * scale, (cy - py) * scale, halfD);
        outUVs.push(px / size, 1.0 - (py / size));
        outColors.push(colors[i * 3], colors[i * 3 + 1], colors[i * 3 + 2]);
        outCovers.push(covers[i]);
        outSizes.push(1);
    }

    const flat = new Float32Array(outPts);
    const uvs = new Float32Array(outUVs);
    const colorsOut = new Uint8Array(outColors);
    const coversOut = new Uint8Array(outCovers);
    const sizesOut = new Uint8Array(outSizes);

    return {
        flat,
        uvs,
        colors: colorsOut,
        covers: coversOut,
        sizes: sizesOut,
        featureCount: baseCount,
        frontCount: baseCount,
        bounds: { w: maxX - minX, h: maxY - minY },
        sourceCanvas: canvas
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

    // Emojis picked from the list and uploaded images use their source pixels;
    // anything typed or loaded as regular text keeps the standard text path.
    const isEmojiMessage = state.messageMode === 'text'
        && state.activeEmoji === text
        && CONFIG.emojiOptions.includes(text);
    const isImageMessage = state.messageMode === 'image' && !!state.activeImage;
    const emojiData = isEmojiMessage ? sampleEmojiPoints(text) : null;
    const imageData = isImageMessage ? sampleImagePoints(state.activeImage) : null;
    const sourceData = emojiData || imageData;
    const isSourceMessage = !!sourceData;
    const points = sourceData ? sourceData.flat : (isImageMessage ? null : sampleTextPoints(text));
    if (!points) {
        showToast(isImageMessage ? 'The image has no visible pixels!' : 'Text must contain at least one visible character!');
        return;
    }

    // One particle per sampled cell for source images (max recognizable detail under
    // the particle cap) instead of the text path's density-clone stacking.
    const { jitterXY, jitterZ, explosionSpeedMin, explosionSpeedRange } = CONFIG;
    const density = isSourceMessage ? CONFIG.emojiDensityOverride : CONFIG.density;
    let pointCount = points.length / 3;
    let step = 1;

    // Subsample points if overall particle count budget is exceeded. Emoji features
    // are kept first; image pixels use a regular stride over the source raster.
    const maxParticles = currentParticleCap();
    const maxPoints = Math.floor(maxParticles / density);
    let flat = points;
    let srcColors = null;   // Uint8Array RGB source colors
    let srcCovers = null;   // Uint8Array source coverage
    let srcSizes = null;    // Uint8Array raster cell size per sample
    let srcUVs  = null;    // Float32Array UV coords (Approach C)
    if (isSourceMessage) {
        srcColors = sourceData.colors;
        srcCovers = sourceData.covers;
        srcSizes = sourceData.sizes;
        srcUVs   = sourceData.uvs || null;
        if (pointCount > maxParticles) {
            const keep = [];
            const frontCount = sourceData.frontCount || pointCount;

            if (frontCount <= maxParticles) {
                // Front face fits entirely within budget! Keep 100% of the front face.
                for (let i = 0; i < frontCount; i++) keep.push(i);

                // Allocate remaining budget to side and back points
                const remaining = maxParticles - frontCount;
                const extraCount = pointCount - frontCount;
                if (remaining > 0 && extraCount > 0) {
                    const extraStep = Math.max(1, Math.ceil(extraCount / remaining));
                    for (let i = frontCount; i < pointCount && keep.length < maxParticles; i += extraStep) {
                        keep.push(i);
                    }
                }
            } else {
                // Front face itself exceeds budget (e.g. CPU fallback 15k cap on large image).
                // Use a uniform 2D stride that covers all rows/columns evenly without vertical banding.
                const step = Math.ceil(frontCount / maxParticles);
                for (let i = 0; i < frontCount && keep.length < maxParticles; i += step) {
                    keep.push(i);
                }
            }

            const cFlat = new Float32Array(keep.length * 3);
            const cColors = new Uint8Array(keep.length * 3);
            const cCovers = new Uint8Array(keep.length);
            const cSizes = new Uint8Array(keep.length);
            const cUVs = srcUVs ? new Float32Array(keep.length * 2) : null;
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
                if (cUVs && srcUVs) {
                    cUVs[k * 2]     = srcUVs[i * 2];
                    cUVs[k * 2 + 1] = srcUVs[i * 2 + 1];
                }
            }
            flat = cFlat;
            srcColors = cColors;
            srcCovers = cCovers;
            srcSizes = cSizes;
            srcUVs  = cUVs;
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
    physics.funnelT = new Float32Array(finalCount);
    physics.funnelRadialX = new Float32Array(finalCount);
    physics.funnelRadialZ = new Float32Array(finalCount);

    // Stable low-discrepancy roles fill the funnel evenly without per-frame random
    // work. The vertical role is biased slightly toward the broad crown so the
    // narrow tail remains a sparse, fading stream rather than a dense stem.
    const goldenAngle = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < finalCount; i++) {
        // Distribute particles across height with dense sampling along the conical vortex
        const verticalSeed = (i * 0.6180339887498949 + 0.5) % 1;
        const shellDist = 0.75 + 0.3 * ((i * 0.7548776662466927 + 0.17) % 1);
        const angle = (i * goldenAngle) % (Math.PI * 2);
        physics.funnelT[i] = Math.pow(verticalSeed, 0.85);
        physics.funnelRadialX[i] = Math.cos(angle) * shellDist;
        physics.funnelRadialZ[i] = Math.sin(angle) * shellDist;
    }

    // Per-particle source appearance: RGBA + raster-cell size. Emojis carry their
    // sampled glyph colors/coverage; text is white/opaque unit-size cells.
    const srcColorArr = new Uint8Array(finalCount * 4);
    const srcSizeArr = new Uint8Array(finalCount);
    // Approach C: UV attribute buffer (2 floats per particle).
    const srcUVArr = new Float32Array(finalCount * 2);

    // Build fresh double-buffered worker working sets below (after resident buffers
    // are populated), since any prior in-flight slots have been transferred away.

    // Emoji/image layouts keep their 2D source continuity: much lower XY/Z jitter
    // than text so thin internal details stay continuous.
    const imageJitter = isEmojiMessage
        ? { xy: CONFIG.emojiJitterXY, z: CONFIG.emojiJitterZ }
        : { xy: CONFIG.imageJitterXY, z: CONFIG.imageJitterZ };
    const jx = isSourceMessage ? imageJitter.xy : jitterXY;
    const jz = isSourceMessage ? imageJitter.z : jitterZ;

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
                // Approach C: copy UV from the source point (density clones share it).
                if (srcUVs) {
                    srcUVArr[idx * 2]     = srcUVs[i * 2];
                    srcUVArr[idx * 2 + 1] = srcUVs[i * 2 + 1];
                }
            } else {
                srcColorArr[idx * 4]     = 255;
                srcColorArr[idx * 4 + 1] = 255;
                srcColorArr[idx * 4 + 2] = 255;
                srcColorArr[idx * 4 + 3] = 255;
                srcSizeArr[idx] = 1;
                // Text particles: UV is zeroed (uUseSourceTexture will be 0 for text).
                srcUVArr[idx * 2] = 0;
                srcUVArr[idx * 2 + 1] = 0;
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
    geo.setAttribute('funnelT', new BufferAttribute(physics.funnelT, 1));
    // Approach C: UV attribute for source texture sampling.
    geo.setAttribute('aSourceUV', new BufferAttribute(srcUVArr, 2));

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

    // Source layouts (emoji/image) use the sampled source colors with normal alpha
    // blending (so dark pixels render) and a crisp, low-jitter, low-depth-cue
    // profile. Text keeps the theme/heat additive style unchanged.
    uniforms.uEmojiMode.value = isSourceMessage ? 1 : 0;
    uniforms.uPointSize.value = isEmojiMessage
        ? CONFIG.emojiPointSize
        : (isImageMessage ? CONFIG.imagePointSize : CONFIG.pointSize);
    uniforms.uDepthCue.value = isEmojiMessage
        ? CONFIG.emojiDepthCue
        : (isImageMessage ? CONFIG.imageDepthCue : 0.28);
    render.particles.material.blending = isSourceMessage ? NormalBlending : AdditiveBlending;
    render.particles.material.needsUpdate = true;

    // Approach C: upload the source canvas as a texture and enable texture sampling.
    // Dispose the previous texture first to prevent GPU memory leaks (the memory
    // test already tracks textureCount, so this must stay clean across rebuilds).
    if (uniforms.uSourceTexture.value) {
        uniforms.uSourceTexture.value.dispose();
        uniforms.uSourceTexture.value = null;
    }
    if (isSourceMessage && sourceData && sourceData.sourceCanvas) {
        const tex = new CanvasTexture(sourceData.sourceCanvas);
        tex.minFilter = LinearFilter;
        tex.magFilter = LinearFilter;
        tex.needsUpdate = true;
        uniforms.uSourceTexture.value = tex;
        uniforms.uUseSourceTexture.value = 1.0;
    } else {
        uniforms.uUseSourceTexture.value = 0.0;
    }

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
                funnelT: physics.funnelT.slice(),
                funnelRadialX: physics.funnelRadialX.slice(),
funnelRadialZ: physics.funnelRadialZ.slice()
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
    tgeo.setAttribute('funnelT', new BufferAttribute(physics.funnelT, 1));
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
function updateTrails() {
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
    }
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
    // 0: uniform sphere (Explode), 1: tornado funnel (Tornado),
    // 2: coherent wind gust (Breeze), 3: crisp starburst rays (Kinetic).
    // Respect a pinned preset style when one is active.
    const style = (typeof state.motionStyle === 'number' && state.motionStyle >= 0)
        ? state.motionStyle
        : Math.floor(Math.random() * 4);

    // Procedural randomized 3D silk wave landscape configuration for Breeze (style 2)
    const blowFromLeft = Math.random() < 0.5;
    const dirX = blowFromLeft ? 1.0 : -1.0;
    let gx = dirX;
    let gy = (Math.random() - 0.5) * 0.08;
    let gz = (Math.random() - 0.5) * 0.05;
    const glen = Math.sqrt(gx * gx + gy * gy + gz * gz) || 1;
    gx /= glen; gy /= glen; gz /= glen;
    gustX = gx; gustY = gy; gustZ = gz;
    gustPerpX = 0; gustPerpY = 1.0; gustPerpZ = 0;

    activeBreezeConfig = {
        blowDir: dirX,
        windAngleY: (Math.random() - 0.5) * 0.22,
        windAngleZ: (Math.random() - 0.5) * 0.12,
        strengthMult: 0.58 + Math.random() * 0.44, // Randomized gentle strength per activation (0.58 - 1.02)
        easePower: 1.45 + Math.random() * 0.40,    // Soft non-linear onset curve
        seedXi: Math.random() * 100.0,
        peakX: (Math.random() - 0.5) * 22.0,
        peakY: 3.5 + Math.random() * 5.0,
        peakAmp: 16.0 + Math.random() * 7.0,
        peakWidthX: 0.065 + Math.random() * 0.025,
        peakWidthY: 0.11 + Math.random() * 0.035,
        creaseY: -(3.5 + Math.random() * 4.0),
        creaseAmp: 6.5 + Math.random() * 3.0,
        creaseFreq: 0.11 + Math.random() * 0.04,
        billowAmp1: 7.5 + Math.random() * 3.0,
        billowAmp2: 3.0 + Math.random() * 2.0,
        depthAmp: 13.0 + Math.random() * 4.5,
        turbAmp: 3.0 + Math.random() * 1.8,
        shearMult: 0.22 + Math.random() * 0.18
    };
    physics.breeze = activeBreezeConfig;

    // Fibonacci-sphere spoke lattice for style 3 (deterministic per spoke index).
    const spokes = Math.max(2, pattern.spokes || 12);
    const jitter = (pattern.spokeJitter != null) ? pattern.spokeJitter : 0.03;
    const golden = Math.PI * (3 - Math.sqrt(5));

    for (let i = 0; i < count; i++) {
        const ix = i * 3, iy = ix + 1, iz = ix + 2;

        let rx, ry, rz;

        if (style === 1) {
            // Tornado directions use screen-up Y and swirl in the visible X/Z
            // funnel plane. The actual target profile is applied in the update loop;
            // these directions keep the blast's semantic debug signal consistent.
            const hx = home[ix], hz = home[iz];
            const r2 = hx * hx + hz * hz;
            let tx, tz;
            if (r2 > 1e-6) {
                const inv = 1 / Math.sqrt(r2);
                tx = -hz * inv;
                tz =  hx * inv;
            } else {
                const a = Math.random() * Math.PI * 2;
                tx = Math.cos(a); tz = Math.sin(a);
            }
            const spinSign = Math.random() < 0.5 ? 1 : -1;
            rx = tx * spinSign + (Math.random() - 0.5) * 0.15;
            ry = 0.72 + (Math.random() - 0.5) * 0.12;
            rz = tz * spinSign + (Math.random() - 0.5) * 0.15;
        } else if (style === 2) {
            // Traveling horizontal wind gust: strictly Left-to-Right or Right-to-Left
            const dirSign = Math.random() < 0.5 ? 1 : -1;
            gx = dirSign;
            gy = (Math.random() - 0.5) * 0.04;
            gz = (Math.random() - 0.5) * 0.04;
            const gLen = Math.hypot(gx, gy, gz) || 1;
            gx /= gLen; gy /= gLen; gz /= gLen;

            rx = gx * 0.92 + (Math.random() * 2 - 1) * 0.08;
            ry = (Math.random() * 2 - 1) * 0.12;
            rz = (Math.random() * 2 - 1) * 0.12;
            activeGustX = gx;
            activeGustY = gy;
            gustX = gx; gustY = gy; gustZ = gz;
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
            // Strong gust: fast, purposeful speeds so the breeze reads clearly.
            physics.randomSpeed[i] = (explosionSpeedMin + Math.random() * explosionSpeedRange) * (1.4 + Math.random() * 0.9);
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
    physics.activeStyle = style;
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
            if (!slot.posLive || !slot.posLive.buffer || slot.posLive.buffer.byteLength === 0) {
                slot.posLive = new Float32Array(current.length);
                slot.springDisp = new Float32Array(current.length);
                slot.springVel = new Float32Array(current.length);
            }
            slot.posLive.set(current);
            slot.springDisp.fill(0);
            slot.springVel.fill(0);
            slot.needsReset = false;
        }
    }
}

function triggerExplosion(force = false) {
    if (physics.explosionStartTime >= 0 && !force) return;
    physics.explosionStartTime = -1;

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
                breeze: activeBreezeConfig,
                explosionOrigin: physics.explosionOrigin.slice(),
                motionToken: physics.motionToken,
                sourceGeneration: physics.sourceGeneration
            }
        });
    } else {
        randomizeExplosionVectors();
    }

    physics.explosionStartTime = render.clock.getElapsedTime();
    if (state.motionStyle !== 2 && state.motionStyle !== 1) {
        flashImpact();
    }
    playExplosionSound(estimatedRecovery);
    announceToScreenReader(`Explosion triggered for "${state.currentText}"`);
}

function explosionAnchorWeight(elapsed, expansionDuration, contractionDuration) {
    if (elapsed <= 0) return 0;
    if (elapsed < expansionDuration) return 1;
    const t = Math.min(1, (elapsed - expansionDuration) / contractionDuration);
    return Math.max(0, 1 - t * t * t);
}

// Divergence-free 3D Curl-Noise fluid flow field (∇ · V_fluid ≡ 0).
// Simulates authentic Navier-Stokes vortex shedding, Kelvin-Helmholtz billows, and laminar shear.
// Parametric 3D Silk Wave Curtain Manifold (Image 1).
// Maps 2D particle topologies onto an undulating, continuous fluid fabric sheet with traveling crests,
// a prominent mountain-billow peak, and a hyper-luminous folded edge crease.
function silkCurtainBreeze(hx, hy, hz, elapsed, breezeProg, maxDist, pat, gustX, gustY) {
    const gx = gustX || 1.0, gy = gustY || 0.0;
    const px = -gy, py = gx; // Perpendicular lateral axis

    // Project particle home coordinate onto wind and lateral axes
    const s0 = hx * gx + hy * gy;
    const p0 = hx * px + hy * py;

    // Primary wind drift with lateral velocity shear
    const windSpeed = (pat.windSpeed || 24.0) * (maxDist / 20.0);
    const deltaS = windSpeed * breezeProg * (1.0 + 0.2 * Math.sin(p0 * 0.12));
    const xi = s0 + deltaS * 0.7; // Effective downwind coordinate for traveling wave sampling

    // Harmonic traveling billow waves
    const bAmp1 = pat.billowAmp1 || 14.0;
    const bAmp2 = pat.billowAmp2 || 6.0;
    const w1 = bAmp1 * Math.sin(0.11 * xi - 2.6 * elapsed) * (1.0 + 0.25 * Math.cos(0.14 * p0));
    const w2 = bAmp2 * Math.sin(0.22 * xi - 4.0 * elapsed + 0.3 * p0);

    // Prominent Gaussian billow peak (the sweeping mountain crest in Image 1)
    const peakX = ((elapsed * 7.0) % 100.0) - 50.0;
    const distSq = (xi - peakX) * (xi - peakX) + (p0 - 6.0) * (p0 - 6.0);
    const peakAmp = pat.peakAmp || 18.0;
    const peak = peakAmp * Math.exp(-distSq / (2.0 * 14.0 * 14.0));

    // Luminous folded edge crease (sharp illuminated foreground ribbon in Image 1)
    const creaseAmp = pat.creaseAmp || 10.0;
    const crease = creaseAmp * Math.pow(Math.sin(0.16 * xi - 3.0 * elapsed), 2) * Math.exp(-(p0 + 10.0) * (p0 + 10.0) / (2.0 * 7.0 * 7.0));

    // Combined lateral wave offset
    const deltaP = (w1 + w2 + peak - crease);

    // 3D Depth draping & perspective tilt
    const dAmp = pat.depthAmp || 16.0;
    const deltaZ = (dAmp * Math.sin(0.13 * xi - 2.2 * elapsed) * Math.cos(0.12 * p0) + 0.45 * p0);

    return {
        x: hx + (gx * deltaS + px * deltaP * breezeProg) * breezeProg,
        y: hy + (gy * deltaS + py * deltaP * breezeProg) * breezeProg,
        z: hz + (deltaZ * breezeProg) * breezeProg
    };
}

function curlNoiseFluid(px, py, pz, time, scale, intensity) {
    const s1 = scale * 0.08, s2 = scale * 0.16, s3 = scale * 0.32;
    const t1 = time * 1.8, t2 = time * 2.4, t3 = time * 3.2;

    const c1x = Math.cos(px * s1 + t1), s1x = Math.sin(px * s1 + t1);
    const c1y = Math.cos(py * s1 - t2), s1y = Math.sin(py * s1 - t2);
    const c1z = Math.cos(pz * s1 + t3), s1z = Math.sin(pz * s1 + t3);

    const c2x = Math.cos(px * s2 - t2), s2x = Math.sin(px * s2 - t2);
    const c2y = Math.cos(py * s2 + t3), s2y = Math.sin(py * s2 + t3);
    const c2z = Math.cos(pz * s2 - t1), s2z = Math.sin(pz * s2 - t1);

    const c3x = Math.cos(px * s3 + t3), s3x = Math.sin(px * s3 + t3);
    const c3y = Math.cos(py * s3 - t1), s3y = Math.sin(py * s3 - t1);
    const c3z = Math.cos(pz * s3 + t2), s3z = Math.sin(pz * s3 + t2);

    const vx = (-s1x * s1y - c1z * c1x) * 1.0 + (-s2x * s2y - c2z * c2x) * 0.5 + (-s3x * s3y - c3z * c3x) * 0.25;
    const vy = (-s1y * s1z - c1x * c1y) * 1.0 + (-s2y * s2z - c2x * c2y) * 0.5 + (-s3y * s3z - c3x * c3y) * 0.25;
    const vz = (-s1z * s1x - c1y * c1z) * 1.0 + (-s2z * s2x - c2y * c2z) * 0.5 + (-s3z * s3x - c3y * c3z) * 0.25;

    return {
        x: vx * intensity,
        y: vy * intensity,
        z: vz * intensity
    };
}

function tornadoEnvelope(elapsed, expansionDuration, contractionDuration) {
    if (elapsed <= 0) return 0;
    if (elapsed < expansionDuration) {
        const t = elapsed / expansionDuration;
        return t * (2 - t);
    }
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
    state.activeExpansionDuration = null;
    state.activeContractionDuration = null;
    state.expansionDuration = preset.expansionDuration;
    state.driftDuration = preset.driftDuration !== undefined ? preset.driftDuration : 0;
    state.contractionDuration = preset.contractionDuration;
    state.explosionMaxDistMultiplier = preset.explosionMaxDistMultiplier;
    state.motionStyle = (preset.motionStyle != null) ? preset.motionStyle : -1;
    physics.activeStyle = state.motionStyle;
    state.soundPitch = preset.soundPitch;
    state.soundDuration = preset.soundDuration;
    state.soundType = preset.soundType;
    state.trailStrength = (preset.trailStrength != null) ? preset.trailStrength : 0.25;

    state.pattern = {
        spokes:       (preset.spokes != null)       ? preset.spokes       : 12,
        spokeJitter:  (preset.spokeJitter != null)  ? preset.spokeJitter  : 0.03,
        spinSpeed:    (preset.spinSpeed != null)    ? preset.spinSpeed    : 0,
        funnelHeight: (preset.funnelHeight != null) ? preset.funnelHeight : 0,
        funnelBottom: (preset.funnelBottom != null) ? preset.funnelBottom : 0,
        funnelCrownRadius: (preset.funnelCrownRadius != null) ? preset.funnelCrownRadius : 0,
        funnelWaistRadius: (preset.funnelWaistRadius != null) ? preset.funnelWaistRadius : 0,
        funnelTailRadius: (preset.funnelTailRadius != null) ? preset.funnelTailRadius : 0,
        funnelWaistT: (preset.funnelWaistT != null) ? preset.funnelWaistT : 0,
        funnelCrownT: (preset.funnelCrownT != null) ? preset.funnelCrownT : 0,
        funnelFadeStart: (preset.funnelFadeStart != null) ? preset.funnelFadeStart : 0,
        funnelFadeEnd: (preset.funnelFadeEnd != null) ? preset.funnelFadeEnd : 0,
        vortexDuration: (preset.vortexDuration != null) ? preset.vortexDuration : 4.5,
        equilibriumDuration: (preset.equilibriumDuration != null) ? preset.equilibriumDuration : 3.5,
        gustCoherence:(preset.gustCoherence != null)? preset.gustCoherence: 0,
        swayAmp:      (preset.swayAmp != null)      ? preset.swayAmp      : 0,
        swayFreq:     (preset.swayFreq != null)     ? preset.swayFreq     : 0,
        gustAmp:      (preset.gustAmp != null)      ? preset.gustAmp      : 0,
        gustFreq:     (preset.gustFreq != null)     ? preset.gustFreq     : 0,
        windDrift:    (preset.windDrift != null)    ? preset.windDrift    : 0,
        turbulence:   (preset.turbulence != null)   ? preset.turbulence   : 0
    };

    state.heatCold = preset.heat ? preset.heat.cold : [0.1, 0.4, 1.0];
    state.heatWarm = preset.heat ? preset.heat.warm : [1.0, 1.0, 0.1];
    state.heatHot  = preset.heat ? preset.heat.hot  : [1.0, 0.1, 0.1];

    uniforms.uHeatCold.value.set(...state.heatCold);
    uniforms.uHeatWarm.value.set(...state.heatWarm);
    uniforms.uHeatHot.value.set(...state.heatHot);
    uniforms.uTornadoFadeStart.value = state.pattern.funnelFadeStart;
    uniforms.uTornadoFadeEnd.value = state.pattern.funnelFadeEnd;
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
async function applyPresetExplosion(presetName, shouldScatter = false) {
    applyPresetPhysics(CONFIG.presets[presetName] || CONFIG.presets.DEFAULT);

    // If particle positions need a full rebuild, do so; otherwise keep the formed sculpture
    if (shouldScatter) {
        await setupParticles(state.currentText, true);
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
    // the farthest zoom (smallest display), text fills most of the desktop stage,
    // and uploaded images are framed to fit the whole square in the stage.
    if (render.autoFit && stage.getBoundingClientRect().left > 0) {
        if (state.messageMode === 'image' && state.activeImage) {
            render.targetZ = imageAutoZoom(w, h);
        } else if (state.activeEmoji && CONFIG.emojiOptions.includes(state.currentText)) {
            render.targetZ = emojiAutoZoom(w, h);
        } else {
            render.targetZ = CONFIG.textAutoZoom;
        }
    }
}

// Frame the square 80-unit image raster inside the stage with explicit clearance
// from the stage edges (the left menu side and the bottom instructions overlay).
// The per-axis available space converts to a camera distance; the aspect cancels
// out, and the larger distance wins so both paddings are satisfied. Only the
// camera distance changes — the raster scale is untouched, so the image's own
// aspect ratio is preserved exactly.
function emojiAutoZoom(stageW, stageH) {
    const tanHalf = Math.tan(CONFIG.cameraAngleDeg * Math.PI / 360);
    const halfBox = CONFIG.targetWorldWidth / 2;
    // 16% margins around the emoji so it occupies ~68% of the stage height/width
    const padX = Math.max(stageW * 0.16, 80);
    const padY = Math.max(stageH * 0.16, 80);
    const availW = Math.max(stageW - 2 * padX, 1);
    const availH = Math.max(stageH - 2 * padY, 1);
    const zByHeight = halfBox * stageH / (tanHalf * availH);
    const zByWidth = halfBox * stageH / (tanHalf * availW);
    return Math.min(CONFIG.zoomMax, Math.max(zByHeight, zByWidth, CONFIG.zoomMin));
}

function imageAutoZoom(stageW, stageH) {
    const tanHalf = Math.tan(CONFIG.cameraAngleDeg * Math.PI / 360);
    const halfBox = CONFIG.targetWorldWidth / 2;
    const padX = Math.min(CONFIG.imageFitPadX, stageW * 0.35);
    const padY = Math.min(CONFIG.imageFitPadY, stageH * 0.35);
    const availW = Math.max(stageW - 2 * padX, 1);
    const availH = Math.max(stageH - 2 * padY, 1);
    const zByHeight = halfBox * stageH / (tanHalf * availH);
    const zByWidth = halfBox * stageH / (tanHalf * availW);
    return Math.min(CONFIG.zoomMax, Math.max(zByHeight, zByWidth, CONFIG.zoomMin));
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

// Toggle the Message Text/Image option tabs and their panels.
function setMessageModeUI(mode) {
    state.messageMode = mode === 'image' ? 'image' : 'text';
    document.querySelectorAll('.message-option').forEach(btn => {
        const on = btn.getAttribute('data-message-mode') === state.messageMode;
        btn.classList.toggle('active', on);
        btn.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    const textPanel = document.getElementById('text-message-mode');
    const imagePanel = document.getElementById('image-message-mode');
    if (textPanel) textPanel.hidden = state.messageMode !== 'text';
    if (imagePanel) imagePanel.hidden = state.messageMode !== 'image';
}

// Switch the active Message mode and rebuild the sculpture for the new source.
async function switchMessageMode(mode) {
    setMessageModeUI(mode);
    clearActivePresets();
    resetToDefaultExplosion();
    if (state.messageMode === 'text') {
        state.activeEmoji = CONFIG.emojiOptions.includes(state.currentText) ? state.currentText : null;
        setEmojiActive(state.activeEmoji);
        await setupParticles(state.currentText, false);
    } else if (state.activeImage) {
        await setupParticles(state.currentText, false);
    }
}

// Turn a chosen image file into the active particle sculpture (local only).
function handleImageUpload(file) {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
        showToast('Please choose an image file!');
        return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = async () => {
        URL.revokeObjectURL(url);
        state.activeImage = img;
        state.imageName = file.name;
        state.activeEmoji = null;
        setEmojiActive(null);
        clearActivePresets();
        resetToDefaultExplosion();
        const imageName = document.getElementById('image-name');
        if (imageName) imageName.textContent = file.name;
        await setupParticles(state.currentText, false);
        announceToScreenReader(`Image uploaded: ${file.name}`);
    };
    img.onerror = () => {
        URL.revokeObjectURL(url);
        showToast('Could not read that image!');
    };
    img.src = url;
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
            state.activeImage = null; // ... and drops any uploaded image
            setEmojiActive(null);
            resetToDefaultExplosion(); // Typing resets preset physics details
            updateCharCounter(textInput.value);
            clearTimeout(interaction.inputDebounceTimer);
            interaction.inputDebounceTimer = setTimeout(async () => {
                await updateText(textInput.value);
            }, CONFIG.inputDebounceMs);
        });
    }

    // Message Text/Image option tabs
    document.querySelectorAll('.message-option').forEach(btn => {
        btn.addEventListener('click', () => {
            switchMessageMode(btn.getAttribute('data-message-mode'));
        });
    });

    // Image upload: rasterize the chosen file into the particle sculpture
    const imageInput = document.getElementById('image-input');
    if (imageInput) {
        imageInput.addEventListener('change', () => {
            handleImageUpload(imageInput.files && imageInput.files[0]);
            // Reset the hidden native control so choosing the same file again
            // still emits change; the visible filename is managed by #image-name.
            imageInput.value = '';
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
                const name = (state.messageMode === 'image' && state.imageName
                    ? state.imageName
                    : state.currentText).replace(/[^a-z0-9]/gi, '_').toLowerCase();
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
            triggerExplosion(true);
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
    const {
        posHome,
        explosionOrigin,
        springDisp,
        springVel,
        randomDir,
        randomSpeed,
        funnelT,
        funnelRadialX,
        funnelRadialZ
    } = physics;
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
    const activeStyle = physics.activeStyle >= 0 ? physics.activeStyle : state.motionStyle;
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
            if (pos && posHome) {
                pos.set(posHome);
                posAttr.needsUpdate = true;
            }
            clearActivePresets();
        } else {
            // At peak, lock the contraction duration to the ACTUAL distance travelled
            // so recovery genuinely reflects how far particles flew.
            if (activeStyle === 0 || activeStyle === 3 || activeStyle === -1) {
                const tDrift = 3.0;
                if (elapsed >= (activeExpDuration + tDrift) && !state.travelApplied) {
                    const travel = state.actualTravelRadius;
                    const baseContr = state.contractionDuration || 2.0;
                    state.activeContractionDuration = Math.min(
                        baseContr * 1.25,
                        Math.max(
                            travel / CONFIG.maxContractionVelocity,
                            CONFIG.contractionDurationFloor
                        )
                    );
                    state.travelApplied = true;
                    scheduleContractionRumble(state.activeContractionDuration);
                }
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
    uniforms.uTornadoActive.value = physics.explosionStartTime >= 0 && physics.activeStyle === 1 ? 1 : 0;
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
                    count, dt, elapsed,
                    mouseLocal: { x: ml.x, y: ml.y, z: ml.z },
                    kFrame, dampFrame,
                    expansionDuration: activeExpDuration,
                    driftDuration: (activeStyle === 0 || activeStyle === 3 || activeStyle === -1) ? 3.0 : 0.0,
                    contractionDuration: activeContrDuration,
                    explosionMaxDistMultiplier: activeMaxDistMult,
                    mouseInfluence,
                    repulsionStr,
                    breeze: activeBreezeConfig,
                    sourceGeneration: physics.sourceGeneration,
                    motionToken: physics.motionToken
                },
                seq: slot.seq
            }, [slot.posLive.buffer, slot.springDisp.buffer, slot.springVel.buffer]);
        }
    } else {
        // Local CPU Fallback (Main Thread)
        // Per-frame time evolution of the pattern's base directions. Tornado morphs
        // into a screen-space funnel, fading back to rest. Breeze surges
        // via a gust envelope, sways the cloud, adds turbulence, and carries the
        // return with a decaying wind drift. All sin/cos pairs computed once/frame.
        const pat = state.pattern;
        let spinAngle = 0, swayAngle = 0, gust = 1, drift = 0, turbAngle = 0;
        // Tornado: the shape morphs into a vertical funnel whose cross-sections
        // rotate around Y. Its target and the captured origin share one envelope,
        // which guarantees exact recovery at the end of contraction.
        const isTornado = activeStyle === 1
            && pat.funnelHeight
            && funnelT
            && funnelRadialX
            && funnelRadialZ;
        if (elapsed > 0 && isTornado) {
            spinAngle = elapsed * pat.spinSpeed;
        } else if (elapsed > 0 && activeStyle === 2) {
            const gustAmp = pat.gustAmp || 0;
            const gustFreq = pat.gustFreq || 0;
            if (gustFreq) gust = 1 + gustAmp * Math.sin(elapsed * gustFreq);
            if (pat.swayAmp) swayAngle = pat.swayAmp * Math.sin(elapsed * (pat.swayFreq || 0));
            if (pat.turbulence) turbAngle = pat.turbulence * Math.sin(elapsed * 8);
            const windDrift = pat.windDrift || 0;
            if (windDrift) drift = elapsed < activeExpDuration
                ? windDrift
                : windDrift * (1 - Math.pow(Math.min(1, (elapsed - activeExpDuration) / activeContrDuration), 3));
        }
        const spinCos = Math.cos(spinAngle), spinSin = Math.sin(spinAngle);
        const swayCos = Math.cos(swayAngle), swaySin = Math.sin(swayAngle);
        const turbCos = Math.cos(turbAngle), turbSin = Math.sin(turbAngle);
        const funnelProgress = isTornado
            ? tornadoEnvelope(elapsed, activeExpDuration, activeContrDuration)
            : 0;
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
                if (isTornado) {
                    const u = funnelT[i];
                    const radius = tornadoRadius(u, pat);
                    const shellX = funnelRadialX[i];
                    const shellZ = funnelRadialZ[i];
                    const shellDist = Math.hypot(shellX, shellZ) || 1.0;
                    const baseAngle = Math.atan2(shellZ, shellX);
                    // Differential horizontal orbit spin (apex orbits faster than crown)
                    const spinSpeed = (pat.spinSpeed || 6.2) * (1.45 - 0.5 * u) / Math.sqrt(shellDist);
                    const currentAngle = baseAngle + elapsed * spinSpeed;
                    const targetX = Math.cos(currentAngle) * (radius * shellDist);
                    const targetZ = Math.sin(currentAngle) * (radius * shellDist);
                    const depProg = elapsed > activeExpDuration
                        ? Math.min(1, (elapsed - activeExpDuration) / activeContrDuration)
                        : 0;
                    const depLift = (pat.departureLift || 16.0) * depProg * (1.0 - depProg);
                    const targetY = (pat.funnelBottom || -20) + (pat.funnelHeight || 40) * u + depLift;

                    bx = (1 - funnelProgress) * posHome[ix] + funnelProgress * targetX;
                    by = (1 - funnelProgress) * posHome[iy] + funnelProgress * targetY;
                    bz = (1 - funnelProgress) * posHome[iz] + funnelProgress * targetZ;
                } else if (activeStyle === 2) {
                    // Procedural 3D Silk Wave Landscape: mountain peaks, valleys, glowing folded creases & multi-layer depth
                    const b = activeBreezeConfig || {
                        blowDir: gustX >= 0 ? 1.0 : -1.0,
                        windAngleY: 0,
                        windAngleZ: 0,
                        seedXi: 0,
                        peakX: 0,
                        peakY: 5.0,
                        peakAmp: 20.0,
                        peakWidthX: 0.07,
                        peakWidthY: 0.12,
                        creaseY: -5.0,
                        creaseAmp: 8.5,
                        creaseFreq: 0.12,
                        billowAmp1: 9.0,
                        billowAmp2: 4.0,
                        depthAmp: 15.0,
                        turbAmp: 4.0,
                        shearMult: 0.28
                    };

                    const hx = posHome[ix], hy = posHome[iy], hz = posHome[iz];
                    const gx = b.blowDir;
                    const cd = (randomSpeed ? randomSpeed[i] : 1.0) * 0.45 + 0.8;

                    let uWind = 0;
                    const str = b.strengthMult || 0.85;
                    const power = b.easePower || 1.5;
                    if (elapsed < activeExpDuration) {
                        const tau = elapsed / activeExpDuration;
                        const baseU = (1.0 - Math.cos(tau * Math.PI)) * 0.5;
                        uWind = Math.pow(baseU, power) * str;
                    } else {
                        const v = Math.min(1.0, (elapsed - activeExpDuration) / activeContrDuration);
                        const baseU = (1.0 + Math.cos(v * Math.PI)) * 0.5;
                        uWind = baseU * str;
                    }

                    if (uWind > 0.000001) {
                        // Differential longitudinal streamline stretching (breaks uniform clump into elegant ribbons)
                        const shear = 1.0 + b.shearMult * Math.sin((hy - b.peakY) * 0.12 + (hx - b.peakX) * 0.08);
                        const dx = activeMaxDistMult * cd * uWind * shear;
                        const deltaX = gx * dx;
                        const deltaWindY = b.windAngleY * dx * 0.32;
                        const deltaWindZ = b.windAngleZ * dx * 0.22;

                        // Aerodynamic plume spread
                        const funnelSpread = 1.0 + 0.026 * dx;
                        const yFunnel = hy * funnelSpread + deltaWindY;
                        const zFunnel = hz * funnelSpread + deltaWindZ;

                        // Traveling silk wave manifold phase
                        const xi = (hx + deltaX) * 0.09 + elapsed * 2.6 + b.seedXi;
                        const p0 = hy * 0.14;

                        // Traveling harmonic billows
                        const w1 = b.billowAmp1 * Math.sin(0.09 * xi - 1.5 * elapsed) * (1.0 + 0.22 * Math.cos(0.14 * p0));
                        const w2 = b.billowAmp2 * Math.sin(0.18 * xi - 2.2 * elapsed + 0.30 * p0);

                        // Mountain peak crest arching across upper boundary (Image 1)
                        const peakDistSq = Math.pow((hx + deltaX - b.peakX) * b.peakWidthX, 2) + Math.pow((hy - b.peakY) * b.peakWidthY, 2);
                        const peak = b.peakAmp * Math.exp(-peakDistSq * 1.3);

                        // Hyper-luminous folded edge crease along lower boundary (Image 1)
                        const creaseFold = Math.sin(b.creaseFreq * xi - 1.6 * elapsed);
                        const creaseDistSq = Math.pow((hy - b.creaseY + 2.4 * creaseFold) * 0.20, 2);
                        const crease = b.creaseAmp * Math.exp(-creaseDistSq * 2.2) * Math.pow(Math.sin(0.14 * xi - 1.3 * elapsed), 2);

                        // Multi-layer sheer Z-depth separation with overlapping veil ribbons
                        const layerSeed = ((i * 37.119) % 10.0) - 5.0;
                        const layerPhase = layerSeed > 0 ? 0.35 : -0.35;
                        const deltaZ = (b.depthAmp * Math.sin(0.10 * xi - 1.3 * elapsed + layerPhase) * Math.cos(0.11 * p0) + 0.28 * p0 + layerSeed * 0.55);

                        // Delicate per-particle flutter within the airy breeze envelope
                        const pPhase = ((i * 19.417) % 100.0) - 50.0;
                        const tAmp = b.turbAmp * uWind;
                        const eddyY = Math.sin(elapsed * 2.0 + xi * 1.1 + pPhase) * (tAmp * 0.35);
                        const eddyZ = Math.cos(elapsed * 1.8 + xi * 0.9 - pPhase) * (tAmp * 0.35);
                        const eddyX = Math.sin(elapsed * 2.2 + pPhase) * (tAmp * 0.15);

                        const targetX = hx + deltaX + eddyX;
                        const targetY = yFunnel + (w1 + w2 + peak - crease) * uWind + eddyY;
                        const targetZ = zFunnel + deltaZ * uWind + eddyZ;

                        bx = (1 - uWind) * hx + uWind * targetX;
                        by = (1 - uWind) * hy + uWind * targetY;
                        bz = (1 - uWind) * hz + uWind * targetZ;
                    }
                } else {
                    const maxDist = randomSpeed[i] * activeMaxDistMult;
                    let rx = randomDir[ix], ry = randomDir[iy], rz = randomDir[iz];
                    let dist;
                    const expDur = activeExpDuration;
                    const contrDur = activeContrDuration;
                    const tDrift = (activeStyle === 0 || activeStyle === 3 || activeStyle === -1) ? 3.0 : 0.0;
                    const peakProg = (1.0 - Math.exp(-2.8)) * 0.82 + 0.18;
                    // Exact latest expansion speed at the transition (C1 continuous matching)
                    const vLatest = (2.8 * Math.exp(-2.8) * 0.82 + 0.18) / Math.max(0.1, expDur);
                    const driftPeakProg = peakProg + vLatest * tDrift * 0.78;

                    if (elapsed < expDur) {
                        // Phase 1: Outward explosion and continuous deceleration
                        const u = elapsed / expDur;
                        const expansionProg = (1.0 - Math.exp(-2.8 * u)) * 0.82 + 0.18 * u;
                        dist = maxDist * expansionProg;
                    } else if (elapsed < expDur + tDrift) {
                        // Phase 2: Seamlessly continues at the latest expansion speed for 3 full seconds (no bump, fluid flow)
                        const dtDrift = elapsed - expDur;
                        const tau = dtDrift / tDrift;
                        const driftProg = peakProg + vLatest * dtDrift * (1.0 - 0.22 * tau);
                        dist = maxDist * driftProg;
                    } else {
                        // Phase 3: Accelerating inward return towards getting back to initial position
                        const v = Math.min(1.0, (elapsed - (expDur + tDrift)) / contrDur);
                        const returnProg = 1.0 - (0.35 * v + 0.65 * Math.pow(v, 2.2));
                        dist = maxDist * driftPeakProg * Math.max(0, returnProg);
                    }
                    bx += rx * dist;
                    by += ry * dist;
                    bz += rz * dist;
                }
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

            if (elapsed <= 0 && d2 >= mouseInfluence2) {
                springVel[ix] = 0;
                springVel[iy] = 0;
                springVel[iz] = 0;
                springDisp[ix] = 0;
                springDisp[iy] = 0;
                springDisp[iz] = 0;
            } else {
                springVel[ix] = (springVel[ix] + (tdx - springDisp[ix]) * kFrame) * dampFrame;
                springVel[iy] = (springVel[iy] + (tdy - springDisp[iy]) * kFrame) * dampFrame;
                springVel[iz] = (springVel[iz] + (tdz - springDisp[iz]) * kFrame) * dampFrame;

                springDisp[ix] += springVel[ix];
                springDisp[iy] += springVel[iy];
                springDisp[iz] += springVel[iz];
            }

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
                // Guard against stale echoes from an older layout or blast phase.
                if (e.data.sourceGeneration !== physics.sourceGeneration
                    || e.data.motionToken !== physics.motionToken) {
                    return;
                }
                physics.randomized = { dirs: e.data.dirs, style: e.data.style };
                physics.activeStyle = e.data.style;
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
        setMessageModeUI('text'); // History stores text messages; images are local-only

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
    triggerExplosion,
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
            funnelT: physics.funnelT ? Array.from(physics.funnelT.slice(0, limit)) : [],
            activeStyle: physics.activeStyle,
            funnelProfile: {
                height: state.pattern.funnelHeight || 0,
                bottom: state.pattern.funnelBottom || 0,
                tailRadius: tornadoRadius(0.05, state.pattern),
                waistRadius: tornadoRadius(0.5, state.pattern),
                crownRadius: tornadoRadius(0.95, state.pattern),
                fadeStart: state.pattern.funnelFadeStart || 0,
                fadeEnd: state.pattern.funnelFadeEnd || 0
            },
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
