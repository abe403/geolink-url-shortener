/**
 * Centralized test data and environment configuration.
 * All magic strings/URLs are defined here — never hard-coded in tests.
 */

export const ENV = {
  frontendUrl: process.env.BASE_URL || 'http://localhost:3000',
  apiUrl: process.env.API_BASE_URL || 'http://localhost:8080',
  apiBase: '/api/urls',
} as const;

export const TEST_URLS = {
  valid: {
    withProtocol: 'https://www.example.com',
    withWww: 'www.github.com',
    withPath: 'https://www.reddit.com/r/programming',
    longUrl: 'https://www.wikipedia.org/wiki/Geographic_information_system',
  },
  invalid: {
    empty: '',
    spaces: '   ',
  },
} as const;

export const TEST_IPS = {
  google: '8.8.8.8',
  cloudflare: '1.1.1.1',
  reddit: 'reddit.com',
  invalid: '999.999.999.999',
} as const;

export const TIMEOUTS = {
  geolocation: 8_000,   // Async backend IP resolution
  mapAnimation: 3_000,  // Leaflet flyTo animation
  shortening: 5_000,    // End-to-end shortening + waypoint
} as const;

export const PAGINATION = {
  pageSize: 4,
} as const;
