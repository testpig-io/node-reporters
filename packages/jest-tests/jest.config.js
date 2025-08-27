module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    reporters: [
        'default',
        ['../jest-reporter/dist/index.js', {
        }]
    ],
    maxWorkers: '50%'
};