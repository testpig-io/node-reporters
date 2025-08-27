// Main git-info module
import { GitInfo, CIProvider, CIProviderConfig } from './types';
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

export function getGitInfo(): GitInfo {
  logger.info('Starting git information extraction...');
  
  const { provider: ciProvider, detector } = detectCIProvider();
  const isCI = ciProvider !== 'unknown';
  
  logger.info(`Environment type: ${isCI ? 'CI' : 'Local Development'}`);
  if (isCI) {
    logger.info(`CI Provider: ${ciProvider}`);
  }
  
  let branch: string;
  let commit: string;
  let author: string;
  let committer: string;
  
  if (isCI && detector) {
    // In CI, try provider-specific environment variables first, then fallback to git commands
    logger.debug('Extracting git info from CI environment variables...');
    
    const providerInfo = detector.getGitInfo();
    
    const providerBranch = providerInfo.branch;
    const gitBranch = providerBranch || getBranchFromGit();
    branch = gitBranch || 'unknown';
    logger.debug(`Branch resolution: provider(${providerBranch}) -> git(${gitBranch}) -> final(${branch})`);
    
    const providerCommit = providerInfo.commit;
    const gitCommit = providerCommit || getCommitFromGit();
    commit = gitCommit || 'unknown';
    logger.debug(`Commit resolution: provider(${providerCommit}) -> git(${gitCommit}) -> final(${commit})`);
    
    const providerAuthor = providerInfo.author;
    const gitAuthor = providerAuthor || getAuthorFromGit();
    author = gitAuthor || 'unknown';
    logger.debug(`Author resolution: provider(${providerAuthor}) -> git(${gitAuthor}) -> final(${author})`);
    
    const providerCommitter = providerInfo.committer;
    const genericCommitter = providerCommitter || getGenericCommitter();
    const gitCommitter = genericCommitter || getCommitterFromGit();
    committer = gitCommitter || 'unknown';
    logger.debug(`Committer resolution: provider(${providerCommitter}) -> generic(${genericCommitter}) -> git(${gitCommitter}) -> final(${committer})`);
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
