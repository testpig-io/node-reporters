import { Given, When, Then } from '@cucumber/cucumber';
import { strict as assert } from 'assert';

class Calculator {
    private numbers: number[] = [];
    private result: number = 0;

    addNumber(num: number) {
        this.numbers.push(num);
    }

    add() {
        this.result = this.numbers.reduce((a, b) => a + b, 0);
        this.numbers = [];
    }

    subtract() {
        this.result = this.numbers[0] - this.numbers[1];
        this.numbers = [];
    }

    multiply() {
        this.result = this.numbers[0] * this.numbers[1];
        this.numbers = [];
    }

    getResult() {
        return this.result;
    }
}

const calculator = new Calculator();

Given('I have entered {int} into the calculator', function (num: number) {
    calculator.addNumber(num);
});

When('I press add', function () {
    calculator.add();
});

When('I press subtract', function () {
    calculator.subtract();
});

When('I press multiply', function () {
    calculator.multiply();
});

Then('the result should be {int}', function (expected: number) {
    assert.equal(calculator.getResult(), expected);
});