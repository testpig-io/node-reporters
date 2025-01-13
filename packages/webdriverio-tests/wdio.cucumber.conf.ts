import { config as baseConfig } from './wdio.conf';
import type { Options } from '@wdio/types';
import path from "path";

export const config: Options.Testrunner = {
    ...baseConfig,
    specs: [
        './test/cucumber/features/**/*.feature'
    ],
    framework: 'cucumber',
    reporters: [
        [path.resolve(__dirname, '../webdriverio-reporter/dist/index.js'), {
            projectId: process.env.TESTPIG_PROJECT_ID,
            runId: process.env.TESTPIG_RUN_ID
        }]
    ],
    cucumberOpts: {
        require: ['./test/cucumber/steps/**/*.ts'],
        requireModule: ['ts-node/register'],
        backtrace: false,
        compiler: [],
        dryRun: false,
        failFast: false,
        snippets: true,
        source: true,
        strict: false,
        tagExpression: '',
        timeout: 60000,
        ignoreUndefinedDefinitions: false
    }
};