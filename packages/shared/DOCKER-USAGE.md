# Docker Usage Guide for TestPig Git Environment CLI

This guide explains how to use the `testpig-git-env` CLI to pass git information to Docker containers across all CI environments.

## Quick Start

The `testpig-git-env` CLI automatically detects your CI environment and provides git information in multiple formats for easy Docker integration.

### Basic Usage

```bash
# Default Docker format
npx testpig-git-env
# Output: -e TESTPIG_GIT_BRANCH="main" -e TESTPIG_GIT_COMMIT="abc123" ...

# Use with Docker
docker run --rm $(npx testpig-git-env) my-test-image
```

## Output Formats

The CLI supports multiple output formats for different use cases:

### 1. Docker Format (Default)
```bash
npx testpig-git-env
# -e TESTPIG_GIT_BRANCH="main" -e TESTPIG_GIT_COMMIT="abc123" -e TESTPIG_GIT_AUTHOR="John Doe" -e TESTPIG_GIT_EMAIL="john@example.com" -e TESTPIG_CI_PROVIDER="github" -e TESTPIG_CI_IS_CI="true"
```

### 2. Shell Export Format
```bash
npx testpig-git-env --format=export
# export TESTPIG_GIT_BRANCH="main"
# export TESTPIG_GIT_COMMIT="abc123"
# export TESTPIG_GIT_AUTHOR="John Doe"
# export TESTPIG_GIT_EMAIL="john@example.com"
# export TESTPIG_CI_PROVIDER="github"
# export TESTPIG_CI_IS_CI="true"
```

### 3. Environment File Format
```bash
npx testpig-git-env --format=env
# TESTPIG_GIT_BRANCH=main
# TESTPIG_GIT_COMMIT=abc123
# TESTPIG_GIT_AUTHOR=John Doe
# TESTPIG_GIT_EMAIL=john@example.com
# TESTPIG_CI_PROVIDER=github
# TESTPIG_CI_IS_CI=true
```

### 4. JSON Format
```bash
npx testpig-git-env --format=json
# {
#   "branch": "main",
#   "commit": "abc123",
#   "author": "John Doe",
#   "email": "john@example.com",
#   "provider": "github",
#   "isCI": true
# }
```

## Docker Compose Integration

### Method 1: Shell Export (Recommended)

Set environment variables in your shell, then run docker-compose:

```bash
# Set variables in your shell
eval "$(npx testpig-git-env --format=export)"

# Run docker-compose (variables automatically inherited)
docker compose -f docker-compose.yml --profile tests run cypress-tests
```

**One-liner version:**
```bash
eval "$(npx testpig-git-env --format=export)" && docker compose -f docker-compose.yml --profile tests run cypress-tests
```

### Method 2: Environment File

Generate a `.env` file and use with `--env-file`:

```bash
# Generate environment file
npx testpig-git-env --format=env > .testpig.env

# Use with docker-compose
docker compose -f docker-compose.yml --profile tests --env-file .testpig.env run cypress-tests
```

### Method 3: Direct Docker Command

For simple `docker run` commands:

```bash
# Traditional approach
docker run --rm $(npx testpig-git-env) my-test-image

# With custom arguments
docker run --rm $(npx testpig-git-env) --volume ./data:/data my-test-image npm test
```

## Docker Compose Configuration

### Option A: No Environment Declaration (Simplest)

Your `docker-compose.yml` doesn't need to declare the variables:

```yaml
# docker-compose.yml
services:
  tests:
    image: my-test-image
    # No environment needed - variables inherited from shell
    command: npm test
```

### Option B: Explicit Declaration (Recommended)

For better documentation and validation:

```yaml
# docker-compose.yml
services:
  tests:
    image: my-test-image
    environment:
      # TestPig git information (inherited from shell)
      - TESTPIG_GIT_BRANCH
      - TESTPIG_GIT_COMMIT
      - TESTPIG_GIT_AUTHOR
      - TESTPIG_GIT_EMAIL
      - TESTPIG_CI_PROVIDER
      - TESTPIG_CI_IS_CI
      # Your existing environment variables
      - NODE_ENV=test
      - API_URL=http://localhost:3000
    command: npm test
```

## Environment Variables

The CLI provides these standardized environment variables:

