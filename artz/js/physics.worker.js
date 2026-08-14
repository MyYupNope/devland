// ─────────────────────────────────────────────
// Physics Web Worker — Multi-threaded Particle Engine
// ─────────────────────────────────────────────
// Offloads O(N) spring relaxation, explosion trajectory calculations, and mouse
// repulsion from the main UI thread, ensuring a rock-solid 60 FPS even with 30k+
// particles. Operates via double-buffered Float32Arrays transferred with zero-copy.

let posHome = null;             // Initial rest coordinates (persistent Float32Array)
let explosionOrigin = null;     // Captured on-screen particle coordinates at blast trigger
let randomDir = null;           // Pre-computed normalized explosion direction unit vectors
let randomSpeed = null;         // Per-particle speed multipliers
let funnelT = null;             // Tornado: normalized vertical positions [0, 1]
let funnelRadialX = null;       // Tornado: unit radial vector X
let funnelRadialZ = null;       // Tornado: unit radial vector Z
let activeStyle = -1;
let activeWorkerBreeze = null;           // Cached pattern style for the current explosion
let pattern = {};               // Pattern parameters from CONFIG.presets
let maxTravelSq = 0;            // Peak squared displacement measured during the current blast
let lastMotionToken = -1;       // Generation tracker for distinct blast phases

const DIRECTIONS_VERIFY = 384;

function tornadoRadius(u, p) {
    const bottom = p.funnelBottom || -20;
    const height = p.funnelHeight || 40;
    const waistU = (p.funnelWaistT != null) ? p.funnelWaistT : (p.funnelWaistU || 0.42);
    const rTail = (p.funnelTailRadius != null) ? p.funnelTailRadius : 0.8;
    const rWaist = (p.funnelWaistRadius != null) ? p.funnelWaistRadius : 3.5;
    const rCrown = (p.funnelCrownRadius != null) ? p.funnelCrownRadius : 22.0;
    const crownExp = p.funnelCrownExp || 1.4;

    if (u <= waistU) {
        const t = u / Math.max(0.01, waistU);
        return rTail + (rWaist - rTail) * (t * t);
    } else {
        const t = (u - waistU) / Math.max(0.01, 1 - waistU);
        return rWaist + (rCrown - rWaist) * Math.pow(t, crownExp);
    }
}

