describe('Example Test Suite', () => {
    it('should pass a simple test', () => {
        expect(true).toBe(true);
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

    it('should fail a test', () => {
        expect(true).toBe(false);
    });
});