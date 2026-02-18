import { describe, it, expect, vi } from 'vitest';
import { 
  generateId, 
  generatePrefixedId, 
  generateShareToken, 
  now, 
  isoToTimestamp, 
  timestampToIso,
  hashPassword,
   isValidUrl,
   generateOrderNo,
   generateHmacSignature,
   sha256Hex
 } from '../id';

describe('Backend ID and Utils', () => {
  describe('ID Generation', () => {
    it('generateId should return a UUID', () => {
      const id = generateId();
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    });

    it('generatePrefixedId should return a prefixed string', () => {
      const prefix = 'test_';
      const id = generatePrefixedId(prefix);
      expect(id.startsWith(prefix)).toBe(true);
      expect(id.length).toBe(prefix.length + 16);
    });

    it('generateShareToken should return a random string of specified length', () => {
      const length = 10;
      const token = generateShareToken(length);
      expect(token.length).toBe(length);
      expect(typeof token).toBe('string');
    });
  });

  describe('Timestamp Utils', () => {
    it('now should return current timestamp', () => {
      const t = now();
      expect(t).toBeGreaterThan(0);
      expect(Math.abs(t - Date.now())).toBeLessThan(100);
    });

    it('isoToTimestamp should convert ISO string correctly', () => {
      const iso = '2024-01-01T00:00:00.000Z';
      const t = isoToTimestamp(iso);
      expect(t).toBe(new Date(iso).getTime());
    });

    it('isoToTimestamp should return null for invalid input', () => {
      expect(isoToTimestamp(null)).toBeNull();
      expect(isoToTimestamp('invalid')).toBeNull();
    });

    it('timestampToIso should convert timestamp to ISO string', () => {
      const t = 1704067200000;
      const iso = timestampToIso(t);
      expect(iso).toBe('2024-01-01T00:00:00.000Z');
    });
  });

  describe('Security Utils', () => {
    it('hashPassword should hash password with salt', async () => {
      const password = 'mypassword';
      const salt = 'mysalt';
      const hash1 = await hashPassword(password, salt);
      const hash2 = await hashPassword(password, salt);
      
      expect(hash1).toBe(hash2);
      expect(hash1.length).toBe(64); // SHA-256 hex is 64 chars
    });

    it('hashPassword should throw error if salt is missing', async () => {
      await expect(hashPassword('pwd', null)).rejects.toThrow('Salt is required');
    });
  });

  describe('URL Validation', () => {
    it('isValidUrl should validate correct URLs', () => {
      expect(isValidUrl('https://example.com')).toBe(true);
      expect(isValidUrl('http://localhost:8080')).toBe(true);
    });

    it('isValidUrl should return false for invalid URLs', () => {
      expect(isValidUrl('invalid-url')).toBe(false);
      expect(isValidUrl('ftp://example.com')).toBe(false);
    });
  });

  describe('Order Number Generation', () => {
    it('generateOrderNo should return a string in ORD-YYMMDD-HHmmss-XXX format', () => {
      const orderNo = generateOrderNo();
      expect(orderNo).toMatch(/^ORD-\d{6}-\d{6}-[A-Z0-9]{3}$/);
    });
  });

  describe('HMAC and SHA256', () => {
    it('generateHmacSignature should return correct format', async () => {
      const signature = await generateHmacSignature('test-payload', 'test-secret');
      expect(signature.startsWith('sha256=')).toBe(true);
      expect(signature.length).toBeGreaterThan(40);
    });

    it('sha256Hex should return valid hex string', async () => {
      const hash = await sha256Hex('test-data');
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
      
      // Test with Uint8Array
      const data = new TextEncoder().encode('test-data');
      const hash2 = await sha256Hex(data);
      expect(hash2).toBe(hash);
    });
  });
});