| Variable | Description | Example |
|----------|-------------|---------|
| `TESTPIG_GIT_BRANCH` | Current git branch | `main`, `feature/auth` |
| `TESTPIG_GIT_COMMIT` | Current git commit SHA | `abc123def456...` |
| `TESTPIG_GIT_AUTHOR` | Git commit author name | `John Doe` |
| `TESTPIG_GIT_EMAIL` | Git commit author email | `john@example.com` |
| `TESTPIG_CI_PROVIDER` | CI provider name | `github`, `gitlab`, `circle`, etc. |
| `TESTPIG_CI_IS_CI` | Whether running in CI | `true`, `false` |

## CI Provider Support

The CLI automatically detects and supports:

- **GitHub Actions** - Uses `GITHUB_*` variables
- **GitLab CI** - Uses `CI_*` and `GITLAB_*` variables  
- **CircleCI** - Uses `CIRCLE_*` variables
- **Travis CI** - Uses `TRAVIS_*` variables
- **Jenkins** - Uses `JENKINS_*` and `GIT_*` variables
- **Local Development** - Falls back to git commands

## Override Variables

You can override any detected values by setting these environment variables:

```bash
# Override specific values
export TESTPIG_GIT_BRANCH="custom-branch"
export TESTPIG_GIT_AUTHOR="Custom Author"
export TESTPIG_GIT_EMAIL="custom@example.com"
export TESTPIG_CI_PROVIDER="custom-provider"

# Then run your command
npx testpig-git-env --format=export
```

## Real-World Examples

### Example 1: Cypress Tests in Docker Compose

```bash
# package.json
{
  "scripts": {
    "test:docker": "eval \"$(npx testpig-git-env --format=export)\" && docker compose run cypress-tests",
    "test:docker:debug": "npx testpig-git-env --verbose && npm run test:docker"
  }
}
```

### Example 2: Jest Tests with Environment File

```bash
# Generate environment file
npx testpig-git-env --format=env > .testpig.env

# docker-compose.yml
services:
  jest-tests:
    image: node:18
    env_file: .testpig.env
    command: npm test
```

### Example 3: Multi-Service Testing

```bash
# Set variables once
eval "$(npx testpig-git-env --format=export)"

# Run multiple test suites
docker compose run unit-tests
docker compose run integration-tests  
docker compose run e2e-tests
```

### Example 4: CI Pipeline

```yaml
# .github/workflows/test.yml
- name: Run Docker Tests
  run: |
    eval "$(npx testpig-git-env --format=export)"
    docker compose run tests
```

## Testing Your Setup

### Test Environment Variables

```bash
# Set variables
eval "$(npx testpig-git-env --format=export)"

# Check they're set
env | grep ^TESTPIG_

# Test with a simple container
docker run --rm alpine env | grep TESTPIG_
```

### Debug Mode

```bash
# See what's being detected
npx testpig-git-env --verbose --json

# Check CI detection
npx testpig-git-env --verbose
```

## Cross-Platform Compatibility

### Windows (PowerShell)

```powershell
# PowerShell version
$env_vars = npx testpig-git-env --format=export
Invoke-Expression $env_vars
docker compose run tests
```

### Windows (Command Prompt)

```batch
REM Generate .env file approach
npx testpig-git-env --format=env > .testpig.env
docker compose --env-file .testpig.env run tests
```

### macOS/Linux

```bash
# Standard approach
eval "$(npx testpig-git-env --format=export)"
docker compose run tests
```

## Troubleshooting

### Issue: Command not found

```bash
npx testpig-git-env
# Error: command not found
```

**Solution**: Install any TestPig reporter package:

```bash
npm install @testpig/jest-reporter
# or @testpig/cypress-reporter, @testpig/playwright-reporter, etc.
```

### Issue: All values show as "unknown"

**Debug steps:**

```bash
# Check what's being detected
npx testpig-git-env --verbose --json

# Common causes:
# - Not in a git repository
# - Git not installed
# - CI environment variables not set
```

### Issue: Variables not passed to container

**Check variables are set:**

```bash
# After eval command, verify:
env | grep ^TESTPIG_

# If empty, the eval didn't work
# Try generating .env file instead:
npx testpig-git-env --format=env > .testpig.env
docker compose --env-file .testpig.env run tests
```

### Issue: Permission denied on Windows

