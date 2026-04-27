import { test, expect } from '@playwright/test';
import { DashboardPage } from '../../pages/DashboardPage';
import { TEST_URLS, TIMEOUTS, PAGINATION } from '../../utils/test-data';

/**
 * Test Suite: URL Shortener — Core Functionality
 *
 * Covers:
 *  - URL input validation (with/without https protocol)
 *  - Successful link creation and sidebar update
 *  - Analytics panel title formatting (domain display)
 *  - Automated website IP mapping after shortening
 *  - Pagination of the Recent Links section
 */
test.describe('URL Shortener — Core Functionality', () => {
  let dashboard: DashboardPage;

  test.beforeEach(async ({ page }) => {
    dashboard = new DashboardPage(page);
    await dashboard.open();
  });

  // ── Input Validation ───────────────────────────────────────────

  test('should display error when submitting an empty URL', async ({ page }) => {
    await dashboard.shortenButton.click();
    await expect(dashboard.urlErrorMessage).toBeVisible();
    await expect(dashboard.urlErrorMessage).toContainText('Please enter a URL');
  });

  test('should accept a URL without https:// protocol', async ({ page }) => {
    // Requirement: plain "www.reddit.com" should work without errors
    await dashboard.urlInput.fill(TEST_URLS.valid.withWww);
    await dashboard.shortenButton.click();

    // Error should NOT appear
    await expect(dashboard.urlErrorMessage).not.toBeVisible();

    // New link should appear in the sidebar
    await expect(page.locator('.short-url-link').first())
      .toBeVisible({ timeout: TIMEOUTS.shortening });
  });

  test('should accept a full https:// URL', async ({ page }) => {
    await dashboard.urlInput.fill(TEST_URLS.valid.withProtocol);
    await dashboard.shortenButton.click();
    await expect(page.locator('.short-url-link').first())
      .toBeVisible({ timeout: TIMEOUTS.shortening });
  });

  test('should display the Shorten Link button in loading state during request', async ({ page }) => {
    await dashboard.urlInput.fill(TEST_URLS.valid.withProtocol);

    // Click and immediately verify button label changes
    const clickPromise = dashboard.shortenButton.click();
    await expect(dashboard.shortenButton).toHaveText('Shortening...');
    await clickPromise;
  });

  // ── Analytics Panel ────────────────────────────────────────────

  test('should display domain name (not short code) in analytics title', async ({ page }) => {
    const shortCode = await dashboard.shortenUrl(TEST_URLS.valid.withProtocol);

    // Title should contain the domain, e.g. "Analytics for www.example.com"
    const title = await dashboard.getAnalyticsTitle();
    expect(title).toContain('Analytics for');
    expect(title).toContain('example.com');
    expect(title).not.toContain(shortCode);  // must NOT show the short code
  });

  test('should show correct domain for URL with path', async ({ page }) => {
    await dashboard.shortenUrl(TEST_URLS.valid.withPath);
    const title = await dashboard.getAnalyticsTitle();
    expect(title).toContain('www.reddit.com');
  });

  test('should show the new link in the Recent Links sidebar', async ({ page }) => {
    await dashboard.shortenUrl(TEST_URLS.valid.withProtocol);
    await expect(dashboard.recentLinksList.first()).toBeVisible();
  });

  // ── Website IP Mapping ─────────────────────────────────────────

  test('should populate Website IP card after shortening a URL', async ({ page }) => {
    await dashboard.shortenUrl(TEST_URLS.valid.withPath);

    // The Website IP card should update from "N/A" to a real IP
    await expect(dashboard.websiteIpCard.locator('div').last())
      .not.toHaveText('N/A', { timeout: TIMEOUTS.geolocation });

    const ip = await dashboard.getWebsiteIp();
    // Basic IP format validation
    expect(ip).toMatch(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/);
  });

  test('should display a map marker after shortening a URL', async ({ page }) => {
    await dashboard.shortenUrl(TEST_URLS.valid.withPath);
    await dashboard.waitForMapMarker();

    // Marker should be present on the Leaflet map
    await expect(page.locator('.leaflet-marker-icon').first()).toBeVisible();
  });

  test('should show Top Region and Latest City after shortening', async ({ page }) => {
    await dashboard.shortenUrl(TEST_URLS.valid.withPath);
    await dashboard.waitForAnalyticsData();

    const region = await dashboard.topRegionCard.locator('div').last().innerText();
    const city = await dashboard.latestCityCard.locator('div').last().innerText();

    expect(region).not.toBe('N/A');
    expect(city).not.toBe('N/A');
  });

  // ── Pagination ────────────────────────────────────────────────

  test(`should show at most ${PAGINATION.pageSize} links per page`, async ({ page }) => {
    // Shorten enough URLs to trigger pagination
    for (let i = 0; i < PAGINATION.pageSize + 2; i++) {
      await dashboard.urlInput.fill(`https://example.com/page-${i}`);
      await dashboard.shortenButton.click();
      await page.waitForTimeout(300);
    }

    const visibleCount = await dashboard.getVisibleLinkCount();
    expect(visibleCount).toBeLessThanOrEqual(PAGINATION.pageSize);
  });

  test('should show page indicator when links exceed page size', async ({ page }) => {
    for (let i = 0; i < PAGINATION.pageSize + 1; i++) {
      await dashboard.urlInput.fill(`https://example.com/pg-${i}`);
      await dashboard.shortenButton.click();
      await page.waitForTimeout(300);
    }

    await expect(dashboard.pageIndicator).toBeVisible();
  });

  test('should navigate to next page and show different links', async ({ page }) => {
    for (let i = 0; i < PAGINATION.pageSize + 2; i++) {
      await dashboard.urlInput.fill(`https://example.com/nav-${i}`);
      await dashboard.shortenButton.click();
      await page.waitForTimeout(300);
    }

    const firstPageItems = await page.locator('.short-url-link').allInnerTexts();
    await dashboard.goToNextPage();

    const secondPageItems = await page.locator('.short-url-link').allInnerTexts();
    expect(firstPageItems).not.toEqual(secondPageItems);
  });

  test('should disable Prev button on first page', async ({ page }) => {
    for (let i = 0; i < PAGINATION.pageSize + 1; i++) {
      await dashboard.urlInput.fill(`https://example.com/p${i}`);
      await dashboard.shortenButton.click();
      await page.waitForTimeout(300);
    }

    await expect(dashboard.paginationPrev).toBeDisabled();
    await expect(dashboard.paginationNext).toBeEnabled();
  });
});
