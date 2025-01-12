"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getGitInfo = getGitInfo;
const child_process_1 = require("child_process");
function getGitInfo() {
    try {
        // Try to execute git rev-parse to check if we're in a git repo
        (0, child_process_1.execSync)('git rev-parse --git-dir', { stdio: 'ignore' });
        // If we are, get the git details
        return {
            user: (0, child_process_1.execSync)('git config user.name', { encoding: 'utf8' }).trim() || 'unknown',
            email: (0, child_process_1.execSync)('git config user.email', { encoding: 'utf8' }).trim() || 'unknown',
            branch: (0, child_process_1.execSync)('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim() || 'unknown'
        };
    }
    catch (error) {
        // Return unknown values if any git command fails
        return {
            user: 'unknown',
            email: 'unknown',
            branch: 'unknown'
        };
    }
}
//# sourceMappingURL=githandler.js.map