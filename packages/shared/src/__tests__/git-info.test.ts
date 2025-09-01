import { getGitInfo } from '../git-info';
import { GitHubProvider, GitLabProvider, CircleProvider, JenkinsProvider, TravisProvider } from '../git-info/providers';

// Mock child_process and logger
jest.mock('child_process', () => ({
  execSync: jest.fn((cmd: string) => {
    if (cmd === 'git rev-parse --abbrev-ref HEAD') return 'main\n';
    if (cmd === 'git name-rev --name-only HEAD') return 'main\n';
    if (cmd === 'git symbolic-ref --short HEAD') return 'main\n';
    if (cmd === 'git branch --show-current') return 'main\n';
    if (cmd === 'git rev-parse HEAD') return 'abc123def456\n';
    if (cmd === 'git config user.name') return 'Test User\n';
    if (cmd === 'git config user.email') return 'test@example.com\n';
    if (cmd === 'git log -1 --pretty=format:"%an (%ae)"') return 'Test User (test@example.com)\n';
    if (cmd === 'git log -1 --pretty=format:"%cn (%ce)"') return 'Test User (test@example.com)\n';
    return '';
  })
}));

jest.mock('../logger', () => ({
  createLogger: jest.fn(() => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }))
}));

// Environment variable cleanup
const originalEnv = process.env;
const knownCIEnvVars = [
  'CI', 'CONTINUOUS_INTEGRATION',
  'GITHUB_ACTIONS', 'GITHUB_RUN_ID', 'GITHUB_REF_NAME', 'GITHUB_SHA', 'GITHUB_REF', 'GITHUB_ACTOR', 'GITHUB_ACTOR_EMAIL', 'GITHUB_HEAD_REF', 'GITHUB_EVENT_NAME',
  'GITLAB_CI', 'CI_PIPELINE_ID', 'CI_COMMIT_REF_NAME', 'CI_MERGE_REQUEST_SOURCE_BRANCH_NAME', 'CI_COMMIT_SHA', 'GITLAB_COMMIT_SHA', 'GITLAB_USER_NAME', 'GITLAB_USER_EMAIL', 'CI_COMMIT_AUTHOR', 'CI_COMMIT_AUTHOR_EMAIL', 'CI_COMMIT_COMMITTER', 'CI_COMMIT_COMMITTER_EMAIL',
  'CIRCLECI', 'CIRCLE_WORKFLOW_ID', 'CIRCLE_BUILD_NUM', 'CIRCLE_BRANCH', 'CIRCLE_SHA1', 'CIRCLE_USERNAME',
  'JENKINS_URL', 'BUILD_NUMBER', 'BRANCH_NAME', 'GIT_BRANCH', 'GIT_COMMIT', 'GIT_AUTHOR_NAME', 'GIT_AUTHOR_EMAIL', 'GIT_COMMITTER_NAME', 'GIT_COMMITTER_EMAIL',
  'TRAVIS', 'TRAVIS_BUILD_ID', 'TRAVIS_BRANCH', 'TRAVIS_PULL_REQUEST_BRANCH', 'TRAVIS_COMMIT', 'TRAVIS_COMMIT_AUTHOR', 'TRAVIS_COMMIT_AUTHOR_EMAIL',
  'BUILDKITE', 'BUILDKITE_BUILD_ID', 'BUILDKITE_BRANCH', 'BUILDKITE_COMMIT', 'BUILDKITE_BUILD_AUTHOR', 'BUILDKITE_BUILD_AUTHOR_EMAIL',
  'APPVEYOR', 'APPVEYOR_BUILD_ID', 'APPVEYOR_REPO_BRANCH', 'APPVEYOR_REPO_COMMIT', 'APPVEYOR_REPO_COMMIT_AUTHOR', 'APPVEYOR_REPO_COMMIT_AUTHOR_EMAIL',
  'TF_BUILD', 'BUILD_BUILDID', 'BUILD_SOURCEBRANCHNAME', 'BUILD_SOURCEVERSION', 'BUILD_REQUESTEDFOR', 'BUILD_REQUESTEDFOREMAIL',
  'BITBUCKET_BUILD_NUMBER', 'BITBUCKET_BRANCH', 'BITBUCKET_COMMIT', 'BITBUCKET_REPO_OWNER', 'BITBUCKET_REPO_SLUG',
  'DRONE', 'DRONE_BUILD_NUMBER', 'DRONE_BRANCH', 'DRONE_COMMIT', 'DRONE_COMMIT_AUTHOR', 'DRONE_COMMIT_AUTHOR_EMAIL',
  'SEMAPHORE', 'SEMAPHORE_WORKFLOW_ID', 'SEMAPHORE_GIT_BRANCH', 'SEMAPHORE_GIT_SHA', 'SEMAPHORE_GIT_COMMIT_AUTHOR', 'SEMAPHORE_GIT_COMMIT_AUTHOR_EMAIL',
  'TEAMCITY_VERSION', 'BUILD_VCS_NUMBER', 'teamcity.build.branch', 'teamcity.build.vcs.number',
  'BAMBOO_BUILD_NUMBER', 'bamboo.repository.branch.name', 'bamboo.repository.revision.number',
  'CI_NAME', 'CODESHIP_BUILD_ID', 'CI_BRANCH', 'CI_COMMIT_ID', 'CI_COMMITTER_NAME', 'CI_COMMITTER_EMAIL',
  'CODEBUILD_BUILD_ID', 'CODEBUILD_SOURCE_VERSION', 'CODEBUILD_WEBHOOK_HEAD_REF',
  'TESTPIG_DEBUG_LOGS'
];

