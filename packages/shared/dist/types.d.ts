export declare enum TestStatus {
    FAILED = "failed",
    PASSED = "passed",
    PENDING = "pending",
    SKIPPED = "skipped",
    RUNNING = "running"
}
export type TestRunDetails = {
    rabbitMqId?: string;
    title?: string;
};
export type TestSuiteDetails = {
    rabbitMqId?: string;
    title?: string;
};
export type SystemDetails = {
    os: string;
    architecture: string;
    browser: string;
    framework: string;
    frameworkVersion: string;
};
export type GitDetails = {
    user: string;
    email: string;
    branch: string;
};
export interface RabbitMQConfig {
    url: string;
    exchange: string;
    queue: string;
    deadLetterExchange: string;
    deadLetterRoutingKey: string;
    routingKey: string;
    messageTtl: number;
    maxLength: number;
}
export declare class MessageData {
    projectId: string;
    rabbitMqId?: string;
    testSuite?: TestSuiteDetails;
    testRun?: TestRunDetails;
    title: string;
    error?: string;
    stack?: string;
    status: TestStatus;
    startTime?: Date;
    endTime?: Date;
    duration?: number;
    fileName?: string;
    testCaseCount?: number;
    testTool?: string;
    testType?: string;
    testBody?: string;
    system?: SystemDetails;
    git?: GitDetails;
    apiKey?: string;
    constructor(event: string, data: Partial<MessageData>);
}
//# sourceMappingURL=types.d.ts.map