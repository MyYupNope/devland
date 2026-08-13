// physics.worker.js
// Runs the heavy particle spring-physics and repulsion simulations in a separate thread.

let posHome = null;
let explosionOrigin = null;
let randomDir = null;
let randomSpeed = null;
let funnelT = null;
let funnelRadialX = null;
let funnelRadialZ = null;
let maxTravelSq = 0; // Running max squared displacement from each blast origin
let lastMotionToken = -1;
let pattern = null;
let activeStyle = -1;

// Shared gust direction for the current Breeze blast, reused each frame for the
// wind follow-through drift. Set when style 2 directions are generated.
let gustX = 1, gustY = 0;

// Leading-slice size echoed back after each randomize for the pattern tests.
const DIRECTIONS_VERIFY = 384;

function tornadoEnvelope(elapsed, expansionDuration, contractionDuration) {
    if (elapsed <= 0) return 0;
    if (elapsed < expansionDuration) {
        const t = elapsed / expansionDuration;
        return t * (2 - t);
    }
    const t = Math.min(1, (elapsed - expansionDuration) / contractionDuration);
    return Math.max(0, 1 - t * t * t);
}

function tornadoRadius(t, pattern) {
    const waistT = Math.max(0.001, Math.min(0.999, pattern.funnelWaistT || 0.42));
    const crownT = Math.max(waistT + 0.001, Math.min(1, pattern.funnelCrownT || 0.78));
    const tail = pattern.funnelTailRadius || 0;
    const waist = pattern.funnelWaistRadius || tail;
    const crown = pattern.funnelCrownRadius || waist;
    const smooth = value => value * value * (3 - 2 * value);

    if (t < waistT) {
        const u = smooth(Math.max(0, Math.min(1, t / waistT)));
        return tail + (waist - tail) * u;
    }
    if (t < crownT) {
        const u = smooth(Math.max(0, Math.min(1, (t - waistT) / (crownT - waistT))));
        return waist + (crown - waist) * u;
    }
    return crown;
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
            sourceGeneration
        } = data;
        if (!randomDir || !randomSpeed) return;
        explosionOrigin = nextOrigin || posHome;
        pattern = patternData || {};
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
                gustX = gx;
                gustY = gy;
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
            ? tornadoEnvelope(elapsed, expansionDuration, contractionDuration)
            : 0;

        for (let i = 0; i < count; i++) {
            const ix = i * 3, iy = ix + 1, iz = ix + 2;

            // 1. Base position interpolates from the captured particle origin back
            // to its text position. There is no shared screen-center origin.
            let bx = posHome[ix] + (explosionOrigin[ix] - posHome[ix]) * anchorWeight;
            let by = posHome[iy] + (explosionOrigin[iy] - posHome[iy]) * anchorWeight;
            let bz = posHome[iz] + (explosionOrigin[iz] - posHome[iz]) * anchorWeight;

if (elapsed > 0.0) {
                if (isTornado) {
                    const t = funnelT[i];
                    const radius = tornadoRadius(t, pattern);
                    const funnelX = funnelRadialX[i] * radius;
                    const funnelZ = funnelRadialZ[i] * radius;
                    const targetX = funnelX * spinCos - funnelZ * spinSin;
                    const targetZ = funnelX * spinSin + funnelZ * spinCos;
                    const targetY = (pattern.funnelBottom || 0) + (pattern.funnelHeight || 0) * t;

                    // The origin anchor and target offset share one progress value,
                    // so the exact endpoint is always the particle's home position.
                    bx += (targetX - explosionOrigin[ix]) * funnelProgress;
                    by += (targetY - explosionOrigin[iy]) * funnelProgress;
                    bz += (targetZ - explosionOrigin[iz]) * funnelProgress;
                } else {
                    const maxDist = randomSpeed[i] * explosionMaxDistMultiplier;
                    let rx = randomDir[ix], ry = randomDir[iy], rz = randomDir[iz];
                    if (activeStyle === 2) {
                        if (swayAngle !== 0) {
                            const nrx = rx * swayCos - ry * swaySin;
                            const nry = rx * swaySin + ry * swayCos;
                            rx = nrx; ry = nry;
                        }
                        if (turbAngle !== 0) {
                            const nrx = rx * turbCos - ry * turbSin;
                            const nry = rx * turbSin + ry * turbCos;
                            rx = nrx; ry = nry;
                        }
                    }

                    let dist;
                    if (elapsed < expansionDuration) {
                        // Expansion: quadratic ease-out
                        const t = elapsed / expansionDuration;
                        dist = maxDist * t * (2.0 - t);
                    } else {
                        // Contraction: cubic ease-in
                        const t = (elapsed - expansionDuration) / contractionDuration;
                        dist = maxDist * (1.0 - t * t * t);
                    }
                    bx += rx * dist * gust;
                    by += ry * dist * gust;
                    bz += rz * dist * gust;
                    // Wind follow-through: keep drifting downwind while returning, so the
                    // cloud is carried home by the breeze. Decays to zero by recovery.
                    bx += gustX * drift;
                    by += gustY * drift;
                }
            }

            // 2. Mouse repulsion calculations with early-exit squared comparison
            const cur_x = posLive[ix], cur_y = posLive[iy], cur_z = posLive[iz];
            const ddx = cur_x - mouseLocal.x;
            const ddy = cur_y - mouseLocal.y;
            const ddz = cur_z - mouseLocal.z;
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
            posLive[ix] = bx + springDisp[ix];
            posLive[iy] = by + springDisp[iy];
            posLive[iz] = bz + springDisp[iz];

            // Measure how far this particle travelled from its own blast origin,
            // but only while an explosion is active (reset on randomize).
            if (elapsed > 0.0) {
                const tx = posLive[ix] - explosionOrigin[ix];
                const ty = posLive[iy] - explosionOrigin[iy];
                const tz = posLive[iz] - explosionOrigin[iz];
                const td2 = tx * tx + ty * ty + tz * tz;
                if (td2 > maxTravelSq) maxTravelSq = td2;
            }
        }

        // Return updated buffers to the main thread (zero-copy transfer)
        self.postMessage({
            type: 'update',
            seq,
            posLive,
            springDisp,
            springVel,
            travelRadius: Math.sqrt(maxTravelSq),
            sourceGeneration: updateSourceGeneration,
            motionToken
        }, [posLive.buffer, springDisp.buffer, springVel.buffer]);
    }
};
