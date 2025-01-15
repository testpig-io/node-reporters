import { Given, When, Then } from '@wdio/cucumber-framework';

When('I visit the WebdriverIO website', async () => {
    await browser.url('https://webdriver.io');
});

Then('I should see {string} in the title', async (text: string) => {
    const title = await browser.getTitle();
    expect(title).toContain(text);
});

Then('basic assertions should pass', () => {
    expect(2 + 2).toBe(4);
    expect(typeof 'hello').toBe('string');
    expect([1, 2, 3]).toHaveLength(3);
});

Then('async operations should work', async () => {
    await new Promise<void>(resolve => {
        setTimeout(() => {
            expect(true).toBe(true);
            resolve();
        }, 100);
    });
});

Then('the test should fail', () => {
    expect(true).toBe(false);
});