import { describe, expect, it } from 'vitest';
import { getActionAdapter } from '../action-registry.js';

describe('AI action registry', () => {
  it('returns required slots and target module for product adapter', () => {
    const adapter = getActionAdapter('product');

    expect(adapter.requiredSlots).toContain('variants');
    expect(adapter.targetModule).toBe('products');
  });
});
