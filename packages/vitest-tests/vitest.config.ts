import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    reporters: [
      'default',
      ['@testpig/vitest-reporter', {
        projectId: process.env.TESTPIG_PROJECT_ID || 'test-project'
      }]
    ]
  }
});