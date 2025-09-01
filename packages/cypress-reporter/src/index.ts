import { TestEventHandler } from "@testpig/core";
import { v4 as uuidv4 } from "uuid";
import {
  Logger,
  MediaData,
  TestEventsEnum,
  createLogger,
  getSystemInfo,
} from "@testpig/shared";
import { spawnSync } from "node:child_process";
import * as fs from "fs";
import * as path from "path";

interface CypressReporterOptions {
  projectId?: string;
  runId?: string;
}

// Use a file to share config between plugin and reporter instances
const CONFIG_FILE = path.join(process.cwd(), ".cypress-testpig-config.json");

// Plugin initialization function - store config for reporter to use
function testPigReporter(on: any, config: any) {
  let browserConfig = { ...config };

  on("before:browser:launch", (browser: any, launchOptions: any) => {
    browserConfig = {
      ...browserConfig,
      browserName: browser.name,
      browserVersion: browser.version,
      browserFamily: browser.family,
    };

    // Write updated config atomically
    try {
      fs.writeFileSync(
        CONFIG_FILE,
        JSON.stringify(browserConfig, null, 2),
        { flag: "w" } // 'w' flag ensures atomic write
      );
    } catch (error) {
      console.error("Failed to write browser config:", error);
    }

    return launchOptions;
  });

  // Write initial config
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(browserConfig, null, 2), {
      flag: "w",
    });
  } catch (error) {
    console.error("Failed to write initial config:", error);
  }

  return config;
}

// Helper to get config in reporter
function getConfig(logger: Logger): any {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const config = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8"));
      logger.debug(
        "Loaded Cypress config successfully!",
        JSON.stringify(config, null, 2)
      );
      return config;
    }
  } catch (err) {
    console.error("Error reading Cypress config:", err);
  }
  return null;
}

class CypressReporter {
  private eventHandler: TestEventHandler;
  private failureCount: number = 0;
  private reporterOptions;
  private logger = createLogger("CypressReporter");
  private cypressConfig: any;
  private metadata: { [key: string]: any };

  constructor(
    runner: any,
    options: { reporterOptions?: CypressReporterOptions & { metadata?: { [key: string]: any } } } = {}
  ) {
    this.reporterOptions = options?.reporterOptions || {};
    const projectId =
      this.reporterOptions?.projectId || process.env.TESTPIG_PROJECT_ID;  
    const runId = this.reporterOptions?.runId || process.env.TESTPIG_RUN_ID;
    this.metadata = this.reporterOptions?.metadata || {};
    if (!projectId) {
      throw new Error(
        "projectId is required in reporterOptions or set in TESTPIG_PROJECT_ID environment variable"
      );
    }

    // Load the Cypress config
    this.cypressConfig = getConfig(this.logger);
    this.logger.debug(
      "Loaded Cypress config:",
      JSON.stringify(this.cypressConfig, null, 2)
    );

    this.eventHandler = new TestEventHandler(projectId, runId);
    this.logger.info(
      `Initialized with projectId: ${projectId}, runId: ${
        runId || "not specified"
      }`
    );
    this.setupEventHandlers(runner);
  }

