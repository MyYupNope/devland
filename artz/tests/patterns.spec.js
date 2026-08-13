import { test, expect } from '@playwright/test';
import { waitForRender } from './helpers';

// The worker (and CPU fallback) echo the generated blast directions back to the
// main thread (see DIRECTIONS_VERIFY). Patterns are verified from those direction
// vectors directly — deterministic and immune to the frame-rate/timing jitter of
// headless software WebGL under parallel load. Expected styles:
// 0 = EXPLODE (uniform sphere), 1 = TORNADO (screen-space funnel in X/Z swirl
// with screen-up Y lift), 2 = BREEZE (strong coherent gust), 3 = KINETIC rays.
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

function assertTornado(dirs, homes) {
    expect(dirs.length).toBeGreaterThan(50);
    let mt = 0, mr = 0, maz = 0, mz = 0;
    for (let i = 0; i < dirs.length; i++) {
        const [dx, dy, dz] = dirs[i];
        const [hx, hy, hz] = homes[i];
        // The camera looks along world Z, so the funnel swirls in the X/Z screen
        // plane while the lift travels up the visible Y axis.
        const r = Math.hypot(hx, hz);
        let tx = 0, tz = 0, radx = 0, radz = 1;
        if (r > 1e-4) {
            radx = hx / r; radz = hz / r;
            tx = -radz; tz = radx;
        }
        mt += Math.abs(dx * tx + dz * tz);
        mr += Math.abs(dx * radx + dz * radz);
        maz += Math.abs(dy);
        mz += dy;
    }
    mt /= dirs.length; mr /= dirs.length; maz /= dirs.length; mz /= dirs.length;
    // A tornado swirls tightly around its Y axis in the visible X/Z plane without
    // blowing outward, and carries the whole sculpture up the screen.
    expect(mt).toBeGreaterThan(0.5);    // swirls in the visible X/Z plane
    expect(mr).toBeLessThan(0.35);      // no outward radial blow-out
    expect(maz).toBeGreaterThan(0.15);  // strong screen-up component
    expect(maz).toBeLessThan(0.85);
    expect(mz).toBeGreaterThan(0.15);   // net screen-up lift
}

function assertFunnelStructure(snap) {
    expect(snap.activeStyle).toBe(1);
    const p = snap.funnelProfile;
    expect(p.height).toBeGreaterThan(0);
    // Broad turbulent crown over a narrow waist over a fading tail.
    expect(p.crownRadius).toBeGreaterThan(p.waistRadius);
    expect(p.waistRadius).toBeGreaterThan(p.tailRadius);
    expect(p.tailRadius).toBeGreaterThan(0);
    expect(p.fadeEnd).toBeGreaterThan(p.fadeStart);
    // The stable per-particle roles span the whole funnel: some particles form the
    // crown, some fall inside the fading tail band.
    const ft = snap.funnelT;
    expect(ft.length).toBeGreaterThan(50);
    expect(Math.max(...ft)).toBeGreaterThan(0.85);
    expect(ft.filter(v => v < p.fadeEnd).length).toBeGreaterThan(0);
}

async function getFunnel(page, url) {
    await page.goto(url);
    await waitForRender(page);
    await page.click(`[data-text="TORNADO"]`);
    await page.waitForFunction(
        (st) => window.__artzDebug.snapshot(1).randomized.style === st,
        1,
        { timeout: 15_000 }
    );
    return page.evaluate(() => window.__artzDebug.snapshot(384));
}

function assertBreeze(dirs) {
    expect(dirs.length).toBeGreaterThan(50);
    const meanX = dirs.reduce((s, d) => s + d[0], 0) / dirs.length;
    const meanY = dirs.reduce((s, d) => s + d[1], 0) / dirs.length;
    const meanZ = dirs.reduce((s, d) => s + d[2], 0) / dirs.length;
    const meanMag = Math.hypot(meanX, meanY, meanZ);
    // High coherence: the whole cloud surges as one strong gust.
    expect(meanMag).toBeGreaterThan(0.7);
    expect(Math.abs(meanZ)).toBeLessThan(0.3);
}

test('EXPLODE preset blasts uniformly in 3D', async ({ page }) => {
    assertExplode((await getPattern(page, '/', 'EXPLODE', 0)).dirs);
});

test('KINETIC preset snaps particles onto crisp rays', async ({ page }) => {
    assertKinetic((await getPattern(page, '/', 'KINETIC', 3)).dirs);
});

test('TORNADO preset swirls particles up into a visible funnel', async ({ page }) => {
    const { dirs, homes } = await getPattern(page, '/', 'TORNADO', 1);
    assertTornado(dirs, homes);
});

test('TORNADO funnel shape has a broad crown over a waist over a fading tail @slow', async ({ page }) => {
    assertFunnelStructure(await getFunnel(page, '/'));
});

test('BREEZE preset flows in one coherent horizontal direction', async ({ page }) => {
    assertBreeze((await getPattern(page, '/', 'BREEZE', 2)).dirs);
});