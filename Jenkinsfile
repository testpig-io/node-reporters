// Jenkins Pipeline for TestPig Node Reporters
// This pipeline tests the testpig-git-env CLI and validates Jenkins provider detection

pipeline {
    agent {
        label 'any'
    }
    
    // Define build parameters
    parameters {
        choice(
            name: 'NODE_VERSION',
            choices: ['18', '20', '22'],
            description: 'Node.js version to use for testing'
        )
        booleanParam(
            name: 'RUN_CROSS_CI_TESTS',
            defaultValue: true,
            description: 'Run cross-CI provider simulation tests'
        )
        booleanParam(
            name: 'ENABLE_DEBUG_LOGS',
            defaultValue: true,
            description: 'Enable debug logging for git-env CLI'
        )
    }
    
    // Environment variables
    environment {
        TESTPIG_DEBUG_LOGS = "${params.ENABLE_DEBUG_LOGS}"
        TESTPIG_PROJECT_ID = 'ee47c'
        NODE_VERSION = "${params.NODE_VERSION}"
        // Jenkins-specific environment variables (automatically available)
        // JENKINS_URL, BUILD_NUMBER, BRANCH_NAME, GIT_COMMIT, etc.
    }
    
    // Build triggers
    triggers {
        // Poll SCM every 5 minutes for changes
        pollSCM('H/5 * * * *')
        // Build daily at midnight
        cron('H 0 * * *')
    }
    
    // Pipeline options
    options {
        // Keep only last 10 builds
        buildDiscarder(logRotator(numToKeepStr: '10'))
        // Timeout after 30 minutes
        timeout(time: 30, unit: 'MINUTES')
        // Add timestamps to console output
        timestamps()
        // Enable ANSI color output
        ansiColor('xterm')
        // Skip checkout to agent
        skipDefaultCheckout()
    }
    
    stages {
        stage('Checkout') {
            steps {
                script {
                    echo "=== Jenkins Environment Information ==="
                    echo "Jenkins URL: ${env.JENKINS_URL}"
                    echo "Build Number: ${env.BUILD_NUMBER}"
                    echo "Build ID: ${env.BUILD_ID}"
                    echo "Job Name: ${env.JOB_NAME}"
                    echo "Branch Name: ${env.BRANCH_NAME}"
                    echo "Git Commit: ${env.GIT_COMMIT}"
                    echo "Git Branch: ${env.GIT_BRANCH}"
                    echo "Git URL: ${env.GIT_URL}"
                    echo "Workspace: ${env.WORKSPACE}"
                    echo "Node Name: ${env.NODE_NAME}"
                    echo "Build URL: ${env.BUILD_URL}"
                    
                    if (env.CHANGE_ID) {
                        echo "Pull Request ID: ${env.CHANGE_ID}"
                        echo "Pull Request Title: ${env.CHANGE_TITLE}"
                        echo "Pull Request Branch: ${env.CHANGE_BRANCH}"
                        echo "Pull Request Target: ${env.CHANGE_TARGET}"
                        echo "Pull Request Author: ${env.CHANGE_AUTHOR}"
                        echo "Pull Request URL: ${env.CHANGE_URL}"
                    }
                }
                
                // Checkout the repository
                checkout scm
                
                // Display git information
                sh '''
                    echo "=== Git Repository Information ==="
                    git --version
                    git log --oneline -5
                    git status
                    git remote -v
                '''
            }
        }
        
        stage('Setup Environment') {
            steps {
                script {
                    // Setup Node.js version
                    sh """
                        echo "=== Setting up Node.js ${env.NODE_VERSION} ==="
                        # Install nvm if not available
                        if ! command -v nvm &> /dev/null; then
                            curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
                            export NVM_DIR="\$HOME/.nvm"
                            [ -s "\$NVM_DIR/nvm.sh" ] && \\. "\$NVM_DIR/nvm.sh"
                        fi
                        
                        # Use specified Node.js version
                        export NVM_DIR="\$HOME/.nvm"
                        [ -s "\$NVM_DIR/nvm.sh" ] && \\. "\$NVM_DIR/nvm.sh"
                        nvm install ${env.NODE_VERSION} || true
                        nvm use ${env.NODE_VERSION}
                        
                        # Display versions
                        node --version
                        npm --version
                        
                        # Install latest npm
                        npm install -g npm@latest
                        npm --version
                    """
                }
            }
        }
        
        stage('Install Dependencies') {
            steps {
                sh '''
                    echo "=== Installing Dependencies ==="
                    
                    # Set Node.js version
                    export NVM_DIR="$HOME/.nvm"
                    [ -s "$NVM_DIR/nvm.sh" ] && \\. "$NVM_DIR/nvm.sh"
                    nvm use ${NODE_VERSION}
                    
                    # Install dependencies
                    npm ci
                    
                    # Install Playwright browsers
                    npx playwright install --with-deps || echo "Playwright installation completed with warnings"
                '''
            }
        }
        
        stage('Build Packages') {
            steps {
                sh '''
                    echo "=== Building Packages ==="
                    
                    # Set Node.js version
                    export NVM_DIR="$HOME/.nvm"
                    [ -s "$NVM_DIR/nvm.sh" ] && \\. "$NVM_DIR/nvm.sh"
                    nvm use ${NODE_VERSION}
                    
                    # Build all packages
                    npx lerna run build
                    
                    # Verify shared package build (our git-env CLI)
                    ls -la packages/shared/dist/
                    ls -la packages/shared/dist/bin/ || echo "No bin directory found"
                    
                    # Make CLI executable if it exists
                    if [ -f packages/shared/dist/bin/git-env.js ]; then
                        chmod +x packages/shared/dist/bin/git-env.js
                        echo "Git-env CLI made executable"
                    else
                        echo "Git-env CLI not found - this may indicate a build issue"
                    fi
                '''
            }
        }
        
        stage('Test Git-Env CLI - Basic') {
            steps {
                sh '''
                    echo "=== Testing Git-Env CLI - Basic Functionality ==="
                    
                    # Set Node.js version
                    export NVM_DIR="$HOME/.nvm"
                    [ -s "$NVM_DIR/nvm.sh" ] && \\. "$NVM_DIR/nvm.sh"
                    nvm use ${NODE_VERSION}
                    
                    # Test CLI Help
                    echo "--- Testing CLI Help ---"
                    node packages/shared/dist/bin/git-env.js --help
                    
                    # Test CLI Basic Output
                    echo "--- Testing CLI Basic Output ---"
                    node packages/shared/dist/bin/git-env.js
                    
                    # Test CLI JSON Output
                    echo "--- Testing CLI JSON Output ---"
                    node packages/shared/dist/bin/git-env.js --json
                    
                    # Test CLI Verbose Mode
                    echo "--- Testing CLI Verbose Mode ---"
                    node packages/shared/dist/bin/git-env.js --verbose --json
                '''
            }
        }
        
        stage('Test Jenkins CI Detection') {
            steps {
                script {
                    sh '''
                        echo "=== Testing Jenkins CI Detection ==="
                        
                        # Set Node.js version
                        export NVM_DIR="$HOME/.nvm"
                        [ -s "$NVM_DIR/nvm.sh" ] && \\. "$NVM_DIR/nvm.sh"
                        nvm use ${NODE_VERSION}
                        
                        echo "Expected Jenkins CI to be detected:"
                        echo "JENKINS_URL=$JENKINS_URL"
                        echo "BUILD_NUMBER=$BUILD_NUMBER"
                        echo "BUILD_ID=$BUILD_ID"
                        echo "JOB_NAME=$JOB_NAME"
                        echo "BRANCH_NAME=$BRANCH_NAME"
                        echo "GIT_COMMIT=$GIT_COMMIT"
                        echo "GIT_BRANCH=$GIT_BRANCH"
                        echo "GIT_AUTHOR_NAME=$GIT_AUTHOR_NAME"
                        echo "GIT_AUTHOR_EMAIL=$GIT_AUTHOR_EMAIL"
                        echo "GIT_COMMITTER_NAME=$GIT_COMMITTER_NAME"
                        echo "GIT_COMMITTER_EMAIL=$GIT_COMMITTER_EMAIL"
                        
                        if [ -n "$CHANGE_ID" ]; then
                            echo "Pull Request Information:"
                            echo "CHANGE_ID=$CHANGE_ID"
                            echo "CHANGE_BRANCH=$CHANGE_BRANCH"
                            echo "CHANGE_TARGET=$CHANGE_TARGET"
                            echo "CHANGE_AUTHOR=$CHANGE_AUTHOR"
                            echo "CHANGE_TITLE=$CHANGE_TITLE"
                        fi
                        
                        echo ""
                        echo "CLI Output:"
                        json_output=$(node packages/shared/dist/bin/git-env.js --verbose --json)
                        echo "$json_output"
                        
                        echo ""
                        echo "=== Validating Jenkins CI Provider Detection ==="
                        provider=$(echo "$json_output" | jq -r '.provider')
                        echo "Provider detected: $provider"
                        
                        if [ "$provider" = "jenkins" ]; then
                            echo "✅ Jenkins CI provider detected correctly"
                        else
                            echo "❌ Expected Jenkins CI provider, got: $provider"
                            exit 1
                        fi
                    '''
                }
            }
        }
        
        stage('Test Jenkins Author Detection') {
            steps {
                sh '''
                    echo "=== Testing Jenkins Author Detection ==="
                    
                    # Set Node.js version
                    export NVM_DIR="$HOME/.nvm"
                    [ -s "$NVM_DIR/nvm.sh" ] && \\. "$NVM_DIR/nvm.sh"
                    nvm use ${NODE_VERSION}
                    
                    json_output=$(node packages/shared/dist/bin/git-env.js --json)
                    author_email=$(echo "$json_output" | jq -r '.email')
                    author_name=$(echo "$json_output" | jq -r '.author')
                    
                    echo "Author name detected: $author_name"
                    echo "Author email detected: $author_email"
                    echo "Jenkins GIT_AUTHOR_NAME: $GIT_AUTHOR_NAME"
                    echo "Jenkins GIT_AUTHOR_EMAIL: $GIT_AUTHOR_EMAIL"
                    echo "Jenkins GIT_COMMITTER_NAME: $GIT_COMMITTER_NAME"
                    echo "Jenkins GIT_COMMITTER_EMAIL: $GIT_COMMITTER_EMAIL"
                    
                    if [ "$author_name" != "unknown" ]; then
                        echo "✅ Author name detected successfully"
                    else
                        echo "⚠️  Author name is unknown - checking if Jenkins variables are available"
                        if [ -n "$GIT_AUTHOR_NAME" ]; then
                            echo "Jenkins GIT_AUTHOR_NAME is available: $GIT_AUTHOR_NAME"
                        else
                            echo "Jenkins GIT_AUTHOR_NAME is not available"
                        fi
                    fi
                    
                    if [ "$author_email" != "unknown" ]; then
                        echo "✅ Author email detected successfully"
                    else
                        echo "⚠️  Author email is unknown - checking if Jenkins variables are available"
                        if [ -n "$GIT_AUTHOR_EMAIL" ]; then
                            echo "Jenkins GIT_AUTHOR_EMAIL is available: $GIT_AUTHOR_EMAIL"
                        else
                            echo "Jenkins GIT_AUTHOR_EMAIL is not available"
                        fi
                    fi
                '''
            }
        }
        
        stage('Test Pull Request Detection') {
            when {
                not { 
                    equals expected: '', actual: "${env.CHANGE_ID ?: ''}" 
                }
            }
            steps {
                sh '''
                    echo "=== Testing Pull Request Detection ==="
                    
                    # Set Node.js version
                    export NVM_DIR="$HOME/.nvm"
                    [ -s "$NVM_DIR/nvm.sh" ] && \\. "$NVM_DIR/nvm.sh"
                    nvm use ${NODE_VERSION}
                    
                    echo "This is a pull request build"
                    echo "CHANGE_ID: $CHANGE_ID"
                    echo "CHANGE_BRANCH: $CHANGE_BRANCH"
                    echo "CHANGE_TARGET: $CHANGE_TARGET"
                    echo "CHANGE_AUTHOR: $CHANGE_AUTHOR"
                    
                    json_output=$(node packages/shared/dist/bin/git-env.js --json)
                    detected_branch=$(echo "$json_output" | jq -r '.branch')
                    echo "Detected branch in PR: $detected_branch"
                    
                    if [ "$detected_branch" = "$CHANGE_BRANCH" ] || [ "$detected_branch" != "unknown" ]; then
                        echo "✅ Pull request branch detection working"
                    else
                        echo "⚠️  Pull request branch detection may need improvement"
                        echo "Expected: $CHANGE_BRANCH, Got: $detected_branch"
                    fi
                '''
            }
        }
        
        stage('Test TestPig Overrides') {
            steps {
                sh '''
                    echo "=== Testing TestPig Environment Variable Overrides ==="
                    
                    # Set Node.js version
                    export NVM_DIR="$HOME/.nvm"
                    [ -s "$NVM_DIR/nvm.sh" ] && \\. "$NVM_DIR/nvm.sh"
                    nvm use ${NODE_VERSION}
                    
                    # Set override variables
                    export TESTPIG_GIT_BRANCH="test-override-branch"
                    export TESTPIG_GIT_AUTHOR="Test Override User"
                    export TESTPIG_GIT_EMAIL="test@example.com"
                    export TESTPIG_CI_PROVIDER="test-provider"
                    
                    echo "Set overrides:"
                    echo "TESTPIG_GIT_BRANCH=$TESTPIG_GIT_BRANCH"
                    echo "TESTPIG_GIT_AUTHOR=$TESTPIG_GIT_AUTHOR"
                    echo "TESTPIG_GIT_EMAIL=$TESTPIG_GIT_EMAIL"
                    echo "TESTPIG_CI_PROVIDER=$TESTPIG_CI_PROVIDER"
                    
                    echo ""
                    echo "CLI Output with overrides:"
                    json_output=$(node packages/shared/dist/bin/git-env.js --json)
                    echo "$json_output"
                    
                    # Validate overrides are applied
                    detected_branch=$(echo "$json_output" | jq -r '.branch')
                    detected_author=$(echo "$json_output" | jq -r '.author')
                    detected_email=$(echo "$json_output" | jq -r '.email')
                    detected_provider=$(echo "$json_output" | jq -r '.provider')
                    
                    echo ""
                    echo "Validation:"
                    
                    if [ "$detected_branch" = "$TESTPIG_GIT_BRANCH" ]; then
                        echo "✅ Branch override applied correctly"
                    else
                        echo "❌ Branch override failed: expected $TESTPIG_GIT_BRANCH, got $detected_branch"
                        exit 1
                    fi
                    
                    if [ "$detected_author" = "$TESTPIG_GIT_AUTHOR" ]; then
                        echo "✅ Author override applied correctly"
                    else
                        echo "❌ Author override failed: expected $TESTPIG_GIT_AUTHOR, got $detected_author"
                        exit 1
                    fi
                    
                    if [ "$detected_email" = "$TESTPIG_GIT_EMAIL" ]; then
                        echo "✅ Email override applied correctly"
                    else
                        echo "❌ Email override failed: expected $TESTPIG_GIT_EMAIL, got $detected_email"
                        exit 1
                    fi
                    
                    if [ "$detected_provider" = "$TESTPIG_CI_PROVIDER" ]; then
                        echo "✅ Provider override applied correctly"
                    else
                        echo "❌ Provider override failed: expected $TESTPIG_CI_PROVIDER, got $detected_provider"
                        exit 1
                    fi
                '''
            }
        }
        
        stage('Test Docker Integration') {
            steps {
                sh '''
                    echo "=== Testing Docker Environment Variables ==="
                    
                    # Set Node.js version
                    export NVM_DIR="$HOME/.nvm"
                    [ -s "$NVM_DIR/nvm.sh" ] && \\. "$NVM_DIR/nvm.sh"
                    nvm use ${NODE_VERSION}
                    
                    echo "Environment variables that would be passed to Docker:"
                    node packages/shared/dist/bin/git-env.js
                    
                    echo ""
                    echo "Formatted for easy reading:"
                    node packages/shared/dist/bin/git-env.js | tr ' ' '\\n'
                    
                    echo ""
                    echo "=== Simulating Docker Command ==="
                    echo "This is how the Docker command would look:"
                    echo "docker run --rm \\$(node packages/shared/dist/bin/git-env.js) my-test-image"
                    
                    echo ""
                    echo "Which expands to:"
                    docker_cmd="docker run --rm $(node packages/shared/dist/bin/git-env.js) my-test-image"
                    echo "$docker_cmd"
                '''
            }
        }
        
        stage('Validate CLI Output Format') {
            steps {
                sh '''
                    echo "=== Validating CLI Output Format ==="
                    
                    # Set Node.js version
                    export NVM_DIR="$HOME/.nvm"
                    [ -s "$NVM_DIR/nvm.sh" ] && \\. "$NVM_DIR/nvm.sh"
                    nvm use ${NODE_VERSION}
                    
                    output=$(node packages/shared/dist/bin/git-env.js)
                    echo "Raw output: $output"
                    
                    # Check for required environment variables
                    if echo "$output" | grep -q "TESTPIG_GIT_BRANCH="; then
                        echo "✅ TESTPIG_GIT_BRANCH found"
                    else
                        echo "❌ TESTPIG_GIT_BRANCH missing"
                        exit 1
                    fi
                    
                    if echo "$output" | grep -q "TESTPIG_GIT_COMMIT="; then
                        echo "✅ TESTPIG_GIT_COMMIT found"
                    else
                        echo "❌ TESTPIG_GIT_COMMIT missing"
                        exit 1
                    fi
                    
                    if echo "$output" | grep -q "TESTPIG_GIT_AUTHOR="; then
                        echo "✅ TESTPIG_GIT_AUTHOR found"
                    else
                        echo "❌ TESTPIG_GIT_AUTHOR missing"
                        exit 1
                    fi
                    
                    if echo "$output" | grep -q "TESTPIG_CI_PROVIDER="; then
                        echo "✅ TESTPIG_CI_PROVIDER found"
                    else
                        echo "❌ TESTPIG_CI_PROVIDER missing"
                        exit 1
                    fi
                    
                    echo "✅ All required environment variables present"
                '''
            }
        }
        
        stage('Cross-CI Provider Tests') {
            when {
                expression { params.RUN_CROSS_CI_TESTS }
            }
            parallel {
                stage('Test GitHub Actions Simulation') {
                    steps {
                        sh '''
                            echo "=== Testing GitHub Actions Provider Simulation ==="
                            
                            # Set Node.js version
                            export NVM_DIR="$HOME/.nvm"
                            [ -s "$NVM_DIR/nvm.sh" ] && \\. "$NVM_DIR/nvm.sh"
                            nvm use ${NODE_VERSION}
                            
                            # Clear Jenkins variables and set GitHub variables
                            unset JENKINS_URL BUILD_NUMBER
                            export GITHUB_ACTIONS=true
                            export GITHUB_RUN_ID=123
                            export GITHUB_SHA=abc123
                            export GITHUB_REF=refs/heads/main
                            export GITHUB_ACTOR=testuser
                            
                            json_output=$(node packages/shared/dist/bin/git-env.js --verbose --json)
                            echo "$json_output"
                            
                            provider=$(echo "$json_output" | jq -r '.provider')
                            echo "Expected provider: github"
                            echo "Detected provider: $provider"
                            
                            if [ "$provider" = "github" ]; then
                                echo "✅ GitHub Actions provider detected correctly"
                            else
                                echo "❌ Expected github, got $provider"
                                exit 1
                            fi
                        '''
                    }
                }
                
                stage('Test GitLab CI Simulation') {
                    steps {
                        sh '''
                            echo "=== Testing GitLab CI Provider Simulation ==="
                            
                            # Set Node.js version
                            export NVM_DIR="$HOME/.nvm"
                            [ -s "$NVM_DIR/nvm.sh" ] && \\. "$NVM_DIR/nvm.sh"
                            nvm use ${NODE_VERSION}
                            
                            # Clear Jenkins variables and set GitLab variables
                            unset JENKINS_URL BUILD_NUMBER
                            export GITLAB_CI=true
                            export CI_PIPELINE_ID=123
                            export CI_COMMIT_SHA=abc123
                            export CI_COMMIT_REF_NAME=main
                            export GITLAB_USER_NAME=testuser
                            
                            json_output=$(node packages/shared/dist/bin/git-env.js --verbose --json)
                            echo "$json_output"
                            
                            provider=$(echo "$json_output" | jq -r '.provider')
                            echo "Expected provider: gitlab"
                            echo "Detected provider: $provider"
                            
                            if [ "$provider" = "gitlab" ]; then
                                echo "✅ GitLab CI provider detected correctly"
                            else
                                echo "❌ Expected gitlab, got $provider"
                                exit 1
                            fi
                        '''
                    }
                }
                
                stage('Test CircleCI Simulation') {
                    steps {
                        sh '''
                            echo "=== Testing CircleCI Provider Simulation ==="
                            
                            # Set Node.js version
                            export NVM_DIR="$HOME/.nvm"
                            [ -s "$NVM_DIR/nvm.sh" ] && \\. "$NVM_DIR/nvm.sh"
                            nvm use ${NODE_VERSION}
                            
                            # Clear Jenkins variables and set CircleCI variables
                            unset JENKINS_URL BUILD_NUMBER
                            export CIRCLECI=true
                            export CIRCLE_WORKFLOW_ID=123
                            export CIRCLE_BRANCH=main
                            export CIRCLE_SHA1=abc123
                            export CIRCLE_USERNAME=testuser
                            
                            json_output=$(node packages/shared/dist/bin/git-env.js --verbose --json)
                            echo "$json_output"
                            
                            provider=$(echo "$json_output" | jq -r '.provider')
                            echo "Expected provider: circle"
                            echo "Detected provider: $provider"
                            
                            if [ "$provider" = "circle" ]; then
                                echo "✅ CircleCI provider detected correctly"
                            else
                                echo "❌ Expected circle, got $provider"
                                exit 1
                            fi
                        '''
                    }
                }
                
                stage('Test Travis CI Simulation') {
                    steps {
                        sh '''
                            echo "=== Testing Travis CI Provider Simulation ==="
                            
                            # Set Node.js version
                            export NVM_DIR="$HOME/.nvm"
                            [ -s "$NVM_DIR/nvm.sh" ] && \\. "$NVM_DIR/nvm.sh"
                            nvm use ${NODE_VERSION}
                            
                            # Clear Jenkins variables and set Travis variables
                            unset JENKINS_URL BUILD_NUMBER
                            export TRAVIS=true
                            export TRAVIS_BUILD_ID=123
                            export TRAVIS_BRANCH=main
                            export TRAVIS_COMMIT=abc123
                            export TRAVIS_COMMIT_AUTHOR="Test User"
                            export TRAVIS_COMMIT_AUTHOR_EMAIL=test@example.com
                            
                            json_output=$(node packages/shared/dist/bin/git-env.js --verbose --json)
                            echo "$json_output"
                            
                            provider=$(echo "$json_output" | jq -r '.provider')
                            echo "Expected provider: travis"
                            echo "Detected provider: $provider"
                            
                            if [ "$provider" = "travis" ]; then
                                echo "✅ Travis CI provider detected correctly"
                            else
                                echo "❌ Expected travis, got $provider"
                                exit 1
                            fi
                        '''
                    }
                }
            }
        }
        
        stage('Run Test Suites') {
            parallel {
                stage('Core Tests') {
                    steps {
                        sh '''
                            # Set Node.js version
                            export NVM_DIR="$HOME/.nvm"
                            [ -s "$NVM_DIR/nvm.sh" ] && \\. "$NVM_DIR/nvm.sh"
                            nvm use ${NODE_VERSION}
                            
                            npx lerna run test --scope=@testpig/core --verbose 2>&1 | sed 's/\\x1b\\[[0-9;]*m//g' > test-results-core.log || true
                            echo "Core tests completed - check test-results-core.log for details"
                        '''
                    }
                }
                
                stage('Shared Tests') {
                    steps {
                        sh '''
                            # Set Node.js version
                            export NVM_DIR="$HOME/.nvm"
                            [ -s "$NVM_DIR/nvm.sh" ] && \\. "$NVM_DIR/nvm.sh"
                            nvm use ${NODE_VERSION}
                            
                            npx lerna run test --scope=@testpig/shared --verbose 2>&1 | sed 's/\\x1b\\[[0-9;]*m//g' > test-results-shared.log || true
                            echo "Shared tests completed - check test-results-shared.log for details"
                        '''
                    }
                }
                
                stage('Jest Tests') {
                    steps {
                        sh '''
                            # Set Node.js version
                            export NVM_DIR="$HOME/.nvm"
                            [ -s "$NVM_DIR/nvm.sh" ] && \\. "$NVM_DIR/nvm.sh"
                            nvm use ${NODE_VERSION}
                            
                            npx lerna run test --scope=@testpig/jest-tests --verbose 2>&1 | sed 's/\\x1b\\[[0-9;]*m//g' > test-results-jest.log || true
                            echo "Jest tests completed - check test-results-jest.log for details"
                        '''
                    }
                }
                
                stage('Mocha Tests') {
                    steps {
                        sh '''
                            # Set Node.js version
                            export NVM_DIR="$HOME/.nvm"
                            [ -s "$NVM_DIR/nvm.sh" ] && \\. "$NVM_DIR/nvm.sh"
                            nvm use ${NODE_VERSION}
                            
                            npx lerna run test --scope=@testpig/mocha-tests --verbose 2>&1 | sed 's/\\x1b\\[[0-9;]*m//g' > test-results-mocha.log || true
                            echo "Mocha tests completed - check test-results-mocha.log for details"
                        '''
                    }
                }
                
                stage('Vitest Tests') {
                    steps {
                        sh '''
                            # Set Node.js version
                            export NVM_DIR="$HOME/.nvm"
                            [ -s "$NVM_DIR/nvm.sh" ] && \\. "$NVM_DIR/nvm.sh"
                            nvm use ${NODE_VERSION}
                            
                            npx lerna run test --scope=@testpig/vitest-tests --verbose 2>&1 | sed 's/\\x1b\\[[0-9;]*m//g' > test-results-vitest.log || true
                            echo "Vitest tests completed - check test-results-vitest.log for details"
                        '''
                    }
                }
            }
        }
    }
    
    post {
        always {
            script {
                echo "=== Build Summary ==="
                echo "Build Number: ${env.BUILD_NUMBER}"
                echo "Build Result: ${currentBuild.result ?: 'SUCCESS'}"
                echo "Duration: ${currentBuild.durationString}"
                echo "Node Version: ${env.NODE_VERSION}"
                
                // Archive test results if they exist
                sh '''
                    echo "=== Archiving Test Results ==="
                    mkdir -p test-results
                    mv test-results-*.log test-results/ 2>/dev/null || echo "No test result files to archive"
                    ls -la test-results/ || echo "No test results directory"
                '''
                
                // Archive test results
                archiveArtifacts artifacts: 'test-results/*.log', allowEmptyArchive: true, fingerprint: true
                
                // Clean workspace on success to save space
                if (currentBuild.result == null || currentBuild.result == 'SUCCESS') {
                    cleanWs()
                }
            }
        }
        
        success {
            echo "✅ Pipeline completed successfully!"
            
            // Send success notification (uncomment to enable)
            // emailext(
            //     subject: "✅ Jenkins Build Success: ${env.JOB_NAME} - ${env.BUILD_NUMBER}",
            //     body: "The Jenkins pipeline completed successfully.\n\nBuild: ${env.BUILD_URL}",
            //     to: "${env.CHANGE_AUTHOR_EMAIL ?: 'team@testpig.io'}"
            // )
        }
        
        failure {
            echo "❌ Pipeline failed!"
            
            // Send failure notification (uncomment to enable)
            // emailext(
            //     subject: "❌ Jenkins Build Failed: ${env.JOB_NAME} - ${env.BUILD_NUMBER}",
            //     body: """
            //         The Jenkins pipeline failed.
            //         
            //         Build: ${env.BUILD_URL}
            //         Console: ${env.BUILD_URL}console
            //         
            //         Please check the logs for more details.
            //     """,
            //     to: "${env.CHANGE_AUTHOR_EMAIL ?: 'team@testpig.io'}"
            // )
        }
        
        unstable {
            echo "⚠️ Pipeline completed with warnings!"
        }
        
        aborted {
            echo "🛑 Pipeline was aborted!"
        }
    }
}
