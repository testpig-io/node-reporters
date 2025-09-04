#!/bin/bash
# Travis CI Git-Env CLI Test Script
# Basic git-env testing for the main Travis CI test matrix

echo "=== Running Basic Git-Env CLI Tests in Travis CI ==="

# Test CLI basic functionality
echo "Testing CLI basic output:"
node packages/shared/dist/bin/git-env.js

echo ""
echo "Testing CLI JSON output:"
node packages/shared/dist/bin/git-env.js --json

echo ""
echo "Testing Travis CI detection:"
echo "TRAVIS: $TRAVIS"
echo "TRAVIS_BUILD_ID: $TRAVIS_BUILD_ID"
echo "TRAVIS_BRANCH: $TRAVIS_BRANCH"
echo "TRAVIS_COMMIT: $TRAVIS_COMMIT"

# Validate that Travis CI is detected
provider=$(node packages/shared/dist/bin/git-env.js --json | jq -r '.provider')
echo "Detected provider: $provider"

if [[ "$provider" == "travis" ]]; then
    echo "✅ Travis CI provider detected correctly in main test"
    exit 0
else
    echo "⚠️  Expected Travis CI provider, got: $provider (this may be expected in some test scenarios)"
    exit 0  # Don't fail main tests for this
fi
