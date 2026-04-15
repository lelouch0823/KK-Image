import { describe, expect, it } from 'vitest';
import {
  parseJsonArray,
  parseJsonObject,
  safeParseJson,
} from '@/utils/json.js';

describe('frontend json helpers', () => {
  it('returns fallback for invalid json text', () => {
    expect(safeParseJson('{', { ok: true })).toEqual({ ok: true });
  });

  it('keeps plain objects and arrays without reparsing', () => {
    expect(parseJsonObject({ ok: true }, {})).toEqual({ ok: true });
    expect(parseJsonArray(['a'], [])).toEqual(['a']);
  });

  it('only returns arrays from parseJsonArray', () => {
    expect(parseJsonArray('["a","b"]', [])).toEqual(['a', 'b']);
    expect(parseJsonArray('{"a":1}', ['fallback'])).toEqual(['fallback']);
  });

  it('only returns objects from parseJsonObject', () => {
    expect(parseJsonObject('{"ok":true}', {})).toEqual({ ok: true });
    expect(parseJsonObject('["a"]', { fallback: true })).toEqual({ fallback: true });
  });
});
