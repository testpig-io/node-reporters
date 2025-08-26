// Mock child_process before importing the module
jest.doMock('child_process', () => ({
  execSync: jest.fn()
}));

describe('getGitInfo', () => {
  const originalEnv = process.env;
  let getGitInfo: any;

  beforeEach(async () => {
    // Clear all mocks
    jest.clearAllMocks();
    
    // Import the module after mocking
    const gitInfoModule = await import('../git-info');
    getGitInfo = gitInfoModule.getGitInfo;
    
    // Reset environment variables
    process.env = { ...originalEnv };
    
    // Clear all CI-related environment variables by default
    delete process.env.CI;
    delete process.env.BUILD_ID;
    delete process.env.BUILD_NUMBER;
    delete process.env.GITHUB_ACTIONS;
    delete process.env.GITHUB_REF_NAME;
    delete process.env.GITHUB_REF;
    delete process.env.GITHUB_SHA;
    delete process.env.GITLAB_CI;
    delete process.env.GITLAB_BRANCH;
    delete process.env.GITLAB_COMMIT_SHA;
    delete process.env.CIRCLECI;
    delete process.env.CIRCLE_BRANCH;
    delete process.env.CIRCLE_SHA1;
    delete process.env.BITBUCKET_BRANCH;
    delete process.env.BITBUCKET_COMMIT;
    delete process.env.BRANCH_NAME;
    delete process.env.BUILDKITE_BRANCH;
    delete process.env.BUILDKITE_COMMIT;
    delete process.env.TRAVIS_BRANCH;
    delete process.env.TRAVIS_COMMIT;
    delete process.env.APPVEYOR_REPO_BRANCH;
    delete process.env.APPVEYOR_REPO_COMMIT;
    delete process.env.DRONE_BRANCH;
    delete process.env.DRONE_COMMIT;
    delete process.env.SEMAPHORE_GIT_BRANCH;
    delete process.env.SEMAPHORE_GIT_SHA;
    delete process.env.CI_COMMIT_REF_NAME;
    delete process.env.CI_COMMIT_SHA;
    delete process.env.GIT_COMMIT;
    delete process.env.COMMIT_ID;
    delete process.env.GIT_AUTHOR_NAME;
    delete process.env.COMMIT_AUTHOR;
    delete process.env.GIT_COMMITTER_NAME;
    delete process.env.COMMIT_COMMITTER;
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
