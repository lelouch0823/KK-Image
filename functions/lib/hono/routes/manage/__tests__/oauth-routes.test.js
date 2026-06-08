import { describe, expect, it } from 'vitest';
import { hashSecret } from '../../../../../repositories/OAuthRepository.js';
import { verifySecret } from '../oauth.js';

describe('OAuth secret verification', () => {
  it('falls back when crypto.subtle.timingSafeEqual is unavailable', async () => {
    const original = globalThis.crypto.subtle.timingSafeEqual;
    globalThis.crypto.subtle.timingSafeEqual = undefined;

    try {
      const storedHash = await hashSecret('client-secret');
      await expect(verifySecret('client-secret', storedHash)).resolves.toBe(true);
      await expect(verifySecret('wrong-secret', storedHash)).resolves.toBe(false);
    } finally {
      globalThis.crypto.subtle.timingSafeEqual = original;
    }
  });
});
