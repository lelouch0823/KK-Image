import { describe, expect, it } from 'vitest';

import { isCronAuthorized } from '../cron-auth.js';

describe('cron auth helper', () => {
  it('accepts exact bearer token', () => {
    const request = new Request('https://example.com/api/cron/backup', {
      headers: {
        Authorization: 'Bearer super-secret',
      },
    });

    expect(isCronAuthorized(request, { CRON_SECRET: 'super-secret' })).toBe(true);
  });

  it('rejects quoted bearer token to preserve strict contract', () => {
    const request = new Request('https://example.com/api/cron/backup', {
      headers: {
        Authorization: 'Bearer "super-secret"',
      },
    });

    expect(isCronAuthorized(request, { CRON_SECRET: 'super-secret' })).toBe(false);
  });

  it('rejects request without authorization header', () => {
    const request = new Request('https://example.com/api/cron/backup');
    expect(isCronAuthorized(request, { CRON_SECRET: 'super-secret' })).toBe(false);
  });

  it('rejects request when CRON_SECRET is missing', () => {
    const request = new Request('https://example.com/api/cron/backup', {
      headers: {
        Authorization: 'Bearer dev-secret',
      },
    });

    expect(isCronAuthorized(request, {})).toBe(false);
  });
});
