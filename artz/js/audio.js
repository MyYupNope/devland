// ─────────────────────────────────────────────
// Web Audio Procedural Sound Synthesizer
// ─────────────────────────────────────────────

let audioCtx = null;
let noiseBuffer = null;

function getAudioContext() {
    if (!audioCtx && (window.AudioContext || window.webkitAudioContext)) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    return audioCtx;
}

function createNoiseBuffer(ctx) {
    if (noiseBuffer) return noiseBuffer;
    const len = ctx.sampleRate * 2.0;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
        data[i] = Math.random() * 2 - 1;
    }
    noiseBuffer = buf;
    return buf;
}

export function playExplosionSound(state) {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const master = ctx.createGain();
    master.gain.setValueAtTime(0.0001, now);
    master.gain.linearRampToValueAtTime(0.35, now + 0.02);
    master.connect(ctx.destination);

    const dur = state.soundDuration || 1.5;
    const pitch = state.soundPitch || 140;
    const type = state.soundType || 'sine';

    if (state.motionStyle === 1) {
        // 4-Phase 15s atmospheric cyclone vortex audio howl (sweeping dual bandpass noise filters)
        const totalTornadoDur = 15.0;
        const wind = ctx.createBufferSource();
        wind.buffer = createNoiseBuffer(ctx);
        wind.loop = true;
        const windFilt = ctx.createBiquadFilter();
        windFilt.type = 'bandpass';
        windFilt.frequency.setValueAtTime(60, now);
        windFilt.frequency.linearRampToValueAtTime(180, now + 3.5);  // Phase 1 Ground rumble
        windFilt.frequency.exponentialRampToValueAtTime(580, now + 6.0); // Phase 2 Mid-ascent scream
        windFilt.frequency.linearRampToValueAtTime(320, now + 8.0);  // Phase 2 Funnel crest
        windFilt.frequency.linearRampToValueAtTime(220, now + 11.5); // Phase 3 Canopy roar
        windFilt.frequency.exponentialRampToValueAtTime(45, now + totalTornadoDur); // Phase 4 Dissipation
        windFilt.Q.value = 2.8;

        const windGain = ctx.createGain();
        windGain.gain.setValueAtTime(0.0001, now);
        windGain.gain.exponentialRampToValueAtTime(0.18, now + 3.0);
        windGain.gain.linearRampToValueAtTime(0.38, now + 6.0);
        windGain.gain.linearRampToValueAtTime(0.24, now + 11.5);
        windGain.gain.exponentialRampToValueAtTime(0.0001, now + totalTornadoDur);

        wind.connect(windFilt);
        windFilt.connect(windGain);
        windGain.connect(master);
        wind.start(now);
        wind.stop(now + totalTornadoDur + 0.1);
        setTimeout(() => {
            try {
                wind.disconnect();
                windFilt.disconnect();
                windGain.disconnect();
                master.disconnect();
            } catch (_) {}
        }, (totalTornadoDur + 0.2) * 1000);
        return;
    }

    if (state.motionStyle === 2) {
        // 4-Phase atmospheric breeze audio: Floor Thud -> 2s Rest -> Wind Gust Lift -> Reverse Wind Settle -> Elevation Shimmer
        const totalBreezeDur = 11.8;
        const wind = ctx.createBufferSource();
        wind.buffer = createNoiseBuffer(ctx);
        wind.loop = true;
        const windFilt = ctx.createBiquadFilter();
        windFilt.type = 'bandpass';
        windFilt.frequency.setValueAtTime(90, now);
        windFilt.frequency.linearRampToValueAtTime(130, now + 1.0);      // Phase 1: Floor impact & recoil
        windFilt.frequency.linearRampToValueAtTime(75, now + 3.0);       // Ground Pause: Quiet floor rest
        windFilt.frequency.exponentialRampToValueAtTime(620, now + 6.6); // Phase 2: Peak forward wind lift
        windFilt.frequency.exponentialRampToValueAtTime(100, now + 10.2);// Phase 3: Reverse wind subsiding to floor
        windFilt.frequency.exponentialRampToValueAtTime(50, now + totalBreezeDur);
        windFilt.Q.value = 1.2;

        const windGain = ctx.createGain();
        windGain.gain.setValueAtTime(0.0001, now);
        windGain.gain.exponentialRampToValueAtTime(0.14, now + 1.0);
        windGain.gain.exponentialRampToValueAtTime(0.01, now + 3.0);     // Quiet ground pause
        windGain.gain.linearRampToValueAtTime(0.32, now + 6.6);          // Wind surge at peak
        windGain.gain.linearRampToValueAtTime(0.05, now + 10.2);         // Reverse landing
        windGain.gain.exponentialRampToValueAtTime(0.0001, now + totalBreezeDur);

        wind.connect(windFilt);
        windFilt.connect(windGain);
        windGain.connect(master);
        wind.start(now);
        wind.stop(now + totalBreezeDur + 0.1);
        setTimeout(() => {
            try {
                wind.disconnect();
                windFilt.disconnect();
                windGain.disconnect();
                master.disconnect();
            } catch (_) {}
        }, (totalBreezeDur + 0.2) * 1000);
        return;
    }

    // Default & Explosion Synthesizers
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(pitch, now);
    osc.frequency.exponentialRampToValueAtTime(28, now + dur);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

    osc.connect(gain);
    gain.connect(master);
    osc.start(now);
    osc.stop(now + dur + 0.05);

    setTimeout(() => {
        try {
            osc.disconnect();
            gain.disconnect();
            master.disconnect();
        } catch (_) {}
    }, (dur + 0.1) * 1000);
}

export function playContractionRumble(duration = 1.5) {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(35, now);
    osc.frequency.linearRampToValueAtTime(55, now + duration * 0.7);
    osc.frequency.exponentialRampToValueAtTime(20, now + duration);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.15, now + duration * 0.5);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + duration + 0.05);

    setTimeout(() => {
        try {
            osc.disconnect();
            gain.disconnect();
        } catch (_) {}
    }, (duration + 0.1) * 1000);
}
