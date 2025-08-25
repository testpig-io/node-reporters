// src/info/gitInfo.ts
import { execSync } from 'child_process';

function runGitCommand(cmd: string): string | null {
  try {
    return execSync(cmd, { encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
}

function isCI(): boolean {
  // Check for common CI environment variables that are set by most providers
  return !!(process.env.CI || process.env.BUILD_ID || process.env.BUILD_NUMBER);
}

function getBranchFromEnvironment(): string | null {
  // Try to get branch from various CI environment variables
  const branchVars = [
    'GITHUB_REF_NAME',           // GitHub Actions (preferred)
    'GITLAB_BRANCH',            // GitLab CI
    'CIRCLE_BRANCH',            // CircleCI
    'BITBUCKET_BRANCH',         // Bitbucket Pipelines
    'BRANCH_NAME',              // Jenkins, TeamCity
    'BUILDKITE_BRANCH',         // Buildkite
    'TRAVIS_BRANCH',            // Travis CI
    'APPVEYOR_REPO_BRANCH',     // AppVeyor
    'DRONE_BRANCH',             // Drone CI
    'SEMAPHORE_GIT_BRANCH',     // Semaphore CI
    'CI_COMMIT_REF_NAME',       // GitLab CI (alternative)
  ];

  for (const varName of branchVars) {
    if (process.env[varName]) {
      let branch = process.env[varName]!;
      
      // Handle GitHub refs like 'refs/heads/main' or 'refs/pull/123/head'
      if (branch.startsWith('refs/heads/')) {
        branch = branch.replace('refs/heads/', '');
      } else if (branch.startsWith('refs/pull/')) {
        branch = `PR-${branch.split('/')[2]}`;
      }
      
      return branch;
    }
  }

  // Special handling for GitHub Actions when GITHUB_REF_NAME is not available
  if (process.env.GITHUB_REF) {
    const ref = process.env.GITHUB_REF;
    if (ref.startsWith('refs/heads/')) {
      return ref.replace('refs/heads/', '');
    } else if (ref.startsWith('refs/pull/')) {
      return `PR-${ref.split('/')[2]}`;
    }
  }

  return null;
}

function getCommitFromEnvironment(): string | null {
  // Try to get commit SHA from various CI environment variables
  const commitVars = [
    'GITHUB_SHA',               // GitHub Actions
    'GITLAB_COMMIT_SHA',        // GitLab CI
    'CIRCLE_SHA1',              // CircleCI
    'BITBUCKET_COMMIT',         // Bitbucket Pipelines
    'BUILDKITE_COMMIT',         // Buildkite
    'TRAVIS_COMMIT',            // Travis CI
    'APPVEYOR_REPO_COMMIT',     // AppVeyor
    'DRONE_COMMIT',             // Drone CI
    'SEMAPHORE_GIT_SHA',        // Semaphore CI
    'CI_COMMIT_SHA',            // GitLab CI (alternative)
    'GIT_COMMIT',               // Generic
    'COMMIT_ID',                // Generic
  ];

  for (const varName of commitVars) {
    if (process.env[varName]) {
      return process.env[varName]!;
    }
  }

  return null;
}

function getAuthorFromEnvironment(): string | null {
  // Try to get author from various CI environment variables
  const authorVars = [
    'GITHUB_ACTOR',             // GitHub Actions
    'GITLAB_USER_NAME',         // GitLab CI
    'CIRCLE_USERNAME',          // CircleCI
    'BUILDKITE_BUILD_CREATOR',  // Buildkite
    'TRAVIS_COMMIT_AUTHOR',     // Travis CI
    'APPVEYOR_REPO_COMMIT_AUTHOR', // AppVeyor
    'DRONE_COMMIT_AUTHOR',      // Drone CI
    'SEMAPHORE_GIT_AUTHOR',     // Semaphore CI
    'GIT_AUTHOR_NAME',          // Generic
    'COMMIT_AUTHOR',            // Generic
  ];

  for (const varName of authorVars) {
    if (process.env[varName]) {
      const author = process.env[varName]!;
      
      // Try to get email from corresponding email variables
      let emailVar = varName.replace('_NAME', '_EMAIL').replace('_AUTHOR', '_EMAIL');
      let email = process.env[emailVar] || process.env[emailVar.replace('_EMAIL', '_MAIL')];
      
      // Handle specific cases for different CI providers
      if (varName === 'GITHUB_ACTOR') {
        email = process.env.GITHUB_ACTOR_EMAIL;
      } else if (varName === 'TRAVIS_COMMIT_AUTHOR') {
        email = process.env.TRAVIS_COMMIT_AUTHOR_EMAIL;
      }
      
      if (email) {
        return `${author} (${email})`;
      }
      
      return author;
    }
  }

  return null;
}

function getCommitterFromEnvironment(): string | null {
  // Try to get committer from various CI environment variables
  const committerVars = [
    'GIT_COMMITTER_NAME',       // Generic
    'COMMIT_COMMITTER',         // Generic
    'GIT_AUTHOR_NAME',          // Fallback to author if no committer specific
  ];

  for (const varName of committerVars) {
    if (process.env[varName]) {
      const committer = process.env[varName]!;
      
      // Try to get email from corresponding email variables
      let email: string | undefined;
      
      if (varName === 'GIT_COMMITTER_NAME') {
        email = process.env.GIT_COMMITTER_EMAIL;
      } else if (varName === 'COMMIT_COMMITTER') {
        email = process.env.COMMIT_COMMITTER_EMAIL;
      } else if (varName === 'GIT_AUTHOR_NAME') {
        email = process.env.GIT_AUTHOR_EMAIL;
      }
      
      if (email) {
        return `${committer} (${email})`;
      }
      
      return committer;
    }
  }

  return null;
}

function getBranchFromGit(): string | null {
  // Try multiple git commands to get branch name
  const commands = [
    'git rev-parse --abbrev-ref HEAD',
    'git name-rev --name-only HEAD',
    'git symbolic-ref --short HEAD',
    'git branch --show-current'
  ];

  for (const cmd of commands) {
    try {
      const result = runGitCommand(cmd);
      if (result && result !== 'HEAD' && result !== 'undefined') {
        // Filter out merge commit names like "9/merge"
        if (!result.includes('/merge') && !result.includes('/head')) {
          return result;
        }
      }
    } catch {}
  }

  return null;
}

function getAuthorFromGit(): string | null {
  // Try to get author from git config first, then from commit
  try {
    const name = runGitCommand('git config user.name');
    const email = runGitCommand('git config user.email');
    
    if (name && email) {
      return `${name} (${email})`;
    }
  } catch {}

  // Fallback to commit author
  return runGitCommand('git log -1 --pretty=format:"%an (%ae)"');
}

function getCommitterFromGit(): string | null {
  // Try to get committer from git config first, then from commit
  try {
    const name = runGitCommand('git config user.name');
    const email = runGitCommand('git config user.email');
    
    if (name && email) {
      return `${name} (${email})`;
    }
  } catch {}

  // Fallback to commit committer
  return runGitCommand('git log -1 --pretty=format:"%cn (%ce)"');
}

export function getGitInfo() {
  const isCIEnv = isCI();
  
  let branch: string;
  let commit: string;
  let author: string;
  let committer: string;
  
  if (isCIEnv) {
    // In CI, try environment variables first, then fallback to git commands
    branch = getBranchFromEnvironment() || getBranchFromGit() || 'unknown';
    commit = getCommitFromEnvironment() || runGitCommand('git rev-parse HEAD') || 'unknown';
    author = getAuthorFromEnvironment() || getAuthorFromGit() || 'unknown';
    committer = getCommitterFromEnvironment() || getCommitterFromGit() || 'unknown';
  } else {
    // Local development - use git commands
    branch = getBranchFromGit() || 'unknown';
    commit = runGitCommand('git rev-parse HEAD') || 'unknown';
    author = getAuthorFromGit() || 'unknown';
    committer = getCommitterFromGit() || 'unknown';
  }

  return {
    branch,
    commit,
    author,
    committer,
    isCI: isCIEnv
  };
}
