import { MessageData, TestSuiteDetails } from '@testpig/shared';
export interface SystemInfo {
    os: string;
    architecture: string;
    browser: string;
    framework: string;
    frameworkVersion: string;
}
export declare class TestEventNormalizer {
    private testRunMap;
    private projectId;
    private testRunTitle;
    constructor(projectId: string, runId?: string);
    normalizeRunStart(): MessageData;
    normalizeSuiteStart(suiteId: string, title: string, fileName: string, testCount: number, systemInfo: SystemInfo, testType: 'e2e' | 'unit'): MessageData;
    normalizeTestStart(testId: string, title: string, fileName: string, testBody: string, testSuite: TestSuiteDetails): MessageData;
    normalizeTestPass(testId: string, title: string, duration: number, testSuite: TestSuiteDetails): MessageData;
    normalizeTestFail(testId: string, title: string, error: string, stack: string, duration: number, testSuite: TestSuiteDetails): MessageData;
    normalizeSuiteEnd(suiteId: string, title: string, hasFailed: boolean): MessageData;
    normalizeRunEnd(hasFailed: boolean): MessageData;
}
//# sourceMappingURL=test-event-normalizer.d.ts.map