import { expect } from 'chai';

describe('Math Operations', () => {
    context('Addition', () => {
        it('should add two positive numbers correctly', () => {
            expect(2 + 3).to.equal(5);
        });

        it('should add two negative numbers correctly', () => {
            expect(-2 + -3).to.equal(-5);
        });

        it('should add a positive and a negative number correctly', () => {
            expect(2 + -3).to.equal(-1);
        });
    });

    context('Subtraction', () => {
        it('should subtract two positive numbers correctly', () => {
            expect(5 - 3).to.equal(2);
        });

        it('should subtract two negative numbers correctly', () => {
            expect(-5 - -3).to.equal(-2);
        });

        it('should subtract a positive and a negative number correctly', () => {
            expect(5 - -3).to.equal(8);
        });
    });
});

describe('String Operations', () => {
    context('Concatenation', () => {
        it('should concatenate two strings correctly', () => {
            expect('Hello' + ' ' + 'World').to.equal('Hello World');
        });

        it('should concatenate an empty string correctly', () => {
            expect('Hello' + '').to.equal('Hello');
        });
    });

    context('Length', () => {
        it('should return the correct length of a string', () => {
            expect('Hello'.length).to.equal(5);
        });

        it('should return zero for an empty string', () => {
            expect(''.length).to.equal(0);
        });
    });
});