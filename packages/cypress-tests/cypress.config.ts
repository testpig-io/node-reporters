import { defineConfig } from 'cypress';

export default defineConfig({
  reporter: '../cypress-reporter/dist/index.js',
  reporterOptions: {
    projectId: "06570",
    runId: "Testing new Cypress reporter!"
  },
  e2e: {
    setupNodeEvents(on, config) {
      // implement node event listeners here
    },
    baseUrl: 'http://localhost:3000',
    supportFile: false
  },
});