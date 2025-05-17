import { Reporter, File, Task, TaskResult, TaskResultPack } from 'vitest';
import { TestEventHandler } from '@testpig/core';
import { v4 as uuidv4 } from 'uuid';
import { TestBodyCache } from './test-body-cache';
import { createLogger, TestEventsEnum } from '@testpig/shared';

interface SuiteInfo {
  id: string;
  title: string;
  file: string;
  testCount: number;
  parentId?: string;  // Track parent suite relationship
}

class VitestReporter implements Reporter {
  private eventHandler: TestEventHandler;
  private failureCount: number = 0;
  private suiteMap = new Map<string, string>(); // Vitest ID -> Our UUID
  private testMap = new Map<string, string>();  // Vitest ID -> Our UUID
  private testBodyCache = new TestBodyCache();
  private ctx?: any;
  private logger = createLogger('VitestReporter');

  constructor(options: { projectId: string; runId?: string }) {
    const projectId = options.projectId || process.env.TESTPIG_PROJECT_ID;
    const runId = options.runId || process.env.TESTPIG_RUN_ID;

    if (!projectId) {
      throw new Error('projectId is required in reporter options or set in TESTPIG_PROJECT_ID environment variable');
    }
    this.eventHandler = new TestEventHandler(projectId, runId);
    this.logger.info(`Initialized with projectId: ${projectId}, runId: ${runId || 'not specified'}`);
  }

  onInit(ctx?: any) {
    this.ctx = ctx;
    this.logger.info('Test run starting');
    const data = this.eventHandler.eventNormalizer.normalizeRunStart();
    this.eventHandler.queueEvent(TestEventsEnum.RUN_START, data);
  }

  onCollected() {
    this.logger.debug('Test collection completed');
  }

  onTaskUpdate(packs: Array<TaskResultPack>) {
    this.logger.debug(`Received task updates: ${packs.length} tasks`);
    
    for (const [id, result, meta] of packs) {
      const task = this.getTask(id);
      if (!task) {
        this.logger.debug(`Task not found: ${id}`);
        continue;
      }

      // Cache test bodies when we encounter a new file
      if (task.file?.filepath) {
        this.logger.debug(`Caching test bodies for file: ${task.file.filepath}`);
        this.testBodyCache.cacheTestBodies(task.file.filepath);
      }

      if (task.type === 'suite' && task.name !== task.file?.name) {
        // This is a describe block (not the file-level suite)
        if (!this.suiteMap.has(task.id)) {
          const suiteId = uuidv4();
          this.suiteMap.set(task.id, suiteId);
          this.logger.debug(`Suite started: ${task.name}, ID: ${suiteId}`);
 
          const data = this.eventHandler.eventNormalizer.normalizeSuiteStart(
            suiteId,
            task.name,
            task.file?.filepath || '',
            task.tasks?.length || 0,
            {
              os: process.platform,
              architecture: process.arch,
              browser: 'Node.js',
              framework: 'Vitest',
              frameworkVersion: require('vitest/package.json').version
            },
            'unit'
          );
          this.eventHandler.queueEvent(TestEventsEnum.SUITE_START, data);
        }

        if (result?.state === 'pass' || result?.state === 'fail') {
          const suiteId = this.suiteMap.get(task.id);
          if (suiteId) {
            this.logger.debug(`Suite ended: ${task.name}, ID: ${suiteId}, result: ${result.state}`);
            const data = this.eventHandler.eventNormalizer.normalizeSuiteEnd(
              suiteId,
              task.name,
              result.state === 'fail'
            );
            this.eventHandler.queueEvent(TestEventsEnum.SUITE_END, data);
          }
        }
      } else if (task.type === 'test') {
        // Get the parent suite ID from the task's ID structure
        const parentSuiteId = task.id.substring(0, task.id.lastIndexOf('_'));
        const suiteId = this.suiteMap.get(parentSuiteId);
        
        if (!suiteId) {
          this.logger.debug(`Parent suite not found for test: ${task.name}, parent ID: ${parentSuiteId}`);
          continue;
        }

        if (!this.testMap.has(task.id)) {
          const testId = uuidv4();
          this.testMap.set(task.id, testId);
          this.logger.debug(`Test started: ${task.name}, ID: ${testId}`);
 
          const testBody = task.file?.filepath 
            ? this.testBodyCache.getTestBody(task.file.filepath, task.name)
            : '';

          const data = this.eventHandler.eventNormalizer.normalizeTestStart(
            testId,
            task.name,
            task.file?.filepath || '',
            testBody,
            {
              rabbitMqId: suiteId,
              title: task.suite?.name || ''
            }
          );
          this.eventHandler.queueEvent(TestEventsEnum.TEST_START, data);
        }

        if (result?.state === 'pass' || result?.state === 'fail') {
          const testId = this.testMap.get(task.id);
          if (!testId) continue;

          if (result.state === 'pass') {
            this.logger.debug(`Test passed: ${task.name}, ID: ${testId}, duration: ${result.duration}ms`);
            const data = this.eventHandler.eventNormalizer.normalizeTestPass({
              testId,
              title: task.name,
              duration: result.duration || 0,
              testSuite: {
                rabbitMqId: suiteId,
                title: task.suite?.name || ''
              }
            });
            this.eventHandler.queueEvent(TestEventsEnum.TEST_PASS, data);
          } else {
            this.failureCount++;
            this.logger.debug(`Test failed: ${task.name}, ID: ${testId}`);
            if (result.errors?.[0]?.message) {
              this.logger.debug(`Error: ${result.errors[0].message}`);
            }
            
            const data = this.eventHandler.eventNormalizer.normalizeTestFail({
              testId,
              title: task.name,
              error: result.errors?.[0]?.message || 'Test failed',
              stack: result.errors?.[0]?.stack || '',
              testSuite: {
                rabbitMqId: suiteId,
                title: task.suite?.name || ''
              }
            });
            this.eventHandler.queueEvent(TestEventsEnum.TEST_FAIL, data);
          }
        }
      }
    }
  }

  async onFinished() {
    this.logger.info("Finishing Vitest test run, waiting for API calls to complete...");
    const data = this.eventHandler.eventNormalizer.normalizeRunEnd(this.failureCount > 0);
    this.eventHandler.queueEvent(TestEventsEnum.RUN_END, data);
    
    try {
      // Process the event queue and wait for it to complete
      await this.eventHandler.processEventQueue();
      
      // Add a delay to ensure network requests have time to complete
      this.logger.info("Waiting for network requests to complete...");
      await new Promise(resolve => setTimeout(resolve, 2000));
      this.logger.info("Network wait period complete, exiting normally");
    } catch (error) {
      this.logger.error("Error processing event queue:", error);
    }
    
    this.testMap.clear();
    this.suiteMap.clear();
    this.testBodyCache.clear();
  }

  private getTask(id: string): Task | undefined {
    return this.ctx?.state?.idMap?.get(id);
  }
}

export default VitestReporter;