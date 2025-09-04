// GitHub Actions CI provider
import { BaseCIProvider } from '../base-provider';
import { CIProvider } from '../types';

export class GitHubProvider extends BaseCIProvider {
  getName(): CIProvider {
    return 'github';
  }

  detect(): boolean {
    const result = this.hasAnyEnv('GITHUB_ACTIONS', 'GITHUB_RUN_ID');
    this.logger.debug(`Checking GitHub Actions: GITHUB_ACTIONS=${this.getEnv('GITHUB_ACTIONS')}, GITHUB_RUN_ID=${this.getEnv('GITHUB_RUN_ID')} -> ${result}`);
    return result;
  }

  protected getBranch(): string | null {
    this.logger.debug(`GitHub branch detection - GITHUB_EVENT_NAME: ${this.getEnv('GITHUB_EVENT_NAME')}, GITHUB_HEAD_REF: ${this.getEnv('GITHUB_HEAD_REF')}, GITHUB_REF_NAME: ${this.getEnv('GITHUB_REF_NAME')}, GITHUB_REF: ${this.getEnv('GITHUB_REF')}`);
    
    // For Pull Requests - prioritize GITHUB_HEAD_REF (the actual PR branch)
    if (this.getEnv('GITHUB_EVENT_NAME') === 'pull_request' && this.getEnv('GITHUB_HEAD_REF')) {
      this.logger.debug(`Using GITHUB_HEAD_REF for PR: ${this.getEnv('GITHUB_HEAD_REF')}`);
      return this.getEnv('GITHUB_HEAD_REF') || null;
    }
    
    // For regular pushes or when GITHUB_HEAD_REF is not available - use GITHUB_REF_NAME
    if (this.getEnv('GITHUB_REF_NAME')) {
      this.logger.debug(`Using GITHUB_REF_NAME: ${this.getEnv('GITHUB_REF_NAME')}`);
      return this.getEnv('GITHUB_REF_NAME') || null;
    }
    
    // Fallback logic for older GitHub Actions or edge cases
    const githubRef = this.getEnv('GITHUB_REF');
    if (githubRef) {
      if (githubRef.startsWith('refs/heads/')) {
        const branch = githubRef.replace('refs/heads/', '');
        this.logger.debug(`Extracted branch from GITHUB_REF: ${branch}`);
        return branch;
      } else if (githubRef.startsWith('refs/pull/')) {
        const prBranch = `PR-${githubRef.split('/')[2]}`;
        this.logger.debug(`Extracted PR branch from GITHUB_REF: ${prBranch}`);
        return prBranch;
      }
    }
    
    // Final fallback - GITHUB_HEAD_REF (for PRs where event name might not be set correctly)
    if (this.getEnv('GITHUB_HEAD_REF')) {
      this.logger.debug(`Using GITHUB_HEAD_REF as fallback: ${this.getEnv('GITHUB_HEAD_REF')}`);
      return this.getEnv('GITHUB_HEAD_REF') || null;
    }
    
    this.logger.debug('No GitHub branch environment variables found');
    return null;
  }

  protected getCommit(): string | null {
    const result = this.getEnv('GITHUB_SHA') || null;
    this.logger.debug(`GitHub commit: GITHUB_SHA=${this.getEnv('GITHUB_SHA')} -> ${result}`);
    return result;
  }

  protected getAuthor(): string | null {
    this.logger.debug(`GitHub author detection - GITHUB_EVENT_NAME: ${this.getEnv('GITHUB_EVENT_NAME')}, GITHUB_ACTOR: ${this.getEnv('GITHUB_ACTOR')}, GITHUB_ACTOR_EMAIL: ${this.getEnv('GITHUB_ACTOR_EMAIL')}`);
    
    // For pull requests, prioritize git commit author over GitHub Actor
    // This avoids the noreply@github.com issue when the workflow actor differs from commit author
    if (this.getEnv('GITHUB_EVENT_NAME') === 'pull_request') {
      this.logger.debug('Pull request detected - using git commit author instead of GitHub Actor');
      return null; // Let git commands handle this for more accurate PR author info
    }
    
    // For non-PR events (push, etc.), use GitHub Actor information
    const actor = this.getEnv('GITHUB_ACTOR');
    const email = this.getEnv('GITHUB_ACTOR_EMAIL');
    
    // Avoid using noreply emails when possible - let git commands provide better info
    if (email && email.includes('noreply.github.com')) {
      this.logger.debug('GitHub Actor has noreply email - letting git commands provide better author info');
      return null; // Fall back to git commands for better email
    }
    
    const result = this.formatPersonWithEmail(actor, email);
    this.logger.debug(`GitHub author result: ${result}`);
    return result;
  }

  protected getCommitter(): string | null {
    // GitHub Actions doesn't provide specific committer info, use generic fallback
    return null;
  }
}
