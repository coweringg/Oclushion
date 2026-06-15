import { Stagehand } from '@browserbasehq/stagehand';
import { BrowserContext, Page, chromium } from 'playwright-core';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { Actions } from './actions.js';
import { Assertions } from './assertions.js';
import { Reporter } from './reporter.js';

const BROWSER_DIR = process.env.OCLUSHOIN_BROWSER_DIR || join(homedir(), '.oclushion', 'browser');
const QA_DIR = process.env.OCLUSHOIN_QA_DIR || join(homedir(), '.oclushion', 'qa');

interface ViewportSpec {
  width: number;
  height: number;
  label: string;
}

interface TestStepSpec {
  action: string;
  selector_hint?: string | null;
  value?: string | null;
  wait_ms?: number | null;
}

interface TestSpec {
  id: string;
  description: string;
  url: string;
  steps: TestStepSpec[];
  timeout_ms: number;
  viewports: ViewportSpec[];
}

interface EvidenceFile {
  path: string;
  kind: string;
  size_bytes: number;
}

interface StepResult {
  passed: boolean;
  step_index: number;
  action: string;
  error?: string;
  evidence: EvidenceFile[];
}

interface TestResult {
  spec_id: string;
  passed: boolean;
  steps_passed: number;
  steps_failed: number;
  evidence: EvidenceFile[];
  duration_ms: number;
  failure_reason?: string;
  timestamps: {
    started_at: string;
    completed_at: string;
  };
}

export class BrowserEngine {
  private stagehand: Stagehand | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private ready = false;
  private activeTests = 0;
  private cancelledTests = new Set<string>();

  isReady(): boolean {
    return this.ready;
  }

  activeTestCount(): number {
    return this.activeTests;
  }

  cancelTest(testId: string): void {
    this.cancelledTests.add(testId);
  }

