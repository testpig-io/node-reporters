// Mock child_process before importing the module
jest.mock('child_process');

// Import after mocking
import { getGitInfo } from '../git-info';
import { execSync } from 'child_process';

describe('getGitInfo', () => {
  const originalEnv = process.env;
  const mockExecSync = execSync as jest.MockedFunction<typeof execSync>;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    
    // Reset environment variables
    process.env = { ...originalEnv };
    
    // Don't clear CI environment variables here - let individual tests set what they need
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

    it('should combine author name and email when both are available', () => {
      process.env.GITLAB_USER_NAME = 'gitlab-user';
      process.env.GITLAB_USER_EMAIL = 'gitlab@example.com';
      
      const result = getGitInfo();
      expect(result.author).toBe('gitlab-user (gitlab@example.com)');
    });

    it('should handle different email variable naming patterns', () => {
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
