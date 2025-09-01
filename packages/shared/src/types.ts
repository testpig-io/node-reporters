import { MediaData } from "./media-collector";

export enum TestStatus {
    FAILED = 'failed',
    PASSED = 'passed',
    PENDING = 'pending',
    SKIPPED = 'skipped',
    RUNNING = 'running',
}

export enum TestEventsEnum {
    RUN_START = 'start',
    RUN_END = 'end',
    SUITE_START = 'suite',
    SUITE_END = 'suite end',
    TEST_START = 'test',
    TEST_END = 'test end',
    TEST_PASS = 'pass',
    TEST_FAIL = 'fail',
}

export type TestRunDetails = {
    rabbitMqId?: string;
    title?: string;
}

export type TestSuiteDetails = {
    rabbitMqId?: string;
    title?: string;
}

export type BrowserDetails = {
    name?: string;
    version?: string;
    viewPort?: string;
    platform?: string;
}

export type SystemDetails = {
    os: string;
    architecture: string;
    browser: string;
    framework: string;
    frameworkVersion: string;
    nodeVersion: string;
    npmVersion: string;
}

export type GitDetails = {
    branch: string;
    commit: string;
    author: string;
}

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

export class MessageData {
    projectId!: string;
    rabbitMqId?: string;
    testSuite?: TestSuiteDetails;
    testRun?: TestRunDetails;
    title!: string;
    error?: string;
    stack?: string;
    status!: TestStatus;
    startTime?: Date;
    endTime?: Date;
    duration?: number;
    fileName?: string;
    testCaseCount?: number;
    testTool?: string;
    testBody?: string;
    system?: SystemDetails;
    git?: GitDetails;
    apiKey?: string;
    retries?: string;
    media?: MediaData;
    browser?: BrowserDetails;
    metadata?: { [key: string]: any };

    constructor(event: string, data: Partial<MessageData>) {
        Object.assign(this, data);
    }
}