// Generic committer detection for providers that don't have specific committer info
import { createLogger } from '../logger';

const logger = createLogger('GitInfo:GenericCommitter');

export function getGenericCommitter(): string | null {
  logger.debug(`Generic committer detection - GIT_COMMITTER_NAME: ${process.env.GIT_COMMITTER_NAME}, COMMIT_COMMITTER: ${process.env.COMMIT_COMMITTER}`);
  
  const name = process.env.GIT_COMMITTER_NAME || process.env.COMMIT_COMMITTER;
  const email = process.env.GIT_COMMITTER_EMAIL || process.env.COMMIT_COMMITTER_EMAIL;
  
  const result = name ? (email ? `${name} (${email})` : name) : null;
  logger.debug(`Generic committer result: ${result}`);
  
  return result;
}