beforeEach(() => {
  // Clean environment variables for isolated tests
  knownCIEnvVars.forEach(envVar => {
    delete process.env[envVar];
  });
});

afterAll(() => {
  process.env = originalEnv;
});

describe('GitHubProvider', () => {
  let provider: GitHubProvider;

  beforeEach(() => {
    provider = new GitHubProvider();
  });

  describe('detection', () => {
    it('should detect GitHub Actions when GITHUB_ACTIONS is set', () => {
      process.env.GITHUB_ACTIONS = 'true';
      expect(provider.detect()).toBe(true);
    });

    it('should detect GitHub Actions when GITHUB_RUN_ID is set', () => {
      process.env.GITHUB_RUN_ID = '123456';
      expect(provider.detect()).toBe(true);
    });

    it('should not detect when no GitHub environment variables are set', () => {
      expect(provider.detect()).toBe(false);
    });
  });

  describe('git info extraction', () => {
    beforeEach(() => {
      process.env.GITHUB_ACTIONS = 'true';
    });

    it('should prioritize GITHUB_HEAD_REF for pull requests', () => {
      process.env.GITHUB_EVENT_NAME = 'pull_request';
      process.env.GITHUB_HEAD_REF = 'feature-branch';
      process.env.GITHUB_REF_NAME = '139/merge';

      const result = provider.getGitInfo();
      expect(result.branch).toBe('feature-branch');
    });

    it('should use GITHUB_REF_NAME for regular pushes', () => {
      process.env.GITHUB_REF_NAME = 'main';

      const result = provider.getGitInfo();
      expect(result.branch).toBe('main');
    });

    it('should extract branch from GITHUB_REF when REF_NAME not available', () => {
      process.env.GITHUB_REF = 'refs/heads/feature-branch';

      const result = provider.getGitInfo();
      expect(result.branch).toBe('feature-branch');
    });

    it('should handle pull request refs in GITHUB_REF', () => {
      process.env.GITHUB_REF = 'refs/pull/123/head';

      const result = provider.getGitInfo();
      expect(result.branch).toBe('PR-123');
    });

    it('should extract commit from GITHUB_SHA', () => {
      process.env.GITHUB_SHA = 'abc123def456';

      const result = provider.getGitInfo();
      expect(result.commit).toBe('abc123def456');
    });

    it('should extract author from GITHUB_ACTOR and email', () => {
      process.env.GITHUB_ACTOR = 'testuser';
      process.env.GITHUB_ACTOR_EMAIL = 'test@example.com';

      const result = provider.getGitInfo();
      expect(result.author).toBe('testuser (test@example.com)');
    });

    it('should extract author from GITHUB_ACTOR without email', () => {
      process.env.GITHUB_ACTOR = 'testuser';

      const result = provider.getGitInfo();
      expect(result.author).toBe('testuser');
    });
  });
});

