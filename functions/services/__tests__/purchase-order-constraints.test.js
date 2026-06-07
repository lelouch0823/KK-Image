import { describe, it, expect } from 'vitest';
import { getSuggestedOrderQuantity, validateOrderQuantity } from '../purchase-order-constraints.js';

describe('purchase-order constraints', () => {
  it('suggests nearest valid quantity >= requested with moq/step/pack', () => {
    // valid x: x>=5, (x-5)%3==0, x%4==0 -> 8, 20, 32...
    expect(getSuggestedOrderQuantity(7, { moq: 5, orderStep: 3, packSize: 4 })).toBe(8);
    expect(getSuggestedOrderQuantity(9, { moq: 5, orderStep: 3, packSize: 4 })).toBe(20);
    expect(getSuggestedOrderQuantity(2, { moq: 5, orderStep: 3, packSize: 4 })).toBe(8);
  });

  it('accepts valid quantity', () => {
    const result = validateOrderQuantity(20, { moq: 5, orderStep: 3, packSize: 4 });
    expect(result.valid).toBe(true);
  });

  it('rejects invalid quantity and returns suggestion', () => {
    const result = validateOrderQuantity(9, { moq: 5, orderStep: 3, packSize: 4 });
    expect(result.valid).toBe(false);
    expect(result.suggestedQuantity).toBe(20);
    expect(result.reason).toMatch(/MOQ|步长|箱规/);
  });
});
