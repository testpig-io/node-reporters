import {defineConfig, devices} from '@playwright/test';

export default defineConfig({
    testDir: './tests',
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: process.env.CI ? 1 : undefined,
    reporter: [
        ['list'],
        ['../playwright-reporter/dist/index.js', {
        }]
    ],
    use: {
        trace: 'on-first-retry',
        screenshot: 'only-on-failure',
    },
    projects: [
        {
            name: 'chromium',
            outputDir: './test-results/chromium',
            use: {...devices['Desktop Chrome'], screenshot: 'only-on-failure'},
        },
        {
            name: 'firefox',
            outputDir: './test-results/firefox',
            use: {...devices['Desktop Firefox'], screenshot: 'only-on-failure'},
        },
        {
            name: 'webkit',
            outputDir: './test-results/webkit',
            use: {...devices['Desktop Safari'], screenshot: 'only-on-failure'},
        },
    ],
});