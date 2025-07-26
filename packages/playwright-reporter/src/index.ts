import {Reporter, TestCase, TestResult, TestStep, TestError, FullConfig, Suite} from '@playwright/test/reporter';
import {TestEventHandler} from '@testpig/core';
import {v4 as uuidv4} from 'uuid';
import fs from 'fs';
import {MediaData, TestEventsEnum, createLogger, getSystemInfo } from "@testpig/shared";
import { PlaywrightConfigManager } from './config-manager';
import path from 'path';

interface BrowserDetails {
    name?: string;
    version?: string;
    viewPort?: string;
    platform?: string;
}

interface SuiteInfo {
    id: string;
    title: string;
    file: string;
    projectName: string;
}

class PlaywrightReporter implements Reporter {
    private configManager: PlaywrightConfigManager | undefined;
    private eventHandler: TestEventHandler;
    private failureCount: number = 0;
    private suitesByProject: Map<string, SuiteInfo> = new Map();
    private logger = createLogger('PlaywrightReporter');

    constructor(options: { projectId?: string; runId?: string } = {}) {
        const projectId = options.projectId || process.env.TESTPIG_PROJECT_ID;
        const runId = options.runId || process.env.TESTPIG_RUN_ID;

        if (!projectId) {
            throw new Error('projectId is required in reporter options or set in TESTPIG_PROJECT_ID environment variable');
        }

        this.eventHandler = new TestEventHandler(projectId, runId);
        this.logger.info(`Initialized with projectId: ${projectId}, runId: ${runId || 'not specified'}`);
    }

    onBegin(config: FullConfig, suite: Suite): void {
        this.configManager = new PlaywrightConfigManager(config);
        this.logger.info('Test run starting');
        const data = this.eventHandler.eventNormalizer.normalizeRunStart();
        this.eventHandler.queueEvent(TestEventsEnum.RUN_START, data);
    }

    onTestBegin(test: TestCase): void {
        const projectName = test.parent.project()?.name || 'unknown';
        const suitePath = test.location.file;
        const suiteTitle = this.getSuiteTitle(test);
        const suiteKey = `${projectName}:${suitePath}`;

        if (!this.suitesByProject.has(suiteKey)) {
            const suiteId = uuidv4();
            const suiteInfo: SuiteInfo = {
                id: suiteId,
                title: suiteTitle,
                file: suitePath,
                projectName
            };
            
            this.suitesByProject.set(suiteKey, suiteInfo);
            this.logger.debug(`Suite started for project ${projectName}: ${suiteTitle}`);

            const suiteData = this.eventHandler.eventNormalizer.normalizeSuiteStart(
                suiteId,
                suiteTitle,
                suitePath,
                1,
                {
                    os: process.platform,
                    architecture: process.arch,
                    browser: projectName,
                    framework: 'Playwright',
                    frameworkVersion: require('@playwright/test/package.json').version,
                    nodeVersion: getSystemInfo().nodeVersion,
                    npmVersion: getSystemInfo().npmVersion
                },
                'e2e'
            );

            this.eventHandler.queueEvent(TestEventsEnum.SUITE_START, suiteData);
        }

        const currentSuite = this.suitesByProject.get(suiteKey);
        if (!currentSuite) {
            this.logger.error(`Suite not found for project ${projectName}`);
            return;
        }

        const testId = uuidv4();
        const testBody = this.getTestBody(test);
        this.logger.debug(`Test started for project ${projectName}: ${test.title}`);

        const rawBrowserDetails = this.configManager?.getBrowserDetails(test);
        const browserDetails: BrowserDetails | undefined = rawBrowserDetails ? {
            name: rawBrowserDetails.name,
            version: rawBrowserDetails.version || undefined,
            viewPort: rawBrowserDetails.viewPort,
            platform: rawBrowserDetails.platform
        } : undefined;

        const testData = this.eventHandler.eventNormalizer.normalizeTestStart(
            testId,
            test.title,
            test.location.file,
            testBody,
            {
                rabbitMqId: currentSuite.id,
                title: currentSuite.title
            },
            browserDetails
        );

        this.eventHandler.queueEvent(TestEventsEnum.TEST_START, testData);
        (test as any).testCaseId = testId;
    }

