module.exports = {
    require: ['ts-node/register'],
    reporter: '../mocha-reporter/dist/index.js',
    'reporter-option': [
        `projectId=${process.env.TESTPIG_PROJECT_ID}`,
        `runId=${process.env.TESTPIG_RUN_ID}`
    ],
    timeout: 5000
};