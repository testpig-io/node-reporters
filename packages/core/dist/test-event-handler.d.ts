import { MessageData } from '@testpig/shared';
import { TestEventNormalizer } from './test-event-normalizer';
export declare class TestEventHandler {
    private publisher;
    private eventQueue;
    private normalizer;
    constructor(projectId: string, runId?: string);
    queueEvent(event: string, data: MessageData): void;
    processEventQueue(): void;
    get eventNormalizer(): TestEventNormalizer;
}
//# sourceMappingURL=test-event-handler.d.ts.map