/// <reference types="jest" />

import { TestEventHandler } from '../test-event-handler';
import { MessageData, TestStatus } from '@testpig/shared';

const mockPublishMessage = jest.fn().mockResolvedValue(true);
const mockFlushQueue = jest.fn().mockResolvedValue(true);

jest.mock('@testpig/shared', () => {
    const actual = jest.requireActual('@testpig/shared');
    return {
        ...actual,
        APIClient: jest.fn().mockImplementation(() => ({
            publishMessage: mockPublishMessage,
            flushQueue: mockFlushQueue
        })),
        createLogger: () => ({
            debug: jest.fn(),
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn()
        })
    };
});

describe('TestEventHandler', () => {
    const PROJECT_ID = 'test-project';
    const RUN_ID = 'test-run';
    const API_KEY = 'test-api-key';
    
    let handler: TestEventHandler;
    
    beforeEach(() => {
        process.env.TESTPIG_API_KEY = API_KEY;
        process.env.TESTPIG_PROJECT_ID = PROJECT_ID;
        process.env.TESTPIG_RUN_ID = RUN_ID;

        jest.clearAllMocks();
        
        handler = new TestEventHandler(PROJECT_ID, RUN_ID);
    });

    afterEach(() => {
        delete process.env.TESTPIG_API_KEY;
        delete process.env.TESTPIG_PROJECT_ID;
        delete process.env.TESTPIG_RUN_ID;
    });

    describe('constructor', () => {
        it('should throw error if API key is not set', () => {
            delete process.env.TESTPIG_API_KEY;
            expect(() => new TestEventHandler(PROJECT_ID)).toThrow('TESTPIG_API_KEY environment variable not set.');
        });

        it('should throw error if project ID is not set', () => {
            delete process.env.TESTPIG_PROJECT_ID;
            expect(() => new TestEventHandler('')).toThrow('TESTPIG_PROJECT_ID environment variable not set.');
        });

        it('should use environment variables over constructor parameters', () => {
            const envProjectId = 'env-project';
            const envRunId = 'env-run';
            process.env.TESTPIG_PROJECT_ID = envProjectId;
            process.env.TESTPIG_RUN_ID = envRunId;

            const handler = new TestEventHandler('different-project', 'different-run');
            const runStart = handler.eventNormalizer.normalizeRunStart();

            expect(runStart.projectId).toBe(envProjectId);
            expect(runStart.title).toBe(envRunId);
        });
    });

    describe('event queue management', () => {
        const sampleEvent = {
            event: 'test',
            data: {
                projectId: PROJECT_ID,
                title: 'Test Event',
                status: TestStatus.RUNNING
            } as MessageData
        };

        it('should queue and retrieve events', () => {
            handler.queueEvent(sampleEvent.event, sampleEvent.data);
            const queue = handler.getEventQueue();
            
            expect(queue).toHaveLength(1);
            expect(queue[0]).toEqual(sampleEvent);
        });

        it('should set event queue', () => {
            const events = [sampleEvent, { ...sampleEvent, event: 'test2' }];
            handler.setEventQueue(events);
            
            expect(handler.getEventQueue()).toEqual(events);
        });
    });

    describe('processEventQueue', () => {
        const createSampleEvent = (id: string): { event: string; data: MessageData } => ({
            event: 'test',
            data: {
                projectId: PROJECT_ID,
                rabbitMqId: id,
                title: `Test Event ${id}`,
                status: TestStatus.RUNNING
            } as MessageData
        });

        it('should process all events in queue', async () => {
            const events = [
                createSampleEvent('1'),
                createSampleEvent('2'),
                createSampleEvent('3')
            ];
            
            handler.setEventQueue(events);
            await handler.processEventQueue();

            expect(mockPublishMessage).toHaveBeenCalledTimes(3);
            expect(mockFlushQueue).toHaveBeenCalledTimes(1);
            expect(handler.getEventQueue()).toHaveLength(0);
        });

        it('should handle empty queue', async () => {
            await handler.processEventQueue();
            
            expect(mockPublishMessage).not.toHaveBeenCalled();
            expect(mockFlushQueue).not.toHaveBeenCalled();
        });

        it('should retry flush on failure', async () => {
            // Mock first two flushes to fail, third to succeed
            mockFlushQueue
                .mockResolvedValueOnce(false)
                .mockResolvedValueOnce(false)
                .mockResolvedValueOnce(true);

            handler.queueEvent('test', createSampleEvent('1').data);
            await handler.processEventQueue();

            expect(mockFlushQueue).toHaveBeenCalledTimes(3);
        });

        it('should handle max retries exceeded', async () => {
            // Mock all flushes to fail
            mockFlushQueue.mockResolvedValue(false);

            handler.queueEvent('test', createSampleEvent('1').data);
            await handler.processEventQueue();

            expect(mockFlushQueue).toHaveBeenCalledTimes(3); // Max retries
        });

        it('should handle publish failure', async () => {
            mockPublishMessage.mockRejectedValueOnce(new Error('Network error'));

            handler.queueEvent('test', createSampleEvent('1').data);
            await handler.processEventQueue();

            expect(mockPublishMessage).toHaveBeenCalledTimes(1);
            // When publishMessage fails, we don't call flushQueue
            expect(mockFlushQueue).not.toHaveBeenCalled();
        });
    });

    describe('eventNormalizer', () => {
        it('should provide access to the event normalizer', () => {
            const normalizer = handler.eventNormalizer;
            const runStart = normalizer.normalizeRunStart();

            expect(runStart.projectId).toBe(PROJECT_ID);
            expect(runStart.title).toBe(RUN_ID);
        });
    });

    describe('integration with APIClient', () => {
        it('should properly format and send events', async () => {
            const testEvent = {
                event: 'test_start',
                data: handler.eventNormalizer.normalizeTestStart(
                    'test-123',
                    'Test Case',
                    'test.spec.ts',
                    'test body',
                    {
                        rabbitMqId: 'suite-123',
                        title: 'Test Suite'
                    }
                )
            };

            handler.queueEvent(testEvent.event, testEvent.data);
            await handler.processEventQueue();

            expect(mockPublishMessage).toHaveBeenCalledWith(
                testEvent.event,
                expect.objectContaining({
                    projectId: PROJECT_ID,
                    title: 'Test Case',
                    status: TestStatus.RUNNING
                })
            );
        });

        it('should handle multiple events with media data', async () => {
            const mediaData = {
                rabbitMqId: 'test-123',
                data: Buffer.from([1, 2, 3, 4]),
                fileName: 'screenshot.png',
                mimeType: 'image/png',
                type: 'image' as const,
                timestamp: new Date().toISOString()
            };

            const testFailEvent = {
                event: 'test_fail',
                data: handler.eventNormalizer.normalizeTestFail({
                    testId: 'test-123',
                    title: 'Failed Test',
                    error: 'Test failed',
                    stack: 'Error stack',
                    testSuite: {
                        rabbitMqId: 'suite-123',
                        title: 'Test Suite'
                    },
                    media: mediaData
                })
            };

            handler.queueEvent(testFailEvent.event, testFailEvent.data);
            await handler.processEventQueue();

            expect(mockPublishMessage).toHaveBeenCalledWith(
                testFailEvent.event,
                expect.objectContaining({
                    status: TestStatus.FAILED,
                    media: expect.objectContaining({
                        fileName: 'screenshot.png'
                    })
                })
            );
        });
    });
}); 