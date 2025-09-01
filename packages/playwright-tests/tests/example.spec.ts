import { test, expect } from '@playwright/test';

test.describe('Example Test Suite', () => {
    test('basic test', async ({ page }) => {
        await page.goto('https://playwright.dev/');
        const title = await page.title();
        expect(title).toContain('Playwright');
    });

    test('should handle assertions', async () => {
        expect(2 + 2).toBe(4);
        expect(typeof 'hello').toBe('string');
        expect([1, 2, 3]).toHaveLength(3);
    });

    test('should handle async operations', async () => {
        await new Promise<void>(resolve => {
            setTimeout(() => {
                expect(true).toBe(true);
                resolve();
            }, 100);
        });
    });

    test.skip('should fail the test', async() => {
        expect(true).toBe(false);
    });
});