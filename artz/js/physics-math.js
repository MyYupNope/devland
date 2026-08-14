// ─────────────────────────────────────────────
// Physics Math Kernel — Shared Calculation Engine
// ─────────────────────────────────────────────
// Single source of truth for all particle kinematic trajectories and parametric models.
// Shared across both the Web Worker thread and the main-thread CPU fallback.

export function tornadoRadius(u, p) {
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

export function evaluateTornadoParticle(i, hx, hy, hz, u, fx, fz, cd, elapsed, pattern) {
    const radiusFunnel = tornadoRadius(u, pattern);
    const baseAngle = Math.atan2(fz, fx);
    const r0 = Math.hypot(hx, hz);

    const t1 = 3.5;                              // Phase 1: Generation & Ground Accretion (0 -> 3.5s)
    const t2 = pattern.vortexDuration || 4.5;    // Phase 2: Organic Ascent & Funnel Growth (3.5 -> 8.0s)
    const t3 = pattern.equilibriumDuration || 3.5;// Phase 3: Maturity & Dynamic Equilibrium (8.0 -> 11.5s)
    const t4 = 3.5;                              // Phase 4: Dissipation & Smooth Return (11.5 -> 15.0s)

    const discRadius = 14.0 + 0.55 * r0;
    const fBottom = pattern.funnelBottom || -22;
    const fHeight = pattern.funnelHeight || 46;

    // Multi-harmonic organic surface ripples (non-cone irregular surface)
    const ripple1 = 0.12 * Math.sin(3.0 * baseAngle - 4.2 * elapsed + 2.5 * u);
    const ripple2 = 0.08 * Math.cos(5.0 * baseAngle + 6.0 * elapsed - 3.8 * u);
    const ripple3 = 0.06 * Math.sin(elapsed * 7.5 + i * 0.03);
    const sheathRipple = 1.0 + ripple1 + ripple2 + ripple3;

    if (elapsed < t1) {
        // ── 1) Generation and Ground Phase (Phase 1: Accretion Revolution) ──
        const p1 = elapsed / t1;
        const e1 = p1 * p1 * p1 * (p1 * (p1 * 6.0 - 15.0) + 10.0); // Smooth quintic Hermite
        const rDisc = (1.0 - e1) * r0 + e1 * discRadius;
        const diffSpin = (4.0 + 15.0 / (r0 + 4.5)) * cd;
        const angle1 = baseAngle + diffSpin * elapsed * e1;

        return {
            x: Math.cos(angle1) * rDisc,
            y: (1.0 - e1) * hy + e1 * (fBottom + 0.022 * rDisc * rDisc + 3.0 * (u - 0.5)),
            z: Math.sin(angle1) * rDisc
        };
    } else if (elapsed < t1 + t2) {
        // ── 2) Ascent and Funnel Growth Phase (Phase 2: Vertical Funnel Vortex) ──
        const p2 = (elapsed - t1) / t2;
        const eLift = p2 * p2 * (3.0 - 2.0 * p2); // Smooth cubic ease for vertical ascent

        const speedPulse = 1.0 + 0.85 * Math.sin(Math.PI * p2);
        const diffSpin1 = (4.0 + 15.0 / (r0 + 4.5)) * cd * t1;
        const vortexSpin = ((pattern.spinSpeed || 5.2) * 2.8 + 4.5 * (1.0 - u)) * cd;
        const angle2 = baseAngle + diffSpin1 + vortexSpin * (elapsed - t1) * speedPulse;

        const currentR = (1.0 - eLift) * discRadius + eLift * (radiusFunnel * sheathRipple);
        const axisX = 2.8 * Math.sin(1.8 * elapsed + 2.2 * u) * u * eLift;
        const axisZ = 2.4 * Math.cos(1.5 * elapsed + 1.8 * u) * u * eLift;

        return {
            x: axisX + Math.cos(angle2) * currentR,
            y: (1.0 - eLift) * (fBottom + 0.022 * discRadius * discRadius) + eLift * (fBottom + fHeight * u) + 5.5 * Math.sin(p2 * Math.PI) * u,
            z: axisZ + Math.sin(angle2) * currentR
        };
    } else if (elapsed < t1 + t2 + t3) {
        // ── 3) Maturity and Dynamic Equilibrium (Phase 3: Centrifugal Expansion) ──
        const p3 = (elapsed - (t1 + t2)) / t3;
        const tRel3 = elapsed - (t1 + t2);
        const bloom = 1.0 + 0.75 * Math.sin(Math.PI * p3) + 0.35 * p3;

        const diffSpin1 = (4.0 + 15.0 / (r0 + 4.5)) * cd * t1;
        const vortexSpin = ((pattern.spinSpeed || 5.2) * 2.8 + 4.5 * (1.0 - u)) * cd;
        const angleAtEnd2 = baseAngle + diffSpin1 + vortexSpin * t2;
        const oscIntegral = tRel3 - (0.42 / 2.4) * (Math.cos(2.4 * tRel3) - 1.0);
        const angle3 = angleAtEnd2 + (vortexSpin * 0.68) * oscIntegral;

        const currentR3 = (radiusFunnel * sheathRipple) * bloom;
        const axisX3 = 2.8 * Math.sin(1.8 * (t1 + t2) + 2.2 * u) * u * (1.0 - 0.4 * p3);
        const axisZ3 = 2.4 * Math.cos(1.5 * (t1 + t2) + 1.8 * u) * u * (1.0 - 0.4 * p3);

        return {
            x: axisX3 + Math.cos(angle3) * currentR3,
            y: fBottom + fHeight * u + (1.0 - p3) * 2.0 * u,
            z: axisZ3 + Math.sin(angle3) * currentR3
        };
    } else {
        // ── 4) Dissipation Phase (Phase 4: Reverse Transformation to Ground Disc & Smooth Return) ──
        const p4 = Math.min(1.0, (elapsed - (t1 + t2 + t3)) / t4);
        const tRel4 = elapsed - (t1 + t2 + t3);

        const diffSpin1 = (4.0 + 15.0 / (r0 + 4.5)) * cd * t1;
        const vortexSpin = ((pattern.spinSpeed || 5.2) * 2.8 + 4.5 * (1.0 - u)) * cd;
        const oscIntegral3End = t3 - (0.42 / 2.4) * (Math.cos(2.4 * t3) - 1.0);
        const angleAtEnd3 = baseAngle + diffSpin1 + vortexSpin * t2 + (vortexSpin * 0.68) * oscIntegral3End;

        const spinDecay4 = Math.pow(1.0 - p4, 2.0);
        const angle4 = angleAtEnd3 + (vortexSpin * 0.50) * spinDecay4 * tRel4;

        const reverseFunnelR = (radiusFunnel * sheathRipple) * (1.0 - p4) + discRadius * p4;
        const reverseFunnelY = (fBottom + fHeight * u) * (1.0 - p4) + (fBottom + 0.022 * discRadius * discRadius + 3.0 * (u - 0.5)) * p4;

        const revDiscX = Math.cos(angle4) * reverseFunnelR;
        const revDiscY = reverseFunnelY;
        const revDiscZ = Math.sin(angle4) * reverseFunnelR;

        const returnProg = 0.35 * p4 + 0.65 * Math.pow(p4, 2.2);
        return {
            x: (1.0 - returnProg) * revDiscX + returnProg * hx,
            y: (1.0 - returnProg) * revDiscY + returnProg * hy,
            z: (1.0 - returnProg) * revDiscZ + returnProg * hz
        };
    }
}

export function evaluateBreezeParticle(i, hx, hy, hz, cd, elapsed, breezeConfig) {
    const b = breezeConfig || {};
    const gx = (b.blowDir != null) ? b.blowDir : 1.0;

    const t1 = 1.0;        // Phase 1: Straight Ground Fall (0 -> 1.0s)
    const tPause = 2.0;    // Ground Rest: 2 seconds on floor (1.0 -> 3.0s)
    const t2 = 3.6;        // Phase 2: Forward Fuzzy Breeze Lift (3.0 -> 6.6s)
    const t3 = 3.6;        // Phase 3: Reverse Breeze Flow to Floor (6.6 -> 10.2s)
    const t4 = 1.6;        // Phase 4: Reverse Drop Elevation Home (10.2 -> 11.8s)

    const lambda = ((i * 37.119) % 100.0) / 100.0;
    const isClash = (lambda < 0.22);

    const seedX = ((i * 19.417) % 100.0) - 50.0;
    const seedZ = ((i * 29.831) % 100.0) - 50.0;

    const scatX = isClash ? seedX * 0.05 : 0.0;
    const scatZ = isClash ? seedZ * 0.04 : 0.0;
    const yGround = -11.0; // Prominently visible in lower canvas

    const gX = hx + scatX;
    const gY = yGround + (hy * 0.03);
    const gZ = hz + scatZ;

    const windSpeedMult = 0.55 + (((i * 43.71) % 100.0) / 100.0) * 0.90;
    const buoyancy = 0.40 + (((i * 81.33) % 100.0) / 100.0) * 1.10;
    const liftStart = Math.pow(((i * 61.19) % 100.0) / 100.0, 1.4) * 0.60;

    function getPlumePosition(tWind, curElapsed) {
        if (lambda > 0.75) {
            const groundTumble = tWind * 14.0 * windSpeedMult * cd + 1.2 * Math.sin(3.5 * curElapsed + i * 0.1);
            return {
                x: gX + gx * groundTumble,
                y: gY + 0.40 * Math.abs(Math.sin(6.0 * curElapsed + i * 0.2)),
                z: gZ + 0.9 * Math.sin(2.5 * curElapsed + i * 0.15)
            };
        } else {
            const p = tWind / t2;
            const liftProg = Math.min(1.0, Math.max(0.0, (p - liftStart) / (1.0 - liftStart + 1e-4)));
            const eLift = liftProg * liftProg * (3.0 - 2.0 * liftProg);

            const plumeSpread = 1.0 + tWind * 0.55;
            const fuzzX = 6.0 * Math.sin(0.35 * gX + 4.1 * curElapsed + i * 0.13) + 3.0 * Math.cos(0.8 * gZ + 6.3 * curElapsed + i * 0.37);
            const fuzzY = 6.5 * Math.sin(0.28 * gX + 3.7 * curElapsed + i * 0.21) * Math.cos(0.4 * gZ + 5.1 * curElapsed) + 3.5 * Math.sin(7.5 * curElapsed + i * 0.45);
            const fuzzZ = 8.5 * Math.sin(0.25 * gX + 3.2 * curElapsed + i * 0.17) + 5.0 * Math.cos(0.6 * gY + 4.8 * curElapsed + i * 0.29);

            const xDrift = gx * (34.0 * windSpeedMult * cd * tWind + fuzzX * plumeSpread);
            const hLift = 10.0 + 24.0 * buoyancy * cd;
            const yWave = 4.5 * Math.sin(0.10 * (gX + gx * tWind * 25.0) - 2.8 * curElapsed) * Math.cos(0.12 * gZ);
            const zRibbon = seedZ * 0.35 * plumeSpread + fuzzZ;

            return {
                x: gX + xDrift,
                y: gY + eLift * (hLift + yWave + fuzzY),
                z: gZ + eLift * zRibbon
            };
        }
    }

    if (elapsed < t1) {
        // ── 1) Phase 1: Straight Vertical Fall & Floor Impact ──
        const p1 = elapsed / t1;
        const eDrop = Math.pow(p1, 2.0);

        const pImpact = Math.max(0.0, (p1 - 0.70) / 0.30);
        const eImpact = pImpact * (2.0 - pImpact);
        const recoil = (isClash ? 1.6 : 0.5) * Math.sin(Math.PI * pImpact) * (1.0 - pImpact);

        return {
            x: hx + scatX * eImpact,
            y: (1.0 - eDrop) * hy + eDrop * gY + recoil,
            z: hz + scatZ * eImpact
        };
    } else if (elapsed < t1 + tPause) {
        // ── 1.5) Ground Pause: 2 full seconds resting flat on visible floor ──
        return {
            x: gX,
            y: gY,
            z: gZ
        };
    } else if (elapsed < t1 + tPause + t2) {
        // ── 2) Phase 2: Forward Fuzzy Breeze Lift ──
        const tWind = elapsed - (t1 + tPause);
        return getPlumePosition(tWind, elapsed);
    } else if (elapsed < t1 + tPause + t2 + t3) {
        // ── 3) Phase 3: Exact Reverse Breeze Flow back to Ground Floor ──
        const p3 = (elapsed - (t1 + tPause + t2)) / t3;
        const smoothP3 = p3 * p3 * (3.0 - 2.0 * p3);
        const tWindRev = t2 * (1.0 - smoothP3);
        return getPlumePosition(tWindRev, elapsed);
    } else {
        // ── 4) Phase 4: Reverse Drop (Straight Elevation to Rest) ──
        const p4 = Math.min(1.0, (elapsed - (t1 + tPause + t2 + t3)) / t4);
        const eRise = p4 * p4 * (3.0 - 2.0 * p4);

        return {
            x: (1.0 - eRise) * gX + eRise * hx,
            y: (1.0 - eRise) * gY + eRise * hy,
            z: (1.0 - eRise) * gZ + eRise * hz
        };
    }
}

export function evaluateExplosionParticle(ox, oy, oz, rx, ry, rz, maxDist, expDur, driftDur, contrDur, elapsed) {
    const tDrift = driftDur || 3.0;
    const peakProg = (1.0 - Math.exp(-2.8)) * 0.82 + 0.18;
    const vLatest = (2.8 * Math.exp(-2.8) * 0.82 + 0.18) / Math.max(0.1, expDur);
    const driftPeakProg = peakProg + vLatest * tDrift * 0.78;

    let dist;
    if (elapsed < expDur) {
        const u = elapsed / expDur;
        dist = ((1.0 - Math.exp(-2.8 * u)) * 0.82 + 0.18 * u) * maxDist;
    } else if (elapsed < expDur + tDrift) {
        const dtDrift = elapsed - expDur;
        const driftRatio = dtDrift / Math.max(0.01, tDrift);
        const prog = peakProg + vLatest * dtDrift * (1.0 - 0.22 * driftRatio);
        dist = prog * maxDist;
    } else {
        const v = Math.min(1.0, (elapsed - (expDur + tDrift)) / contrDur);
        const returnProg = (1.0 - (0.35 * v + 0.65 * Math.pow(v, 2.2)));
        dist = driftPeakProg * Math.max(0, returnProg) * maxDist;
    }

    return {
        x: ox + rx * dist,
        y: oy + ry * dist,
        z: oz + rz * dist
    };
}