self.onmessage = function (e) {
    const { type, data, seq } = e.data;

    if (type === 'init') {
        posHome = data.posHome;
        explosionOrigin = data.explosionOrigin || data.posHome;
        randomDir = data.randomDir;
        randomSpeed = data.randomSpeed;
        funnelT = data.funnelT;
        funnelRadialX = data.funnelRadialX;
        funnelRadialZ = data.funnelRadialZ;
        lastMotionToken = -1;
        return;
    }

    if (type === 'randomize') {
        // Randomize explosion trajectory vectors/speeds off the main thread, so the
        // per-blast 30k-particle trig loop never causes a main-thread hitch.
        const {
            explosionSpeedMin,
            explosionSpeedRange,
            motionStyle,
            pattern: patternData,
            explosionOrigin: nextOrigin,
            motionToken,
            sourceGeneration,
            breeze: breezeConfig
        } = data;
        if (!randomDir || !randomSpeed) return;
        explosionOrigin = nextOrigin || posHome;
        pattern = patternData || {};
        activeWorkerBreeze = breezeConfig || null;
        activeStyle = (typeof motionStyle === 'number' && motionStyle >= 0)
            ? motionStyle
            : Math.floor(Math.random() * 4);
        lastMotionToken = -1;
        const count = randomSpeed.length;
        maxTravelSq = 0; // Start measuring the actual travel radius for this blast

        // Pattern styles: 0 = uniform sphere (Explode), 1 = tornado funnel
        // (Tornado), 2 = coherent wind gust (Breeze), 3 = crisp starburst rays
        // (Kinetic). Presets pin a style (-1 => random per blast).
        const style = activeStyle;

        // Shared gust direction for style 2 (mostly horizontal).
        const gustAngle = Math.random() * Math.PI * 2;
        let gx = Math.cos(gustAngle);
        let gy = Math.sin(gustAngle);
        let gz = (Math.random() - 0.5) * 0.4;
        const glen = Math.sqrt(gx * gx + gy * gy + gz * gz) || 1;
        gx /= glen; gy /= glen; gz /= glen;

        // Fibonacci-sphere spoke lattice for style 3 (deterministic per spoke).
        const spokes = Math.max(2, pattern.spokes || 12);
        const jitter = (pattern.spokeJitter != null) ? pattern.spokeJitter : 0.03;
        const golden = Math.PI * (3 - Math.sqrt(5));

        for (let i = 0; i < count; i++) {
            const ix = i * 3, iy = ix + 1, iz = ix + 2;

            let rx, ry, rz;

            if (style === 1) {
                // Tornado directions swirl in the visible X/Z plane and point up in
                // screen-space Y. The update path morphs into the actual funnel.
                const hx = posHome[ix], hz = posHome[iz];
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
                const coherence = pattern.gustCoherence || 0;
                const rand = 1 - coherence;
                rx = gx * coherence + (Math.random() * 2 - 1) * rand;
                ry = gy * coherence + (Math.random() * 2 - 1) * rand;
                rz = gz * coherence + (Math.random() * 2 - 1) * rand;
            } else if (style === 3) {
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
                randomSpeed[i] = (explosionSpeedMin + Math.random() * explosionSpeedRange) * (1.4 + Math.random() * 0.9);
            } else if (style === 3) {
                randomSpeed[i] = (explosionSpeedMin + Math.random() * explosionSpeedRange) * (1.5 + Math.random() * 0.7);
            } else {
                const speedVar = 0.75 + Math.random() * 0.55;
                randomSpeed[i] = (explosionSpeedMin + Math.random() * explosionSpeedRange) * speedVar;
            }

            randomDir[ix] = rx;
            randomDir[iy] = ry;
            randomDir[iz] = rz;
        }

        // Echo a slice of the generated directions to the main thread (copy, non-transfer)
        // so the pattern regression tests can verify them deterministically.
        self.postMessage({
            type: 'randomized',
            dirs: randomDir.slice(0, DIRECTIONS_VERIFY * 3),
            style: activeStyle,
            motionToken,
            sourceGeneration
        });
        return;
    }

    if (type === 'update') {
        const {
            posLive,
            springDisp,
            springVel,
            count,
            dt,
            elapsed,
            mouseLocal,
            kFrame,
            dampFrame,
            expansionDuration,
            driftDuration,
            contractionDuration,
            explosionMaxDistMultiplier,
            mouseInfluence,
            repulsionStr,
            sourceGeneration: updateSourceGeneration,
            motionToken
        } = data;

        if (!posHome) {
            // Safe fallback if update is sent before init completes
            self.postMessage({ type: 'update', seq, posLive, springDisp, springVel, travelRadius: 0 }, [posLive.buffer, springDisp.buffer, springVel.buffer]);
            return;
        }

        const mouseInfluence2 = mouseInfluence * mouseInfluence;

        // A new blast/recovery phase starts from the captured on-screen origin and
        // must not inherit spring displacement from the preceding phase.
        if (motionToken !== lastMotionToken) {
            springDisp.fill(0);
            springVel.fill(0);
            lastMotionToken = motionToken;
        }

        const anchorWeight = elapsed <= 0
            ? 0
            : elapsed < expansionDuration
                ? 1
                : Math.max(0, 1 - Math.pow(Math.min(1, (elapsed - expansionDuration) / contractionDuration), 3));

        // Pattern time-evolution. Tornado morphs into a screen-space funnel and spins
        // its X/Z cross-sections around Y, then the envelope fades back to rest.
        // Breeze surges via a gust envelope, sways the cloud, adds turbulence, and
        // carries the return with a decaying wind drift. One sin/cos pair per frame,
        // then cheap per-particle multiplies.
        let spinAngle = 0, swayAngle = 0, gust = 1, drift = 0, turbAngle = 0;
        const isTornado = activeStyle === 1
            && pattern.funnelHeight
            && funnelT
            && funnelRadialX
            && funnelRadialZ;
        if (elapsed > 0 && isTornado) {
            spinAngle = elapsed * pattern.spinSpeed;
        } else if (elapsed > 0 && activeStyle === 2) {
            const gustAmp = pattern.gustAmp || 0;
            const gustFreq = pattern.gustFreq || 0;
            if (gustFreq) gust = 1 + gustAmp * Math.sin(elapsed * gustFreq);
            if (pattern.swayAmp) swayAngle = pattern.swayAmp * Math.sin(elapsed * (pattern.swayFreq || 0));
            if (pattern.turbulence) turbAngle = pattern.turbulence * Math.sin(elapsed * 8);
            const windDrift = pattern.windDrift || 0;
            if (windDrift) drift = elapsed < expansionDuration
                ? windDrift
                : windDrift * (1 - Math.pow(Math.min(1, (elapsed - expansionDuration) / contractionDuration), 3));
        }
        const spinCos = Math.cos(spinAngle), spinSin = Math.sin(spinAngle);
        const swayCos = Math.cos(swayAngle), swaySin = Math.sin(swayAngle);
        const turbCos = Math.cos(turbAngle), turbSin = Math.sin(turbAngle);
        const funnelProgress = isTornado
            ? (elapsed < expansionDuration
                ? elapsed / expansionDuration
                : 1 - Math.pow(Math.min(1, (elapsed - expansionDuration) / contractionDuration), 3))
            : 0;

        for (let i = 0; i < count; i++) {
            const ix = i * 3, iy = ix + 1, iz = ix + 2;

            // 1. Time-dependent explosion base position
            // Particles burst out along their assigned trajectory from the captured origin,
            // then contract back into posHome with zero residual offset.
            let bx = posHome[ix], by = posHome[iy], bz = posHome[iz];

            if (elapsed > 0) {
                if (activeStyle === 1 && isTornado) {
                    const u = funnelT[i];
                    const radius = tornadoRadius(u, pattern);
                    const fx = funnelRadialX[i], fz = funnelRadialZ[i];

                    // Spin the cross-section around Y
                    const rx = fx * spinCos - fz * spinSin;
                    const rz = fx * spinSin + fz * spinCos;

                    // Compute current radial distance from center
                    const shellPhase = i * 0.005;
                    const shellDist = 0.95 + 0.1 * Math.sin(elapsed * 6 + shellPhase);
                    const baseAngle = Math.atan2(fz, fx);
                    const spinSpeed = pattern.spinSpeed || 6.0;
                    const currentAngle = baseAngle + elapsed * spinSpeed;
                    const targetX = Math.cos(currentAngle) * (radius * shellDist);
                    const targetZ = Math.sin(currentAngle) * (radius * shellDist);
                    const depProg = elapsed > expansionDuration
                        ? Math.min(1, (elapsed - expansionDuration) / contractionDuration)
                        : 0;
                    const depLift = (pattern.departureLift || 16.0) * depProg * (1.0 - depProg);
                    const targetY = (pattern.funnelBottom || -20) + (pattern.funnelHeight || 40) * u + depLift;

                    bx = (1 - funnelProgress) * posHome[ix] + funnelProgress * targetX;
                    by = (1 - funnelProgress) * posHome[iy] + funnelProgress * targetY;
                    bz = (1 - funnelProgress) * posHome[iz] + funnelProgress * targetZ;
                } else if (activeStyle === 2) {
                    const b = (data.breeze || activeWorkerBreeze) || {
                        blowDir: 1.0,
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
                    if (elapsed < expansionDuration) {
                        const rawU = elapsed / expansionDuration;
                        uWind = Math.pow(rawU, power) * str;
                    } else {
                        const v = Math.min(1.0, (elapsed - expansionDuration) / contractionDuration);
                        uWind = Math.max(0, 1.0 - Math.pow(v, 2.2)) * str;
                    }

                    if (uWind <= 0.0001) {
                        bx = hx;
                        by = hy;
                        bz = hz;
                    } else {
                        const p0 = (hx * 0.08 + hy * 0.05 + hz * 0.04);
                        const progress = elapsed * cd;
                        const deltaX = gx * (progress * 52.0 + Math.sin(0.12 * hx + progress * 2.2) * 8.0);
                        const xi = hx + deltaX;

                        const yFunnel = hy + b.shearMult * deltaX;
                        const zFunnel = hz + 0.12 * deltaX;

                        const w1 = b.billowAmp1 * Math.sin(0.08 * xi - 1.5 * elapsed + 0.45 * p0);
                        const w2 = b.billowAmp2 * Math.sin(0.18 * xi - 2.2 * elapsed + 0.30 * p0);

                        const peakDistSq = Math.pow((hx + deltaX - b.peakX) * b.peakWidthX, 2) + Math.pow((hy - b.peakY) * b.peakWidthY, 2);
                        const peak = b.peakAmp * Math.exp(-peakDistSq * 1.3);

                        const creaseFold = Math.sin(b.creaseFreq * xi - 1.6 * elapsed);
                        const creaseDistSq = Math.pow((hy - b.creaseY + 2.4 * creaseFold) * 0.20, 2);
                        const crease = b.creaseAmp * Math.exp(-creaseDistSq * 2.2) * Math.pow(Math.sin(0.14 * xi - 1.3 * elapsed), 2);

                        const layerSeed = ((i * 37.119) % 10.0) - 5.0;
                        const layerPhase = layerSeed > 0 ? 0.35 : -0.35;
                        const deltaZ = (b.depthAmp * Math.sin(0.10 * xi - 1.3 * elapsed + layerPhase) * Math.cos(0.11 * p0) + 0.28 * p0 + layerSeed * 0.55);

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
                    const maxDist = randomSpeed[i] * explosionMaxDistMultiplier;
                    let rx = randomDir[ix], ry = randomDir[iy], rz = randomDir[iz];
                    let dist;
                    const expDur = expansionDuration;
                    const contrDur = contractionDuration;
                    const tDrift = (activeStyle === 0 || activeStyle === 3 || activeStyle === -1) ? (driftDuration || 3.0) : 0.0;
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

            // 2. Mouse repulsion calculations with early-exit squared comparison
            const cur_x = posLive[ix], cur_y = posLive[iy], cur_z = posLive[iz];
            const ddx = cur_x - mouseLocal.x;
            const ddy = cur_y - mouseLocal.y;
            const distSq = ddx * ddx + ddy * ddy;

            let fx = 0, fy = 0, fz = 0;
            if (distSq < mouseInfluence2 && distSq > 0.0001) {
                const invDist = 1 / Math.sqrt(distSq);
                const mouseForce = (1 - Math.sqrt(distSq) / mouseInfluence) * repulsionStr;
                fx = ddx * invDist * mouseForce;
                fy = ddy * invDist * mouseForce;
                fz = mouseForce * 0.4;
            }

            // 3. Spring physics: dampening & Hooke's law relative to base position
            let vx = springVel[ix], vy = springVel[iy], vz = springVel[iz];
            let sx = springDisp[ix], sy = springDisp[iy], sz = springDisp[iz];

            // Spring relaxation towards 0 displacement, plus mouse impulse
            vx = (vx + (fx - sx * kFrame) * dt) * dampFrame;
            vy = (vy + (fy - sy * kFrame) * dt) * dampFrame;
            vz = (vz + (fz - sz * kFrame) * dt) * dampFrame;

            sx += vx * dt;
            sy += vy * dt;
            sz += vz * dt;

            springVel[ix] = vx; springVel[iy] = vy; springVel[iz] = vz;
            springDisp[ix] = sx; springDisp[iy] = sy; springDisp[iz] = sz;

            // Final particle coordinate: base trajectory + spring displacement
            const finalX = bx + sx;
            const finalY = by + sy;
            const finalZ = bz + sz;

            posLive[ix] = finalX;
            posLive[iy] = finalY;
            posLive[iz] = finalZ;

            // Measure actual peak travel distance relative to origin (for rumble/sound)
            if (elapsed > 0 && elapsed <= expansionDuration) {
                const ox = explosionOrigin[ix], oy = explosionOrigin[iy], oz = explosionOrigin[iz];
                const dx = finalX - ox, dy = finalY - oy, dz = finalZ - oz;
                const dsq = dx * dx + dy * dy + dz * dz;
                if (dsq > maxTravelSq) maxTravelSq = dsq;
            }
        }

        const actualTravelRadius = Math.sqrt(maxTravelSq);

        // Zero-copy transfer of typed array buffers back to the main thread
        self.postMessage(
            {
                type: 'update',
                seq,
                posLive,
                springDisp,
                springVel,
                travelRadius: actualTravelRadius,
                sourceGeneration: updateSourceGeneration,
                motionToken
            },
            [posLive.buffer, springDisp.buffer, springVel.buffer]
        );
    }
};
