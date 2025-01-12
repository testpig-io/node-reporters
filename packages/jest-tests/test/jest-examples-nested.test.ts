// `packages/jest-tests/test/jest-new-scenarios.test.ts`

describe('New Test Suite', () => {
    describe('Nested Suite 1', () => {
        it('should pass a simple test 2', () => {
            expect(true).toBe(true);
        });

        it('should perform basic assertions 2', () => {
            expect(2 + 2).toBe(4);
            expect(typeof 'hello').toBe('string');
            expect([1, 2, 3]).toHaveLength(3);
        });
    });

    describe('Nested Suite 2', () => {
        it('should handle async operations 2', async () => {
            await new Promise<void>(resolve => {
                setTimeout(() => {
                    expect(true).toBe(true);
                    resolve();
                }, 100);
            });
        });

        it('should test object properties', () => {
            const obj = { a: 1, b: 2, c: 3 };
            expect(obj).toHaveProperty('a', 1);
            expect(obj).toHaveProperty('b', 2);
            expect(obj).toHaveProperty('c', 3);
        });

        it('should test array contents', () => {
            const arr = [1, 2, 3, 4, 5];
            expect(arr).toContain(3);
            expect(arr).toContain(5);
        });
    });

    describe('Nested Suite 3', () => {
        it('should test string matching', () => {
            const str = 'Hello, world!';
            expect(str).toMatch(/world/);
            expect(str).toMatch(/^Hello/);
        });

        it('should test number comparisons', () => {
            expect(10).toBeGreaterThan(5);
            expect(10).toBeLessThan(20);
        });
    });
});