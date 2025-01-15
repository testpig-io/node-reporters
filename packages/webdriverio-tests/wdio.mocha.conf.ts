import { config as baseConfig } from './wdio.conf';
import type { Options } from '@wdio/types';
import path from "path";

export const config: Options.Testrunner = {
    ...baseConfig,
    specs: [
        './test/mocha/**/*.spec.ts'
    ],
    framework: 'mocha',
    reporters: [
        [path.resolve(__dirname, '../webdriverio-reporter/dist/index.js'), {
            projectId: process.env.TESTPIG_PROJECT_ID,
            runId: process.env.TESTPIG_RUN_ID
        }]
    ],
    mochaOpts: {
        timeout: 60000
    }
};