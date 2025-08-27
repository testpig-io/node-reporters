// GitLab CI provider
import { BaseCIProvider } from '../base-provider';
import { CIProvider } from '../types';

export class GitLabProvider extends BaseCIProvider {
  getName(): CIProvider {
    return 'gitlab';
  }

  detect(): boolean {
    const result = this.hasAnyEnv('GITLAB_CI', 'CI_PIPELINE_ID');
    this.logger.debug(`Checking GitLab CI: GITLAB_CI=${this.getEnv('GITLAB_CI')}, CI_PIPELINE_ID=${this.getEnv('CI_PIPELINE_ID')} -> ${result}`);
    return result;
  }

  protected getBranch(): string | null {
    this.logger.debug(`GitLab branch detection - CI_COMMIT_REF_NAME: ${this.getEnv('CI_COMMIT_REF_NAME')}, CI_MERGE_REQUEST_SOURCE_BRANCH_NAME: ${this.getEnv('CI_MERGE_REQUEST_SOURCE_BRANCH_NAME')}`);
    const result = this.getFirstAvailableEnv('CI_COMMIT_REF_NAME', 'CI_MERGE_REQUEST_SOURCE_BRANCH_NAME');
    this.logger.debug(`GitLab branch result: ${result}`);
    return result;
  }

  protected getCommit(): string | null {
    const result = this.getFirstAvailableEnv('CI_COMMIT_SHA', 'GITLAB_COMMIT_SHA');
    this.logger.debug(`GitLab commit: CI_COMMIT_SHA=${this.getEnv('CI_COMMIT_SHA')}, GITLAB_COMMIT_SHA=${this.getEnv('GITLAB_COMMIT_SHA')} -> ${result}`);
    return result;
  }

  protected getAuthor(): string | null {
    this.logger.debug(`GitLab author detection - GITLAB_USER_NAME: ${this.getEnv('GITLAB_USER_NAME')}, CI_COMMIT_AUTHOR: ${this.getEnv('CI_COMMIT_AUTHOR')}`);
    const name = this.getFirstAvailableEnv('GITLAB_USER_NAME', 'CI_COMMIT_AUTHOR');
    const email = this.getFirstAvailableEnv('GITLAB_USER_EMAIL', 'CI_COMMIT_AUTHOR_EMAIL');
    const result = this.formatPersonWithEmail(name || undefined, email || undefined);
    this.logger.debug(`GitLab author result: ${result}`);
    return result;
  }

  protected getCommitter(): string | null {
    this.logger.debug(`GitLab committer detection - CI_COMMIT_COMMITTER: ${this.getEnv('CI_COMMIT_COMMITTER')}, CI_COMMIT_COMMITTER_EMAIL: ${this.getEnv('CI_COMMIT_COMMITTER_EMAIL')}`);
    const name = this.getEnv('CI_COMMIT_COMMITTER');
    const email = this.getEnv('CI_COMMIT_COMMITTER_EMAIL');
    const result = this.formatPersonWithEmail(name, email);
    this.logger.debug(`GitLab committer result: ${result}`);
    return result;
  }
}
