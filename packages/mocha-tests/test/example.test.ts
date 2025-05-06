import { expect } from 'chai';

describe('Example Test Suite', () => {
    it('should pass a simple test', () => {
        expect(true).to.equal(true);
    });

    it('should perform basic assertions', () => {
        expect(2 + 2).to.equal(4);
        expect('hello').to.be.a('string');
        expect([1, 2, 3]).to.have.length(3);
    });

    it('should handle async operations', async () => {
        await new Promise<void>(resolve => {
            setTimeout(() => {
                expect(true).to.be.true;
                resolve();
            }, 100);
        });
    });

    xit('should fail a test', () => {
        expect(false).to.equal(true);
    });
});