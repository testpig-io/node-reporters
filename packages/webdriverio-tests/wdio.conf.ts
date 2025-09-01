import type { Options } from "@wdio/types";
import path from "path";

export const config: Options.Testrunner = {
  runner: "local",
  autoCompileOpts: {
    autoCompile: true,
    tsNodeOpts: {
      project: "./tsconfig.json",
      transpileOnly: true,
    },
  },
  specs: ["./test/**/*.spec.ts"],
  exclude: [],
  maxInstances: 10,
  capabilities: [
    {
      browserName: "chrome",
      "goog:chromeOptions": {
        args: [
          "--no-sandbox", 
          "--disable-dev-shm-usage",
        ],
      },
    },
  ],
  logLevel: "info",
  bail: 0,
  baseUrl: "http://localhost",
  waitforTimeout: 10000,
  connectionRetryTimeout: 120000,
  connectionRetryCount: 3,
  services: ["chromedriver"],
  framework: "mocha",
  reporters: [
    [
      path.resolve(__dirname, "../webdriverio-reporter/dist/index.js"),
      {
        projectId: process.env.TESTPIG_PROJECT_ID,
        runId: process.env.TESTPIG_RUN_ID,
      },
    ],
  ],
  mochaOpts: {
    ui: "bdd",
    timeout: 60000,
  },
};
