/// <reference types="jest" />

import { APIClient } from '../api-client';
import { MessageData, TestStatus } from '../types';

// Import our mock types
interface MockFormDataEntry {
    value: any;
    filename?: string;
}

describe('APIClient', () => {
    let client: APIClient;
    const API_KEY = 'test-api-key';
    const BASE_URL = 'http://test.api';

    beforeEach(() => {
        client = new APIClient(API_KEY, BASE_URL);
        jest.clearAllMocks();
    });

    afterEach(() => {
        jest.resetAllMocks();
    });

    describe('publishMessage', () => {
        it('should add message to queue', async () => {
            const message: MessageData = {
                rabbitMqId: '123',
                title: 'Test',
                projectId: 'test-project',
                status: TestStatus.RUNNING
            };

            await client.publishMessage('test', message);
            await client.flushQueue(); // Force flush to check queue processing

            expect(fetch).toHaveBeenCalledTimes(1);
            expect(fetch).toHaveBeenCalledWith(
                `${BASE_URL}/reporter-events/batch`,
                expect.objectContaining({
                    method: 'POST',
                    headers: expect.objectContaining({
                        'Authorization': `Bearer ${API_KEY}`,
                    }),
                })
            );
        });
    });

    describe('media handling', () => {
        it('should handle Cypress serialized Buffer format', async () => {
            // Create a serialized buffer (how Cypress sends it)
            const serializedBuffer = {
                type: 'Buffer',
                data: [1, 2, 3, 4] // Sample image data
            };

            const message: MessageData = {
                rabbitMqId: '123',
                title: 'Test with Cypress Screenshot',
                projectId: 'test-project',
                status: TestStatus.RUNNING,
                media: {
                    rabbitMqId: '123',
                    data: serializedBuffer as any,
                    fileName: 'test@#$%^&*.png',
                    mimeType: 'image/png',
                    type: 'image',
                    timestamp: new Date().toISOString()
                }
            };

            await client.publishMessage('test', message);
            await client.flushQueue();

            // Get the FormData from the fetch call
            const fetchCall = (fetch as jest.Mock).mock.calls[0];
            const formData = fetchCall[1].body;
            
            // Convert entries to array for easier testing
            const entries = Array.from(formData.entries()) as [string, MockFormDataEntry][];
            
            // Check media entry
            const mediaEntry = entries.find(([key]) => key === 'media');
            expect(mediaEntry).toBeDefined();
            expect(mediaEntry![1].filename).toBe('test.png'); // Should be sanitized
            
            // Check message entry
            const messagesEntry = entries.find(([key]) => key === 'messages');
            const messages = JSON.parse(messagesEntry![1].value);
            expect(messages[0].data.media.fileName).toBe('test.png');
            expect(messages[0].data.media.data).toBeUndefined(); // Binary data should be removed
        });

        it('should handle Playwright raw Buffer format', async () => {
            // Create a raw buffer (how Playwright sends it)
            const rawBuffer = Buffer.from([1, 2, 3, 4]); // Sample image data

            const message: MessageData = {
                rabbitMqId: '123',
                title: 'Test with Playwright Screenshot',
                projectId: 'test-project',
                status: TestStatus.RUNNING,
                media: {
                    rabbitMqId: '123',
                    data: rawBuffer,
                    fileName: 'test screenshot.png',
                    mimeType: 'image/png',
                    type: 'image',
                    timestamp: new Date().toISOString()
                }
            };

            await client.publishMessage('test', message);
            await client.flushQueue();

            const fetchCall = (fetch as jest.Mock).mock.calls[0];
            const formData = fetchCall[1].body;
            const entries = Array.from(formData.entries()) as [string, MockFormDataEntry][];
            
            // Check media entry
            const mediaEntry = entries.find(([key]) => key === 'media');
            expect(mediaEntry).toBeDefined();
            expect(mediaEntry![1].filename).toBe('test-screenshot.png'); // Should be sanitized
            expect(mediaEntry![1].value).toBeInstanceOf(Blob);
            
            // Check message entry
            const messagesEntry = entries.find(([key]) => key === 'messages');
            const messages = JSON.parse(messagesEntry![1].value);
            expect(messages[0].data.media.fileName).toBe('test-screenshot.png');
            expect(messages[0].data.media.data).toBeUndefined(); // Binary data should be removed
        });
    });

    describe('filename sanitization', () => {
        it('should properly sanitize filenames with spaces and special characters', async () => {
            const testCases = [
                ['test screenshot.png', 'test-screenshot.png'],
                ['test@#$%^&*.png', 'test-.png'],
                ['  leading spaces.png', 'leading-spaces.png'],
                ['trailing spaces  .png', 'trailing-spaces-.png'],
                ['multiple   spaces.png', 'multiple-spaces.png'],
                ['special!@#$chars.png', 'special-chars.png'],
                ['dots.in.name.png', 'dots.in.name.png']
            ];

            for (const [input, expected] of testCases) {
                const message: MessageData = {
                    rabbitMqId: '123',
                    title: 'Test',
                    projectId: 'test-project',
                    status: TestStatus.RUNNING,
                    media: {
                        rabbitMqId: '123',
                        data: Buffer.from([1, 2, 3, 4]),
                        fileName: input,
                        mimeType: 'image/png',
                        type: 'image',
                        timestamp: new Date().toISOString()
                    }
                };

                await client.publishMessage('test', message);
                await client.flushQueue();

                const fetchCall = (fetch as jest.Mock).mock.calls.at(-1);
                const formData = fetchCall[1].body;
                const entries = Array.from(formData.entries()) as [string, MockFormDataEntry][];
                
                const mediaEntry = entries.find(([key]) => key === 'media');
                expect(mediaEntry).toBeDefined();
                expect(mediaEntry![1].filename).toBe(expected);
                
                const messagesEntry = entries.find(([key]) => key === 'messages');
                const messages = JSON.parse(messagesEntry![1].value);
                expect(messages[0].data.media.fileName).toBe(expected);
            }
        });
    });

    describe('error handling', () => {
        it('should handle network errors gracefully', async () => {
            (fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

            const message: MessageData = {
                rabbitMqId: '123',
                title: 'Test',
                projectId: 'test-project',
                status: TestStatus.RUNNING
            };

            await client.publishMessage('test', message);
            const result = await client.flushQueue();

            expect(result).toBe(false); // Should return false on error
            expect(fetch).toHaveBeenCalledTimes(1);
        });

        it('should handle API errors gracefully', async () => {
            (fetch as jest.Mock).mockResolvedValueOnce({
                ok: false,
                status: 500,
                statusText: 'Internal Server Error',
                text: () => Promise.resolve('Server error')
            });

            const message: MessageData = {
                rabbitMqId: '123',
                title: 'Test',
                projectId: 'test-project',
                status: TestStatus.RUNNING
            };

            await client.publishMessage('test', message);
            const result = await client.flushQueue();

            expect(result).toBe(false); // Should return false on error
            expect(fetch).toHaveBeenCalledTimes(1);
        });
    });
}); 