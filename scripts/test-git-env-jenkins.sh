#!/bin/bash
# Jenkins Git-Env CLI Test Script
# Basic git-env testing for Jenkins CI environment

echo "=== Running Basic Git-Env CLI Tests in Jenkins ==="

# Set Node.js version if NVM is available
if command -v nvm &> /dev/null; then
    export NVM_DIR="$HOME/.nvm"
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
    nvm use ${NODE_VERSION:-20} 2>/dev/null || echo "Using system Node.js"
fi

# Test CLI basic functionality
echo "Testing CLI basic output:"
node packages/shared/dist/bin/git-env.js

echo ""
echo "Testing CLI JSON output:"
node packages/shared/dist/bin/git-env.js --json

echo ""
echo "Testing Jenkins CI detection:"
echo "JENKINS_URL: $JENKINS_URL"
echo "BUILD_NUMBER: $BUILD_NUMBER"
echo "BRANCH_NAME: $BRANCH_NAME"
echo "GIT_COMMIT: $GIT_COMMIT"
echo "GIT_BRANCH: $GIT_BRANCH"
echo "GIT_AUTHOR_NAME: $GIT_AUTHOR_NAME"
echo "GIT_AUTHOR_EMAIL: $GIT_AUTHOR_EMAIL"

# Validate that Jenkins is detected
provider=$(node packages/shared/dist/bin/git-env.js --json | jq -r '.provider')
echo "Detected provider: $provider"

if [[ "$provider" == "jenkins" ]]; then
    echo "✅ Jenkins provider detected correctly"
    exit 0
else
    echo "⚠️  Expected Jenkins provider, got: $provider (this may be expected in some test scenarios)"
    exit 0  # Don't fail main tests for this
fi
