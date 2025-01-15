describe('Example Test Suite', () => {
    it('jasmine - should open browser and verify title', async () => {
        await browser.url('https://webdriver.io');
        const title = await browser.getTitle();
        expect(title).toContain('WebdriverIO');
    });

    it('jasmine - should perform basic assertions', () => {
        expect(2 + 2).toBe(4);
        expect(typeof 'hello').toBe('string');
        expect([1, 2, 3].length).toBe(3);
    });

    it('jasmine - should handle async operations', async () => {
        await new Promise<void>(resolve => {
            setTimeout(() => {
                expect(true).toBeTruthy();
                resolve();
            }, 100);
        });
    });

    it('jasmine - should fail the test', () => {
        expect(true).toBeFalsy();
    });
});