# Docker Usage Guide for TestPig

TestPig now includes a built-in CLI utility that makes running tests in Docker containers seamless. No more `unknown` values for git information!

## Quick Start

If you have **any** TestPig reporter installed, you automatically get the `testpig-git-env` command:

```bash
# Replace your docker run command:
docker run --rm my-test-image

# With this:
docker run --rm $(npx testpig-git-env) my-test-image
```

That's it! TestPig will automatically:
- ✅ Detect your CI environment (GitHub Actions, GitLab CI, etc.)
- ✅ Fall back to local git commands when not in CI
- ✅ Work on Windows, macOS, and Linux
- ✅ Provide consistent git information to your tests

## How It Works

The `testpig-git-env` utility:

1. **Detects CI Environment**: Automatically recognizes GitHub Actions, GitLab CI, CircleCI, Jenkins, Travis CI, and more
2. **Extracts Git Information**: Gets branch, commit, author, and email from CI variables or git commands
3. **Outputs Docker Flags**: Provides properly formatted `-e` flags for Docker

### Example Output

```bash
$ npx testpig-git-env
-e TESTPIG_GIT_BRANCH="main" -e TESTPIG_GIT_COMMIT="abc123..." -e TESTPIG_GIT_AUTHOR="John Doe" -e TESTPIG_GIT_EMAIL="john@example.com" -e TESTPIG_CI_PROVIDER="github"
```

## Platform Examples

### Local Development

```bash
# macOS/Linux
docker run --rm $(npx testpig-git-env) my-test-image

# Windows PowerShell
$env_vars = npx testpig-git-env
docker run --rm $env_vars my-test-image

# Windows Command Prompt
for /f "delims=" %i in ('npx testpig-git-env') do docker run --rm %i my-test-image
```

### CI/CD Examples

#### GitHub Actions

```yaml
name: Test
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          
      - name: Install dependencies
        run: npm ci
        
      - name: Run tests in Docker
        run: |
          docker run --rm $(npx testpig-git-env) my-test-image
```

#### GitLab CI

```yaml
test:
  image: docker:latest
  services:
    - docker:dind
  before_script:
    - apk add --no-cache nodejs npm
    - npm ci
  script:
    - docker run --rm $(npx testpig-git-env) my-test-image
```

#### CircleCI

```yaml
version: 2.1
jobs:
  test:
    docker:
      - image: cimg/node:18
    steps:
      - checkout
      - setup_remote_docker
      - run:
          name: Install dependencies
          command: npm ci
      - run:
          name: Run Docker tests
          command: docker run --rm $(npx testpig-git-env) my-test-image
```

### Docker Compose

```yaml
# docker-compose.test.yml
version: '3.8'
services:
  tests:
    image: my-test-image
    environment:
      # Set these before running docker-compose
      - TESTPIG_GIT_BRANCH=${TESTPIG_GIT_BRANCH}
      - TESTPIG_GIT_COMMIT=${TESTPIG_GIT_COMMIT}
      - TESTPIG_GIT_AUTHOR=${TESTPIG_GIT_AUTHOR}
      - TESTPIG_GIT_EMAIL=${TESTPIG_GIT_EMAIL}
      - TESTPIG_CI_PROVIDER=${TESTPIG_CI_PROVIDER}
```

```bash
# Set variables and run
eval $(npx testpig-git-env --export)  # Future feature
docker-compose -f docker-compose.test.yml up
```

## Advanced Usage

### Debug Mode

See exactly what's being detected:

```bash
npx testpig-git-env --verbose --json
```

Example output:
```json
{
  "branch": "feature/docker-support",
  "commit": "abc123def456789...",
  "author": "John Doe",
  "email": "john@example.com",
  "provider": "github",
  "isCI": true
}
```

### Manual Overrides

Override specific values when needed:

```bash
# Override just the branch
export TESTPIG_GIT_BRANCH="custom-branch"
docker run --rm $(npx testpig-git-env) my-test-image

# Override multiple values
export TESTPIG_GIT_BRANCH="hotfix"
export TESTPIG_GIT_AUTHOR="Release Bot"
docker run --rm $(npx testpig-git-env) my-test-image
```

### Available Override Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `TESTPIG_GIT_BRANCH` | Git branch name | `main`, `feature/auth` |
| `TESTPIG_GIT_COMMIT` | Full commit SHA | `abc123def456789...` |
| `TESTPIG_GIT_AUTHOR` | Author name | `John Doe` |
| `TESTPIG_GIT_EMAIL` | Author email | `john@example.com` |
| `TESTPIG_CI_PROVIDER` | CI provider name | `github`, `gitlab`, `local` |

## Supported CI Providers

The utility automatically detects these CI environments:

- **GitHub Actions** (`GITHUB_ACTIONS`, `GITHUB_RUN_ID`)
- **GitLab CI** (`GITLAB_CI`, `CI_PIPELINE_ID`)
- **CircleCI** (`CIRCLECI`, `CIRCLE_WORKFLOW_ID`)
- **Jenkins** (`JENKINS_URL`, `BUILD_NUMBER`)
- **Travis CI** (`TRAVIS`, `TRAVIS_JOB_ID`)
- **Generic CI** (`CI=true`, `CONTINUOUS_INTEGRATION=true`)

