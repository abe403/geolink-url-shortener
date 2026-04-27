import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';
import { TIMEOUTS } from '../utils/test-data';

/**
 * DashboardPage — Page Object for the GEO.LINK analytics dashboard.
 * Maps all interactive UI elements to typed methods.
 * Tests should NEVER use raw selectors — only methods from this class.
 */
export class DashboardPage extends BasePage {
  // ── Locators ──────────────────────────────────────────────────────
  readonly urlInput: Locator;
  readonly shortenButton: Locator;
  readonly urlErrorMessage: Locator;
  readonly ipLookupInput: Locator;
  readonly ipLookupButton: Locator;
  readonly analyticsTitle: Locator;
  readonly interactionCount: Locator;
  readonly topRegionCard: Locator;
  readonly latestCityCard: Locator;
  readonly websiteIpCard: Locator;
  readonly mapContainer: Locator;
  readonly recentLinksList: Locator;
  readonly paginationPrev: Locator;
  readonly paginationNext: Locator;
  readonly pageIndicator: Locator;
  readonly testLinkButton: Locator;

  constructor(page: Page) {
    super(page);

    this.urlInput = page.locator('input[placeholder*="example.com"]');
    this.shortenButton = page.locator('button[type="submit"]');
    this.urlErrorMessage = page.locator('p').filter({ hasText: /Please enter|Failed to/ });
    this.ipLookupInput = page.locator('input[placeholder*="8.8.8.8"]');
    this.ipLookupButton = page.locator('button').filter({ has: page.locator('svg') }).last();
    this.analyticsTitle = page.locator('h2');
    this.interactionCount = page.locator('p').filter({ hasText: 'total interactions' });
    this.topRegionCard = page.locator('div').filter({ hasText: 'Top Region' }).last();
    this.latestCityCard = page.locator('div').filter({ hasText: 'Latest City' }).last();
    this.websiteIpCard = page.locator('div').filter({ hasText: 'Website IP' }).last();
    this.mapContainer = page.locator('.map-container');
    this.recentLinksList = page.locator('.url-item');
    this.paginationPrev = page.locator('button').filter({ hasText: '← Prev' });
    this.paginationNext = page.locator('button').filter({ hasText: 'Next →' });
    this.pageIndicator = page.locator('span').filter({ hasText: /\d+ \/ \d+/ });
    this.testLinkButton = page.locator('button').filter({ hasText: 'Test Link' });
  }

  // ── Actions ───────────────────────────────────────────────────────

  /** Navigate to the dashboard homepage. */
  async open(): Promise<void> {
    await this.navigate('/');
    await expect(this.urlInput).toBeVisible();
  }

  /** Shorten a URL and return its short code by waiting for the new list item. */
  async shortenUrl(rawUrl: string): Promise<string> {
    await this.urlInput.fill(rawUrl);
    await this.shortenButton.click();

    // Wait for the new link to appear in the sidebar
    const firstItem = this.page.locator('.short-url-link').first();
    await expect(firstItem).toBeVisible({ timeout: TIMEOUTS.shortening });
    return (await firstItem.innerText()).replace('/', '').trim();
  }

  /** Perform an IP or domain lookup and wait for the analytics to update. */
  async lookupIpOrDomain(query: string): Promise<void> {
    await this.ipLookupInput.fill(query);
    await this.ipLookupButton.click();
  }

  /** Click a recent link item by its index (0-based). */
  async selectRecentLink(index: number): Promise<void> {
    await this.recentLinksList.nth(index).click();
  }

  /** Wait until a waypoint (map marker) is visible on the map. */
  async waitForMapMarker(): Promise<void> {
    await expect(this.page.locator('.leaflet-marker-icon').first())
      .toBeVisible({ timeout: TIMEOUTS.geolocation });
  }

  /** Wait until the analytics stats cards show non-N/A values. */
  async waitForAnalyticsData(): Promise<void> {
    await expect(this.topRegionCard.locator('div').last())
      .not.toHaveText('N/A', { timeout: TIMEOUTS.geolocation });
  }

  /** Returns the current analytics title text. */
  async getAnalyticsTitle(): Promise<string> {
    return this.getText('h2');
  }

  /** Navigate to the next page of recent links. */
  async goToNextPage(): Promise<void> {
    await this.paginationNext.click();
  }

  /** Navigate to the previous page of recent links. */
  async goToPrevPage(): Promise<void> {
    await this.paginationPrev.click();
  }

  /** Returns the page indicator text, e.g. "2 / 3". */
  async getPageIndicatorText(): Promise<string> {
    return this.getText('span:has-text("/ ")');
  }

  /** Returns the count of visible recent link items on the current page. */
  async getVisibleLinkCount(): Promise<number> {
    return this.recentLinksList.count();
  }

  /** Returns the stat card value for Website IP. */
  async getWebsiteIp(): Promise<string> {
    return this.websiteIpCard.locator('div').last().innerText();
  }
}
