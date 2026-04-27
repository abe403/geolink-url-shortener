import { test, expect } from '@playwright/test';
import { DashboardPage } from '../pages/DashboardPage';
import { TEST_IPS, TEST_URLS, TIMEOUTS } from '../utils/test-data';

/**
 * Test Suite: Map & Geolocation Analytics
 *
 * Covers:
 *  - Map rendering and visibility
 *  - IP lookup tool (raw IPs and domain names)
 *  - Camera (viewport) update on link selection
 *  - Analytics loaded from DB on page reload
 *  - Marker popup content accuracy
 */
test.describe('Map & Geolocation Analytics', () => {
  let dashboard: DashboardPage;

  test.beforeEach(async ({ page }) => {
    dashboard = new DashboardPage(page);
    await dashboard.open();
  });

  // ── Map Rendering ────────────────────────────────────────────

  test('should render the Leaflet map on load', async ({ page }) => {
    await expect(dashboard.mapContainer).toBeVisible();
    await expect(page.locator('.leaflet-container')).toBeVisible();
  });

  test('should show default "Global Click Map" title when no link is selected', async ({ page }) => {
    await expect(dashboard.analyticsTitle).toHaveText('Global Click Map');
  });

  test('should display tile layer (dark CARTO tiles)', async ({ page }) => {
    // .leaflet-tile-pane is always in the DOM and visible (unlike .leaflet-tile-container
    // which Leaflet marks visibility:hidden during zoom animation)
    await expect(page.locator('.leaflet-tile-pane')).toBeVisible();
  });

  // ── IP Lookup ────────────────────────────────────────────────

  test('should place a waypoint when looking up a valid IP address', async ({ page }) => {
    await dashboard.lookupIpOrDomain(TEST_IPS.google);

    await expect(page.locator('.leaflet-marker-icon').first())
      .toBeVisible({ timeout: TIMEOUTS.geolocation });
  });

  test('should place a waypoint when looking up a domain name', async ({ page }) => {
    await dashboard.lookupIpOrDomain(TEST_IPS.reddit);

    await expect(page.locator('.leaflet-marker-icon').first())
      .toBeVisible({ timeout: TIMEOUTS.geolocation });
  });

  test('should update stats cards after IP lookup', async ({ page }) => {
    await dashboard.lookupIpOrDomain(TEST_IPS.cloudflare);
    await dashboard.waitForAnalyticsData();

    const city = await dashboard.latestCityValue.innerText();
    expect(city).not.toBe('N/A');
  });

  test('should show the resolved IP in the Website IP card after lookup', async ({ page }) => {
    await dashboard.lookupIpOrDomain(TEST_IPS.cloudflare);

    // ip-api resolves 1.1.1.1 — that IP should appear in the card
    await expect(dashboard.websiteIpValue)
      .toHaveText(TEST_IPS.cloudflare, { timeout: TIMEOUTS.geolocation });
  });

  test('should show an error alert for an invalid IP', async ({ page }) => {
    page.once('dialog', async dialog => {
      expect(dialog.message()).toContain('Could not resolve');
      await dialog.accept();
    });

    await dashboard.lookupIpOrDomain(TEST_IPS.invalid);
  });

  // ── Camera / Viewport Update ──────────────────────────────────

  test('should update map viewport when selecting a recent link', async ({ page }) => {
    await dashboard.shortenUrl(TEST_URLS.valid.withPath);
    await dashboard.waitForMapMarker();

    // Reload and re-select to verify DB persistence + camera update
    await page.reload({ waitUntil: 'networkidle' });
    await expect(page.locator('.short-url-link').first()).toBeVisible({ timeout: 5000 });
    await dashboard.selectRecentLink(0);

    await expect(page.locator('.leaflet-marker-icon').first())
      .toBeVisible({ timeout: TIMEOUTS.geolocation });
  });

  // ── Marker Popup Content ─────────────────────────────────────

  test('should display location metadata in marker popup', async ({ page }) => {
    await dashboard.lookupIpOrDomain(TEST_IPS.google);

    await expect(page.locator('.leaflet-marker-icon').first())
      .toBeVisible({ timeout: TIMEOUTS.geolocation });

    // Click the marker to open popup
    await page.locator('.leaflet-marker-icon').first().click();

    const popup = page.locator('.leaflet-popup-content');
    await expect(popup).toBeVisible({ timeout: 3000 });
    // Google's DNS (8.8.8.8) resolves to US
    await expect(popup).toContainText(/United States|US/);
  });

  // ── Persistence ──────────────────────────────────────────────

  test('should restore recent links from DB after page reload', async ({ page }) => {
    const shortCode = await dashboard.shortenUrl(TEST_URLS.valid.withProtocol);

    await page.reload({ waitUntil: 'networkidle' });
    await dashboard.open();

    await expect(page.locator('.short-url-link').first()).toBeVisible();
    const links = await page.locator('.short-url-link').allInnerTexts();
    expect(links.some(l => l.includes(shortCode))).toBe(true);
  });
});
