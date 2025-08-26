// Mock child_process and logger before importing the module
jest.doMock('child_process', () => ({
  execSync: jest.fn()
}));

jest.doMock('../logger', () => ({
  createLogger: jest.fn(() => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }))
}));

describe('getGitInfo', () => {
  const originalEnv = process.env;
  let getGitInfo: any;

  beforeEach(async () => {
    // Clear all mocks
    jest.clearAllMocks();
    
    // Set up execSync mock to return predictable values
    const { execSync } = require('child_process');
    execSync.mockImplementation((cmd: string) => {
      if (cmd === 'git rev-parse --abbrev-ref HEAD') return 'mock-branch';
      if (cmd === 'git rev-parse HEAD') return 'mock-commit-hash';
      if (cmd.includes('git log -1 --pretty=format:"%an (%ae)"')) return 'Mock Author (mock@example.com)';
      if (cmd.includes('git log -1 --pretty=format:"%cn (%ce)"')) return 'Mock Committer (mock@example.com)';
      if (cmd.includes('git config user.name')) return 'Mock User';
      if (cmd.includes('git config user.email')) return 'mock@example.com';
      return '';
    });
    
    // Import the module after mocking
    const gitInfoModule = await import('../git-info');
    getGitInfo = gitInfoModule.getGitInfo;
    
    // Reset environment variables
    process.env = { ...originalEnv };
    
    // Clear ALL CI-related environment variables comprehensively
    const ciEnvVars = [
      // Generic CI variables
      'CI', 'BUILD_ID', 'BUILD_NUMBER', 'TESTPIG_DEBUG_LOGS',
      
      // GitHub Actions
      'GITHUB_ACTIONS', 'GITHUB_RUN_ID', 'GITHUB_REF_NAME', 'GITHUB_REF', 'GITHUB_SHA', 
      'GITHUB_ACTOR', 'GITHUB_HEAD_REF', 'GITHUB_ACTOR_EMAIL',
      
      // GitLab CI
      'GITLAB_CI', 'CI_PIPELINE_ID', 'GITLAB_BRANCH', 'GITLAB_COMMIT_SHA', 'CI_COMMIT_REF_NAME',
      'CI_MERGE_REQUEST_SOURCE_BRANCH_NAME', 'CI_COMMIT_SHA', 'GITLAB_USER_NAME', 'CI_COMMIT_AUTHOR',
      'GITLAB_USER_EMAIL', 'CI_COMMIT_AUTHOR_EMAIL', 'CI_COMMIT_COMMITTER', 'CI_COMMIT_COMMITTER_EMAIL',
      
      // CircleCI
      'CIRCLECI', 'CIRCLE_WORKFLOW_ID', 'CIRCLE_BUILD_NUM', 'CIRCLE_BRANCH', 'CIRCLE_SHA1', 'CIRCLE_USERNAME',
      
      // Travis CI
      'TRAVIS', 'TRAVIS_BUILD_ID', 'TRAVIS_BRANCH', 'TRAVIS_PULL_REQUEST_BRANCH', 'TRAVIS_COMMIT',
      'TRAVIS_COMMIT_AUTHOR', 'TRAVIS_COMMIT_AUTHOR_EMAIL',
      
      // Jenkins
      'JENKINS_URL', 'BUILD_NUMBER', 'BRANCH_NAME', 'GIT_BRANCH', 'GIT_COMMIT', 'GIT_AUTHOR_NAME',
      'GIT_AUTHOR_EMAIL', 'GIT_COMMITTER_NAME', 'GIT_COMMITTER_EMAIL',
      
      // Buildkite
      'BUILDKITE', 'BUILDKITE_BUILD_ID', 'BUILDKITE_BRANCH', 'BUILDKITE_COMMIT', 'BUILDKITE_BUILD_CREATOR',
      
      // AppVeyor
      'APPVEYOR', 'APPVEYOR_BUILD_NUMBER', 'APPVEYOR_REPO_BRANCH', 'APPVEYOR_PULL_REQUEST_HEAD_REPO_BRANCH',
      'APPVEYOR_REPO_COMMIT', 'APPVEYOR_REPO_COMMIT_AUTHOR', 'APPVEYOR_REPO_COMMIT_AUTHOR_EMAIL',
      
      // Azure Pipelines
      'AZURE_HTTP_USER_AGENT', 'BUILD_BUILDNUMBER', 'TF_BUILD', 'BUILD_SOURCEBRANCH', 'SYSTEM_PULLREQUEST_SOURCEBRANCH',
      'BUILD_SOURCEVERSION', 'BUILD_REQUESTEDFOR', 'BUILD_REQUESTEDFOREMAIL',
      
      // Bitbucket
      'BITBUCKET_BUILD_NUMBER', 'BITBUCKET_COMMIT', 'BITBUCKET_BRANCH', 'BITBUCKET_COMMIT_AUTHOR',
      
      // Drone CI
      'DRONE', 'DRONE_BUILD_NUMBER', 'DRONE_BRANCH', 'DRONE_SOURCE_BRANCH', 'DRONE_COMMIT', 
      'DRONE_COMMIT_SHA', 'DRONE_COMMIT_AUTHOR', 'DRONE_COMMIT_AUTHOR_EMAIL',
      
      // Semaphore CI
      'SEMAPHORE', 'SEMAPHORE_EXECUTABLE_UUID', 'SEMAPHORE_GIT_BRANCH', 'SEMAPHORE_GIT_PR_BRANCH',
      'SEMAPHORE_GIT_SHA', 'SEMAPHORE_GIT_AUTHOR', 'SEMAPHORE_GIT_AUTHOR_EMAIL',
      
      // TeamCity
      'TEAMCITY_VERSION', 'BUILD_VCS_BRANCH', 'BUILD_VCS_NUMBER', 'BUILD_VCS_AUTHOR',
      
      // Bamboo
      'bamboo_buildNumber', 'bamboo_planKey', 'bamboo_planRepository_branch', 'bamboo_planRepository_revision',
      'bamboo_planRepository_username',
      
      // Codeship
      'CI_NAME', 'CODESHIP', 'CI_BRANCH', 'CI_COMMIT_ID', 'CI_COMMITTER_NAME',
      
      // AWS CodeBuild
      'CODEBUILD_BUILD_ARN', 'CODEBUILD_INITIATOR', 'CODEBUILD_WEBHOOK_HEAD_REF', 'CODEBUILD_RESOLVED_SOURCE_VERSION',
      
      // Generic Git variables
      'COMMIT_ID', 'COMMIT_AUTHOR', 'COMMIT_COMMITTER', 'COMMIT_COMMITTER_EMAIL'
    ];
    
    // Clear all CI environment variables
    ciEnvVars.forEach(varName => {
      delete process.env[varName];
    });
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('CI Environment Detection', () => {
    it('should detect GitHub Actions CI', () => {
      process.env.GITHUB_ACTIONS = 'true';
      
      const result = getGitInfo();
      expect(result.isCI).toBe(true);
      expect(result.ciProvider).toBe('github');
    });

    it('should detect GitLab CI', () => {
      process.env.GITLAB_CI = 'true';
      
      const result = getGitInfo();
      expect(result.isCI).toBe(true);
      expect(result.ciProvider).toBe('gitlab');
    });

    it('should detect CircleCI', () => {
      process.env.CIRCLECI = 'true';
      
      const result = getGitInfo();
      expect(result.isCI).toBe(true);
      expect(result.ciProvider).toBe('circle');
    });

    it('should detect Jenkins', () => {
      process.env.BUILD_NUMBER = '67';
      
      const result = getGitInfo();
      expect(result.isCI).toBe(true);
      expect(result.ciProvider).toBe('jenkins');
    });

    it('should return unknown provider when no CI detected', () => {
      const result = getGitInfo();
      expect(result.isCI).toBe(false);
      expect(result.ciProvider).toBeUndefined();
    });
  });

  describe('CI Environment - Branch Detection', () => {
    it('should use GITHUB_REF_NAME for GitHub Actions', () => {
      process.env.GITHUB_ACTIONS = 'true';
      process.env.GITHUB_REF_NAME = 'main';
      
      const result = getGitInfo();
      expect(result.branch).toBe('main');
      expect(result.ciProvider).toBe('github');
    });

    it('should handle GitHub refs and convert to branch names', () => {
      process.env.GITHUB_ACTIONS = 'true';
      process.env.GITHUB_REF = 'refs/heads/feature-branch';
      
      const result = getGitInfo();
      expect(result.branch).toBe('feature-branch');
      expect(result.ciProvider).toBe('github');
    });

    it('should handle GitHub pull request refs', () => {
      process.env.GITHUB_ACTIONS = 'true';
      process.env.GITHUB_REF = 'refs/pull/123/head';
      
      const result = getGitInfo();
      expect(result.branch).toBe('PR-123');
      expect(result.ciProvider).toBe('github');
    });

    it('should use CI_COMMIT_REF_NAME for GitLab CI', () => {
      process.env.GITLAB_CI = 'true';
      process.env.CI_COMMIT_REF_NAME = 'develop';
      
      const result = getGitInfo();
      expect(result.branch).toBe('develop');
      expect(result.ciProvider).toBe('gitlab');
    });

    it('should use CIRCLE_BRANCH for CircleCI', () => {
      process.env.CIRCLECI = 'true';
      process.env.CIRCLE_BRANCH = 'hotfix';
      
      const result = getGitInfo();
      expect(result.branch).toBe('hotfix');
      expect(result.ciProvider).toBe('circle');
    });

    it('should use BITBUCKET_BRANCH for Bitbucket Pipelines', () => {
      process.env.BITBUCKET_BUILD_NUMBER = '123';
      process.env.BITBUCKET_BRANCH = 'release';
      
      const result = getGitInfo();
      expect(result.branch).toBe('release');
      expect(result.ciProvider).toBe('bitbucket');
    });

    it('should use BRANCH_NAME for Jenkins', () => {
      process.env.BUILD_NUMBER = '67';
      process.env.BRANCH_NAME = 'jenkins-branch';
      
      const result = getGitInfo();
      expect(result.branch).toBe('jenkins-branch');
      expect(result.ciProvider).toBe('jenkins');
    });
  });

  describe('CI Environment - Commit Detection', () => {
    it('should use GITHUB_SHA for GitHub Actions', () => {
      process.env.GITHUB_ACTIONS = 'true';
      process.env.GITHUB_SHA = 'github-commit-123';
      
      const result = getGitInfo();
      expect(result.commit).toBe('github-commit-123');
      expect(result.ciProvider).toBe('github');
    });

    it('should use CI_COMMIT_SHA for GitLab CI', () => {
      process.env.GITLAB_CI = 'true';
      process.env.CI_COMMIT_SHA = 'gitlab-commit-456';
      
      const result = getGitInfo();
      expect(result.commit).toBe('gitlab-commit-456');
      expect(result.ciProvider).toBe('gitlab');
    });

    it('should use CIRCLE_SHA1 for CircleCI', () => {
      process.env.CIRCLECI = 'true';
      process.env.CIRCLE_SHA1 = 'circle-commit-789';
      
      const result = getGitInfo();
      expect(result.commit).toBe('circle-commit-789');
      expect(result.ciProvider).toBe('circle');
    });
  });

  describe('CI Environment - Author Detection', () => {
    it('should use GITHUB_ACTOR for GitHub Actions', () => {
      process.env.GITHUB_ACTIONS = 'true';
      process.env.GITHUB_ACTOR = 'github-user';
      
      const result = getGitInfo();
      expect(result.author).toBe('github-user');
      expect(result.ciProvider).toBe('github');
    });

    it.skip('should combine author name and email when both are available', () => {
      process.env.GITLAB_USER_NAME = 'gitlab-user';
      process.env.GITLAB_USER_EMAIL = 'gitlab@example.com';
      
      const result = getGitInfo();
      expect(result.author).toBe('gitlab-user (gitlab@example.com)');
    });

    it.skip('should handle different email variable naming patterns', () => {
      process.env.TRAVIS_COMMIT_AUTHOR = 'travis-user';
      process.env.TRAVIS_COMMIT_AUTHOR_EMAIL = 'travis@example.com';
      
      const result = getGitInfo();
      expect(result.author).toBe('travis-user (travis@example.com)');
    });
  });

  describe('CI Environment - Committer Detection', () => {
    it('should use GIT_COMMITTER_NAME when available in Jenkins', () => {
      process.env.BUILD_NUMBER = '123';
      process.env.GIT_COMMITTER_NAME = 'committer-user';
      process.env.GIT_COMMITTER_EMAIL = 'committer@example.com';
      
      const result = getGitInfo();
      expect(result.committer).toBe('committer-user (committer@example.com)');
      expect(result.ciProvider).toBe('jenkins');
    });

    it('should use CI_COMMIT_COMMITTER for GitLab CI', () => {
      process.env.GITLAB_CI = 'true';
      process.env.CI_COMMIT_COMMITTER = 'gitlab-committer';
      process.env.CI_COMMIT_COMMITTER_EMAIL = 'committer@gitlab.com';
      
      const result = getGitInfo();
      expect(result.committer).toBe('gitlab-committer (committer@gitlab.com)');
      expect(result.ciProvider).toBe('gitlab');
    });

    it('should fallback to generic committer when provider-specific not available', () => {
      process.env.GITHUB_ACTIONS = 'true';
      process.env.GIT_COMMITTER_NAME = 'generic-committer';
      process.env.GIT_COMMITTER_EMAIL = 'generic@example.com';
      
      const result = getGitInfo();
      expect(result.committer).toBe('generic-committer (generic@example.com)');
      expect(result.ciProvider).toBe('github');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty environment variables gracefully', () => {
      process.env.GITHUB_ACTIONS = 'true';
      process.env.GITHUB_REF_NAME = '';
      process.env.GITHUB_SHA = '';
      
      const result = getGitInfo();
      // Should fallback to git commands or unknown
      expect(result.branch).toBeDefined();
      expect(result.commit).toBeDefined();
      expect(result.ciProvider).toBe('github');
    });

    it('should handle undefined environment variables gracefully', () => {
      process.env.GITHUB_ACTIONS = 'true';
      process.env.GITHUB_REF_NAME = undefined;
      
      const result = getGitInfo();
      // Should fallback to git commands or unknown
      expect(result.branch).toBeDefined();
      expect(result.ciProvider).toBe('github');
    });

    it('should return local development when no CI provider detected', () => {
      const result = getGitInfo();
      expect(result.isCI).toBe(false);
      expect(result.ciProvider).toBeUndefined();
      // Should use git commands for local development
      expect(result.branch).toBeDefined();
      expect(result.commit).toBeDefined();
    });
  });
});
