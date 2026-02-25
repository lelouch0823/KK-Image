import { describe, it, expect } from 'vitest';
import {
  getSuggestedOrderQuantity,
  validateOrderQuantity,
} from '../purchase-order-constraints.js';

describe('purchase-order constraints (frontend)', () => {
  it('suggests quantity that satisfies moq + step + pack', () => {
    expect(getSuggestedOrderQuantity(7, { moq: 5, orderStep: 3, packSize: 4 })).toBe(8);
    expect(getSuggestedOrderQuantity(9, { moq: 5, orderStep: 3, packSize: 4 })).toBe(20);
  });

  it('validates quantity and includes suggestion', () => {
    expect(validateOrderQuantity(20, { moq: 5, orderStep: 3, packSize: 4 }).valid).toBe(true);
    const invalid = validateOrderQuantity(9, { moq: 5, orderStep: 3, packSize: 4 });
    expect(invalid.valid).toBe(false);
    expect(invalid.suggestedQuantity).toBe(20);
  });
});