describe('GitLabProvider', () => {
  let provider: GitLabProvider;

  beforeEach(() => {
    provider = new GitLabProvider();
  });

  describe('detection', () => {
    it('should detect GitLab CI when GITLAB_CI is set', () => {
      process.env.GITLAB_CI = 'true';
      expect(provider.detect()).toBe(true);
    });

    it('should detect GitLab CI when CI_PIPELINE_ID is set', () => {
      process.env.CI_PIPELINE_ID = '123456';
      expect(provider.detect()).toBe(true);
    });

    it('should not detect when no GitLab environment variables are set', () => {
      expect(provider.detect()).toBe(false);
    });
  });

  describe('git info extraction', () => {
    beforeEach(() => {
      process.env.GITLAB_CI = 'true';
    });

    it('should extract branch from CI_COMMIT_REF_NAME', () => {
      process.env.CI_COMMIT_REF_NAME = 'feature-branch';

      const result = provider.getGitInfo();
      expect(result.branch).toBe('feature-branch');
    });

    it('should extract branch from CI_MERGE_REQUEST_SOURCE_BRANCH_NAME if REF_NAME not available', () => {
      process.env.CI_MERGE_REQUEST_SOURCE_BRANCH_NAME = 'feature-branch';

      const result = provider.getGitInfo();
      expect(result.branch).toBe('feature-branch');
    });

    it('should extract commit from CI_COMMIT_SHA', () => {
      process.env.CI_COMMIT_SHA = 'abc123def456';

      const result = provider.getGitInfo();
      expect(result.commit).toBe('abc123def456');
    });

    it('should extract commit from GITLAB_COMMIT_SHA if CI_COMMIT_SHA not available', () => {
      process.env.GITLAB_COMMIT_SHA = 'abc123def456';

      const result = provider.getGitInfo();
      expect(result.commit).toBe('abc123def456');
    });

    it('should extract author from GITLAB_USER_NAME and email', () => {
      process.env.GITLAB_USER_NAME = 'Test User';
      process.env.GITLAB_USER_EMAIL = 'test@example.com';

      const result = provider.getGitInfo();
      expect(result.author).toBe('Test User (test@example.com)');
    });

    it('should extract committer from CI_COMMIT_COMMITTER', () => {
      process.env.CI_COMMIT_COMMITTER = 'Committer User';
      process.env.CI_COMMIT_COMMITTER_EMAIL = 'committer@example.com';

      const result = provider.getGitInfo();
      expect(result.committer).toBe('Committer User (committer@example.com)');
    });
  });
});

describe('CircleProvider', () => {
  let provider: CircleProvider;

  beforeEach(() => {
    provider = new CircleProvider();
  });

  describe('detection', () => {
    it('should detect CircleCI when CIRCLECI is set', () => {
      process.env.CIRCLECI = 'true';
      expect(provider.detect()).toBe(true);
    });

    it('should detect CircleCI when CIRCLE_WORKFLOW_ID is set', () => {
      process.env.CIRCLE_WORKFLOW_ID = '12345';
      expect(provider.detect()).toBe(true);
    });

    it('should detect CircleCI when CIRCLE_BUILD_NUM is set', () => {
      process.env.CIRCLE_BUILD_NUM = '123';
      expect(provider.detect()).toBe(true);
    });

    it('should not detect when no CircleCI environment variables are set', () => {
      expect(provider.detect()).toBe(false);
    });
  });

  describe('git info extraction', () => {
    beforeEach(() => {
      process.env.CIRCLECI = 'true';
    });

    it('should extract branch from CIRCLE_BRANCH', () => {
      process.env.CIRCLE_BRANCH = 'feature-branch';

      const result = provider.getGitInfo();
      expect(result.branch).toBe('feature-branch');
    });

    it('should extract commit from CIRCLE_SHA1', () => {
      process.env.CIRCLE_SHA1 = 'abc123def456';

      const result = provider.getGitInfo();
      expect(result.commit).toBe('abc123def456');
    });

    it('should extract author from CIRCLE_USERNAME', () => {
      process.env.CIRCLE_USERNAME = 'testuser';

      const result = provider.getGitInfo();
      expect(result.author).toBe('testuser');
    });
  });
});

