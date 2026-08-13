import { test, expect } from '@playwright/test';
import { waitForRender } from './helpers';

function assertOriginCapture(result) {
    expect(result.before.position.length).toBeGreaterThan(0);
    expect(result.before.position.length).toBe(result.after.explosionOrigin.length);

    let maxCaptureError = 0;
    for (let i = 0; i < result.before.position.length; i++) {
        maxCaptureError = Math.max(
            maxCaptureError,
            Math.abs(result.before.position[i] - result.after.explosionOrigin[i])
        );
    }
    expect(maxCaptureError).toBeLessThan(1e-6);

    // A shared screen-center origin would collapse all particles to one point.
    const xs = [];
    for (let i = 0; i < result.after.explosionOrigin.length; i += 3) {
        xs.push(result.after.explosionOrigin[i]);
    }
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(1);
}

async function exerciseOrigin(page, url) {
    await page.goto(url);
    await waitForRender(page);

    const result = await page.evaluate(() => {
        const before = window.__artzDebug.snapshot(32);
        window.__artzDebug.triggerExplosion();
        const after = window.__artzDebug.snapshot(32);
        return { before, after };
    });
    assertOriginCapture(result);

    await page.waitForFunction(() => !window.__artzDebug.snapshot(1).explosionActive, null, {
        timeout: 12_000
    });
    await page.waitForTimeout(100);

    const recovered = await page.evaluate(() => window.__artzDebug.snapshot(32));
    let maxRecoveryError = 0;
    for (let i = 0; i < recovered.position.length; i++) {
        maxRecoveryError = Math.max(
            maxRecoveryError,
            Math.abs(recovered.position[i] - recovered.home[i])
        );
    }
    expect(maxRecoveryError).toBeLessThan(1e-4);
}

test('worker explosions start at each particle position and recover exactly', async ({ page }) => {
    await exerciseOrigin(page, '/');
});

test('CPU fallback explosions start at each particle position and recover exactly', async ({ page }) => {
    await exerciseOrigin(page, '/?noworker=1');
});

test('preset explosions capture their scattered on-screen origins', async ({ page }) => {
    await page.goto('/');
    await waitForRender(page);

    await page.click('[data-text="KINETIC"]');
    await page.waitForFunction(() => window.__artzDebug.snapshot(1).explosionActive);
    const snapshot = await page.evaluate(() => window.__artzDebug.snapshot(32));

    let maxScatter = 0;
    for (let i = 0; i < snapshot.home.length; i++) {
        maxScatter = Math.max(
            maxScatter,
            Math.abs(snapshot.explosionOrigin[i] - snapshot.home[i])
        );
    }
    expect(maxScatter).toBeGreaterThan(5);
    expect(snapshot.rotation).toEqual([0, 0, 0]);
});
