// physics.worker.js
// Runs the heavy particle spring-physics and repulsion simulations in a separate thread.

let posHome = null;
let randomDir = null;
let randomSpeed = null;

self.onmessage = function (e) {
    const { type, data } = e.data;

    if (type === 'init') {
        posHome = data.posHome;
        randomDir = data.randomDir;
        randomSpeed = data.randomSpeed;
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
            self.postMessage({ type: 'update', posLive, springDisp, springVel });
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
        }

        // Return updated buffers to the main thread
        self.postMessage({
            type: 'update',
            posLive,
            springDisp,
            springVel
        });
    }
};
