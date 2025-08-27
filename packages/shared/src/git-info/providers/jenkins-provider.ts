// Jenkins CI provider
import { BaseCIProvider } from '../base-provider';
import { CIProvider } from '../types';

export class JenkinsProvider extends BaseCIProvider {
  getName(): CIProvider {
    return 'jenkins';
  }

  detect(): boolean {
    const result = this.hasAnyEnv('JENKINS_URL', 'BUILD_NUMBER');
    this.logger.debug(`Checking Jenkins: JENKINS_URL=${this.getEnv('JENKINS_URL')}, BUILD_NUMBER=${this.getEnv('BUILD_NUMBER')} -> ${result}`);
    return result;
  }

  protected getBranch(): string | null {
    this.logger.debug(`Jenkins branch detection - BRANCH_NAME: ${this.getEnv('BRANCH_NAME')}, GIT_BRANCH: ${this.getEnv('GIT_BRANCH')}`);
    
    // First try BRANCH_NAME
    let result = this.getEnv('BRANCH_NAME') || null;
    
    // If not available, try GIT_BRANCH and clean it up
    if (!result) {
      const gitBranch = this.getEnv('GIT_BRANCH');
      if (gitBranch) {
        result = gitBranch.replace('origin/', '');
      }
    }
    
    this.logger.debug(`Jenkins branch result: ${result}`);
    return result;
  }

  protected getCommit(): string | null {
    const result = this.getEnv('GIT_COMMIT') || null;
    this.logger.debug(`Jenkins commit: GIT_COMMIT=${this.getEnv('GIT_COMMIT')} -> ${result}`);
    return result;
  }

  protected getAuthor(): string | null {
    this.logger.debug(`Jenkins author detection - GIT_AUTHOR_NAME: ${this.getEnv('GIT_AUTHOR_NAME')}, GIT_AUTHOR_EMAIL: ${this.getEnv('GIT_AUTHOR_EMAIL')}`);
    const name = this.getEnv('GIT_AUTHOR_NAME');
    const email = this.getEnv('GIT_AUTHOR_EMAIL');
    const result = this.formatPersonWithEmail(name, email);
    this.logger.debug(`Jenkins author result: ${result}`);
    return result;
  }

  protected getCommitter(): string | null {
    this.logger.debug(`Jenkins committer detection - GIT_COMMITTER_NAME: ${this.getEnv('GIT_COMMITTER_NAME')}, GIT_COMMITTER_EMAIL: ${this.getEnv('GIT_COMMITTER_EMAIL')}`);
    const name = this.getEnv('GIT_COMMITTER_NAME');
    const email = this.getEnv('GIT_COMMITTER_EMAIL');
    const result = this.formatPersonWithEmail(name, email);
    this.logger.debug(`Jenkins committer result: ${result}`);
    return result;
  }
}