```bash
# Use PowerShell instead of CMD
$env_vars = npx testpig-git-env --format=export
Invoke-Expression $env_vars
```

## Best Practices

### 1. Use npm scripts

```json
{
  "scripts": {
    "test:docker": "eval \"$(npx testpig-git-env --format=export)\" && docker compose run tests",
    "test:docker:debug": "npx testpig-git-env --verbose && npm run test:docker"
  }
}
```

### 2. Create shell aliases

```bash
# Add to your .bashrc or .zshrc
alias docker-test='eval "$(npx testpig-git-env --format=export)" && docker compose run tests'
alias docker-cypress='eval "$(npx testpig-git-env --format=export)" && docker compose run cypress'
```

### 3. Use .gitignore for environment files

```gitignore
# .gitignore
.testpig.env
```

### 4. Validate in CI

```yaml
# CI workflow
- name: Validate Git Info
  run: |
    npx testpig-git-env --verbose --json
    eval "$(npx testpig-git-env --format=export)"
    echo "Branch: $TESTPIG_GIT_BRANCH"
    echo "Commit: $TESTPIG_GIT_COMMIT"
```

## Understanding the Flow

The `testpig-git-env` CLI uses a smart two-layer approach:

### Layer 1: CI Provider Detection (Automatic)
The CLI automatically detects your CI environment and reads standard CI variables:

```bash
# GitHub Actions (automatic):
GITHUB_ACTIONS=true, GITHUB_SHA=abc123, GITHUB_REF=refs/heads/main

# CircleCI (automatic):
CIRCLECI=true, CIRCLE_SHA1=abc123, CIRCLE_BRANCH=main

# Travis CI (automatic):
TRAVIS=true, TRAVIS_COMMIT=abc123, TRAVIS_BRANCH=main
```

### Layer 2: TESTPIG_* Standardization
The CLI converts everything to standardized `TESTPIG_*` format:

```bash
# What testpig-git-env outputs:
TESTPIG_GIT_BRANCH=main
TESTPIG_GIT_COMMIT=abc123
TESTPIG_GIT_AUTHOR="Your Name"
TESTPIG_GIT_EMAIL=your@email.com
TESTPIG_CI_PROVIDER=github
```

### Key Point: No Manual TESTPIG_* Required

**You don't need to manually set TESTPIG_* variables!** The CLI:
1. Reads your CI environment automatically
2. Extracts git info from CI provider variables
3. Converts to TESTPIG_* format for Docker
4. Provides fallback to git commands if CI not detected

TESTPIG_* variables are for **overrides only**, not normal operation.

## FAQ

### Q: Do I need to modify my docker-compose.yml?

**A:** No, but it's recommended for clarity. Variables set in your shell are automatically inherited by Docker Compose.

### Q: What's the difference between --format=export and --format=env?

**A:** 
- `--format=export` → For shell evaluation with `eval`
- `--format=env` → For `.env` files with `--env-file`

### Q: Can I use this with Kubernetes?

**A:** Yes! Generate a `.env` file and create a ConfigMap:

```bash
npx testpig-git-env --format=env > .testpig.env
kubectl create configmap testpig-git-env --from-env-file=.testpig.env
```

### Q: Does this work in monorepos?

**A:** Yes! The CLI detects git information from the repository root, regardless of which subdirectory you run it from.

### Q: Can I use custom CI variables?

**A:** Yes! Set override variables:

```bash
export TESTPIG_GIT_BRANCH="custom-branch"
export TESTPIG_CI_PROVIDER="custom-ci"
npx testpig-git-env --format=export
```

## Getting Help

- **CLI Help**: `npx testpig-git-env --help`
- **Debug Mode**: `npx testpig-git-env --verbose --json`
- **GitHub Issues**: [testpig-io/node-reporters](https://github.com/testpig-io/node-reporters)

## Summary

The `testpig-git-env` CLI makes Docker integration effortless by:

✅ **Automatic CI detection** across all major providers
✅ **Multiple output formats** for different use cases  
✅ **Zero configuration** in most CI environments
✅ **Cross-platform compatibility** (Windows, macOS, Linux)
✅ **Simple Docker Compose integration** with `eval` or `.env` files
✅ **Comprehensive override support** for custom scenarios

Choose the integration method that works best for your workflow! 🚀