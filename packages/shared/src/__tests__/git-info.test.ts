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
    it('should detect CI from CI environment variable', () => {
      process.env.CI = 'true';
      
      const result = getGitInfo();
      expect(result.isCI).toBe(true);
    });

    it('should detect CI from BUILD_ID environment variable', () => {
      process.env.BUILD_ID = '12345';
      
      const result = getGitInfo();
      expect(result.isCI).toBe(true);
    });

    it('should detect CI from BUILD_NUMBER environment variable', () => {
      process.env.BUILD_NUMBER = '67';
      
      const result = getGitInfo();
      expect(result.isCI).toBe(true);
    });
  });

  describe('CI Environment - Branch Detection', () => {
    beforeEach(() => {
      process.env.CI = 'true';
    });

    it('should use GITHUB_REF_NAME for GitHub Actions', () => {
      process.env.GITHUB_REF_NAME = 'main';
      
      const result = getGitInfo();
      expect(result.branch).toBe('main');
    });

    it('should handle GitHub refs and convert to branch names', () => {
      process.env.GITHUB_REF = 'refs/heads/feature-branch';
      
      const result = getGitInfo();
      expect(result.branch).toBe('feature-branch');
    });

    it('should handle GitHub pull request refs', () => {
      process.env.GITHUB_REF = 'refs/pull/123/head';
      
      const result = getGitInfo();
      expect(result.branch).toBe('PR-123');
    });

    it('should use GITLAB_BRANCH for GitLab CI', () => {
      process.env.GITLAB_BRANCH = 'develop';
      
      const result = getGitInfo();
      expect(result.branch).toBe('develop');
    });

    it('should use CIRCLE_BRANCH for CircleCI', () => {
      process.env.CIRCLE_BRANCH = 'hotfix';
      
      const result = getGitInfo();
      expect(result.branch).toBe('hotfix');
    });

    it('should use BITBUCKET_BRANCH for Bitbucket Pipelines', () => {
      process.env.BITBUCKET_BRANCH = 'release';
      
      const result = getGitInfo();
      expect(result.branch).toBe('release');
    });

    it('should use BRANCH_NAME for Jenkins/TeamCity', () => {
      process.env.BRANCH_NAME = 'jenkins-branch';
      
      const result = getGitInfo();
      expect(result.branch).toBe('jenkins-branch');
    });
  });

  describe('CI Environment - Commit Detection', () => {
    beforeEach(() => {
      process.env.CI = 'true';
    });

    it('should use GITHUB_SHA for GitHub Actions', () => {
      process.env.GITHUB_SHA = 'github-commit-123';
      
      const result = getGitInfo();
      expect(result.commit).toBe('github-commit-123');
    });

    it('should use GITLAB_COMMIT_SHA for GitLab CI', () => {
      process.env.GITLAB_COMMIT_SHA = 'gitlab-commit-456';
      
      const result = getGitInfo();
      expect(result.commit).toBe('gitlab-commit-456');
    });

    it('should use CIRCLE_SHA1 for CircleCI', () => {
      process.env.CIRCLE_SHA1 = 'circle-commit-789';
      
      const result = getGitInfo();
      expect(result.commit).toBe('circle-commit-789');
    });
  });

  describe('CI Environment - Author Detection', () => {
    beforeEach(() => {
      process.env.CI = 'true';
    });

    it('should use GITHUB_ACTOR for GitHub Actions', () => {
      process.env.GITHUB_ACTOR = 'github-user';
      
      const result = getGitInfo();
      expect(result.author).toBe('github-user');
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
    beforeEach(() => {
      process.env.CI = 'true';
    });

    it('should use GIT_COMMITTER_NAME when available', () => {
      process.env.GIT_COMMITTER_NAME = 'committer-user';
      process.env.GIT_COMMITTER_EMAIL = 'committer@example.com';
      
      const result = getGitInfo();
      expect(result.committer).toBe('committer-user (committer@example.com)');
    });

    it('should fallback to author when no committer variables are available', () => {
      process.env.GIT_AUTHOR_NAME = 'author-user';
      process.env.GIT_AUTHOR_EMAIL = 'author@example.com';
      
      const result = getGitInfo();
      expect(result.committer).toBe('author-user (author@example.com)');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty environment variables gracefully', () => {
      process.env.CI = 'true';
      process.env.GITHUB_REF_NAME = '';
      process.env.GITHUB_SHA = '';
      
      const result = getGitInfo();
      // Should fallback to git commands or unknown
      expect(result.branch).toBeDefined();
      expect(result.commit).toBeDefined();
    });

    it('should handle undefined environment variables gracefully', () => {
      process.env.CI = 'true';
      process.env.GITHUB_REF_NAME = undefined;
      
      const result = getGitInfo();
      // Should fallback to git commands or unknown
      expect(result.branch).toBeDefined();
    });
  });
});