    onTestEnd(test: TestCase, result: TestResult): void {
        const testId = (test as any).testCaseId;
        const projectName = test.parent.project()?.name || 'unknown';
        const suiteKey = `${projectName}:${test.location.file}`;
        const currentSuite = this.suitesByProject.get(suiteKey);
        
        if (!currentSuite) {
            this.logger.error(`Suite not found for project ${projectName}`);
            return;
        }

        if (result.status === 'passed') {
            this.logger.debug(`Test passed: ${test.title}`);
            const data = this.eventHandler.eventNormalizer.normalizeTestPass(
                {
                    testId,
                    title: test.title,
                    duration: result.duration ? Math.ceil(result.duration) : undefined,
                    retries: result.retry,
                    testSuite: {
                        rabbitMqId: currentSuite.id,
                        title: currentSuite.title
                    }
                }
            );
            this.eventHandler.queueEvent(TestEventsEnum.TEST_PASS, data);
        } else if (result.status === 'failed') {
            let mediaData: MediaData | undefined;
            if (this.configManager?.isScreenshotEnabled(test)) {
                // Try attachment first
                const screenshot = result.attachments.find(a => 
                    a.name === 'screenshot' && 
                    a.contentType === 'image/png'
                );

                this.logger.warn(`FAILED > result.attachments:`, JSON.stringify(result.attachments, null, 2));

                try {
                    const screenshotPath = screenshot?.path || this.configManager.getScreenshotPath(test);
                    this.logger.warn(`FAILED > Screenshot path FINAL: ${screenshotPath}`);
                    if (screenshotPath && fs.existsSync(screenshotPath)) {
                        const screenshotData = fs.readFileSync(screenshotPath);
                        this.logger.warn(`FAILED > Screenshot data:`, screenshotData);
                        mediaData = {
                            data: screenshotData,
                            rabbitMqId: testId,
                            type: 'image',
                            mimeType: 'image/png',
                            fileName: path.basename(screenshotPath),
                            timestamp: new Date().toISOString()
                        };
                    }
                } catch (error) {
                    this.logger.error(`Failed to process screenshot:`, error);
                }
            }
            this.failureCount++;
            const error = result.error || {};
            this.logger.debug(`Test failed: ${test.title}`, error.message);
            const data = this.eventHandler.eventNormalizer.normalizeTestFail(
                {
                    testId,
                    title: test.title,
                    error: error.message || 'Test failed',
                    stack: error.stack || '',
                    testSuite: {
                        rabbitMqId: currentSuite.id,
                        title: currentSuite.title
                    },
                    media: mediaData
                }
            );
            this.eventHandler.queueEvent(TestEventsEnum.TEST_FAIL, data);
        } else if (result.status === 'skipped') {
            this.logger.debug(`Test skipped: ${test.title}`);
            const data = this.eventHandler.eventNormalizer.normalizeTestSkip(
                {
                    testId,
                    title: test.title,
                    testSuite: {
                        rabbitMqId: currentSuite.id,
                        title: currentSuite.title
                    }
                }
            );
            this.eventHandler.queueEvent(TestEventsEnum.TEST_END, data);
        } else if (result.status === 'timedOut' || result.status === 'interrupted') {
            this.logger.debug(`Test ${result.status}: ${test.title}`);
            const data = this.eventHandler.eventNormalizer.normalizeTestPending(
                {
                    testId,
                    title: test.title,
                    testSuite: {
                        rabbitMqId: currentSuite.id,
                        title: currentSuite.title
                    }
                }
            );
            this.eventHandler.queueEvent(TestEventsEnum.TEST_END, data);
        }
    }

    async onEnd(): Promise<void> {
        // End all suites
        for (const [_, suite] of this.suitesByProject) {
            this.logger.debug(`Suite ended for project ${suite.projectName}: ${suite.title}`);
            const suiteEndData = this.eventHandler.eventNormalizer.normalizeSuiteEnd(
                suite.id,
                suite.title,
                false
            );
            this.eventHandler.queueEvent(TestEventsEnum.SUITE_END, suiteEndData);
        }

        const data = this.eventHandler.eventNormalizer.normalizeRunEnd(this.failureCount > 0);
        this.eventHandler.queueEvent(TestEventsEnum.RUN_END, data);
        
        this.logger.info("Finishing Playwright test run, waiting for API calls to complete...");
        await this.eventHandler.processEventQueue();
        
        this.logger.info("Waiting for network requests to complete...");
        await new Promise(resolve => setTimeout(resolve, 2000));
        this.logger.info("Network wait period complete, exiting normally");
    }

    private getSuiteTitle(test: TestCase): string {
        const parts = test.location.file.split('/');
        return parts[parts.length - 1].replace(/\.[^/.]+$/, '');
    }

    private getTestBody(test: TestCase): string {
        try {
            const content = fs.readFileSync(test.location.file, 'utf8');
            const lines = content.split('\n');

            // Playwright provides line numbers for test locations
            const startLine = test.location.line - 1;
            let endLine = startLine;

            // Find the end of the test by looking for closing brace
            let braceCount = 0;
            let foundStart = false;

            for (let i = startLine; i < lines.length; i++) {
                const line = lines[i];

                if (!foundStart && line.includes('test(')) {
                    foundStart = true;
                }

                if (foundStart) {
                    braceCount += (line.match(/{/g) || []).length;
                    braceCount -= (line.match(/}/g) || []).length;

                    if (braceCount === 0) {
                        endLine = i;
                        break;
                    }
                }
            }

            return lines.slice(startLine, endLine + 1).join('\n');
        } catch (error) {
            this.logger.error('Error reading test file:', error);
            return '';
        }
    }
}

export default PlaywrightReporter;