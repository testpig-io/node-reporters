import { defineConfig } from 'cypress';
const { testPigReporter } = require('../cypress-reporter/dist/index.js');

export default defineConfig({
  reporter: '../cypress-reporter/dist/index.js',
  e2e: {
    setupNodeEvents(on, config) {
      return testPigReporter(on, config);
    },
    supportFile: false
  },
});