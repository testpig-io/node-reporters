import { config as baseConfig } from './wdio.conf';
import type { Options } from '@wdio/types';
import path from "path";

export const config: Options.Testrunner = {
    ...baseConfig,
    specs: [
        './test/jasmine/**/*.spec.ts'
    ],
    framework: 'jasmine',
    reporters: [
        [path.resolve(__dirname, '../webdriverio-reporter/dist/index.js'), {
            projectId: process.env.TESTPIG_PROJECT_ID,
            runId: process.env.TESTPIG_RUN_ID
        }]
    ],
    jasmineOpts: {
        defaultTimeoutInterval: 60000,
        expectationResultHandler: undefined
    }
};