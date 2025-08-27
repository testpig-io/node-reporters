// src/info/gitInfo.ts
import { execSync } from 'child_process';
import { createLogger } from './logger';

const logger = createLogger('GitInfo');

function runGitCommand(cmd: string): string | null {
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

// CI Provider definitions
type CIProvider = 'github' | 'gitlab' | 'circle' | 'travis' | 'jenkins' | 'buildkite' | 'appveyor' | 'azure' | 'bitbucket' | 'drone' | 'semaphore' | 'teamcity' | 'bamboo' | 'codeship' | 'aws' | 'unknown';

interface CIProviderConfig {
  name: CIProvider;
  detectFn: () => boolean;
}

// CI Provider detection functions
function isGitHubActions(): boolean {
  const result = !!(process.env.GITHUB_ACTIONS || process.env.GITHUB_RUN_ID);
  logger.debug(`Checking GitHub Actions: GITHUB_ACTIONS=${process.env.GITHUB_ACTIONS}, GITHUB_RUN_ID=${process.env.GITHUB_RUN_ID} -> ${result}`);
  return result;
}

function isGitLabCI(): boolean {
  const result = !!(process.env.GITLAB_CI || process.env.CI_PIPELINE_ID);
  logger.debug(`Checking GitLab CI: GITLAB_CI=${process.env.GITLAB_CI}, CI_PIPELINE_ID=${process.env.CI_PIPELINE_ID} -> ${result}`);
  return result;
}

function isCircleCI(): boolean {
  const result = !!(process.env.CIRCLECI || process.env.CIRCLE_WORKFLOW_ID || process.env.CIRCLE_BUILD_NUM);
  logger.debug(`Checking CircleCI: CIRCLECI=${process.env.CIRCLECI}, CIRCLE_WORKFLOW_ID=${process.env.CIRCLE_WORKFLOW_ID}, CIRCLE_BUILD_NUM=${process.env.CIRCLE_BUILD_NUM} -> ${result}`);
  return result;
}

function isTravisCI(): boolean {
  const result = !!(process.env.TRAVIS || process.env.TRAVIS_BUILD_ID);
  logger.debug(`Checking Travis CI: TRAVIS=${process.env.TRAVIS}, TRAVIS_BUILD_ID=${process.env.TRAVIS_BUILD_ID} -> ${result}`);
  return result;
}

function isJenkins(): boolean {
  const result = !!(process.env.JENKINS_URL || process.env.BUILD_NUMBER);
  logger.debug(`Checking Jenkins: JENKINS_URL=${process.env.JENKINS_URL}, BUILD_NUMBER=${process.env.BUILD_NUMBER} -> ${result}`);
  return result;
}

function isBuildkite(): boolean {
  const result = !!(process.env.BUILDKITE || process.env.BUILDKITE_BUILD_ID);
  logger.debug(`Checking Buildkite: BUILDKITE=${process.env.BUILDKITE}, BUILDKITE_BUILD_ID=${process.env.BUILDKITE_BUILD_ID} -> ${result}`);
  return result;
}

function isAppVeyor(): boolean {
  const result = !!(process.env.APPVEYOR || process.env.APPVEYOR_BUILD_NUMBER);
  logger.debug(`Checking AppVeyor: APPVEYOR=${process.env.APPVEYOR}, APPVEYOR_BUILD_NUMBER=${process.env.APPVEYOR_BUILD_NUMBER} -> ${result}`);
  return result;
}

function isAzurePipelines(): boolean {
  const result = !!(process.env.AZURE_HTTP_USER_AGENT || process.env.BUILD_BUILDNUMBER || process.env.TF_BUILD);
  logger.debug(`Checking Azure Pipelines: AZURE_HTTP_USER_AGENT=${process.env.AZURE_HTTP_USER_AGENT}, BUILD_BUILDNUMBER=${process.env.BUILD_BUILDNUMBER}, TF_BUILD=${process.env.TF_BUILD} -> ${result}`);
  return result;
}

function isBitbucket(): boolean {
  const result = !!(process.env.BITBUCKET_BUILD_NUMBER || process.env.BITBUCKET_COMMIT);
  logger.debug(`Checking Bitbucket: BITBUCKET_BUILD_NUMBER=${process.env.BITBUCKET_BUILD_NUMBER}, BITBUCKET_COMMIT=${process.env.BITBUCKET_COMMIT} -> ${result}`);
  return result;
}

function isDroneCI(): boolean {
  const result = !!(process.env.DRONE || process.env.DRONE_BUILD_NUMBER);
  logger.debug(`Checking Drone CI: DRONE=${process.env.DRONE}, DRONE_BUILD_NUMBER=${process.env.DRONE_BUILD_NUMBER} -> ${result}`);
  return result;
}

function isSemaphoreCI(): boolean {
  const result = !!(process.env.SEMAPHORE || process.env.SEMAPHORE_EXECUTABLE_UUID);
  logger.debug(`Checking Semaphore CI: SEMAPHORE=${process.env.SEMAPHORE}, SEMAPHORE_EXECUTABLE_UUID=${process.env.SEMAPHORE_EXECUTABLE_UUID} -> ${result}`);
  return result;
}

function isTeamCity(): boolean {
  const result = !!(process.env.TEAMCITY_VERSION || process.env.BUILD_NUMBER);
  logger.debug(`Checking TeamCity: TEAMCITY_VERSION=${process.env.TEAMCITY_VERSION}, BUILD_NUMBER=${process.env.BUILD_NUMBER} -> ${result}`);
  return result;
}

function isBamboo(): boolean {
  const result = !!(process.env.bamboo_buildNumber || process.env.bamboo_planKey);
  logger.debug(`Checking Bamboo: bamboo_buildNumber=${process.env.bamboo_buildNumber}, bamboo_planKey=${process.env.bamboo_planKey} -> ${result}`);
  return result;
}

function isCodeship(): boolean {
  const result = !!(process.env.CI_NAME === 'codeship' || process.env.CODESHIP);
  logger.debug(`Checking Codeship: CI_NAME=${process.env.CI_NAME}, CODESHIP=${process.env.CODESHIP} -> ${result}`);
  return result;
}

function isAWSCodeBuild(): boolean {
  const result = !!(process.env.CODEBUILD_BUILD_ARN || process.env.CODEBUILD_INITIATOR);
  logger.debug(`Checking AWS CodeBuild: CODEBUILD_BUILD_ARN=${process.env.CODEBUILD_BUILD_ARN}, CODEBUILD_INITIATOR=${process.env.CODEBUILD_INITIATOR} -> ${result}`);
  return result;
}

// Main CI detection function
function detectCIProvider(): CIProvider {
  logger.debug('Starting CI provider detection...');
  
  const providers: CIProviderConfig[] = [
    { name: 'github', detectFn: isGitHubActions },
    { name: 'gitlab', detectFn: isGitLabCI },
    { name: 'circle', detectFn: isCircleCI },
    { name: 'travis', detectFn: isTravisCI },
    { name: 'jenkins', detectFn: isJenkins },
    { name: 'buildkite', detectFn: isBuildkite },
    { name: 'appveyor', detectFn: isAppVeyor },
    { name: 'azure', detectFn: isAzurePipelines },
    { name: 'bitbucket', detectFn: isBitbucket },
    { name: 'drone', detectFn: isDroneCI },
    { name: 'semaphore', detectFn: isSemaphoreCI },
    { name: 'teamcity', detectFn: isTeamCity },
    { name: 'bamboo', detectFn: isBamboo },
    { name: 'codeship', detectFn: isCodeship },
    { name: 'aws', detectFn: isAWSCodeBuild },
  ];
  logger.debug(`CI providers: ${providers.map(p => p.name).join(', ')}`);

  for (const provider of providers) {
    logger.debug(`Checking CI provider: ${provider.name}`);
    if (provider.detectFn()) {
      logger.info(`CI provider detected: ${provider.name}`);
      return provider.name;
    }
  }

  logger.info('No CI provider detected - running in local development mode');
  return 'unknown';
}

// Provider-specific branch extraction functions
function getBranchFromProvider(provider: CIProvider): string | null {
  logger.debug(`Extracting branch from provider: ${provider}`);
  
  let result: string | null = null;
  
  switch (provider) {
    case 'github':
      result = getBranchFromGitHub();
      break;
    case 'gitlab':
      result = getBranchFromGitLab();
      break;
    case 'circle':
      result = getBranchFromCircleCI();
      break;
    case 'travis':
      result = getBranchFromTravis();
      break;
    case 'jenkins':
      result = getBranchFromJenkins();
      break;
    case 'buildkite':
      result = getBranchFromBuildkite();
      break;
    case 'appveyor':
      result = getBranchFromAppVeyor();
      break;
    case 'azure':
      result = getBranchFromAzure();
      break;
    case 'bitbucket':
      result = getBranchFromBitbucket();
      break;
    case 'drone':
      result = getBranchFromDrone();
      break;
    case 'semaphore':
      result = getBranchFromSemaphore();
      break;
    case 'teamcity':
      result = getBranchFromTeamCity();
      break;
    case 'bamboo':
      result = getBranchFromBamboo();
      break;
    case 'codeship':
      result = getBranchFromCodeship();
      break;
    case 'aws':
      result = getBranchFromAWS();
      break;
    default:
      result = null;
      break;
  }
  
  logger.debug(`Branch extraction result for ${provider}: ${result}`);
  return result;
}

function getBranchFromGitHub(): string | null {
  logger.debug(`GitHub branch detection - GITHUB_EVENT_NAME: ${process.env.GITHUB_EVENT_NAME}, GITHUB_HEAD_REF: ${process.env.GITHUB_HEAD_REF}, GITHUB_REF_NAME: ${process.env.GITHUB_REF_NAME}, GITHUB_REF: ${process.env.GITHUB_REF}`);
  
  // For Pull Requests - prioritize GITHUB_HEAD_REF (the actual PR branch)
  if (process.env.GITHUB_EVENT_NAME === 'pull_request' && process.env.GITHUB_HEAD_REF) {
    logger.debug(`Using GITHUB_HEAD_REF for PR: ${process.env.GITHUB_HEAD_REF}`);
    return process.env.GITHUB_HEAD_REF;
  }
  
  // For regular pushes or when GITHUB_HEAD_REF is not available - use GITHUB_REF_NAME
  if (process.env.GITHUB_REF_NAME) {
    logger.debug(`Using GITHUB_REF_NAME: ${process.env.GITHUB_REF_NAME}`);
    return process.env.GITHUB_REF_NAME;
  }
  
  // Fallback logic for older GitHub Actions or edge cases
  if (process.env.GITHUB_REF) {
    const ref = process.env.GITHUB_REF;
    if (ref.startsWith('refs/heads/')) {
      const branch = ref.replace('refs/heads/', '');
      logger.debug(`Extracted branch from GITHUB_REF: ${branch}`);
      return branch;
    } else if (ref.startsWith('refs/pull/')) {
      const prBranch = `PR-${ref.split('/')[2]}`;
      logger.debug(`Extracted PR branch from GITHUB_REF: ${prBranch}`);
      return prBranch;
    }
  }
  
  // Final fallback - GITHUB_HEAD_REF (for PRs where event name might not be set correctly)
  if (process.env.GITHUB_HEAD_REF) {
    logger.debug(`Using GITHUB_HEAD_REF as fallback: ${process.env.GITHUB_HEAD_REF}`);
    return process.env.GITHUB_HEAD_REF;
  }
  
  logger.debug('No GitHub branch environment variables found');
  return null;
}

function getBranchFromGitLab(): string | null {
  logger.debug(`GitLab branch detection - CI_COMMIT_REF_NAME: ${process.env.CI_COMMIT_REF_NAME}, CI_MERGE_REQUEST_SOURCE_BRANCH_NAME: ${process.env.CI_MERGE_REQUEST_SOURCE_BRANCH_NAME}`);
  const result = process.env.CI_COMMIT_REF_NAME || process.env.CI_MERGE_REQUEST_SOURCE_BRANCH_NAME || null;
  logger.debug(`GitLab branch result: ${result}`);
  return result;
}

function getBranchFromCircleCI(): string | null {
  logger.debug(`CircleCI branch detection - CIRCLE_BRANCH: ${process.env.CIRCLE_BRANCH}`);
  const result = process.env.CIRCLE_BRANCH || null;
  logger.debug(`CircleCI branch result: ${result}`);
  return result;
}

function getBranchFromTravis(): string | null {
  logger.debug(`Travis branch detection - TRAVIS_BRANCH: ${process.env.TRAVIS_BRANCH}, TRAVIS_PULL_REQUEST_BRANCH: ${process.env.TRAVIS_PULL_REQUEST_BRANCH}`);
  const result = process.env.TRAVIS_BRANCH || process.env.TRAVIS_PULL_REQUEST_BRANCH || null;
  logger.debug(`Travis branch result: ${result}`);
  return result;
}

function getBranchFromJenkins(): string | null {
  logger.debug(`Jenkins branch detection - BRANCH_NAME: ${process.env.BRANCH_NAME}, GIT_BRANCH: ${process.env.GIT_BRANCH}`);
  const result = process.env.BRANCH_NAME || process.env.GIT_BRANCH?.replace('origin/', '') || null;
  logger.debug(`Jenkins branch result: ${result}`);
  return result;
}

function getBranchFromBuildkite(): string | null {
  logger.debug(`Buildkite branch detection - BUILDKITE_BRANCH: ${process.env.BUILDKITE_BRANCH}`);
  const result = process.env.BUILDKITE_BRANCH || null;
  logger.debug(`Buildkite branch result: ${result}`);
  return result;
}

function getBranchFromAppVeyor(): string | null {
  logger.debug(`AppVeyor branch detection - APPVEYOR_REPO_BRANCH: ${process.env.APPVEYOR_REPO_BRANCH}, APPVEYOR_PULL_REQUEST_HEAD_REPO_BRANCH: ${process.env.APPVEYOR_PULL_REQUEST_HEAD_REPO_BRANCH}`);
  const result = process.env.APPVEYOR_REPO_BRANCH || process.env.APPVEYOR_PULL_REQUEST_HEAD_REPO_BRANCH || null;
  logger.debug(`AppVeyor branch result: ${result}`);
  return result;
}

function getBranchFromAzure(): string | null {
  logger.debug(`Azure branch detection - BUILD_SOURCEBRANCH: ${process.env.BUILD_SOURCEBRANCH}, SYSTEM_PULLREQUEST_SOURCEBRANCH: ${process.env.SYSTEM_PULLREQUEST_SOURCEBRANCH}`);
  const result = process.env.BUILD_SOURCEBRANCH?.replace('refs/heads/', '') || process.env.SYSTEM_PULLREQUEST_SOURCEBRANCH || null;
  logger.debug(`Azure branch result: ${result}`);
  return result;
}

function getBranchFromBitbucket(): string | null {
  logger.debug(`Bitbucket branch detection - BITBUCKET_BRANCH: ${process.env.BITBUCKET_BRANCH}`);
  const result = process.env.BITBUCKET_BRANCH || null;
  logger.debug(`Bitbucket branch result: ${result}`);
  return result;
}

function getBranchFromDrone(): string | null {
  logger.debug(`Drone branch detection - DRONE_BRANCH: ${process.env.DRONE_BRANCH}, DRONE_SOURCE_BRANCH: ${process.env.DRONE_SOURCE_BRANCH}`);
  const result = process.env.DRONE_BRANCH || process.env.DRONE_SOURCE_BRANCH || null;
  logger.debug(`Drone branch result: ${result}`);
  return result;
}

function getBranchFromSemaphore(): string | null {
  logger.debug(`Semaphore branch detection - SEMAPHORE_GIT_BRANCH: ${process.env.SEMAPHORE_GIT_BRANCH}, SEMAPHORE_GIT_PR_BRANCH: ${process.env.SEMAPHORE_GIT_PR_BRANCH}`);
  const result = process.env.SEMAPHORE_GIT_BRANCH || process.env.SEMAPHORE_GIT_PR_BRANCH || null;
  logger.debug(`Semaphore branch result: ${result}`);
  return result;
}

function getBranchFromTeamCity(): string | null {
  logger.debug(`TeamCity branch detection - BUILD_VCS_BRANCH: ${process.env.BUILD_VCS_BRANCH}`);
  const result = process.env.BUILD_VCS_BRANCH || null;
  logger.debug(`TeamCity branch result: ${result}`);
  return result;
}

function getBranchFromBamboo(): string | null {
  logger.debug(`Bamboo branch detection - bamboo_planRepository_branch: ${process.env.bamboo_planRepository_branch}`);
  const result = process.env.bamboo_planRepository_branch || null;
  logger.debug(`Bamboo branch result: ${result}`);
  return result;
}

function getBranchFromCodeship(): string | null {
  logger.debug(`Codeship branch detection - CI_BRANCH: ${process.env.CI_BRANCH}`);
  const result = process.env.CI_BRANCH || null;
  logger.debug(`Codeship branch result: ${result}`);
  return result;
}

function getBranchFromAWS(): string | null {
  logger.debug(`AWS branch detection - CODEBUILD_WEBHOOK_HEAD_REF: ${process.env.CODEBUILD_WEBHOOK_HEAD_REF}`);
  const result = process.env.CODEBUILD_WEBHOOK_HEAD_REF?.replace('refs/heads/', '') || null;
  logger.debug(`AWS branch result: ${result}`);
  return result;
}

// Provider-specific commit extraction functions
function getCommitFromProvider(provider: CIProvider): string | null {
  logger.debug(`Extracting commit from provider: ${provider}`);
  
  let result: string | null = null;
  
  switch (provider) {
    case 'github':
      result = process.env.GITHUB_SHA || null;
      logger.debug(`GitHub commit: GITHUB_SHA=${process.env.GITHUB_SHA} -> ${result}`);
      break;
    case 'gitlab':
      result = process.env.CI_COMMIT_SHA || process.env.GITLAB_COMMIT_SHA || null;
      logger.debug(`GitLab commit: CI_COMMIT_SHA=${process.env.CI_COMMIT_SHA}, GITLAB_COMMIT_SHA=${process.env.GITLAB_COMMIT_SHA} -> ${result}`);
      break;
    case 'circle':
      result = process.env.CIRCLE_SHA1 || null;
      logger.debug(`CircleCI commit: CIRCLE_SHA1=${process.env.CIRCLE_SHA1} -> ${result}`);
      break;
    case 'travis':
      result = process.env.TRAVIS_COMMIT || null;
      logger.debug(`Travis commit: TRAVIS_COMMIT=${process.env.TRAVIS_COMMIT} -> ${result}`);
      break;
    case 'jenkins':
      result = process.env.GIT_COMMIT || null;
      logger.debug(`Jenkins commit: GIT_COMMIT=${process.env.GIT_COMMIT} -> ${result}`);
      break;
    case 'buildkite':
      result = process.env.BUILDKITE_COMMIT || null;
      logger.debug(`Buildkite commit: BUILDKITE_COMMIT=${process.env.BUILDKITE_COMMIT} -> ${result}`);
      break;
    case 'appveyor':
      result = process.env.APPVEYOR_REPO_COMMIT || null;
      logger.debug(`AppVeyor commit: APPVEYOR_REPO_COMMIT=${process.env.APPVEYOR_REPO_COMMIT} -> ${result}`);
      break;
    case 'azure':
      result = process.env.BUILD_SOURCEVERSION || null;
      logger.debug(`Azure commit: BUILD_SOURCEVERSION=${process.env.BUILD_SOURCEVERSION} -> ${result}`);
      break;
    case 'bitbucket':
      result = process.env.BITBUCKET_COMMIT || null;
      logger.debug(`Bitbucket commit: BITBUCKET_COMMIT=${process.env.BITBUCKET_COMMIT} -> ${result}`);
      break;
    case 'drone':
      result = process.env.DRONE_COMMIT || process.env.DRONE_COMMIT_SHA || null;
      logger.debug(`Drone commit: DRONE_COMMIT=${process.env.DRONE_COMMIT}, DRONE_COMMIT_SHA=${process.env.DRONE_COMMIT_SHA} -> ${result}`);
      break;
    case 'semaphore':
      result = process.env.SEMAPHORE_GIT_SHA || null;
      logger.debug(`Semaphore commit: SEMAPHORE_GIT_SHA=${process.env.SEMAPHORE_GIT_SHA} -> ${result}`);
      break;
    case 'teamcity':
      result = process.env.BUILD_VCS_NUMBER || null;
      logger.debug(`TeamCity commit: BUILD_VCS_NUMBER=${process.env.BUILD_VCS_NUMBER} -> ${result}`);
      break;
    case 'bamboo':
      result = process.env.bamboo_planRepository_revision || null;
      logger.debug(`Bamboo commit: bamboo_planRepository_revision=${process.env.bamboo_planRepository_revision} -> ${result}`);
      break;
    case 'codeship':
      result = process.env.CI_COMMIT_ID || null;
      logger.debug(`Codeship commit: CI_COMMIT_ID=${process.env.CI_COMMIT_ID} -> ${result}`);
      break;
    case 'aws':
      result = process.env.CODEBUILD_RESOLVED_SOURCE_VERSION || null;
      logger.debug(`AWS commit: CODEBUILD_RESOLVED_SOURCE_VERSION=${process.env.CODEBUILD_RESOLVED_SOURCE_VERSION} -> ${result}`);
      break;
    default:
      result = null;
      break;
  }
  
  logger.debug(`Commit extraction result for ${provider}: ${result}`);
  return result;
}

// Provider-specific author extraction functions
function getAuthorFromProvider(provider: CIProvider): string | null {
  switch (provider) {
    case 'github':
      return getGitHubAuthor();
    case 'gitlab':
      return getGitLabAuthor();
    case 'circle':
      return getCircleCIAuthor();
    case 'travis':
      return getTravisAuthor();
    case 'jenkins':
      return getJenkinsAuthor();
    case 'buildkite':
      return getBuildkiteAuthor();
    case 'appveyor':
      return getAppVeyorAuthor();
    case 'azure':
      return getAzureAuthor();
    case 'bitbucket':
      return getBitbucketAuthor();
    case 'drone':
      return getDroneAuthor();
    case 'semaphore':
      return getSemaphoreAuthor();
    case 'teamcity':
      return getTeamCityAuthor();
    case 'bamboo':
      return getBambooAuthor();
    case 'codeship':
      return getCodeshipAuthor();
    case 'aws':
      return getAWSAuthor();
    default:
      return null;
  }
}

function getGitHubAuthor(): string | null {
  logger.debug(`GitHub author detection - GITHUB_ACTOR: ${process.env.GITHUB_ACTOR}, GITHUB_ACTOR_EMAIL: ${process.env.GITHUB_ACTOR_EMAIL}`);
  const actor = process.env.GITHUB_ACTOR;
  const email = process.env.GITHUB_ACTOR_EMAIL;
  logger.debug(`GitHub author result: ${actor ? (email ? `${actor} (${email})` : actor) : null}`);
  return actor ? (email ? `${actor} (${email})` : actor) : null;
}

function getGitLabAuthor(): string | null {
  logger.debug(`GitLab author detection - GITLAB_USER_NAME: ${process.env.GITLAB_USER_NAME}, CI_COMMIT_AUTHOR: ${process.env.CI_COMMIT_AUTHOR}`);
  const name = process.env.GITLAB_USER_NAME || process.env.CI_COMMIT_AUTHOR;
  const email = process.env.GITLAB_USER_EMAIL || process.env.CI_COMMIT_AUTHOR_EMAIL;
  logger.debug(`GitLab author result: ${name ? (email ? `${name} (${email})` : name) : null}`);
  return name ? (email ? `${name} (${email})` : name) : null;
}

function getCircleCIAuthor(): string | null {
  logger.debug(`CircleCI author detection - CIRCLE_USERNAME: ${process.env.CIRCLE_USERNAME}`);
  const username = process.env.CIRCLE_USERNAME;
  logger.debug(`CircleCI author result: ${username || null}`);
  return username || null;
}

function getTravisAuthor(): string | null {
  logger.debug(`Travis author detection - TRAVIS_COMMIT_AUTHOR: ${process.env.TRAVIS_COMMIT_AUTHOR}, TRAVIS_COMMIT_AUTHOR_EMAIL: ${process.env.TRAVIS_COMMIT_AUTHOR_EMAIL}`);
  const author = process.env.TRAVIS_COMMIT_AUTHOR;
  const email = process.env.TRAVIS_COMMIT_AUTHOR_EMAIL;
  logger.debug(`Travis author result: ${author ? (email ? `${author} (${email})` : author) : null}`);
  return author ? (email ? `${author} (${email})` : author) : null;
}

function getJenkinsAuthor(): string | null {
  logger.debug(`Jenkins author detection - GIT_AUTHOR_NAME: ${process.env.GIT_AUTHOR_NAME}, GIT_AUTHOR_EMAIL: ${process.env.GIT_AUTHOR_EMAIL}`);
  const author = process.env.GIT_AUTHOR_NAME;
  const email = process.env.GIT_AUTHOR_EMAIL;
  logger.debug(`Jenkins author result: ${author ? (email ? `${author} (${email})` : author) : null}`);
  return author ? (email ? `${author} (${email})` : author) : null;
}

function getBuildkiteAuthor(): string | null {
  logger.debug(`Buildkite author detection - BUILDKITE_BUILD_CREATOR: ${process.env.BUILDKITE_BUILD_CREATOR}`);
  const result = process.env.BUILDKITE_BUILD_CREATOR || null;
  logger.debug(`Buildkite author result: ${result}`);
  return result;
}

function getAppVeyorAuthor(): string | null {
  logger.debug(`AppVeyor author detection - APPVEYOR_REPO_COMMIT_AUTHOR: ${process.env.APPVEYOR_REPO_COMMIT_AUTHOR}, APPVEYOR_REPO_COMMIT_AUTHOR_EMAIL: ${process.env.APPVEYOR_REPO_COMMIT_AUTHOR_EMAIL}`);
  const author = process.env.APPVEYOR_REPO_COMMIT_AUTHOR;
  const email = process.env.APPVEYOR_REPO_COMMIT_AUTHOR_EMAIL;
  logger.debug(`AppVeyor author result: ${author ? (email ? `${author} (${email})` : author) : null}`);
  return author ? (email ? `${author} (${email})` : author) : null;
}

function getAzureAuthor(): string | null {
  logger.debug(`Azure author detection - BUILD_REQUESTEDFOR: ${process.env.BUILD_REQUESTEDFOR}, BUILD_REQUESTEDFOREMAIL: ${process.env.BUILD_REQUESTEDFOREMAIL}`);
  const author = process.env.BUILD_REQUESTEDFOR;
  const email = process.env.BUILD_REQUESTEDFOREMAIL;
  logger.debug(`Azure author result: ${author ? (email ? `${author} (${email})` : author) : null}`);
  return author ? (email ? `${author} (${email})` : author) : null;
}

function getBitbucketAuthor(): string | null {
  logger.debug(`Bitbucket author detection - BITBUCKET_COMMIT_AUTHOR: ${process.env.BITBUCKET_COMMIT_AUTHOR}`);
  const result = process.env.BITBUCKET_COMMIT_AUTHOR || null;
  logger.debug(`Bitbucket author result: ${result}`);
  return result;
}

function getDroneAuthor(): string | null {
  logger.debug(`Drone author detection - DRONE_COMMIT_AUTHOR: ${process.env.DRONE_COMMIT_AUTHOR}, DRONE_COMMIT_AUTHOR_EMAIL: ${process.env.DRONE_COMMIT_AUTHOR_EMAIL}`);
  const result = process.env.DRONE_COMMIT_AUTHOR || null;
  const email = process.env.DRONE_COMMIT_AUTHOR_EMAIL;
  logger.debug(`Drone author result: ${result ? (email ? `${result} (${email})` : result) : null}`);
  return result ? (email ? `${result} (${email})` : result) : null;
}

function getSemaphoreAuthor(): string | null {
  logger.debug(`Semaphore author detection - SEMAPHORE_GIT_AUTHOR: ${process.env.SEMAPHORE_GIT_AUTHOR}, SEMAPHORE_GIT_AUTHOR_EMAIL: ${process.env.SEMAPHORE_GIT_AUTHOR_EMAIL}`);
  const result = process.env.SEMAPHORE_GIT_AUTHOR || null;
  const email = process.env.SEMAPHORE_GIT_AUTHOR_EMAIL;
  logger.debug(`Semaphore author result: ${result ? (email ? `${result} (${email})` : result) : null}`);
  return result ? (email ? `${result} (${email})` : result) : null;
}

function getTeamCityAuthor(): string | null {
  logger.debug(`TeamCity author detection - BUILD_VCS_AUTHOR: ${process.env.BUILD_VCS_AUTHOR}`);
  const result = process.env.BUILD_VCS_AUTHOR || null;
  logger.debug(`TeamCity author result: ${result}`);
  return result;
}

function getBambooAuthor(): string | null {
  logger.debug(`Bamboo author detection - bamboo_planRepository_username: ${process.env.bamboo_planRepository_username}`);
  const result = process.env.bamboo_planRepository_username || null;
  logger.debug(`Bamboo author result: ${result}`);
  return result;
}

function getCodeshipAuthor(): string | null {
  logger.debug(`Codeship author detection - CI_COMMITTER_NAME: ${process.env.CI_COMMITTER_NAME}`);
  const result = process.env.CI_COMMITTER_NAME || null;
  logger.debug(`Codeship author result: ${result}`);
  return result;
}

function getAWSAuthor(): string | null {
  logger.debug(`AWS author detection - CODEBUILD_INITIATOR: ${process.env.CODEBUILD_INITIATOR}`);
  const result = process.env.CODEBUILD_INITIATOR || null;
  logger.debug(`AWS author result: ${result}`);
  return result;
}

// Provider-specific committer extraction functions
function getCommitterFromProvider(provider: CIProvider): string | null {
  // For most CI providers, committer is the same as author
  // Only differentiate where providers explicitly provide committer info
  switch (provider) {
    case 'jenkins':
      return getJenkinsCommitter();
    case 'gitlab':
      return getGitLabCommitter();
    default:
      // For most providers, fallback to author info or generic env vars
      return getGenericCommitter();
  }
}

function getJenkinsCommitter(): string | null {
  logger.debug(`Jenkins committer detection - GIT_COMMITTER_NAME: ${process.env.GIT_COMMITTER_NAME}, GIT_COMMITTER_EMAIL: ${process.env.GIT_COMMITTER_EMAIL}`);
  const result = process.env.GIT_COMMITTER_NAME || null;
  const email = process.env.GIT_COMMITTER_EMAIL;
  logger.debug(`Jenkins committer result: ${result ? (email ? `${result} (${email})` : result) : null}`);
  return result ? (email ? `${result} (${email})` : result) : null;
}

function getGitLabCommitter(): string | null {
  logger.debug(`GitLab committer detection - CI_COMMIT_COMMITTER: ${process.env.CI_COMMIT_COMMITTER}, CI_COMMIT_COMMITTER_EMAIL: ${process.env.CI_COMMIT_COMMITTER_EMAIL}`);
  const result = process.env.CI_COMMIT_COMMITTER || null;
  const email = process.env.CI_COMMIT_COMMITTER_EMAIL;
  logger.debug(`GitLab committer result: ${result ? (email ? `${result} (${email})` : result) : null}`);
  return result ? (email ? `${result} (${email})` : result) : null;
}

function getGenericCommitter(): string | null {
  logger.debug(`Generic committer detection - GIT_COMMITTER_NAME: ${process.env.GIT_COMMITTER_NAME}, COMMIT_COMMITTER: ${process.env.COMMIT_COMMITTER}`);
  const result = process.env.GIT_COMMITTER_NAME || process.env.COMMIT_COMMITTER || null;
  const email = process.env.GIT_COMMITTER_EMAIL || process.env.COMMIT_COMMITTER_EMAIL;
  logger.debug(`Generic committer result: ${result ? (email ? `${result} (${email})` : result) : null}`);
  return result ? (email ? `${result} (${email})` : result) : null;
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
  console.log('[DEBUG] getGitInfo > Environment variables:', {
    GITHUB_ACTIONS: process.env.GITHUB_ACTIONS,
    GITHUB_REF_NAME: process.env.GITHUB_REF_NAME,
    GITHUB_SHA: process.env.GITHUB_SHA,
    GITHUB_REF: process.env.GITHUB_REF,
  });
  logger.info('Starting git information extraction...');
  
  const ciProvider = detectCIProvider();
  const isCI = ciProvider !== 'unknown';
  
  logger.info(`Environment type: ${isCI ? 'CI' : 'Local Development'}`);
  if (isCI) {
    logger.info(`CI Provider: ${ciProvider}`);
  }
  
  let branch: string;
  let commit: string;
  let author: string;
  let committer: string;
  
  if (isCI) {
    // In CI, try provider-specific environment variables first, then fallback to git commands
    logger.debug('Extracting git info from CI environment variables...');
    
    const providerBranch = getBranchFromProvider(ciProvider);
    const gitBranch = providerBranch || getBranchFromGit();
    branch = gitBranch || 'unknown';
    logger.debug(`Branch resolution: provider(${providerBranch}) -> git(${gitBranch}) -> final(${branch})`);
    
    const providerCommit = getCommitFromProvider(ciProvider);
    const gitCommit = providerCommit || runGitCommand('git rev-parse HEAD');
    commit = gitCommit || 'unknown';
    logger.debug(`Commit resolution: provider(${providerCommit}) -> git(${gitCommit}) -> final(${commit})`);
    
    const providerAuthor = getAuthorFromProvider(ciProvider);
    const gitAuthor = providerAuthor || getAuthorFromGit();
    author = gitAuthor || 'unknown';
    logger.debug(`Author resolution: provider(${providerAuthor}) -> git(${gitAuthor}) -> final(${author})`);
    
    const providerCommitter = getCommitterFromProvider(ciProvider);
    const gitCommitter = providerCommitter || getCommitterFromGit();
    committer = gitCommitter || 'unknown';
    logger.debug(`Committer resolution: provider(${providerCommitter}) -> git(${gitCommitter}) -> final(${committer})`);
  } else {
    // Local development - use git commands
    logger.debug('Extracting git info from local git commands...');
    
    branch = getBranchFromGit() || 'unknown';
    commit = runGitCommand('git rev-parse HEAD') || 'unknown';
    author = getAuthorFromGit() || 'unknown';
    committer = getCommitterFromGit() || 'unknown';
    
    logger.debug(`Local git extraction - branch: ${branch}, commit: ${commit}, author: ${author}, committer: ${committer}`);
  }

  const result = {
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

