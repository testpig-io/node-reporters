"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRabbitMQConfig = getRabbitMQConfig;
function getRabbitMQConfig() {
    return {
        url: process.env.TESTPIG_RABBITMQ_URL || 'amqp://localhost',
        exchange: process.env.TESTPIG_RABBITMQ_EXCHANGE || 'test_events_exchange',
        queue: process.env.TESTPIG_RABBITMQ_QUEUE || 'test_events',
        deadLetterExchange: process.env.TESTPIG_RABBITMQ_DLX || 'test_events_dlx',
        deadLetterRoutingKey: process.env.TESTPIG_RABBITMQ_DLX_KEY || 'dead.letter',
        routingKey: process.env.TESTPIG_RABBITMQ_ROUTING_KEY || 'test.events.default',
        messageTtl: parseInt(process.env.TESTPIG_RABBITMQ_MSG_TTL || '3600000', 10), // 1 hour default
        maxLength: parseInt(process.env.TESTPIG_RABBITMQ_MAX_LENGTH || '10000', 10)
    };
}
//# sourceMappingURL=config.js.map