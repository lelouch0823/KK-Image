import { describe, expect, it } from 'vitest';
import { getChangesCount, hasChanges } from '../result.js';

describe('result helpers', () => {
  it('returns zero changes for missing metadata', () => {
    expect(getChangesCount()).toBe(0);
    expect(getChangesCount({})).toBe(0);
    expect(hasChanges({})).toBe(false);
  });

  it('detects positive metadata changes', () => {
    expect(getChangesCount({ meta: { changes: 2 } })).toBe(2);
    expect(hasChanges({ meta: { changes: 1 } })).toBe(true);
  });
});
