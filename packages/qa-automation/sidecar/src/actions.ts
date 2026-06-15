import { Stagehand } from '@browserbasehq/stagehand';
import { Page } from 'playwright-core';

export class Actions {
  constructor(
    private stagehand: Stagehand,
    private page: Page,
    private reporter: any
  ) {}

  async navigate(url: string): Promise<void> {
    await this.page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
  }

  async click(selector: string): Promise<void> {
    try {
      await this.stagehand.act({ action: `click the element "${selector}"` });
    } catch {
      await this.selfHealingClick(selector);
    }
  }

  private async selfHealingClick(hint: string): Promise<void> {
    const observations = await this.stagehand.observe({
      instruction: `find clickable element related to: ${hint}`,
    });

    if (observations && observations.length > 0) {
      const target = observations[0];
      const selector = target.selector;
      if (selector) {
        await this.page.click(selector);
        return;
      }
    }

    throw new Error(`Could not find element to click: ${hint}`);
  }

  async type(selector: string, text: string): Promise<void> {
    try {
      await this.stagehand.act({ action: `type "${text}" into the element "${selector}"` });
    } catch {
      await this.selfHealingType(selector, text);
    }
  }

  private async selfHealingType(hint: string, text: string): Promise<void> {
    const observations = await this.stagehand.observe({
      instruction: `find input or textarea related to: ${hint}`,
    });

    if (observations && observations.length > 0) {
      const target = observations[0];
      const selector = target.selector;
      if (selector) {
        await this.page.fill(selector, text);
        return;
      }
    }

    throw new Error(`Could not find input to type into: ${hint}`);
  }

  async select(selector: string, value: string): Promise<void> {
    try {
      await this.page.selectOption(selector, value);
    } catch {
      const observations = await this.stagehand.observe({
        instruction: `find select element related to: ${selector}`,
      });

      if (observations && observations.length > 0) {
        const target = observations[0];
        const sel = target.selector;
        if (sel) {
          await this.page.selectOption(sel, value);
          return;
        }
      }

      throw new Error(`Could not find select element: ${selector}`);
    }
  }

  async wait(ms: number): Promise<void> {
    await this.page.waitForTimeout(ms);
  }

  async extract(selector: string): Promise<string> {
    try {
      const text = await this.page.textContent(selector);
      return text?.trim() || '';
    } catch {
      const observations = await this.stagehand.observe({
        instruction: `find element to extract text from related to: ${selector}`,
      });

      if (observations && observations.length > 0) {
        const target = observations[0];
        const sel = target.selector;
        if (sel) {
          const text = await this.page.textContent(sel);
          return text?.trim() || '';
        }
      }

      throw new Error(`Could not extract text from: ${selector}`);
    }
  }
}
