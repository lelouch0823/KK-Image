import { describe, it, expect } from 'vitest';
import { CreateOrderSchema } from '../sales.js';

describe('CreateOrderSchema', () => {
  it('accepts variantId for variant-bound orders', () => {
    const payload = CreateOrderSchema.parse({
      name: 'Product A',
      quantity: 1,
      fileIds: [],
      productId: 'p1',
      variantId: 'v1'
    });

    expect(payload.variantId).toBe('v1');
    expect(payload.productId).toBe('p1');
  });
});