  private setupEventHandlers(runner: any) {
    runner.on("start", () => {
      this.logger.info("Cypress test run starting");
      const data = this.eventHandler.eventNormalizer.normalizeRunStart();
      this.eventHandler.queueEvent(TestEventsEnum.RUN_START, data);
    });

    runner.on("suite", (suite: any) => {
      if (!suite.title || suite.root) {
        this.logger.debug(`Ignoring root suite or suite with no title`);
        return;
      }

      const suiteId = uuidv4();
      suite.testSuiteId = suiteId;
      this.logger.debug(
        `Suite started: ${suite.title}, ID: ${suiteId}, file: ${suite.invocationDetails?.relativeFile}`
      );
      this.logger.debug(
        "Cypress config loaded: ",
        JSON.stringify(this.cypressConfig, null, 2)
      );

      // Reload config to get latest browser info
      this.cypressConfig = getConfig(this.logger);

      const data = this.eventHandler.eventNormalizer.normalizeSuiteStart(
        suiteId,
        suite.title,
        suite.invocationDetails.relativeFile,
        suite.tests?.length || 0,
        {
          os: process.platform,
          architecture: process.arch,
          browser: this.cypressConfig?.browserName,
          framework: "Cypress",
          frameworkVersion: require("cypress/package.json").version,
          nodeVersion: getSystemInfo().nodeVersion,
          npmVersion: getSystemInfo().npmVersion,
        },
        this.metadata
      );
      this.eventHandler.queueEvent(TestEventsEnum.SUITE_START, data);
    });

    runner.on("test", (test: any) => {
      const testId = uuidv4();
      test.testCaseId = testId;
      this.logger.debug(
        `Test started: ${test.title}, ID: ${testId}, suite: ${test.parent?.title}`
      );

      const data = this.eventHandler.eventNormalizer.normalizeTestStart(
        testId,
        test.title,
        test.invocationDetails.relativeFile,
        test.body,
        {
          rabbitMqId: test.parent?.testSuiteId,
          title: test.parent?.title,
        },
        {
          name: this.cypressConfig?.browserName,
          version: this.cypressConfig?.browserVersion,
          viewPort: JSON.stringify({
            width: this.cypressConfig?.viewportWidth,
            height: this.cypressConfig?.viewportHeight,
          }),
          platform: process.platform,
        }
      );
      this.eventHandler.queueEvent(TestEventsEnum.TEST_START, data);
    });

    runner.on("pass", (test: any) => {
      this.logger.debug(
        `Test passed: ${test.title}, ID: ${test.testCaseId}, duration: ${test.duration}ms`
      );
      const data = this.eventHandler.eventNormalizer.normalizeTestPass({
        testId: test.testCaseId,
        title: test.title,
        duration: Math.ceil(test.duration),
        testSuite: {
          rabbitMqId: test.parent?.testSuiteId,
          title: test.parent?.title,
        },
        retries: test._retries,
      });
      this.eventHandler.queueEvent(TestEventsEnum.TEST_PASS, data);
    });

    runner.on("fail", (test: any, err: Error) => {
      this.failureCount++;
      this.logger.debug(`Test failed: ${test.title}, ID: ${test.testCaseId}`);
      this.logger.debug(`Error: ${err.message}`);

      // Are screenshots enabled?
      const screenshotsEnabled = this.cypressConfig?.screenshotOnRunFailure;
      this.logger.info("Screenshots enabled:", screenshotsEnabled);

      let mediaData: MediaData | undefined;
      if (screenshotsEnabled) {
        this.logger.info(
          "Screenshots enabled, getting screenshot path from config"
        );
        const screenshotsFolder = this.cypressConfig?.screenshotsFolder;
        this.logger.info(
          "Screenshots folder contents:",
          fs.readdirSync(screenshotsFolder)
        );
        const testFileName = path.basename(test.invocationDetails.relativeFile);
        const screenshotFilename = `${test.parent?.title} -- ${test.title} (failed).png`;
        const screenshotPath = path.join(
          screenshotsFolder,
          testFileName,
          screenshotFilename
        );
        this.logger.info("Screenshot path:", screenshotPath);
        // check if screenshot exists
        if (!fs.existsSync(screenshotPath)) {
          this.logger.warn(
            "Screenshot does not exist - check screenshotsFolder:",
            screenshotPath
          );
          mediaData = undefined;
        } else {
          const screenshotData = fs.readFileSync(screenshotPath);
          this.logger.info("Screenshot data:", screenshotData);
          mediaData = {
            data: screenshotData,
            rabbitMqId: test.testCaseId,
            type: "image",
            mimeType: "image/png",
            fileName: screenshotFilename,
            timestamp: new Date().toISOString(),
          };
        }
      }

      const data = this.eventHandler.eventNormalizer.normalizeTestFail({
        testId: test.testCaseId,
        title: test.title,
        error: err.message,
        stack: err.stack || "",
        testSuite: {
          rabbitMqId: test.parent?.testSuiteId,
          title: test.parent?.title,
        },
        media: mediaData,
      });

      this.eventHandler.queueEvent(TestEventsEnum.TEST_FAIL, data);
    });

    runner.on("suite end", (suite: any) => {
      if (!suite.title || suite.root) {
        this.logger.debug(`Ignoring end of root suite or suite with no title`);
        return;
      }

      const hasFailed = suite.tests.some((t: any) => t.state === "failed");
      this.logger.debug(
        `Suite ended: ${suite.title}, ID: ${suite.testSuiteId}, hasFailed: ${hasFailed}`
      );

      const data = this.eventHandler.eventNormalizer.normalizeSuiteEnd(
        suite.testSuiteId,
        suite.title,
        hasFailed
      );
      this.eventHandler.queueEvent(TestEventsEnum.SUITE_END, data);
    });

    runner.on("end", async () => {
      this.logger.info("Cypress test run ending, preparing to send results");
      const data = this.eventHandler.eventNormalizer.normalizeRunEnd(
        this.failureCount > 0
      );
      this.eventHandler.queueEvent(TestEventsEnum.RUN_END, data);

      // Clean up config file
      try {
        if (fs.existsSync(CONFIG_FILE)) {
          fs.unlinkSync(CONFIG_FILE);
        }
      } catch (err) {
        this.logger.error("Error cleaning up config file:", err);
      }

      // Serialize the event queue to pass to the child process
      const eventQueue = JSON.stringify(this.eventHandler.getEventQueue());
      this.logger.info(
        `Spawning child process to handle ${
          this.eventHandler.getEventQueue().length
        } events`
      );

      // Spawn a new Node.js process to handle the event queue processing
      // We can thank Cypress for needing this super hacky workaround. 🙄
      // Cypress by default will kill the process after the test run is complete
      // before mocha processes have completed async operations
      // See: https://github.com/cypress-io/cypress/issues/7139
      const result = spawnSync(
        "node",
        [
          "-e",
          `
                const { TestEventHandler } = require('@testpig/core');
                const { createLogger } = require('@testpig/shared');
                const logger = createLogger('CypressChildProcess');
                
                logger.info('Starting child process to process event queue');
                const eventQueue = ${eventQueue};
                logger.info(\`Processing \${eventQueue.length} events\`);
                
                const eventHandler = new TestEventHandler('${
                  this.reporterOptions.projectId ||
                  process.env.TESTPIG_PROJECT_ID
                }', '${
            this.reporterOptions.runId || process.env.TESTPIG_RUN_ID
          }');
                eventHandler.setEventQueue(eventQueue);
                
                logger.info('Starting event processing');
                eventHandler.processEventQueue().then(() => {
                    logger.info('Successfully processed all events');
                    setTimeout(() => {
                        logger.info('Exiting child process after waiting for network requests');
                    }, 2000);
                }).catch((error) => {
                    logger.error('Failed to process event queue:', error);
                });
            `,
        ],
        { stdio: "inherit" }
      );

      if (result.error) {
        this.logger.error("Failed to spawn child process:", result.error);
      } else {
        this.logger.info("Child process completed");
      }
    });
  }
}

// Export both the plugin init function and reporter class
module.exports = CypressReporter;
module.exports.testPigReporter = testPigReporter;
