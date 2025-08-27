// CircleCI provider
import { BaseCIProvider } from '../base-provider';
import { CIProvider } from '../types';

export class CircleProvider extends BaseCIProvider {
  getName(): CIProvider {
    return 'circle';
  }

  detect(): boolean {
    const result = this.hasAnyEnv('CIRCLECI', 'CIRCLE_WORKFLOW_ID', 'CIRCLE_BUILD_NUM');
    this.logger.debug(`Checking CircleCI: CIRCLECI=${this.getEnv('CIRCLECI')}, CIRCLE_WORKFLOW_ID=${this.getEnv('CIRCLE_WORKFLOW_ID')}, CIRCLE_BUILD_NUM=${this.getEnv('CIRCLE_BUILD_NUM')} -> ${result}`);
    return result;
  }

  protected getBranch(): string | null {
    this.logger.debug(`CircleCI branch detection - CIRCLE_BRANCH: ${this.getEnv('CIRCLE_BRANCH')}`);
    const result = this.getEnv('CIRCLE_BRANCH') || null;
    this.logger.debug(`CircleCI branch result: ${result}`);
    return result;
  }

  protected getCommit(): string | null {
    const result = this.getEnv('CIRCLE_SHA1') || null;
    this.logger.debug(`CircleCI commit: CIRCLE_SHA1=${this.getEnv('CIRCLE_SHA1')} -> ${result}`);
    return result;
  }

  protected getAuthor(): string | null {
    this.logger.debug(`CircleCI author detection - CIRCLE_USERNAME: ${this.getEnv('CIRCLE_USERNAME')}`);
    const result = this.getEnv('CIRCLE_USERNAME') || null;
    this.logger.debug(`CircleCI author result: ${result}`);
    return result;
  }
}
