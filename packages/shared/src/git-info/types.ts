// Types and interfaces for git-info module

export type CIProvider = 
  | 'github' 
  | 'gitlab' 
  | 'circle' 
  | 'travis' 
  | 'jenkins' 
  | 'buildkite' 
  | 'appveyor' 
  | 'azure' 
  | 'bitbucket' 
  | 'drone' 
  | 'semaphore' 
  | 'teamcity' 
  | 'bamboo' 
  | 'codeship' 
  | 'aws' 
  | 'unknown';

export interface GitInfo {
  branch: string;
  commit: string;
  author: string;
  committer: string;
  isCI: boolean;
  ciProvider?: CIProvider;
}

export interface CIProviderInfo {
  branch: string | null;
  commit: string | null;
  author: string | null;
  committer: string | null;
}

export interface CIProviderConfig {
  name: CIProvider;
  provider: CIProviderDetector;
}

export interface CIProviderDetector {
  /**
   * Detect if this CI provider is currently running
   */
  detect(): boolean;
  
  /**
   * Get git information from this CI provider's environment variables
   */
  getGitInfo(): CIProviderInfo;
  
  /**
   * Get the provider name
   */
  getName(): CIProvider;
}
