#!/usr/bin/env node

/**
 * TestPig Git Environment CLI
 * 
 * Universal git environment detector that works across all platforms and CI providers.
 * Automatically detects CI environment variables and falls back to git commands.
 * 
 * Usage:
 *   npx testpig-git-env                    # Output Docker environment flags
 *   npx testpig-git-env --json             # Output JSON format
 *   npx testpig-git-env --verbose          # Debug output
 */

import { platform, arch } from 'os';
import { existsSync, readFileSync } from 'fs';

// Reuse existing git-info logic - this keeps everything DRY and consistent
import { getGitInfo, GitInfo } from '../git-info/index';

interface CLIOptions {
  json: boolean;
  verbose: boolean;
  help: boolean;
  format: 'docker' | 'env' | 'export' | 'json';
}

interface ResolvedGitInfo {
  branch: string;
  commit: string;
  author: string;
  email: string;
  provider: string;
  isCI: boolean;
}

function isRunningInDocker(): boolean {
  try {
    // Check for .dockerenv file (most reliable)
    if (existsSync('/.dockerenv')) return true;
    
    // Check cgroup (Linux)
    if (existsSync('/proc/1/cgroup')) {
      const cgroup = readFileSync('/proc/1/cgroup', 'utf8');
      if (cgroup.includes('docker') || cgroup.includes('/docker/')) return true;
    }
    
    // Check if we're PID 1 (common in containers)
    if (process.pid === 1) return true;
    
    return false;
  } catch {
    return false;
  }
}

function resolveGitInfo(options: CLIOptions): ResolvedGitInfo {
  if (options.verbose) {
    console.error(`Platform: ${platform()} ${arch()}`);
    console.error(`Node: ${process.version}`);
    console.error(`Docker: ${isRunningInDocker()}`);
    console.error(`Process PID: ${process.pid}`);
  }
  
  // Use the existing git-info module - this ensures 100% consistency
  const gitInfo: GitInfo = getGitInfo();
  
  if (options.verbose) {
    console.error('Git info from existing module:', gitInfo);
  }
  
  // Extract email with comprehensive fallback logic
  let email = 'unknown';
  let authorName = gitInfo.author;
  
  // Extract email from the git-info author field (format: "Name (email)")
  const authorEmailMatch = gitInfo.author.match(/\(([^)]+)\)$/);
  if (authorEmailMatch) {
    email = authorEmailMatch[1];
    authorName = gitInfo.author.replace(/\s*\([^)]*\)$/, ''); // Remove email from author name
  }
  
  // If no email in author, try to extract from committer field as fallback
  if (email === 'unknown' && gitInfo.committer) {
    const committerEmailMatch = gitInfo.committer.match(/\(([^)]+)\)$/);
    if (committerEmailMatch) {
      email = committerEmailMatch[1];
    }
  }
  
  // Store the original email for fallback purposes
  const originalEmail = email !== 'unknown' ? email : null;
  
  // Apply TestPig overrides
  if (process.env.TESTPIG_GIT_EMAIL) {
    email = process.env.TESTPIG_GIT_EMAIL;
  }
  
  if (process.env.TESTPIG_GIT_AUTHOR) {
    authorName = process.env.TESTPIG_GIT_AUTHOR;
    
    // If the override author contains an email, extract it
    const overrideEmailMatch = authorName.match(/\(([^)]+)\)$/);
    if (overrideEmailMatch) {
      email = overrideEmailMatch[1];
      authorName = authorName.replace(/\s*\([^)]*\)$/, '');
    }
    // Smart fallback: if only author is overridden (no email override),
    // preserve the original email to avoid losing it
    else if (!process.env.TESTPIG_GIT_EMAIL && originalEmail) {
      email = originalEmail;
    }
  }
  
  // Convert GitInfo to ResolvedGitInfo format
  const resolvedInfo: ResolvedGitInfo = {
    branch: gitInfo.branch,
    commit: gitInfo.commit,
    author: authorName,
    email: email,
    provider: gitInfo.ciProvider || (gitInfo.isCI ? 'unknown' : 'local'),
    isCI: gitInfo.isCI
  };
  
  if (options.verbose) {
    console.error('Final resolved info:', resolvedInfo);
  }
  
  return resolvedInfo;
}

function parseArgs(): CLIOptions {
  const args = process.argv.slice(2);
  
  // Parse format option
  let format: 'docker' | 'env' | 'export' | 'json' = 'docker';
  const formatIndex = args.findIndex(arg => arg.startsWith('--format='));
  if (formatIndex !== -1) {
    const formatValue = args[formatIndex].split('=')[1];
    if (['docker', 'env', 'export', 'json'].includes(formatValue)) {
      format = formatValue as 'docker' | 'env' | 'export' | 'json';
    }
  }
  
  // Override format if --json is specified (for backward compatibility)
  if (args.includes('--json')) {
    format = 'json';
  }
  
  return {
    json: args.includes('--json'),
    verbose: args.includes('--verbose') || args.includes('-v'),
    help: args.includes('--help') || args.includes('-h'),
    format
  };
}

