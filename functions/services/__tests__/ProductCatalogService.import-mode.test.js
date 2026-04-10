import { describe, expect, it } from 'vitest';
import { BadRequestError } from '../../lib/hono/errors.js';
import { normalizeImportMode } from '../ProductCatalogService.js';

describe('ProductCatalogService import mode normalization', () => {
  it('defaults empty import mode to safe_merge', () => {
    expect(normalizeImportMode()).toBe('safe_merge');
    expect(normalizeImportMode('')).toBe('safe_merge');
  });

  it('keeps explicit safe_merge and replace modes', () => {
    expect(normalizeImportMode('safe_merge')).toBe('safe_merge');
    expect(normalizeImportMode('SAFE_MERGE')).toBe('safe_merge');
    expect(normalizeImportMode('replace')).toBe('replace');
  });

  it('rejects unsupported import modes instead of silently upgrading to replace', () => {
    expect(() => normalizeImportMode('merge')).toThrow('Invalid import mode');
    expect(() => normalizeImportMode('overwrite_all')).toThrow(BadRequestError);
  });
});
