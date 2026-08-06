import { test, expect } from '@playwright/test';
import { setText, waitForRender, particleCount, samplePositions } from './helpers';

test('page loads and renders a particle sculpture', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));

    await page.goto('/');
    await waitForRender(page);

    await expect(page.locator('canvas')).toBeVisible();
    const count = await particleCount(page);
    expect(count).toBeGreaterThan(0);
    expect(errors).toEqual([]);
});

test('particles are actively animated (positions change)', async ({ page }) => {
    await page.goto('/');
    await waitForRender(page);

    const a = await samplePositions(page, 24);
    await page.waitForTimeout(300);
    const b = await samplePositions(page, 24);

    let changed = 0;
    for (let i = 0; i < a.length; i++) {
        if (Math.abs(a[i] - b[i]) > 1e-6) changed++;
    }
    // Breathing physics moves the sculpture continuously.
    expect(changed).toBeGreaterThan(0);
});

test('changing the text rebuilds with a bounded particle count', async ({ page }) => {
    await page.goto('/');
    await waitForRender(page);

    await setText(page, 'HELLO');
    await waitForRender(page);
    const count = await particleCount(page);
    expect(count).toBeGreaterThan(0);
    // 30k hard ceiling (worker path).
    expect(count).toBeLessThanOrEqual(30000);
});
