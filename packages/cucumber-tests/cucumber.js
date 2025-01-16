module.exports = {
    default: {
        requireModule: ['ts-node/register'],
        require: ['features/step_definitions/**/*.ts'],
        format: [
            '../cucumber-reporter/dist/index.js:testpig.json',
            'progress'
        ],
        formatOptions: {
            testpig: {
                projectId: process.env.TESTPIG_PROJECT_ID || 'test-project',
                runId: process.env.TESTPIG_RUN_ID
            }
        }
    }
};