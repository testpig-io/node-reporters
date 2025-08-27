// Git command utilities
import { execSync } from 'child_process';
import { createLogger } from '../logger';

const logger = createLogger('GitCommands');

export function runGitCommand(cmd: string): string | null {
  try {
    logger.debug(`Executing git command: ${cmd}`);
    const result = execSync(cmd, { encoding: 'utf8' }).trim();
    logger.debug(`Git command result: ${result}`);
    return result;
  } catch (error) {
    logger.debug(`Git command failed: ${cmd} - ${error}`);
    return null;
  }
}

export function getBranchFromGit(): string | null {
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

export function getAuthorFromGit(): string | null {
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

export function getCommitterFromGit(): string | null {
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

export function getCommitFromGit(): string | null {
  return runGitCommand('git rev-parse HEAD');
}
