import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  isAdminAuthenticated, 
  authenticateAdmin,
  saveApiKey,
  deleteApiKey,
  verifyTurnstile,
  verifyJWT, 
  generateJWT, 
  verifyApiKey, 
  timingSafeCompare,
  generateApiKey,
  ADMIN_AUTH_COOKIE
} from '../auth';
import { MSG } from '../messages';

// Mock crypto globally for Cloudflare Workers simulation
const timingSafeEqualMock = vi.fn((a, b) => {
  if (a.byteLength !== b.byteLength) return false;
  const a8 = new Uint8Array(a);
  const b8 = new Uint8Array(b);
  return a8.every((v, i) => v === b8[i]);
});

const signMock = vi.fn(async (algo, key, data) => {
  const encoder = new TextEncoder();
  const d = typeof data === 'string' ? encoder.encode(data) : data;
  const buffer = new Uint8Array(32);
  for (let i = 0; i < d.length; i++) {
    buffer[i % 32] ^= d[i];
  }
  return buffer.buffer;
});

vi.stubGlobal('crypto', {
  subtle: {
    timingSafeEqual: timingSafeEqualMock,
    importKey: vi.fn().mockResolvedValue('mock-key'),
    sign: signMock
  }
});

describe('Auth Utils 100% Coverage Final', () => {
  let db;
  let env;

  beforeEach(async () => {
    vi.clearAllMocks();
    db = {
      prepare: vi.fn().mockReturnThis(),
      bind: vi.fn().mockReturnThis(),
      run: vi.fn().mockResolvedValue({ success: true }),
      all: vi.fn().mockResolvedValue({ results: [] }),
      first: vi.fn().mockResolvedValue(null)
    };
    env = { 
      DB: db, 
      JWT_SECRET: 'test-secret',
      DEFAULT_API_KEY: 'default-tk'
    };
    
    // Clear the internal cache in auth.js via deleteApiKey
    // We must ensure the mock for prepare/bind/run exists.
    await deleteApiKey('force-cache-clear', env);
    vi.clearAllMocks(); // Clear mocks again after the "cleanup" call
  });

  describe('JWT Operations', () => {
    it('should generate and verify JWT', async () => {
       const user = { id: 'u1', name: 'Test', type: 'admin', permissions: ['all'] };
       const token = await generateJWT(user, env);
       expect(token).toBeDefined();
       
       const decoded = await verifyJWT(token, env);
       expect(decoded.id).toBe('u1');
       expect(decoded.permissions).toEqual(['all']);
    });

    it('should handle expired token', async () => {
       const now = Math.floor(Date.now() / 1000);
       const originalNow = Date.now;
       const token = await generateJWT({ id: 'u1' }, env, 10);
       
       global.Date.now = () => (now + 20) * 1000;
       await expect(verifyJWT(token, env)).rejects.toThrow(MSG.AUTH.JWT_FAILED);
       global.Date.now = originalNow;
    });
  });

  describe('API Key Operations', () => {
    it('should verify from DB and use cache on second call', async () => {
      // First call: DB fetch
      db.all.mockResolvedValueOnce({ results: [
        { id: 'k1', key_value: 'v1', permissions: '["read"]', disabled: 0 }
      ] });
      const res1 = await verifyApiKey('v1', env);
      expect(res1.id).toBe('k1');
      expect(db.prepare).toHaveBeenCalledTimes(1);

      // Second call: Cache hit (db.prepare should NOT be called again if TTL < 60s)
      const res2 = await verifyApiKey('v1', env);
      expect(res2.id).toBe('k1');
      // Still 2 because deleteApiKey called prepare once in beforeEach, 
      // then verifyApiKey first call called it once.
      // So TOTAL prepare calls should be 2.
      expect(db.prepare).toHaveBeenCalledTimes(1); 
    });

    it('should throw if API key is invalid (cache cleared in beforeEach)', async () => {
        db.all.mockResolvedValueOnce({ results: [] });
        await expect(verifyApiKey('v99', env)).rejects.toThrow(MSG.AUTH.API_KEY_INVALID);
    });

    it('should use default API key if DB fails', async () => {
        db.all.mockRejectedValue(new Error('DB Fail'));
        const res = await verifyApiKey('default-tk', env);
        expect(res.id).toBe('default');
    });

    it('should throw if default API key doesn\'t match provided one', async () => {
        db.all.mockRejectedValue(new Error('DB Fail'));
        await expect(verifyApiKey('wrong-tk', env)).rejects.toThrow(MSG.AUTH.API_KEY_INVALID);
    });
  });

  describe('authenticateAdmin & isAdminAuthenticated', () => {
    it('should authenticate via Bearer and handle invalid cases', async () => {
       const token = await generateJWT({ id: 'admin' }, env);
       const req = new Request('https://api.test', { headers: { 'Authorization': `Bearer ${token}` } });
       expect(await isAdminAuthenticated(req, env)).toBe(true);
       
       const req2 = new Request('https://api.test');
       expect(await isAdminAuthenticated(req2, env)).toBe(false);
    });
  });

  describe('timingSafeCompare', () => {
    it('should handle logic paths', () => {
       expect(timingSafeCompare('a', 'a')).toBe(true);
       expect(timingSafeCompare('a', 'b')).toBe(false);
       expect(timingSafeCompare('a', 'aa')).toBe(false);
    });
  });

  describe('Turnstile', () => {
    it('should handle success/error', async () => {
       global.fetch = vi.fn().mockResolvedValue({ json: () => ({ success: true }) });
       expect(await verifyTurnstile('t', 's')).toBe(true);
       
       global.fetch.mockRejectedValue(new Error('!'));
       expect(await verifyTurnstile('t', 's')).toBe(false);
    });
  });
});
