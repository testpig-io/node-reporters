describe('Example Test Suite', () => {
    it('should open browser and verify title', async () => {
        await browser.url('https://webdriver.io');
        const title = await browser.getTitle();
        expect(title).toContain('WebdriverIO');
    });

    it('should perform basic assertions', () => {
        expect(2 + 2).toBe(4);
        expect(typeof 'hello').toBe('string');
        expect([1, 2, 3]).toHaveLength(3);
    });

    it('should handle async operations', async () => {
        await new Promise<void>(resolve => {
            setTimeout(() => {
                expect(true).toBe(true);
                resolve();
            }, 100);
        });
    });
});