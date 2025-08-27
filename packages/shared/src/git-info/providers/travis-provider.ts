// Travis CI provider
import { BaseCIProvider } from '../base-provider';
import { CIProvider } from '../types';

export class TravisProvider extends BaseCIProvider {
  getName(): CIProvider {
    return 'travis';
  }

  detect(): boolean {
    const result = this.hasAnyEnv('TRAVIS', 'TRAVIS_BUILD_ID');
    this.logger.debug(`Checking Travis CI: TRAVIS=${this.getEnv('TRAVIS')}, TRAVIS_BUILD_ID=${this.getEnv('TRAVIS_BUILD_ID')} -> ${result}`);
    return result;
  }

  protected getBranch(): string | null {
    this.logger.debug(`Travis branch detection - TRAVIS_BRANCH: ${this.getEnv('TRAVIS_BRANCH')}, TRAVIS_PULL_REQUEST_BRANCH: ${this.getEnv('TRAVIS_PULL_REQUEST_BRANCH')}`);
    const result = this.getFirstAvailableEnv('TRAVIS_BRANCH', 'TRAVIS_PULL_REQUEST_BRANCH');
    this.logger.debug(`Travis branch result: ${result}`);
    return result;
  }

  protected getCommit(): string | null {
    const result = this.getEnv('TRAVIS_COMMIT') || null;
    this.logger.debug(`Travis commit: TRAVIS_COMMIT=${this.getEnv('TRAVIS_COMMIT')} -> ${result}`);
    return result;
  }

  protected getAuthor(): string | null {
    this.logger.debug(`Travis author detection - TRAVIS_COMMIT_AUTHOR: ${this.getEnv('TRAVIS_COMMIT_AUTHOR')}, TRAVIS_COMMIT_AUTHOR_EMAIL: ${this.getEnv('TRAVIS_COMMIT_AUTHOR_EMAIL')}`);
    const name = this.getEnv('TRAVIS_COMMIT_AUTHOR');
    const email = this.getEnv('TRAVIS_COMMIT_AUTHOR_EMAIL');
    const result = this.formatPersonWithEmail(name, email);
    this.logger.debug(`Travis author result: ${result}`);
    return result;
  }
}