describe('JenkinsProvider', () => {
  let provider: JenkinsProvider;

  beforeEach(() => {
    provider = new JenkinsProvider();
  });

  describe('detection', () => {
    it('should detect Jenkins when JENKINS_URL is set', () => {
      process.env.JENKINS_URL = 'http://jenkins.example.com';
      expect(provider.detect()).toBe(true);
    });

    it('should detect Jenkins when BUILD_NUMBER is set', () => {
      process.env.BUILD_NUMBER = '123';
      expect(provider.detect()).toBe(true);
    });

    it('should not detect when no Jenkins environment variables are set', () => {
      expect(provider.detect()).toBe(false);
    });
  });

  describe('git info extraction', () => {
    beforeEach(() => {
      process.env.JENKINS_URL = 'http://jenkins.example.com';
    });

    it('should extract branch from BRANCH_NAME', () => {
      process.env.BRANCH_NAME = 'feature-branch';

      const result = provider.getGitInfo();
      expect(result.branch).toBe('feature-branch');
    });

    it('should extract branch from GIT_BRANCH and clean origin prefix', () => {
      process.env.GIT_BRANCH = 'origin/feature-branch';

      const result = provider.getGitInfo();
      expect(result.branch).toBe('feature-branch');
    });

    it('should extract commit from GIT_COMMIT', () => {
      process.env.GIT_COMMIT = 'abc123def456';

      const result = provider.getGitInfo();
      expect(result.commit).toBe('abc123def456');
    });

    it('should extract author from GIT_AUTHOR_NAME and email', () => {
      process.env.GIT_AUTHOR_NAME = 'Test User';
      process.env.GIT_AUTHOR_EMAIL = 'test@example.com';

      const result = provider.getGitInfo();
      expect(result.author).toBe('Test User (test@example.com)');
    });

    it('should extract committer from GIT_COMMITTER_NAME and email', () => {
      process.env.GIT_COMMITTER_NAME = 'Committer User';
      process.env.GIT_COMMITTER_EMAIL = 'committer@example.com';

      const result = provider.getGitInfo();
      expect(result.committer).toBe('Committer User (committer@example.com)');
    });
  });
});

describe('TravisProvider', () => {
  let provider: TravisProvider;

  beforeEach(() => {
    provider = new TravisProvider();
  });

  describe('detection', () => {
    it('should detect Travis CI when TRAVIS is set', () => {
      process.env.TRAVIS = 'true';
      expect(provider.detect()).toBe(true);
    });

    it('should detect Travis CI when TRAVIS_BUILD_ID is set', () => {
      process.env.TRAVIS_BUILD_ID = '123456';
      expect(provider.detect()).toBe(true);
    });

    it('should not detect when no Travis environment variables are set', () => {
      expect(provider.detect()).toBe(false);
    });
  });

  describe('git info extraction', () => {
    beforeEach(() => {
      process.env.TRAVIS = 'true';
    });

    it('should extract branch from TRAVIS_BRANCH', () => {
      process.env.TRAVIS_BRANCH = 'feature-branch';

      const result = provider.getGitInfo();
      expect(result.branch).toBe('feature-branch');
    });

    it('should extract branch from TRAVIS_PULL_REQUEST_BRANCH if BRANCH not available', () => {
      process.env.TRAVIS_PULL_REQUEST_BRANCH = 'feature-branch';

      const result = provider.getGitInfo();
      expect(result.branch).toBe('feature-branch');
    });

    it('should extract commit from TRAVIS_COMMIT', () => {
      process.env.TRAVIS_COMMIT = 'abc123def456';

      const result = provider.getGitInfo();
      expect(result.commit).toBe('abc123def456');
    });

    it('should extract author from TRAVIS_COMMIT_AUTHOR and email', () => {
      process.env.TRAVIS_COMMIT_AUTHOR = 'Test User';
      process.env.TRAVIS_COMMIT_AUTHOR_EMAIL = 'test@example.com';

      const result = provider.getGitInfo();
      expect(result.author).toBe('Test User (test@example.com)');
    });
  });
});

