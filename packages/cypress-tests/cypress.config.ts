import { defineConfig } from 'cypress';

export default defineConfig({
  reporter: '../cypress-reporter/dist/index.js',
  reporterOptions: {
    projectId: process.env.TESTPIG_PROJECT_ID || "d2b95",
    runId: process.env.TESTPIG_RUN_ID || "New Node Reporter 3"
  },
  e2e: {
    setupNodeEvents(on, config) {
      // implement node event listeners here
    },
    baseUrl: 'http://localhost:3000',
    supportFile: false
  },
});