declare namespace Cypress {
  interface ReporterOptions {
    reporterOptions?: {
      projectId?: string;
      runId?: string;
    };
  }
}