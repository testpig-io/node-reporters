// Base abstract class for CI providers
import { CIProvider, CIProviderDetector, CIProviderInfo } from './types';
import { createLogger } from '../logger';

export abstract class BaseCIProvider implements CIProviderDetector {
  protected logger = createLogger(`GitInfo:${this.getName()}`);

  /**
   * Abstract method to detect if this CI provider is running
   */
  abstract detect(): boolean;

  /**
   * Abstract method to get the provider name
   */
  abstract getName(): CIProvider;

  /**
   * Get git information from this CI provider
   */
  getGitInfo(): CIProviderInfo {
    this.logger.debug(`Extracting git info from ${this.getName()}`);
    
    const result: CIProviderInfo = {
      branch: this.getBranch(),
      commit: this.getCommit(),
      author: this.getAuthor(),
      committer: this.getCommitter()
    };

    this.logger.debug(`Git info extraction result for ${this.getName()}:`, result);
    return result;
  }

  /**
   * Abstract method to get branch information
   */
  protected abstract getBranch(): string | null;

  /**
   * Abstract method to get commit information
   */
  protected abstract getCommit(): string | null;

  /**
   * Abstract method to get author information
   */
  protected abstract getAuthor(): string | null;

  /**
   * Abstract method to get committer information
   * Default implementation returns null (most providers don't have specific committer info)
   */
  protected getCommitter(): string | null {
    return null;
  }

  /**
   * Helper method to safely get environment variable
   */
  protected getEnv(name: string): string | undefined {
    return process.env[name];
  }

  /**
   * Helper method to format author/committer with email
   */
  protected formatPersonWithEmail(name: string | undefined, email: string | undefined): string | null {
    if (!name) return null;
    return email ? `${name} (${email})` : name;
  }

  /**
   * Helper method to check if any of the provided environment variables are set
   */
  protected hasAnyEnv(...names: string[]): boolean {
    return names.some(name => !!process.env[name]);
  }

  /**
   * Helper method to get the first available environment variable value
   */
  protected getFirstAvailableEnv(...names: string[]): string | null {
    for (const name of names) {
      const value = process.env[name];
      if (value) return value;
    }
    return null;
  }
}
