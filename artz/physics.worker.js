// physics.worker.js
// Runs the heavy particle spring-physics and repulsion simulations in a separate thread.

let posHome = null;
let randomDir = null;
let randomSpeed = null;
let maxTravelSq = 0; // Running max squared displacement from home, reset per blast

self.onmessage = function (e) {
    const { type, data, seq } = e.data;

    if (type === 'init') {
        posHome = data.posHome;
        randomDir = data.randomDir;
        randomSpeed = data.randomSpeed;
        return;
    }

    if (type === 'randomize') {
        // Randomize explosion trajectory vectors/speeds off the main thread, so the
        // per-blast 30k-particle trig loop never causes a main-thread hitch.
        const { explosionSpeedMin, explosionSpeedRange, motionStyle } = data;
        if (!randomDir || !randomSpeed) return;
        const count = randomSpeed.length;
        maxTravelSq = 0; // Start measuring the actual travel radius for this blast

        // 0: Spherical Chaos, 1: Vortex Swirl, 2: Directional Blast, 3: Cluster Burst.
        // Presets pin a deterministic style (-1 => random per blast).
        const style = (typeof motionStyle === 'number' && motionStyle >= 0)
            ? motionStyle
            : Math.floor(Math.random() * 4);
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
                const currentAngle = Math.atan2(ry, rx) + swirlPower;
                const radius = Math.sqrt(rx * rx + ry * ry);
                rx = Math.cos(currentAngle) * radius;
                ry = Math.sin(currentAngle) * radius;
            } else if (style === 2) {
                rx = rx * 0.35 + biasX * 0.65;
                ry = ry * 0.35 + biasY * 0.65;
                rz = rz * 0.35 + biasZ * 0.65;
                const len = Math.sqrt(rx * rx + ry * ry + rz * rz) || 1;
                rx /= len; ry /= len; rz /= len;
            } else if (style === 3) {
                const cluster = 0.5 + 0.5 * Math.sin(i * 0.08);
                randomSpeed[i] = (explosionSpeedMin + Math.random() * explosionSpeedRange) * (0.4 + cluster);
            }

            if (style !== 3) {
                const speedVar = 0.75 + Math.random() * 0.55;
                randomSpeed[i] = (explosionSpeedMin + Math.random() * explosionSpeedRange) * speedVar;
            }

            randomDir[ix] = rx;
            randomDir[iy] = ry;
            randomDir[iz] = rz;
        }
        return;
    }

    if (type === 'update') {
        const {
            posLive,
            springDisp,
            springVel,
            count,
            dt,
            time,
            elapsed,
            isMotionReduced,
            mouseLocal,
            kFrame,
            dampFrame,
            expansionDuration,
            contractionDuration,
            explosionMaxDistMultiplier,
            mouseInfluence,
            repulsionStr
        } = data;

        if (!posHome) {
            // Safe fallback if update is sent before init completes
            self.postMessage({ type: 'update', seq, posLive, springDisp, springVel, travelRadius: 0 }, [posLive.buffer, springDisp.buffer, springVel.buffer]);
            return;
        }

        const mouseInfluence2 = mouseInfluence * mouseInfluence;

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
                const maxDist = randomSpeed[i] * explosionMaxDistMultiplier;
                const rx = randomDir[ix], ry = randomDir[iy], rz = randomDir[iz];

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
                bx += rx * dist;
                by += ry * dist;
                bz += rz * dist;
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

            // Measure how far this particle actually travelled from its rest position,
            // but only while an explosion is active (reset on randomize).
            if (elapsed > 0.0) {
                const tx = posLive[ix] - posHome[ix];
                const ty = posLive[iy] - posHome[iy];
                const tz = posLive[iz] - posHome[iz];
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
            travelRadius: Math.sqrt(maxTravelSq)
        }, [posLive.buffer, springDisp.buffer, springVel.buffer]);
    }
};
