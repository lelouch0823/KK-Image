import { describe, expect, it } from 'vitest';

import { UpdateProductStatusSchema } from '../product.js';

describe('product status schema', () => {
  it('rejects unsupported draft product status', () => {
    expect(UpdateProductStatusSchema.safeParse({ status: 'draft' }).success).toBe(false);
    expect(UpdateProductStatusSchema.safeParse({ status: 'active' }).success).toBe(true);
    expect(UpdateProductStatusSchema.safeParse({ status: 'archived' }).success).toBe(true);
  });
});