## Troubleshooting

### Issue: Command not found

```bash
npx testpig-git-env
# Error: command not found
```

**Solution**: Make sure you have a TestPig reporter installed:

```bash
npm install @testpig/jest-reporter
# or
npm install @testpig/cypress-reporter
# or any other @testpig/* package
```

### Issue: Permission denied on Windows

```bash
# Use PowerShell instead of CMD
$env_vars = npx testpig-git-env
docker run --rm $env_vars my-test-image
```

### Issue: Git commands fail in container

The utility detects git information on the **host** machine, not inside the container. This is intentional and correct behavior.

### Issue: All values show as "unknown"

Enable debug mode to see what's happening:

```bash
npx testpig-git-env --verbose --json
```

Common causes:
- Not in a git repository
- Git not installed on host
- CI environment variables not set properly

## Understanding the Flow

### Two-Layer Strategy

The `testpig-git-env` CLI uses a smart two-layer approach:

#### Layer 1: CI Provider Detection (Automatic)
The CLI automatically detects your CI environment and reads standard CI variables:

```bash
# GitHub Actions (automatic):
GITHUB_ACTIONS=true, GITHUB_SHA=abc123, GITHUB_REF=refs/heads/main

# CircleCI (automatic):
CIRCLECI=true, CIRCLE_SHA1=abc123, CIRCLE_BRANCH=main

# Travis CI (automatic):
TRAVIS=true, TRAVIS_COMMIT=abc123, TRAVIS_BRANCH=main
```

#### Layer 2: TESTPIG_* Standardization
The CLI converts everything to standardized `TESTPIG_*` format for Docker:

```bash
# What testpig-git-env outputs for Docker:
-e TESTPIG_GIT_BRANCH=main
-e TESTPIG_GIT_COMMIT=abc123
-e TESTPIG_GIT_AUTHOR="Your Name"
-e TESTPIG_GIT_EMAIL=your@email.com
-e TESTPIG_CI_PROVIDER=github
```

### Docker Compose Integration

You have three options for docker-compose integration:

#### Option A: CLI Handles Everything (Recommended)
```yaml
# docker-compose.yml
services:
  tests:
    image: my-test-image
    # No environment needed - CLI provides everything

# Usage:
# docker-compose run $(npx testpig-git-env) tests
```

#### Option B: Pass Through CI Variables
```yaml
# docker-compose.yml
services:
  tests:
    image: my-test-image
    environment:
      # Pass through CI provider variables for automatic detection
      - GITHUB_ACTIONS
      - GITHUB_SHA
      - GITHUB_REF
      - GITHUB_ACTOR
      # Add overrides if needed
      - TESTPIG_GIT_AUTHOR=Custom Author
```

#### Option C: Full Override Mode
```yaml
# docker-compose.yml
services:
  tests:
    image: my-test-image
    environment:
      # Completely override with custom values
      - TESTPIG_GIT_BRANCH=custom-branch
      - TESTPIG_GIT_COMMIT=custom-sha
      - TESTPIG_GIT_AUTHOR=Custom Author
      - TESTPIG_GIT_EMAIL=custom@email.com
      - TESTPIG_CI_PROVIDER=custom-provider
```

### Key Point: No Manual TESTPIG_* Required

**You don't need to manually pass TESTPIG_* variables!** The CLI:
1. Reads your CI environment automatically
2. Extracts git info from CI provider variables
3. Converts to TESTPIG_* format for Docker
4. Provides fallback to git commands if CI not detected

TESTPIG_* variables are for **overrides only**, not normal operation.

## Best Practices

### 1. Use in npm scripts

```json
{
  "scripts": {
    "test:docker": "docker run --rm $(npx testpig-git-env) my-test-image",
    "test:docker:debug": "npx testpig-git-env --verbose && npm run test:docker"
  }
}
```

### 2. Create shell aliases

```bash
# Add to your .bashrc or .zshrc
alias docker-test='docker run --rm $(npx testpig-git-env)'

# Usage:
docker-test my-test-image
```

### 3. CI Pipeline Templates

Create reusable CI templates with TestPig Docker support built-in.

## Migration Guide

### Before (manual environment variables)

```bash
docker run --rm \
  -e GIT_BRANCH="$(git rev-parse --abbrev-ref HEAD)" \
  -e GIT_COMMIT="$(git rev-parse HEAD)" \
  -e GIT_AUTHOR="$(git config user.name)" \
  my-test-image
```

### After (automatic detection)

```bash
docker run --rm $(npx testpig-git-env) my-test-image
```

The new approach:
- ✅ Works across all CI providers
- ✅ Handles edge cases (PRs, detached HEAD, etc.)
- ✅ Provides consistent variable names
- ✅ Includes debug and override capabilities
- ✅ Works on all platforms

## Next Steps

1. **Update your CI pipelines** to use `$(npx testpig-git-env)`
2. **Remove manual git environment variable scripts**
3. **Test across different environments** (local, CI, different platforms)
4. **Use debug mode** if you encounter any issues

For more information, see our [main documentation](README.md) or [open an issue](https://github.com/testpig-io/node-reporters/issues).
