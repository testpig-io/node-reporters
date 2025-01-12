module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    reporters: [
        'default',
        ['../jest-reporter/dist/index.js', {
            projectId: process.env.TESTPIG_PROJECT_ID || 'test-project',
            runId: process.env.TESTPIG_RUN_ID || 'test-run'
        }]
    ]
};