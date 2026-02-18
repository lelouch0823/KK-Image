import { describe, it, expect } from 'vitest';
import { getTodayISOString, generateRandomId } from '../common';

describe('Common Utils', () => {
  it('getTodayISOString should return correct format', () => {
    const today = getTodayISOString();
    expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(today).toBe(new Date().toISOString().split('T')[0]);
  });

  it('generateRandomId should return string with prefix', () => {
    const id = generateRandomId('test');
    expect(id.startsWith('test-')).toBe(true);
    expect(id.split('-').length).toBeGreaterThanOrEqual(3);
  });

  it('generateRandomId should use default prefix', () => {
    const id = generateRandomId();
    expect(id.startsWith('local-')).toBe(true);
  });
});
