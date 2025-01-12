interface CypressReporterOptions {
    projectId?: string;
    runId?: string;
}
declare class CypressReporter {
    private eventHandler;
    private failureCount;
    constructor(runner: any, options?: {
        reporterOptions?: CypressReporterOptions;
    });
    private setupEventHandlers;
}
export = CypressReporter;
//# sourceMappingURL=index.d.ts.map