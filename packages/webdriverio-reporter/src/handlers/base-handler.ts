export interface TestHandlerConfig {
    projectId: string;
    runId?: string;
    metadata?: { [key: string]: any };
}

export interface SuiteInfo {
    id: string;
    title: string;
    file: string;
    testCount: number;
}

export interface BaseHandler {
    handleSuiteStart(suite: any): void;
    handleTestStart(test: any): void;
    handleTestPass(test: any): void;
    handleTestFail(test: any): void;
    handleSuiteEnd(suite: any): void;
    handleRunStart(): void;
    handleRunEnd(): void;
}