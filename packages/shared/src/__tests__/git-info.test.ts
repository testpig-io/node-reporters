import { execSync } from 'child_process';
import { getGitInfo } from '../git-info';

// Mock child_process.execSync
jest.mock('child_process', () => ({
  execSync: jest.fn()
}));

const mockExecSync = execSync as jest.MockedFunction<typeof execSync>;

describe('getGitInfo', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset environment variables
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('Local Development Environment', () => {
    beforeEach(() => {
      // Ensure CI environment variables are not set
      delete process.env.CI;
      delete process.env.BUILD_ID;
      delete process.env.BUILD_NUMBER;
    });

    it('should return git info using git commands when not in CI', () => {
      mockExecSync
        .mockReturnValueOnce(Buffer.from('main\n')) // git rev-parse --abbrev-ref HEAD
        .mockReturnValueOnce(Buffer.from('abc123def456\n')) // git rev-parse HEAD
        .mockReturnValueOnce(Buffer.from('John Doe\n')) // git config user.name
        .mockReturnValueOnce(Buffer.from('john@example.com\n')) // git config user.email
        .mockReturnValueOnce(Buffer.from('Jane Smith\n')) // git config user.name (committer)
        .mockReturnValueOnce(Buffer.from('jane@example.com\n')); // git config user.email (committer)

      const result = getGitInfo();

      expect(result).toEqual({
        branch: 'main',
        commit: 'abc123def456',
        author: 'John Doe (john@example.com)',
        committer: 'Jane Smith (jane@example.com)',
        isCI: false
      });
    });

    it('should fallback to commit author when git config is not available', () => {
      mockExecSync
        .mockReturnValueOnce(Buffer.from('main\n')) // git rev-parse --abbrev-ref HEAD
        .mockReturnValueOnce(Buffer.from('abc123def456\n')) // git rev-parse HEAD
        .mockReturnValueOnce(Buffer.from('')) // git config user.name (empty)
        .mockReturnValueOnce(Buffer.from('')) // git config user.email (empty)
        .mockReturnValueOnce(Buffer.from('John Doe (john@example.com)\n')) // author from commit
        .mockReturnValueOnce(Buffer.from('')) // git config user.name (committer, empty)
        .mockReturnValueOnce(Buffer.from('')) // git config user.email (committer, empty)
        .mockReturnValueOnce(Buffer.from('Jane Smith (jane@example.com)\n')); // committer from commit

      const result = getGitInfo();

      expect(result).toEqual({
        branch: 'main',
        commit: 'abc123def456',
        author: 'John Doe (john@example.com)',
        committer: 'Jane Smith (jane@example.com)',
        isCI: false
      });
    });

    it('should try multiple git commands to get branch name', () => {
      // First command fails, second succeeds
      mockExecSync
        .mockImplementationOnce(() => { throw new Error('git rev-parse failed'); })
        .mockReturnValueOnce(Buffer.from('feature-branch\n')) // git name-rev --name-only HEAD
        .mockReturnValueOnce(Buffer.from('abc123def456\n')) // git rev-parse HEAD
        .mockReturnValueOnce(Buffer.from('John Doe\n')) // git config user.name
        .mockReturnValueOnce(Buffer.from('john@example.com\n')) // git config user.email
        .mockReturnValueOnce(Buffer.from('Jane Smith\n')) // git config user.name (committer)
        .mockReturnValueOnce(Buffer.from('jane@example.com\n')); // git config user.email (committer)

      const result = getGitInfo();

      expect(result.branch).toBe('feature-branch');
    });

    it('should handle git command failures gracefully', () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('git command failed');
      });

      const result = getGitInfo();

      expect(result).toEqual({
        branch: 'unknown',
        commit: 'unknown',
        author: 'unknown',
        committer: 'unknown',
        isCI: false
      });
    });
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

    it('should fallback to git commands when no CI branch variables are available', () => {
      mockExecSync
        .mockReturnValueOnce(Buffer.from('fallback-branch\n')) // git name-rev --name-only HEAD
        .mockReturnValueOnce(Buffer.from('abc123\n')) // git rev-parse HEAD
        .mockReturnValueOnce(Buffer.from('John Doe\n')) // git config user.name
        .mockReturnValueOnce(Buffer.from('john@example.com\n')); // git config user.email

      const result = getGitInfo();
      expect(result.branch).toBe('fallback-branch');
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

    it('should fallback to git command when no CI commit variables are available', () => {
      mockExecSync
        .mockReturnValueOnce(Buffer.from('fallback-commit\n')) // git rev-parse HEAD
        .mockReturnValueOnce(Buffer.from('John Doe\n')) // git config user.name
        .mockReturnValueOnce(Buffer.from('john@example.com\n')); // git config user.email

      const result = getGitInfo();
      expect(result.commit).toBe('fallback-commit');
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

    it('should fallback to git commands when no CI author variables are available', () => {
      mockExecSync
        .mockReturnValueOnce(Buffer.from('fallback-author\n')) // git config user.name
        .mockReturnValueOnce(Buffer.from('fallback@example.com\n')) // git config user.email
        .mockReturnValueOnce(Buffer.from('fallback-committer\n')) // git config user.name (committer)
        .mockReturnValueOnce(Buffer.from('fallback@example.com\n')); // git config user.email (committer)

      const result = getGitInfo();
      expect(result.author).toBe('fallback-author (fallback@example.com)');
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

    it('should fallback to git commands when no CI committer variables are available', () => {
      mockExecSync
        .mockReturnValueOnce(Buffer.from('fallback-committer\n')) // git config user.name
        .mockReturnValueOnce(Buffer.from('fallback@example.com\n')) // git config user.email

      const result = getGitInfo();
      expect(result.committer).toBe('fallback-committer (fallback@example.com)');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty environment variables gracefully', () => {
      process.env.CI = 'true';
      process.env.GITHUB_REF_NAME = '';
      process.env.GITHUB_SHA = '';
      
      mockExecSync
        .mockReturnValueOnce(Buffer.from('fallback-branch\n')) // git name-rev --name-only HEAD
        .mockReturnValueOnce(Buffer.from('fallback-commit\n')) // git rev-parse HEAD
        .mockReturnValueOnce(Buffer.from('fallback-author\n')) // git config user.name
        .mockReturnValueOnce(Buffer.from('fallback@example.com\n')); // git config user.email

      const result = getGitInfo();
      expect(result.branch).toBe('fallback-branch');
      expect(result.commit).toBe('fallback-commit');
    });

    it('should handle undefined environment variables gracefully', () => {
      process.env.CI = 'true';
      process.env.GITHUB_REF_NAME = undefined;
      
      mockExecSync
        .mockReturnValueOnce(Buffer.from('fallback-branch\n')) // git name-rev --name-only HEAD
        .mockReturnValueOnce(Buffer.from('fallback-commit\n')) // git rev-parse HEAD
        .mockReturnValueOnce(Buffer.from('fallback-author\n')) // git config user.name
        .mockReturnValueOnce(Buffer.from('fallback@example.com\n')); // git config user.email

      const result = getGitInfo();
      expect(result.branch).toBe('fallback-branch');
    });
  });
});
