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
  
  // Extract email from author field if it exists (format: "Name (email)")
  const emailMatch = gitInfo.author.match(/\(([^)]+)\)$/);
  const email = emailMatch ? emailMatch[1] : 'unknown';
  
  // Convert GitInfo to ResolvedGitInfo format
  const resolvedInfo: ResolvedGitInfo = {
    branch: gitInfo.branch,
    commit: gitInfo.commit,
    author: gitInfo.author.replace(/\s*\([^)]*\)$/, ''), // Remove email from author name
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
  
  return {
    json: args.includes('--json'),
    verbose: args.includes('--verbose') || args.includes('-v'),
    help: args.includes('--help') || args.includes('-h')
  };
}

function showHelp(): void {
  console.log(`
TestPig Git Environment CLI

USAGE:
  npx testpig-git-env [OPTIONS]

OPTIONS:
  --json, -j     Output in JSON format
  --verbose, -v  Show debug information
  --help, -h     Show this help message

EXAMPLES:
  # Basic usage - output Docker environment flags
  npx testpig-git-env
  
  # Use with Docker
  docker run --rm $(npx testpig-git-env) my-test-image
  
  # Debug what's being detected
  npx testpig-git-env --verbose --json
  
  # Override specific values
  export TESTPIG_GIT_BRANCH="custom-branch"
  npx testpig-git-env

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
    
    if (options.json) {
      console.log(JSON.stringify(gitInfo, null, 2));
    } else {
      // Output Docker environment flags
      const flags = [
        `-e TESTPIG_GIT_BRANCH="${gitInfo.branch}"`,
        `-e TESTPIG_GIT_COMMIT="${gitInfo.commit}"`,
        `-e TESTPIG_GIT_AUTHOR="${gitInfo.author}"`,
        `-e TESTPIG_GIT_EMAIL="${gitInfo.email}"`,
        `-e TESTPIG_CI_PROVIDER="${gitInfo.provider}"`
      ];
      console.log(flags.join(' '));
    }
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
