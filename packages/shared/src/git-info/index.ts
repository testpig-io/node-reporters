// Main git-info module
import { GitInfo, CIProvider, CIProviderConfig, CIProviderInfo } from './types';
import { 
  getBranchFromGit, 
  getAuthorFromGit, 
  getCommitterFromGit, 
  getCommitFromGit 
} from './git-commands';
import { getGenericCommitter } from './generic-committer';
import { createLogger } from '../logger';

// Import core providers
import {
  GitHubProvider,
  GitLabProvider,
  CircleProvider,
  JenkinsProvider,
  TravisProvider
} from './providers';

const logger = createLogger('GitInfo');

// Registry of all supported CI providers
const CI_PROVIDERS: CIProviderConfig[] = [
  { name: 'github', provider: new GitHubProvider() },
  { name: 'gitlab', provider: new GitLabProvider() },
  { name: 'circle', provider: new CircleProvider() },
  { name: 'jenkins', provider: new JenkinsProvider() },
  { name: 'travis', provider: new TravisProvider() },
  // Additional providers can be easily added here
];

function detectCIProvider(): { provider: CIProvider; detector: any } {
  logger.debug('Starting CI provider detection...');
  logger.debug(`Available providers: ${CI_PROVIDERS.map(p => p.name).join(', ')}`);

  for (const config of CI_PROVIDERS) {
    logger.debug(`Checking CI provider: ${config.name}`);
    if (config.provider.detect()) {
      logger.info(`CI provider detected: ${config.name}`);
      return { provider: config.name, detector: config.provider };
    }
  }

  logger.info('No CI provider detected - running in local development mode');
  return { provider: 'unknown', detector: null };
}

function getTestPigOverrides(): CIProviderInfo {
  return {
    branch: process.env.TESTPIG_GIT_BRANCH || null,
    commit: process.env.TESTPIG_GIT_COMMIT || null,
    author: formatTestPigAuthor(),
    committer: null
  };
}

function formatTestPigAuthor(): string | null {
  const name = process.env.TESTPIG_GIT_AUTHOR;
  const email = process.env.TESTPIG_GIT_EMAIL;
  
  if (!name) return null;
  return email ? `${name} (${email})` : name;
}

function hasTestPigOverrides(): boolean {
  return !!(process.env.TESTPIG_GIT_BRANCH || 
           process.env.TESTPIG_GIT_COMMIT || 
           process.env.TESTPIG_GIT_AUTHOR || 
           process.env.TESTPIG_GIT_EMAIL);
}

export function getGitInfo(): GitInfo {
  logger.info('Starting git information extraction...');
  
  // Check for TestPig environment variable overrides first
  const testPigOverrides = getTestPigOverrides();
  const hasOverrides = hasTestPigOverrides();
  
  if (hasOverrides) {
    logger.info('TestPig environment variable overrides detected');
    logger.debug('TestPig overrides:', testPigOverrides);
  }
  
  const { provider: ciProvider, detector } = detectCIProvider();
  const isCI = ciProvider !== 'unknown' || hasOverrides;
  
  logger.info(`Environment type: ${isCI ? 'CI' : 'Local Development'}`);
  logger.info(`CI Provider: ${ciProvider}`);
  logger.info(`TestPig Overrides: ${hasOverrides}`);
  
  let branch: string;
  let commit: string;
  let author: string;
  let committer: string;
  
  if (isCI && detector) {
    // Priority: TestPig overrides -> CI provider vars -> Git commands
    logger.debug('Extracting git info with TestPig overrides and CI environment variables...');
    
    const providerInfo = detector.getGitInfo();
    
    const testPigBranch = testPigOverrides.branch;
    const providerBranch = providerInfo.branch;
    const gitBranch = testPigBranch || providerBranch || getBranchFromGit();
    branch = gitBranch || 'unknown';
    logger.debug(`Branch resolution: testpig(${testPigBranch}) -> provider(${providerBranch}) -> git(${gitBranch}) -> final(${branch})`);
    
    const testPigCommit = testPigOverrides.commit;
    const providerCommit = providerInfo.commit;
    const gitCommit = testPigCommit || providerCommit || getCommitFromGit();
    commit = gitCommit || 'unknown';
    logger.debug(`Commit resolution: testpig(${testPigCommit}) -> provider(${providerCommit}) -> git(${gitCommit}) -> final(${commit})`);
    
    const testPigAuthor = testPigOverrides.author;
    const providerAuthor = providerInfo.author;
    const gitAuthor = testPigAuthor || providerAuthor || getAuthorFromGit();
    author = gitAuthor || 'unknown';
    logger.debug(`Author resolution: testpig(${testPigAuthor}) -> provider(${providerAuthor}) -> git(${gitAuthor}) -> final(${author})`);
    
    const providerCommitter = providerInfo.committer;
    const genericCommitter = providerCommitter || getGenericCommitter();
    const gitCommitter = genericCommitter || getCommitterFromGit();
    committer = gitCommitter || 'unknown';
    logger.debug(`Committer resolution: provider(${providerCommitter}) -> generic(${genericCommitter}) -> git(${gitCommitter}) -> final(${committer})`);
  } else if (hasOverrides) {
    // TestPig overrides with git fallback (for Docker environments without CI detection)
    logger.debug('Extracting git info from TestPig overrides with git fallback...');
    
    const testPigBranch = testPigOverrides.branch;
    const gitBranch = testPigBranch || getBranchFromGit();
    branch = gitBranch || 'unknown';
    logger.debug(`Branch resolution: testpig(${testPigBranch}) -> git(${gitBranch}) -> final(${branch})`);
    
    const testPigCommit = testPigOverrides.commit;
    const gitCommit = testPigCommit || getCommitFromGit();
    commit = gitCommit || 'unknown';
    logger.debug(`Commit resolution: testpig(${testPigCommit}) -> git(${gitCommit}) -> final(${commit})`);
    
    const testPigAuthor = testPigOverrides.author;
    const gitAuthor = testPigAuthor || getAuthorFromGit();
    author = gitAuthor || 'unknown';
    logger.debug(`Author resolution: testpig(${testPigAuthor}) -> git(${gitAuthor}) -> final(${author})`);
    
    const genericCommitter = getGenericCommitter();
    const gitCommitter = genericCommitter || getCommitterFromGit();
    committer = gitCommitter || 'unknown';
    logger.debug(`Committer resolution: generic(${genericCommitter}) -> git(${gitCommitter}) -> final(${committer})`);
  } else {
    // Local development - use git commands
    logger.debug('Extracting git info from local git commands...');
    
    branch = getBranchFromGit() || 'unknown';
    commit = getCommitFromGit() || 'unknown';
    author = getAuthorFromGit() || 'unknown';
    committer = getCommitterFromGit() || 'unknown';
    
    logger.debug(`Local git extraction - branch: ${branch}, commit: ${commit}, author: ${author}, committer: ${committer}`);
  }

  const result: GitInfo = {
    branch,
    commit,
    author,
    committer,
    isCI,
    ciProvider: isCI ? ciProvider : undefined
  };
  
  logger.info(`Git info extraction complete:`, result);
  
  return result;
}

// Export types for external use
export type { GitInfo, CIProvider } from './types';
