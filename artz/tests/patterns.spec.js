import { test, expect } from '@playwright/test';
import { waitForRender } from './helpers';

// The worker (and CPU fallback) echo the generated blast directions back to the
// main thread (see DIRECTIONS_VERIFY). Patterns are verified from those direction
// vectors directly — deterministic and immune to the frame-rate/timing jitter of
// headless software WebGL under parallel load. Expected styles:
// 0 = EXPLODE (uniform sphere), 1 = GALAXY (tangential vortex, flattened disk),
// 2 = BREEZE (coherent gust), 3 = KINETIC (crisp rays).
async function getPattern(page, url, chip, expectedStyle) {
    await page.goto(url);
    await waitForRender(page);
    await page.click(`[data-text="${chip}"]`);
    await page.waitForFunction(
        (st) => window.__artzDebug.snapshot(1).randomized.style === st,
        expectedStyle,
        { timeout: 15_000 }
    );

    const res = await page.evaluate((n) => {
        const s = window.__artzDebug.snapshot(n);
        return { dirs: s.randomized.dirs, home: s.home };
    }, 384);

    const dirs = [];
    for (let i = 0; i + 2 < res.dirs.length; i += 3) {
        dirs.push([res.dirs[i], res.dirs[i + 1], res.dirs[i + 2]]);
    }
    const homes = [];
    for (let i = 0; i + 2 < res.home.length; i += 3) {
        homes.push([res.home[i], res.home[i + 1], res.home[i + 2]]);
    }
    return { dirs, homes };
}

function assertExplode(dirs) {
    expect(dirs.length).toBeGreaterThan(50);
    const zs = dirs.map(d => d[2]);
    const zMean = zs.reduce((s, z) => s + z, 0) / zs.length;
    const zStd = Math.sqrt(zs.reduce((s, z) => s + (z - zMean) ** 2, 0) / (zs.length - 1));
    const meanX = dirs.reduce((s, d) => s + d[0], 0) / dirs.length;
    const meanY = dirs.reduce((s, d) => s + d[1], 0) / dirs.length;
    const meanMag = Math.hypot(meanX, meanY, zMean);
    expect(zStd).toBeGreaterThan(0.35);
    expect(meanMag).toBeLessThan(0.25);
}

function assertKinetic(dirs) {
    expect(dirs.length).toBeGreaterThan(50);
    const sub = dirs.slice(0, 96);
    let alignedPairs = 0;
    for (let i = 0; i < sub.length; i++) {
        for (let j = i + 1; j < sub.length; j++) {
            const dot = sub[i][0] * sub[j][0] + sub[i][1] * sub[j][1] + sub[i][2] * sub[j][2];
            if (Math.abs(dot) > 0.95) alignedPairs++;
        }
    }
    expect(alignedPairs).toBeGreaterThan(150);
}

function assertGalaxy(dirs, homes) {
    expect(dirs.length).toBeGreaterThan(50);
    let mt = 0, mr = 0, maz = 0, mx = 0, my = 0, mz = 0;
    for (let i = 0; i < dirs.length; i++) {
        const [dx, dy, dz] = dirs[i];
        const [hx, hy] = homes[i];
        const r = Math.hypot(hx, hy);
        let radx = 0, rady = 0, tx = 1, ty = 0;
        if (r > 1e-4) {
            radx = hx / r; rady = hy / r;
            tx = -rady; ty = radx;
        }
        mt += Math.abs(dx * tx + dy * ty);
        mr += Math.abs(dx * radx + dy * rady);
        maz += Math.abs(dz);
        mx += dx; my += dy; mz += dz;
    }
    mt /= dirs.length; mr /= dirs.length; maz /= dirs.length;
    const meanMag = Math.hypot(mx / dirs.length, my / dirs.length, mz / dirs.length);
    expect(mt).toBeGreaterThan(0.6);
    expect(mr).toBeLessThan(0.5);
    expect(maz).toBeLessThan(0.35);
    expect(meanMag).toBeLessThan(0.25);
}

function assertBreeze(dirs) {
    expect(dirs.length).toBeGreaterThan(50);
    const meanX = dirs.reduce((s, d) => s + d[0], 0) / dirs.length;
    const meanY = dirs.reduce((s, d) => s + d[1], 0) / dirs.length;
    const meanZ = dirs.reduce((s, d) => s + d[2], 0) / dirs.length;
    const meanMag = Math.hypot(meanX, meanY, meanZ);
    expect(meanMag).toBeGreaterThan(0.4);
    expect(Math.abs(meanZ)).toBeLessThan(0.3);
}

test('EXPLODE preset blasts uniformly in 3D', async ({ page }) => {
    assertExplode((await getPattern(page, '/', 'EXPLODE', 0)).dirs);
});

test('KINETIC preset snaps particles onto crisp rays', async ({ page }) => {
    assertKinetic((await getPattern(page, '/', 'KINETIC', 3)).dirs);
});

test('GALAXY preset orbits tangentially in a flattened disk', async ({ page }) => {
    const { dirs, homes } = await getPattern(page, '/', 'GALAXY', 1);
    assertGalaxy(dirs, homes);
});

test('BREEZE preset flows in one coherent horizontal direction', async ({ page }) => {
    assertBreeze((await getPattern(page, '/', 'BREEZE', 2)).dirs);
});

test('CPU fallback matches EXPLODE uniform sphere', async ({ page }) => {
    assertExplode((await getPattern(page, '/?noworker=1', 'EXPLODE', 0)).dirs);
});

test('CPU fallback matches KINETIC ray clustering', async ({ page }) => {
    assertKinetic((await getPattern(page, '/?noworker=1', 'KINETIC', 3)).dirs);
});

test('CPU fallback matches GALAXY tangential disk', async ({ page }) => {
    const { dirs, homes } = await getPattern(page, '/?noworker=1', 'GALAXY', 1);
    assertGalaxy(dirs, homes);
});

test('CPU fallback matches BREEZE gust coherence', async ({ page }) => {
    assertBreeze((await getPattern(page, '/?noworker=1', 'BREEZE', 2)).dirs);
});