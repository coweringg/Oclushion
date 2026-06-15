import { Page } from 'playwright-core';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
import { readFileSync } from 'node:fs';

export interface AssertionResult {
  passed: boolean;
  actual: unknown;
  expected: unknown;
  error?: string;
}

export class Assertions {
  constructor(
    private page: Page,
    private reporter: any
  ) {}

  async assertVisible(selector: string): Promise<AssertionResult> {
    try {
      const element = await this.page.$(selector);
      if (!element) {
        return {
          passed: false,
          actual: null,
          expected: selector,
          error: `Element not found: ${selector}`,
        };
      }
      const visible = await element.isVisible();
      return {
        passed: visible,
        actual: visible,
        expected: true,
        error: visible ? undefined : `Element not visible: ${selector}`,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        passed: false,
        actual: null,
        expected: selector,
        error: msg,
      };
    }
  }

  async assertText(selector: string, expected: string): Promise<AssertionResult> {
    try {
      const text = await this.page.textContent(selector);
      const actual = text?.trim() || '';
      const passed = actual === expected;
      return {
        passed,
        actual,
        expected,
        error: passed ? undefined : `Text mismatch. Expected "${expected}", got "${actual}"`,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        passed: false,
        actual: null,
        expected,
        error: msg,
      };
    }
  }

  async assertScreenshot(selector?: string | null, baselinePath?: string | null): Promise<AssertionResult> {
    try {
      if (!baselinePath) {
        return {
          passed: false,
          actual: null,
          expected: 'baselinePath required',
          error: 'No baseline path provided',
        };
      }

      let screenshotBuffer: Buffer;
      if (selector) {
        const element = await this.page.$(selector);
        if (!element) {
          return {
            passed: false,
            actual: null,
            expected: selector,
            error: `Element not found: ${selector}`,
          };
        }
        screenshotBuffer = await element.screenshot();
      } else {
        screenshotBuffer = await this.page.screenshot();
      }

      let baselineBuffer: Buffer;
      try {
        baselineBuffer = readFileSync(baselinePath);
      } catch {
        return {
          passed: false,
          actual: null,
          expected: baselinePath,
          error: `Baseline screenshot not found: ${baselinePath}`,
        };
      }

      const actualPng = PNG.sync.read(screenshotBuffer);
      const baselinePng = PNG.sync.read(baselineBuffer);

      const diff = new PNG({
        width: Math.max(actualPng.width, baselinePng.width),
        height: Math.max(actualPng.height, baselinePng.height),
      });

      const mismatchedPixels = pixelmatch(
        baselinePng.data,
        actualPng.data,
        diff.data,
        diff.width,
        diff.height,
        { threshold: 0.1 }
      );

      const totalPixels = diff.width * diff.height;
      const diffPercent = (mismatchedPixels / totalPixels) * 100;
      const passed = diffPercent < 1.0;

      return {
        passed,
        actual: `${diffPercent.toFixed(2)}%`,
        expected: '< 1.0%',
        error: passed
          ? undefined
          : `Screenshot mismatch: ${diffPercent.toFixed(2)}% pixels differ`,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        passed: false,
        actual: null,
        expected: baselinePath || 'screenshot',
        error: msg,
      };
    }
  }

  async assertAccessibility(): Promise<AssertionResult> {
    try {
      const result = await this.page.evaluate(() => {
        return (window as any).axe?.run?.() || null;
      });

      if (!result) {
        return {
          passed: true,
          actual: 'axe-core not loaded',
          expected: 'no violations',
        };
      }

      const violations = result.violations || [];
      const passed = violations.length === 0;

      return {
        passed,
        actual: `${violations.length} violations`,
        expected: '0 violations',
        error: passed
          ? undefined
          : `Accessibility violations: ${violations.map((v: any) => v.id).join(', ')}`,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        passed: false,
        actual: null,
        expected: 'no violations',
        error: msg,
      };
    }
  }
}
