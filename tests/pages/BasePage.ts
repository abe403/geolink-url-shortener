import { Page, Locator, expect } from '@playwright/test';

/**
 * BasePage — Abstract base class for all Page Objects.
 * Encapsulates common wait strategies and assertion helpers
 * following the Page Object Model (POM) design pattern.
 */
export abstract class BasePage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  /** Navigate to a relative path and wait for the network to settle. */
  async navigate(path: string = '/'): Promise<void> {
    await this.page.goto(path, { waitUntil: 'networkidle' });
  }

  /** Wait for an element to be visible and return it. */
  async waitForElement(selector: string): Promise<Locator> {
    const el = this.page.locator(selector);
    await expect(el).toBeVisible();
    return el;
  }

  /** Type into an input, clearing it first. */
  async fillInput(selector: string, value: string): Promise<void> {
    const input = this.page.locator(selector);
    await input.clear();
    await input.fill(value);
  }

  /** Get inner text from a locator. */
  async getText(selector: string): Promise<string> {
    return (await this.page.locator(selector).innerText()).trim();
  }

  /** Take a named screenshot (useful in debugging). */
  async screenshot(name: string): Promise<void> {
    await this.page.screenshot({ path: `screenshots/${name}.png`, fullPage: true });
  }
}
