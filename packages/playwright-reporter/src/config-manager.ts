// src/config-manager.ts
import { FullConfig, TestCase, FullProject } from '@playwright/test/reporter';
import { ScreenshotMode } from '@playwright/test';
import path from 'path';
import { createLogger } from '@testpig/shared';

interface ProjectConfig {
    name: string;
    outputDir: string;
    browser: {
        name: string;
        version: null;
        viewPort: string;
        platform: string;
    };
    screenshotConfig: {
        mode: ScreenshotMode;
    };
}

export class PlaywrightConfigManager {
    private projects: Map<string, ProjectConfig> = new Map();
    private logger = createLogger('PlaywrightConfigManager');

    constructor(config: FullConfig) {
        this.initializeProjects(config);
    }

    private initializeProjects(config: FullConfig) {
        config.projects.forEach(project => {
            const projectConfig: ProjectConfig = {
                name: project.name,
                outputDir: this.resolveOutputDir(project),
                browser: this.getBrowserInfo(project),
                screenshotConfig: this.getScreenshotConfig(project)
            };

            this.logger.warn(`Project config: ${project.name}`, JSON.stringify(projectConfig, null, 2));
            
            this.projects.set(project.name, projectConfig);
            this.logger.debug(`Initialized project config: ${project.name}`, projectConfig);
        });
    }

    private resolveOutputDir(project: FullProject): string {
        // Handle both absolute and relative paths
        return path.isAbsolute(project.outputDir) 
            ? project.outputDir 
            : path.resolve(process.cwd(), project.outputDir);
    }

    private getBrowserInfo(project: FullProject) {
        const use = project.use || {};
        return {
            name: project.name,  // chromium, firefox, webkit
            version: null,
            viewPort: JSON.stringify(use.viewport),
            platform: process.platform
        };
    }

    private getScreenshotConfig(project: FullProject) {
        const use = project.use || {};
        return {
            mode: use.screenshot as ScreenshotMode
        };
    }

    getProjectConfig(test: TestCase): ProjectConfig | undefined {
        const projectName = test.parent?.project()?.name;
        if (!projectName) return undefined;
        return this.projects.get(projectName);
    }

    getScreenshotPath(test: TestCase): string | undefined {
        const projectConfig = this.getProjectConfig(test);
        if (!projectConfig) return undefined;

        const testFileName = test.location.file.split('/').pop()?.replace(/\.[^/.]+$/, '');
        const screenshotName = `${test.title.replace(/[^a-zA-Z0-9]/g, '_')}-failed-1.png`;
        
        return path.join(
            projectConfig.outputDir,
            `${testFileName}-snapshots`,
            screenshotName
        );
    }

    getBrowserDetails(test: TestCase) {
        return this.getProjectConfig(test)?.browser;
    }

    isScreenshotEnabled(test: TestCase): boolean {
        const config = this.getProjectConfig(test);
        if (!config) return false;

        const mode = config.screenshotConfig.mode;
        return mode === 'on' || mode === 'only-on-failure';
    }
}   