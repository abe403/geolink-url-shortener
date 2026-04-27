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
  readonly mapContainer: Locator;
  readonly recentLinksList: Locator;
  readonly paginationPrev: Locator;
  readonly paginationNext: Locator;
  readonly pageIndicator: Locator;
  readonly testLinkButton: Locator;

  // Stats card value locators — target the SECOND div inside each .glass-card
  // DOM: <div class="glass-card"><div>Top Region</div><div>{value}</div></div>
  readonly topRegionValue: Locator;
  readonly latestCityValue: Locator;
  readonly websiteIpValue: Locator;

  constructor(page: Page) {
    super(page);

    this.urlInput = page.locator('input[placeholder*="example.com"]');
    this.shortenButton = page.locator('button[type="submit"]');
    this.urlErrorMessage = page.locator('p').filter({ hasText: /Please enter|Failed to/ });

    this.ipLookupInput = page.locator('input[placeholder*="8.8.8.8"]');
    // Precise: the button immediately following the IP input (same .input-group row)
    this.ipLookupButton = page.locator('div.input-group button').filter({ has: page.locator('svg') });

    this.analyticsTitle = page.locator('h2');
    this.interactionCount = page.locator('p').filter({ hasText: 'total interactions' });
    this.mapContainer = page.locator('.map-container');
    this.recentLinksList = page.locator('.url-item');
    this.paginationPrev = page.locator('button').filter({ hasText: '← Prev' });
    this.paginationNext = page.locator('button').filter({ hasText: 'Next →' });
    this.pageIndicator = page.locator('span').filter({ hasText: /\d+ \/ \d+/ });
    this.testLinkButton = page.locator('button').filter({ hasText: 'Test Link' });

    // Stats cards: each card is a .glass-card with two divs (label + value).
    // We locate the VALUE div by targeting the second child of the card
    // that contains the specific label text.
    this.topRegionValue = page.locator('.stats-grid .glass-card')
      .filter({ has: page.locator('div', { hasText: 'Top Region' }) })
      .locator('div:last-child');

    this.latestCityValue = page.locator('.stats-grid .glass-card')
      .filter({ has: page.locator('div', { hasText: 'Latest City' }) })
      .locator('div:last-child');

    this.websiteIpValue = page.locator('.stats-grid .glass-card')
      .filter({ has: page.locator('div', { hasText: 'Website IP' }) })
      .locator('div:last-child');
  }

  // ── Actions ───────────────────────────────────────────────────────

  /** Navigate to the dashboard homepage. */
  async open(): Promise<void> {
    await this.navigate('/');
    await expect(this.urlInput).toBeVisible();
  }

  /** Shorten a URL and wait for both the sidebar AND the analytics h2 to update. */
  async shortenUrl(rawUrl: string): Promise<string> {
    await this.urlInput.fill(rawUrl);
    await this.shortenButton.click();

    // Wait for the new link to appear in the sidebar
    const firstItem = this.page.locator('.short-url-link').first();
    await expect(firstItem).toBeVisible({ timeout: TIMEOUTS.shortening });

    // Also wait for the analytics title to switch away from "Global Click Map"
    await expect(this.analyticsTitle).not.toHaveText('Global Click Map', { timeout: TIMEOUTS.shortening });

    return (await firstItem.innerText()).replace('/', '').trim();
  }

  /** Perform an IP or domain lookup and wait for the marker to appear. */
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

  /** Wait until the Top Region card shows a non-N/A value. */
  async waitForAnalyticsData(): Promise<void> {
    await expect(this.topRegionValue)
      .not.toHaveText('N/A', { timeout: TIMEOUTS.geolocation });
  }

  /** Returns the current analytics title text. */
  async getAnalyticsTitle(): Promise<string> {
    return this.getText('h2');
  }

  /** Navigate to the next page and wait for the list to update. */
  async goToNextPage(): Promise<void> {
    const before = await this.page.locator('.short-url-link').first().innerText();
    await this.paginationNext.click();
    // Wait until the first item changes (page actually flipped)
    await expect(this.page.locator('.short-url-link').first()).not.toHaveText(before, { timeout: 3000 });
  }

  /** Navigate to the previous page and wait for the list to update. */
  async goToPrevPage(): Promise<void> {
    const before = await this.page.locator('.short-url-link').first().innerText();
    await this.paginationPrev.click();
    await expect(this.page.locator('.short-url-link').first()).not.toHaveText(before, { timeout: 3000 });
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
    return this.websiteIpValue.innerText();
  }
}
