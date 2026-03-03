import { describe, it, expect } from 'vitest';
import { safeJsonParse, parseJsonArray, parseJsonObject } from '../json.js';

describe('json utils', () => {
  it('returns fallback on invalid json', () => {
    expect(safeJsonParse('{', [])).toEqual([]);
  });

  it('returns non-string input as-is', () => {
    expect(safeJsonParse({ a: 1 }, {})).toEqual({ a: 1 });
  });

  it('parses json array string', () => {
    expect(parseJsonArray('[1,2,3]')).toEqual([1, 2, 3]);
  });

  it('falls back for non-array array parser input', () => {
    expect(parseJsonArray('{"a":1}')).toEqual([]);
  });

  it('parses json object string', () => {
    expect(parseJsonObject('{"a":1}')).toEqual({ a: 1 });
  });

  it('falls back for non-object object parser input', () => {
    expect(parseJsonObject('["a"]')).toEqual({});
  });
});
