// src/info/ciInfo.ts
import ci from 'ci-info';

export function getCIInfo() {
  const base = {
    isCI: ci.isCI,
    name: ci.name || null
  };

  if (!ci.isCI) return base;

  // Augment with specific provider metadata
  const env = process.env;
  if (ci.name === 'GitHub Actions') {
    return {
      ...base,
      prNumber: env.GITHUB_REF?.split('/')[2] || null,
      repo: env.GITHUB_REPOSITORY || null,
      runId: env.GITHUB_RUN_ID || null
    };
  }

  if (ci.name === 'GitLab CI') {
    return {
      ...base,
      prNumber: env.CI_MERGE_REQUEST_IID || null,
      repo: env.CI_PROJECT_PATH || null,
      pipelineId: env.CI_PIPELINE_ID || null
    };
  }

  if (ci.name === 'Bitbucket Pipelines') {
    return {
      ...base,
      prNumber: env.BITBUCKET_PR_ID || null,
      repo: env.BITBUCKET_REPO_FULL_NAME || null,
      pipelineUuid: env.BITBUCKET_PIPELINE_UUID || null
    };
  }

  return base;
}
