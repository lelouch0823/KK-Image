import { describe, expect, it } from 'vitest';
import { toNonNegativeInt } from '../number.js';

describe('number utilities', () => {
  it('normalizes non-finite values to zero for non-negative integers', () => {
    expect(toNonNegativeInt('1e309')).toBe(0);
    expect(toNonNegativeInt(Infinity)).toBe(0);
    expect(toNonNegativeInt(-Infinity)).toBe(0);
    expect(toNonNegativeInt(NaN)).toBe(0);
  });

  it('truncates finite non-negative values', () => {
    expect(toNonNegativeInt('4.9')).toBe(4);
    expect(toNonNegativeInt(-2.2)).toBe(0);
  });
});
