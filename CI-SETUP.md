# CI Provider Setup Guide

This document outlines how to set up each CI provider to execute workflows when you push to your GitHub repository.

## 🏆 Summary

| Provider | GitHub Integration | Cost | Setup Difficulty | Recommendation |
|----------|-------------------|------|------------------|----------------|
| **GitHub Actions** | ✅ Native | Free tier | Easy | ✅ **Primary** |
| **CircleCI** | ✅ Direct | Free tier | Easy | ✅ **Recommended** |
| **Travis CI** | ✅ Direct | Free for OSS | Easy | ✅ **Recommended** |
| **GitLab CI** | ❌ Requires mirror | Free | Medium | ⚠️ **Optional** |
| **Jenkins** | ⚠️ Self-hosted | Varies | Hard | ❌ **Use simulation** |

## 🚀 Quick Setup (Recommended)

For immediate testing of your git-env CLI across multiple CI providers:

### 1. CircleCI (Easiest)
1. Go to [circleci.com](https://circleci.com)
2. Click "Sign Up" → "Sign up with GitHub"
3. Authorize CircleCI to access your repositories
4. Find your repository in the dashboard
5. Click "Set Up Project" → "Use Existing Config"
6. CircleCI will automatically detect `.circleci/config.yml`

### 2. Travis CI 
1. Go to [travis-ci.com](https://travis-ci.com)
2. Click "Sign up with GitHub"
3. Authorize Travis CI
4. Go to your profile settings
5. Find `testpig-io/node-reporters` and toggle it ON
6. Travis will automatically detect `.travis.yml`

**Result**: After push/PR, you'll see builds running in both CircleCI and Travis CI dashboards, plus GitHub Actions.

## 📋 Detailed Setup Instructions

### GitHub Actions ✅ (Already Working)
- **Status**: ✅ Already configured
- **File**: `.github/workflows/test.yml`
- **Setup**: None required - runs automatically
- **Features**: Native GitHub integration, matrix builds, Jenkins simulation

### CircleCI ✅ (Quick Setup)
- **Status**: 🔧 Ready to configure
- **File**: `.circleci/config.yml`
- **Website**: [circleci.com](https://circleci.com)

**Setup Steps:**
1. **Create Account**: Sign up with GitHub account
2. **Connect Repository**: 
   - Dashboard → "Set Up Project"
   - Find `testpig-io/node-reporters`
   - Click "Set Up Project"
   - Select "Use Existing Config" (detects `.circleci/config.yml`)
3. **First Build**: Push code to trigger first build
4. **Environment Variables** (if needed):
   - Project Settings → Environment Variables
   - Add any secrets like `TESTPIG_API_KEY`

**Free Tier**: 6,000 build minutes/month

### Travis CI ✅ (Quick Setup)
- **Status**: 🔧 Ready to configure  
- **File**: `.travis.yml`
- **Website**: [travis-ci.com](https://travis-ci.com)

**Setup Steps:**
1. **Create Account**: Sign up with GitHub account
2. **Enable Repository**:
   - Go to your Travis profile
   - Find `testpig-io/node-reporters`
   - Toggle the switch to enable
3. **First Build**: Push code to trigger first build
4. **Environment Variables** (if needed):
   - Repository Settings → Environment Variables
   - Add any secrets like `TESTPIG_API_KEY`

**Free Tier**: Unlimited for open source

### GitLab CI ⚠️ (Mirror Required)
- **Status**: ⚠️ Requires GitLab account + mirroring
- **File**: `.gitlab-ci.yml`
- **Website**: [gitlab.com](https://gitlab.com)

**Option A: Repository Mirroring**
1. **Create GitLab Account**: Sign up at gitlab.com
2. **Create Project**: New project on GitLab
3. **Set Up Mirroring**:
   - Project Settings → Repository → Mirroring repositories
   - Add GitHub repository URL
   - Set up authentication (GitHub token)
   - Enable "Mirror repository"
4. **Automatic Sync**: GitLab will sync commits and run CI

**Option B: Skip GitLab CI**
- Consider removing `.gitlab-ci.yml` if you won't use GitLab
- Keep the cross-provider simulation tests in other CI systems

### Jenkins ❌ (Use Simulation Instead)
- **Status**: 🎯 Using GitHub Actions simulation
- **File**: `Jenkinsfile` (for reference)
- **Recommendation**: Use the Jenkins simulation in GitHub Actions

**Why Use Simulation:**
- ✅ Tests Jenkins provider detection logic
- ✅ No server setup required
- ✅ No maintenance overhead
- ✅ Validates all Jenkins environment variables

**If You Really Want Real Jenkins:**
1. **Cloud Jenkins**: Use CloudBees or similar service
2. **Self-Hosted**: Install Jenkins server + GitHub webhook
3. **Complexity**: High setup and maintenance cost

## 🎯 Recommended Approach

### Phase 1: Quick Setup (5 minutes)
1. **CircleCI**: Sign up + enable repository
2. **Travis CI**: Sign up + enable repository
3. **Push code**: See builds in all 3 platforms (GitHub + CircleCI + Travis)

### Phase 2: Optional (if needed)
4. **GitLab CI**: Only if you need GitLab-specific testing
5. **Real Jenkins**: Only if you have Jenkins infrastructure

### Phase 3: Clean Up
- Remove unused CI config files if not setting up those providers
- Keep Jenkins simulation in GitHub Actions for testing

## 🔧 Environment Variables

If your tests require environment variables (like `TESTPIG_API_KEY`), set them in each platform:

### GitHub Actions
- Repository Settings → Secrets and variables → Actions → New repository secret

### CircleCI  
- Project Settings → Environment Variables → Add Variable

### Travis CI
- Repository Settings → Environment Variables → Add Variable

### GitLab CI
- Project Settings → CI/CD → Variables → Add Variable

## 🧪 Testing Your Setup

After setting up CI providers:

1. **Create a test branch**:
   ```bash
   git checkout -b test-ci-setup
   git push origin test-ci-setup
   ```

2. **Create a PR**: Open pull request on GitHub

3. **Check CI Status**: You should see builds in:
   - ✅ GitHub Actions (always)
   - ✅ CircleCI (if configured)
   - ✅ Travis CI (if configured)
   - ✅ GitLab CI (if mirrored)

4. **Monitor Builds**: Each should test git-env CLI and provider detection

## 🚨 Troubleshooting

### CircleCI Issues
- **Build not triggering**: Check repository is connected in CircleCI dashboard
- **Config errors**: Validate `.circleci/config.yml` syntax
- **Permission issues**: Ensure CircleCI has repository access

### Travis CI Issues  
- **Build not triggering**: Check repository is enabled in Travis settings
- **Legacy vs New**: Use travis-ci.com (not travis-ci.org)
- **Config errors**: Validate `.travis.yml` syntax

### GitLab CI Issues
- **Mirror not syncing**: Check mirror settings and authentication
- **Builds not running**: Verify `.gitlab-ci.yml` is valid
- **Permission issues**: Ensure GitLab can access GitHub repository

## 💡 Pro Tips

1. **Start Small**: Set up CircleCI and Travis first - they're the easiest
2. **Monitor Costs**: Free tiers are generous but monitor usage
3. **Use Secrets**: Never commit API keys - use each platform's secret management
4. **Parallel Testing**: All platforms test simultaneously for fast feedback
5. **Status Badges**: Add CI status badges to your README once set up

## 🎉 Success Criteria

After setup, you should have:
- ✅ Multiple CI providers running on every push/PR
- ✅ Git-env CLI tested across all environments  
- ✅ Provider detection validated for each CI system
- ✅ Cross-provider compatibility confirmed
- ✅ Docker integration tested everywhere

This ensures your Docker git-info solution works reliably across all major CI platforms! 🚀
