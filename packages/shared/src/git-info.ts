// src/info/gitInfo.ts
import { execSync } from 'child_process';

function runGitCommand(cmd: string): string | null {
  try {
    return execSync(cmd, { encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
}

export function getGitInfo() {
  const branch = runGitCommand('git rev-parse --abbrev-ref HEAD') || 'unknown';
  const commit = runGitCommand('git rev-parse HEAD') || 'unknown';
  const author = runGitCommand('git log -1 --pretty=format:"%an (%ae)"') || 'unknown';
  const committer = runGitCommand('git log -1 --pretty=format:"%cn (%ce)"') || 'unknown';

  console.log('branch', branch);
  console.log('commit', commit);
  console.log('author', author);
  console.log('committer', committer);

  return {
    branch,
    commit,
    author,
    committer
  };
}
