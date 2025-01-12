import { execSync } from 'child_process';
import { GitDetails } from './types';

export function getGitInfo(): GitDetails {
    try {
        // Try to execute git rev-parse to check if we're in a git repo
        execSync('git rev-parse --git-dir', { stdio: 'ignore' });

        // If we are, get the git details
        return {
            user: execSync('git config user.name', { encoding: 'utf8' }).trim() || 'unknown',
            email: execSync('git config user.email', { encoding: 'utf8' }).trim() || 'unknown',
            branch: execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim() || 'unknown'
        };
    } catch (error) {
        // Return unknown values if any git command fails
        return {
            user: 'unknown',
            email: 'unknown',
            branch: 'unknown'
        };
    }
}