function formatOutput(info: ResolvedGitInfo, format: 'docker' | 'env' | 'export' | 'json'): string {
  switch (format) {
    case 'json':
      return JSON.stringify(info, null, 2);
    
    case 'env':
      // Format for .env file
      return [
        `TESTPIG_GIT_BRANCH=${info.branch}`,
        `TESTPIG_GIT_COMMIT=${info.commit}`,
        `TESTPIG_GIT_AUTHOR=${info.author}`,
        `TESTPIG_GIT_EMAIL=${info.email}`,
        `TESTPIG_CI_PROVIDER=${info.provider}`,
        `TESTPIG_CI_IS_CI=${info.isCI ? 'true' : 'false'}`
      ].join('\n');
    
    case 'export':
      // Format for shell export
      return [
        `export TESTPIG_GIT_BRANCH="${info.branch}"`,
        `export TESTPIG_GIT_COMMIT="${info.commit}"`,
        `export TESTPIG_GIT_AUTHOR="${info.author}"`,
        `export TESTPIG_GIT_EMAIL="${info.email}"`,
        `export TESTPIG_CI_PROVIDER="${info.provider}"`,
        `export TESTPIG_CI_IS_CI="${info.isCI ? 'true' : 'false'}"`
      ].join('\n');
    
    case 'docker':
    default:
      // Default Docker format
      return [
        `-e TESTPIG_GIT_BRANCH="${info.branch}"`,
        `-e TESTPIG_GIT_COMMIT="${info.commit}"`,
        `-e TESTPIG_GIT_AUTHOR="${info.author}"`,
        `-e TESTPIG_GIT_EMAIL="${info.email}"`,
        `-e TESTPIG_CI_PROVIDER="${info.provider}"`,
        `-e TESTPIG_CI_IS_CI="${info.isCI ? 'true' : 'false'}"`
      ].join(' ');
  }
}

function showHelp(): void {
  console.log(`
TestPig Git Environment CLI

USAGE:
  npx testpig-git-env [OPTIONS]

OPTIONS:
  --format=FORMAT Output format: docker (default), env, export, json
  --json, -j      Output in JSON format (same as --format=json)
  --verbose, -v   Show debug information
  --help, -h      Show this help message

FORMATS:
  docker          Docker environment variables (default)
                  -e TESTPIG_GIT_BRANCH="main" -e TESTPIG_GIT_COMMIT="abc123"
  
  env             Environment file format (.env)
                  TESTPIG_GIT_BRANCH=main
                  TESTPIG_GIT_COMMIT=abc123
  
  export          Shell export format
                  export TESTPIG_GIT_BRANCH="main"
                  export TESTPIG_GIT_COMMIT="abc123"
  
  json            JSON format
                  {"branch": "main", "commit": "abc123"}

EXAMPLES:
  # Basic usage - Docker environment flags
  npx testpig-git-env
  docker run --rm \$(npx testpig-git-env) my-test-image
  
  # Docker Compose with environment file
  npx testpig-git-env --format=env > .testpig.env
  docker compose --env-file .testpig.env run tests
  
  # Docker Compose with shell export
  eval "\$(npx testpig-git-env --format=export)"
  docker compose -f docker-compose.yml --profile tests run cypress-tests
  
  # Debug what's being detected
  npx testpig-git-env --verbose --json

ENVIRONMENT VARIABLES:
  Override any detected values with:
  - TESTPIG_GIT_BRANCH    Git branch name
  - TESTPIG_GIT_COMMIT    Git commit SHA
  - TESTPIG_GIT_AUTHOR    Git author name
  - TESTPIG_GIT_EMAIL     Git author email
  - TESTPIG_CI_PROVIDER   CI provider name

SUPPORTED CI PROVIDERS:
  - GitHub Actions
  - GitLab CI
  - CircleCI
  - Jenkins
  - Travis CI
  - Generic CI environments
`);
}

function main(): void {
  const options = parseArgs();
  
  if (options.help) {
    showHelp();
    process.exit(0);
  }
  
  try {
    const gitInfo = resolveGitInfo(options);
    const output = formatOutput(gitInfo, options.format);
    console.log(output);
  } catch (error) {
    if (options.verbose) {
      console.error('Error:', error);
    }
    console.error('Failed to resolve git information. Use --verbose for details.');
    process.exit(1);
  }
}

// Only run if this file is executed directly
if (require.main === module) {
  main();
}
