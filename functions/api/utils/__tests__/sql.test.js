import { describe, it, expect } from 'vitest';
import { placeholders, inClause, buildSetClause } from '../sql.js';

describe('sql helpers', () => {
  it('placeholders returns empty string for empty input', () => {
    expect(placeholders([])).toBe('');
  });

  it('placeholders returns repeated placeholders for array size', () => {
    expect(placeholders([1, 2, 3])).toBe('?,?,?');
  });

  it('inClause returns safe no-match clause for empty input', () => {
    expect(inClause([])).toBe('(NULL)');
  });

  it('inClause wraps placeholders for non-empty input', () => {
    expect(inClause(['a', 'b'])).toBe('(?,?)');
  });

  it('buildSetClause returns deterministic clause and values', () => {
    expect(buildSetClause({ updated_at: 1, name: 'x' })).toEqual({
      clause: 'name = ?, updated_at = ?',
      values: ['x', 1],
    });
  });
});
