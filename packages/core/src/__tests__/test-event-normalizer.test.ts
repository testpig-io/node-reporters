/// <reference types="jest" />

import { TestEventNormalizer } from '../test-event-normalizer';
import { TestStatus, MessageData, getGitInfo, SystemDetails, MediaData } from '@testpig/shared';

jest.mock('@testpig/shared', () => ({
    ...jest.requireActual('@testpig/shared'),
    getGitInfo: jest.fn().mockReturnValue({
        branch: 'main',
        commit: 'abc123',
        author: 'test@example.com',
        committer: 'test@example.com',
        isCI: false
    }),
    createLogger: () => ({
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn()
    })
}));

describe('TestEventNormalizer', () => {
    const PROJECT_ID = 'test-project';
    const RUN_ID = 'test-run';
    let normalizer: TestEventNormalizer;

    beforeEach(() => {
        jest.clearAllMocks();
        normalizer = new TestEventNormalizer(PROJECT_ID, RUN_ID);
    });

    describe('normalizeRunStart', () => {
        it('should create a new test run with provided runId', () => {
            const result = normalizer.normalizeRunStart();

            expect(result).toEqual(expect.objectContaining({
                title: RUN_ID,
                status: TestStatus.RUNNING,
                projectId: PROJECT_ID,
                rabbitMqId: expect.any(String)
            }));
        });

        it('should use git branch as run title when runId not provided', () => {
            const normalizerWithoutRunId = new TestEventNormalizer(PROJECT_ID);
            const result = normalizerWithoutRunId.normalizeRunStart();

            expect(result).toEqual(expect.objectContaining({
                title: 'main', // from mocked getGitInfo
                status: TestStatus.RUNNING,
                projectId: PROJECT_ID,
                rabbitMqId: expect.any(String)
            }));
        });

        it('should reuse existing test run if already created', () => {
            const firstRun = normalizer.normalizeRunStart();
            const secondRun = normalizer.normalizeRunStart();

            expect(secondRun.rabbitMqId).toBe(firstRun.rabbitMqId);
        });
    });

    describe('normalizeSuiteStart', () => {
        const metaData = {
            testType: 'e2e'
        };

        const systemInfo: SystemDetails = {
            os: 'darwin',
            architecture: 'x64',
            browser: 'chrome',
            framework: 'jest',
            frameworkVersion: '29.0.0',
            nodeVersion: '18.0.0',
            npmVersion: '9.0.0'
        };

        it('should normalize suite start event with all required fields', () => {
            const suiteId = 'suite-123';
            const title = 'Test Suite';
            const fileName = 'test.spec.ts';
            const testCount = 5;

            const result = normalizer.normalizeSuiteStart(
                suiteId,
                title,
                fileName,
                testCount,
                systemInfo,
                metaData
            );

            expect(result).toEqual(expect.objectContaining({
                fileName,
                projectId: PROJECT_ID,
                status: TestStatus.RUNNING,
                startTime: expect.any(Date),
                rabbitMqId: suiteId,
                title,
                testTool: systemInfo.framework,
                metadata: metaData,
                testRun: expect.objectContaining({
                    title: RUN_ID
                }),
                testCaseCount: testCount,
                system: systemInfo,
                git: expect.objectContaining({
                    branch: 'main',
                    commit: 'abc123',
                    author: 'test@example.com'
                })
            }));
        });
    });

    describe('normalizeTestStart', () => {
        const browserDetails = {
            name: 'chrome',
            version: '100.0.0',
            viewPort: '1280x720',
            platform: 'darwin'
        };

        it('should normalize test start event with browser details', () => {
            const testId = 'test-123';
            const title = 'should do something';
            const fileName = 'test.spec.ts';
            const testBody = 'test function body';
            const testSuite = {
                rabbitMqId: 'suite-123',
                title: 'Test Suite'
            };

            const result = normalizer.normalizeTestStart(
                testId,
                title,
                fileName,
                testBody,
                testSuite,
                browserDetails
            );

            expect(result).toEqual(expect.objectContaining({
                projectId: PROJECT_ID,
                rabbitMqId: testId,
                startTime: expect.any(Date),
                testSuite,
                title,
                status: TestStatus.RUNNING,
                fileName,
                testBody,
                browser: browserDetails
            }));
        });

        it('should normalize test start event without browser details', () => {
            const testId = 'test-123';
            const title = 'should do something';
            const fileName = 'test.spec.ts';
            const testBody = 'test function body';
            const testSuite = {
                rabbitMqId: 'suite-123',
                title: 'Test Suite'
            };

            const result = normalizer.normalizeTestStart(
                testId,
                title,
                fileName,
                testBody,
                testSuite
            );

            expect(result.browser).toBeUndefined();
        });
    });

    describe('normalizeTestPass', () => {
        it('should normalize test pass event with duration and retries', () => {
            const testId = 'test-123';
            const title = 'should pass';
            const duration = 100;
            const testSuite = {
                rabbitMqId: 'suite-123',
                title: 'Test Suite'
            };
            const retries = 2;

            const result = normalizer.normalizeTestPass({
                testId,
                title,
                duration,
                testSuite,
                retries
            });

            expect(result).toEqual(expect.objectContaining({
                projectId: PROJECT_ID,
                rabbitMqId: testId,
                testSuite,
                testRun: expect.objectContaining({
                    title: RUN_ID
                }),
                title,
                status: TestStatus.PASSED,
                duration,
                retries: '2',
                endTime: expect.any(Date)
            }));
        });

        it('should normalize test pass event without optional fields', () => {
            const testId = 'test-123';
            const title = 'should pass';
            const testSuite = {
                rabbitMqId: 'suite-123',
                title: 'Test Suite'
            };

            const result = normalizer.normalizeTestPass({
                testId,
                title,
                testSuite
            });

            expect(result.duration).toBeUndefined();
            expect(result.retries).toBeUndefined();
        });
    });

    describe('normalizeTestFail', () => {
        it('should normalize test fail event with media data', () => {
            const testId = 'test-123';
            const title = 'should fail';
            const error = 'Test failed';
            const stack = 'Error stack trace';
            const testSuite = {
                rabbitMqId: 'suite-123',
                title: 'Test Suite'
            };
            const duration = 100;
            const media: MediaData = {
                rabbitMqId: testId,
                data: Buffer.from([1, 2, 3, 4]),
                fileName: 'screenshot.png',
                mimeType: 'image/png',
                type: 'image',
                timestamp: new Date().toISOString()
            };

            const result = normalizer.normalizeTestFail({
                testId,
                title,
                error,
                stack,
                testSuite,
                duration,
                media
            });

            expect(result).toEqual(expect.objectContaining({
                projectId: PROJECT_ID,
                rabbitMqId: testId,
                testSuite,
                testRun: expect.objectContaining({
                    title: RUN_ID
                }),
                title,
                error,
                stack,
                status: TestStatus.FAILED,
                duration,
                endTime: expect.any(Date),
                media
            }));
        });

        it('should strip ANSI escape codes from error and stack trace', () => {
            const testId = 'test-123';
            const title = 'should fail';
            const error = '\u001b[31mTest failed\u001b[0m';
            const stack = '\u001b[31mError stack trace\u001b[0m';
            const testSuite = {
                rabbitMqId: 'suite-123',
                title: 'Test Suite'
            };

            const result = normalizer.normalizeTestFail({
                testId,
                title,
                error,
                stack,
                testSuite
            });

            expect(result.error).toBe('Test failed');
            expect(result.stack).toBe('Error stack trace');
        });
    });

    describe('normalizeSuiteEnd', () => {
        it('should normalize suite end event with failed status', () => {
            const suiteId = 'suite-123';
            const title = 'Test Suite';
            const hasFailed = true;

            const result = normalizer.normalizeSuiteEnd(suiteId, title, hasFailed);

            expect(result).toEqual(expect.objectContaining({
                projectId: PROJECT_ID,
                endTime: expect.any(Date),
                rabbitMqId: suiteId,
                title,
                status: TestStatus.FAILED,
                testRun: expect.objectContaining({
                    title: RUN_ID
                })
            }));
        });

        it('should normalize suite end event with passed status', () => {
            const suiteId = 'suite-123';
            const title = 'Test Suite';
            const hasFailed = false;

            const result = normalizer.normalizeSuiteEnd(suiteId, title, hasFailed);

            expect(result.status).toBe(TestStatus.PASSED);
        });
    });

    describe('normalizeRunEnd', () => {
        it('should normalize run end event with failed status', () => {
            // First create a run
            const runStart = normalizer.normalizeRunStart();
            const result = normalizer.normalizeRunEnd(true);

            expect(result).toEqual(expect.objectContaining({
                rabbitMqId: runStart.rabbitMqId,
                title: RUN_ID,
                status: TestStatus.FAILED,
                projectId: PROJECT_ID,
                testRun: expect.objectContaining({
                    rabbitMqId: runStart.rabbitMqId,
                    title: RUN_ID
                }),
                endTime: expect.any(Date)
            }));
        });

        it('should normalize run end event with passed status', () => {
            const result = normalizer.normalizeRunEnd(false);
            expect(result.status).toBe(TestStatus.PASSED);
        });
    });

    describe('normalizeTestPending', () => {
        it('should normalize test pending event', () => {
            const testId = 'test-123';
            const title = 'pending test';
            const testSuite = {
                rabbitMqId: 'suite-123',
                title: 'Test Suite'
            };

            const result = normalizer.normalizeTestPending({
                testId,
                title,
                testSuite
            });

            expect(result).toEqual(expect.objectContaining({
                projectId: PROJECT_ID,
                rabbitMqId: testId,
                testSuite,
                title,
                status: TestStatus.PENDING,
                endTime: expect.any(Date)
            }));
        });
    });

    describe('normalizeTestSkip', () => {
        it('should normalize test skip event', () => {
            const testId = 'test-123';
            const title = 'skipped test';
            const testSuite = {
                rabbitMqId: 'suite-123',
                title: 'Test Suite'
            };

            const result = normalizer.normalizeTestSkip({
                testId,
                title,
                testSuite
            });

            expect(result).toEqual(expect.objectContaining({
                projectId: PROJECT_ID,
                rabbitMqId: testId,
                testSuite,
                title,
                status: TestStatus.SKIPPED,
                endTime: expect.any(Date)
            }));
        });
    });
}); 