describe('getGitInfo integration', () => {
  it('should detect GitHub Actions and return correct provider', () => {
    process.env.GITHUB_ACTIONS = 'true';
    process.env.GITHUB_REF_NAME = 'main';
    process.env.GITHUB_SHA = 'abc123def456';
    process.env.GITHUB_ACTOR = 'testuser';

    const result = getGitInfo();
    expect(result.isCI).toBe(true);
    expect(result.ciProvider).toBe('github');
    expect(result.branch).toBe('main');
    expect(result.commit).toBe('abc123def456');
    expect(result.author).toBe('testuser');
  });

  it('should detect GitLab CI and return correct provider', () => {
    process.env.GITLAB_CI = 'true';
    process.env.CI_COMMIT_REF_NAME = 'feature-branch';
    process.env.CI_COMMIT_SHA = 'abc123def456';
    process.env.GITLAB_USER_NAME = 'Test User';

    const result = getGitInfo();
    expect(result.isCI).toBe(true);
    expect(result.ciProvider).toBe('gitlab');
    expect(result.branch).toBe('feature-branch');
    expect(result.commit).toBe('abc123def456');
    expect(result.author).toBe('Test User');
  });

  it('should detect CircleCI and return correct provider', () => {
    process.env.CIRCLECI = 'true';
    process.env.CIRCLE_BRANCH = 'develop';
    process.env.CIRCLE_SHA1 = 'abc123def456';
    process.env.CIRCLE_USERNAME = 'testuser';

    const result = getGitInfo();
    expect(result.isCI).toBe(true);
    expect(result.ciProvider).toBe('circle');
    expect(result.branch).toBe('develop');
    expect(result.commit).toBe('abc123def456');
    expect(result.author).toBe('testuser');
  });

  it('should detect Jenkins and return correct provider', () => {
    process.env.JENKINS_URL = 'http://jenkins.example.com';
    process.env.BRANCH_NAME = 'feature-branch';
    process.env.GIT_COMMIT = 'abc123def456';
    process.env.GIT_AUTHOR_NAME = 'Test User';

    const result = getGitInfo();
    expect(result.isCI).toBe(true);
    expect(result.ciProvider).toBe('jenkins');
    expect(result.branch).toBe('feature-branch');
    expect(result.commit).toBe('abc123def456');
    expect(result.author).toBe('Test User');
  });

  it('should detect Travis CI and return correct provider', () => {
    process.env.TRAVIS = 'true';
    process.env.TRAVIS_BRANCH = 'main';
    process.env.TRAVIS_COMMIT = 'abc123def456';
    process.env.TRAVIS_COMMIT_AUTHOR = 'Test User';

    const result = getGitInfo();
    expect(result.isCI).toBe(true);
    expect(result.ciProvider).toBe('travis');
    expect(result.branch).toBe('main');
    expect(result.commit).toBe('abc123def456');
    expect(result.author).toBe('Test User');
  });

  it('should return local development when no CI provider detected', () => {
    const result = getGitInfo();
    expect(result.isCI).toBe(false);
    expect(result.ciProvider).toBeUndefined();
    expect(result.branch).toBe('main'); // From mocked git command
    expect(result.commit).toBe('abc123def456'); // From mocked git command
    expect(result.author).toBe('Test User (test@example.com)'); // From mocked git command
    expect(result.committer).toBe('Test User (test@example.com)'); // From mocked git command
  });

  it('should fall back to git commands when CI environment variables are missing', () => {
    process.env.GITHUB_ACTIONS = 'true';
    // No GitHub env vars set, should fall back to git commands

    const result = getGitInfo();
    expect(result.isCI).toBe(true);
    expect(result.ciProvider).toBe('github');
    expect(result.branch).toBe('main'); // From mocked git command
    expect(result.commit).toBe('abc123def456'); // From mocked git command
    expect(result.author).toBe('Test User (test@example.com)'); // From mocked git command
  });

  it('should handle GitHub PR correctly with GITHUB_HEAD_REF priority', () => {
    process.env.GITHUB_ACTIONS = 'true';
    process.env.GITHUB_EVENT_NAME = 'pull_request';
    process.env.GITHUB_HEAD_REF = 'feature-branch';
    process.env.GITHUB_REF_NAME = '139/merge';
    process.env.GITHUB_SHA = 'merge-commit-sha';

    const result = getGitInfo();
    expect(result.isCI).toBe(true);
    expect(result.ciProvider).toBe('github');
    expect(result.branch).toBe('feature-branch'); // Should use HEAD_REF, not the merge branch
    expect(result.commit).toBe('merge-commit-sha'); // Merge commit is acceptable
  });
});