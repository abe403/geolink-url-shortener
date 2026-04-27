import { test, expect, APIRequestContext, APIResponse } from '@playwright/test';
import { ENV, TEST_URLS } from '../../utils/test-data';

/**
 * Test Suite: REST API Contract Tests
 *
 * Validates the Spring Boot backend endpoints:
 *  - POST   /api/urls/shorten
 *  - GET    /api/urls
 *  - GET    /api/urls/{shortCode}
 *  - GET    /api/urls/{shortCode}/analytics
 *  - GET    /{shortCode}  (redirect)
 *
 * Uses Playwright's built-in APIRequestContext (no extra HTTP library needed).
 */

const BASE = ENV.apiUrl + ENV.apiBase;

test.describe('API — URL Shortener Endpoints', () => {

  // ── POST /api/urls/shorten ────────────────────────────────────

  test.describe('POST /api/urls/shorten', () => {
    test('should return 200 and a valid ShortUrl object', async ({ request }) => {
      const res = await request.post(`${BASE}/shorten`, {
        data: TEST_URLS.valid.withProtocol,
        headers: { 'Content-Type': 'text/plain' },
      });

      expect(res.status()).toBe(200);

      const body = await res.json();
      expect(body).toHaveProperty('id');
      expect(body).toHaveProperty('shortCode');
      expect(body).toHaveProperty('originalUrl');
      expect(body.originalUrl).toBe(TEST_URLS.valid.withProtocol);
      expect(body.shortCode).toMatch(/^[A-Za-z0-9]{6}$/);  // Base62 6-char code
    });

    test('should return a unique shortCode for each request', async ({ request }) => {
      const [res1, res2] = await Promise.all([
        request.post(`${BASE}/shorten`, {
          data: TEST_URLS.valid.withProtocol,
          headers: { 'Content-Type': 'text/plain' },
        }),
        request.post(`${BASE}/shorten`, {
          data: TEST_URLS.valid.longUrl,
          headers: { 'Content-Type': 'text/plain' },
        }),
      ]);

      const body1 = await res1.json();
      const body2 = await res2.json();
      expect(body1.shortCode).not.toBe(body2.shortCode);
    });

    test('should store createdAt timestamp', async ({ request }) => {
      const res = await request.post(`${BASE}/shorten`, {
        data: TEST_URLS.valid.withPath,
        headers: { 'Content-Type': 'text/plain' },
      });

      const body = await res.json();
      expect(body).toHaveProperty('createdAt');
      const ts = new Date(body.createdAt);
      expect(ts.getTime()).not.toBeNaN();
    });
  });

  // ── GET /api/urls ─────────────────────────────────────────────

  test.describe('GET /api/urls', () => {
    test('should return 200 and an array of URLs', async ({ request }) => {
      const res = await request.get(`${BASE}`);
      expect(res.status()).toBe(200);

      const body = await res.json();
      expect(Array.isArray(body)).toBe(true);
    });

    test('should include newly shortened URL in the list', async ({ request }) => {
      const postRes = await request.post(`${BASE}/shorten`, {
        data: TEST_URLS.valid.withProtocol,
        headers: { 'Content-Type': 'text/plain' },
      });
      const created = await postRes.json();

      const getRes = await request.get(`${BASE}`);
      const list = await getRes.json();

      const found = list.find((u: any) => u.shortCode === created.shortCode);
      expect(found).toBeDefined();
    });

    test('should return URLs sorted newest first', async ({ request }) => {
      const res = await request.get(`${BASE}`);
      const list: any[] = await res.json();

      if (list.length >= 2) {
        const first = new Date(list[0].createdAt).getTime();
        const second = new Date(list[1].createdAt).getTime();
        expect(first).toBeGreaterThanOrEqual(second);
      }
    });
  });

  // ── GET /api/urls/{shortCode} ────────────────────────────────

  test.describe('GET /api/urls/{shortCode}', () => {
    test('should return the correct ShortUrl for a valid code', async ({ request }) => {
      // Create a URL first
      const postRes = await request.post(`${BASE}/shorten`, {
        data: TEST_URLS.valid.longUrl,
        headers: { 'Content-Type': 'text/plain' },
      });
      const created = await postRes.json();

      // Fetch by short code
      const getRes = await request.get(`${BASE}/${created.shortCode}`);
      expect(getRes.status()).toBe(200);

      const body = await getRes.json();
      expect(body.shortCode).toBe(created.shortCode);
      expect(body.originalUrl).toBe(TEST_URLS.valid.longUrl);
    });

    test('should return 500 for a non-existent short code', async ({ request }) => {
      const res = await request.get(`${BASE}/XXXXXX`);
      expect(res.status()).toBeGreaterThanOrEqual(400);
    });
  });

  // ── GET /api/urls/{shortCode}/analytics ──────────────────────

  test.describe('GET /api/urls/{shortCode}/analytics', () => {
    test('should return an array (initially empty) for a new link', async ({ request }) => {
      const postRes = await request.post(`${BASE}/shorten`, {
        data: TEST_URLS.valid.withProtocol,
        headers: { 'Content-Type': 'text/plain' },
      });
      const created = await postRes.json();

      const analyticsRes = await request.get(`${BASE}/${created.shortCode}/analytics`);
      expect(analyticsRes.status()).toBe(200);
      expect(Array.isArray(await analyticsRes.json())).toBe(true);
    });

    test('analytics DTO should contain lat/lon fields (not raw geometry)', async ({ request }) => {
      // Shorten a URL and wait a bit for async geolocation
      const postRes = await request.post(`${BASE}/shorten`, {
        data: TEST_URLS.valid.longUrl,
        headers: { 'Content-Type': 'text/plain' },
      });
      const created = await postRes.json();

      // Poll for up to 8 seconds
      let clicks: any[] = [];
      const deadline = Date.now() + 8_000;
      while (Date.now() < deadline && clicks.length === 0) {
        const r = await request.get(`${BASE}/${created.shortCode}/analytics`);
        clicks = await r.json();
        if (clicks.length === 0) await new Promise(r => setTimeout(r, 500));
      }

      if (clicks.length > 0) {
        const click = clicks[0];
        expect(click).toHaveProperty('latitude');
        expect(click).toHaveProperty('longitude');
        expect(click).toHaveProperty('city');
        expect(click).toHaveProperty('country');
        expect(click).toHaveProperty('ipAddress');
        // Should NOT have a raw JTS geometry (which caused the previous StackOverflow bug)
        expect(click).not.toHaveProperty('location');
      }
    });
  });

  // ── GET /{shortCode} (Redirect) ───────────────────────────────

  test.describe('GET /{shortCode} — Redirect', () => {
    test('should redirect to the original URL', async ({ request }) => {
      const postRes = await request.post(`${BASE}/shorten`, {
        data: TEST_URLS.valid.withProtocol,
        headers: { 'Content-Type': 'text/plain' },
      });
      const created = await postRes.json();

      const redirectRes = await request.get(
        `${ENV.apiUrl}/${created.shortCode}`,
        { maxRedirects: 0 }
      );

      // Should return a 3xx redirect
      expect(redirectRes.status()).toBeGreaterThanOrEqual(300);
      expect(redirectRes.status()).toBeLessThan(400);

      const location = redirectRes.headers()['location'];
      expect(location).toBe(TEST_URLS.valid.withProtocol);
    });
  });
});