  async initPlaywright(): Promise<void> {
    if (this.ready) return;

    if (!existsSync(BROWSER_DIR)) {
      mkdirSync(BROWSER_DIR, { recursive: true });
    }
    if (!existsSync(QA_DIR)) {
      mkdirSync(QA_DIR, { recursive: true });
    }

    const browser = await chromium.launch({
      headless: true,
      downloadsPath: BROWSER_DIR,
    });

    this.context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      ignoreHTTPSErrors: true,
    });

    this.page = await this.context.newPage();

    await this.page.route('***', async (route) => {
      const url = route.request().url();
      const hostname = new URL(url).hostname;
      if (hostname === 'localhost' || hostname === '127.0.0.1') {
        await route.continue();
      } else if (
        url.startsWith('data:') ||
        url.startsWith('blob:') ||
        url.startsWith('file:')
      ) {
        await route.continue();
      } else {
        await route.abort('blockedbyclient');
      }
    });

    this.stagehand = new Stagehand({
      browser,
      page: this.page,
      verbose: 0,
      domSettleTimeoutMs: 5000,
    });

    await this.stagehand.init();

    this.ready = true;
  }

  async runTest(spec: TestSpec): Promise<TestResult> {
    this.activeTests++;
    const startedAt = new Date().toISOString();
    const startTime = Date.now();

    const allEvidence: EvidenceFile[] = [];
    let totalPassed = 0;
    let totalFailed = 0;
    let failureReason: string | undefined;

    try {
      for (const viewport of spec.viewports) {
        if (this.cancelledTests.has(spec.id)) {
          failureReason = 'Test was cancelled';
          break;
        }

        const vpResult = await this.runTestForViewport(spec, viewport);
        allEvidence.push(...vpResult.evidence);
        totalPassed += vpResult.stepsPassed;
        totalFailed += vpResult.stepsFailed;

        if (vpResult.failureReason) {
          failureReason = vpResult.failureReason;
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      failureReason = msg;
      totalFailed++;
    } finally {
      this.activeTests--;
      this.cancelledTests.delete(spec.id);
    }

    const duration = Date.now() - startTime;
    const completedAt = new Date().toISOString();

    return {
      spec_id: spec.id,
      passed: totalFailed === 0,
      steps_passed: totalPassed,
      steps_failed: totalFailed,
      evidence: allEvidence,
      duration_ms: duration,
      failure_reason: failureReason,
      timestamps: {
        started_at: startedAt,
        completed_at: completedAt,
      },
    };
  }

  private async runTestForViewport(
    spec: TestSpec,
    viewport: ViewportSpec
  ): Promise<{
    evidence: EvidenceFile[];
    stepsPassed: number;
    stepsFailed: number;
    failureReason?: string;
  }> {
    const reporter = new Reporter(spec.id, QA_DIR);
    const actions = new Actions(this.stagehand!, this.page!, reporter);
    const assertions = new Assertions(this.page!, reporter);

    const evidence: EvidenceFile[] = [];
    let stepsPassed = 0;
    let stepsFailed = 0;
    let failureReason: string | undefined;

    if (this.page) {
      await this.page.setViewportSize({ width: viewport.width, height: viewport.height });
    }

    for (let i = 0; i < spec.steps.length; i++) {
      if (this.cancelledTests.has(spec.id)) {
        failureReason = 'Test was cancelled';
        break;
      }

      const step = spec.steps[i];

      try {
        switch (step.action) {
          case 'Navigate': {
            await actions.navigate(spec.url);
            const screenshot = await reporter.captureScreenshot(`step${i}_navigate`);
            evidence.push(screenshot);
            break;
          }

          case 'Click': {
            await actions.click(step.selector_hint!);
            break;
          }

          case 'Type': {
            await actions.type(step.selector_hint!, step.value!);
            break;
          }

          case 'Select': {
            await actions.select(step.selector_hint!, step.value!);
            break;
          }

          case 'AssertVisible': {
            const result = await assertions.assertVisible(step.selector_hint!);
            if (!result.passed) {
              throw new Error(`Element not visible: ${step.selector_hint} (expected: ${result.expected}, actual: ${result.actual})`);
            }
            break;
          }

          case 'AssertText': {
            const result = await assertions.assertText(step.selector_hint!, step.value!);
            if (!result.passed) {
              throw new Error(`Text mismatch: ${step.selector_hint} (expected: ${result.expected}, actual: ${result.actual})`);
            }
            break;
          }

          case 'AssertScreenshot': {
            const result = await assertions.assertScreenshot(step.selector_hint!, step.value);
            if (!result.passed) {
              throw new Error(`Screenshot mismatch: ${step.selector_hint} (diff: ${result.actual})`);
            }
            break;
          }

          case 'Wait': {
            await actions.wait(step.wait_ms || 1000);
            break;
          }

          case 'Extract': {
            await actions.extract(step.selector_hint!);
            break;
          }

          default: {
            throw new Error(`Unknown action: ${step.action}`);
          }
        }

        if (step.wait_ms && step.wait_ms > 0) {
          await actions.wait(step.wait_ms);
        }

        stepsPassed++;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        stepsFailed++;
        failureReason = `Step ${i} (${step.action}): ${msg}`;

        const screenshot = await reporter.captureScreenshot(`step${i}_failure`);
        evidence.push(screenshot);
        break;
      }
    }

    const stepEvidence = await reporter.finalize();
    evidence.push(...stepEvidence);

    return {
      evidence,
      stepsPassed,
      stepsFailed,
      failureReason,
    };
  }

  async captureScreenshot(
    url: string,
    viewport: ViewportSpec
  ): Promise<string> {
    if (!this.ready) {
      await this.initPlaywright();
    }

    if (this.page) {
      await this.page.setViewportSize({ width: viewport.width, height: viewport.height });
      await this.page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
      const screenshotDir = join(QA_DIR, 'screenshots');
      if (!existsSync(screenshotDir)) {
        mkdirSync(screenshotDir, { recursive: true });
      }
      const path = join(screenshotDir, `screenshot_${viewport.label}_${Date.now()}.png`);
      await this.page.screenshot({ path, fullPage: false });
      return path;
    }

    throw new Error('Page not initialized');
  }

  async close(): Promise<void> {
    if (this.stagehand) {
      try {
        await this.stagehand.close();
      } catch {
      }
    }
    this.ready = false;
  }
}
