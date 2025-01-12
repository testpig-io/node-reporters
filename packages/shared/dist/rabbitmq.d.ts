import { MessageData, RabbitMQConfig } from './types';
export declare class RabbitMQPublisher {
    private channel;
    private readonly config;
    constructor(config?: Partial<RabbitMQConfig>);
    connect(): Promise<void>;
    publishMessage(event: string, data: MessageData): boolean;
}
//# sourceMappingURL=rabbitmq.d.ts.map