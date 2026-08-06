import { defineConfig, devices } from '@playwright/test';

// Browser test configuration for artz.
// Tests run against the production build served by `vite preview` so worker URL
// resolution and the /artz/ base path match the deployed environment.
export default defineConfig({
    testDir: './tests',
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: process.env.CI ? 2 : undefined,
    reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
    timeout: 60_000,
    expect: { timeout: 15_000 },

    use: {
        baseURL: 'http://127.0.0.1:4173/artz/',
        trace: 'retain-on-failure',
        screenshot: 'only-on-failure',
        // Software WebGL is sufficient to exercise the draw path headlessly.
    },

    webServer: {
        command: 'npm run preview -- --host 127.0.0.1 --port 4173',
        url: 'http://127.0.0.1:4173/artz/',
        reuseExistingServer: !process.env.CI,
        timeout: 60_000,
    },

    projects: [
        {
            name: 'chromium',
            use: {
                ...devices['Desktop Chrome'],
                // Run WebGL on the software rasterizer so it works in headless CI.
                launchOptions: { args: ['--use-angle=swiftshader'] },
            },
        },
    ],
});
