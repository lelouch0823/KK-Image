import { describe, expect, it, vi } from 'vitest';

import {
  buildOrderLineProjectionStatement,
  parsePositiveLineCommandQuantity,
  queryInventoryBalance,
} from '../order-line-shared.js';

describe('order-line-shared', () => {
  it('parses positive line command quantities from quantity, qty, or amount fields', () => {
    expect(parsePositiveLineCommandQuantity({ quantity: 4 })).toBe(4);
    expect(parsePositiveLineCommandQuantity({ qty: 3 })).toBe(3);
    expect(parsePositiveLineCommandQuantity({ amount: 2 })).toBe(2);
  });

  it('floors positive decimal line command quantities', () => {
    expect(parsePositiveLineCommandQuantity({ quantity: 3.9 })).toBe(3);
  });

  it('rejects missing or non-positive line command quantities', () => {
    expect(() => parsePositiveLineCommandQuantity({ quantity: 0 })).toThrow(
      'quantity must be a positive number'
    );
    expect(() => parsePositiveLineCommandQuantity({ amount: 'bad' })).toThrow(
      'quantity must be a positive number'
    );
  });

  it('queries inventory balance with empty-id shortcut and normalized counters', async () => {
    const first = vi.fn(async () => ({
      variant_id: 'var-1',
      on_hand: '8',
      reserved: null,
      available: '6',
    }));
    const bind = vi.fn(() => ({ first }));
    const prepare = vi.fn(() => ({ bind }));

    await expect(queryInventoryBalance({ prepare }, '')).resolves.toBeNull();
    await expect(queryInventoryBalance({ prepare }, 'var-1')).resolves.toEqual({
      variant_id: 'var-1',
      on_hand: 8,
      reserved: 0,
      available: 6,
    });
  });

  it('builds full-projection order-line update statements with stable bind order', () => {
    const boundStatement = { sql: 'bound' };
    const bind = vi.fn(() => boundStatement);
    const prepare = vi.fn(() => ({ bind }));

    const result = buildOrderLineProjectionStatement(
      { prepare },
      {
        id: 'line-1',
        order_id: 'order-1',
        ordered_qty: 8,
        procured_qty: 8,
        received_qty: 8,
        reserved_qty: 5,
        shipped_qty: 1,
        cancelled_qty: 0,
        display_status: 'ready',
      },
      {
        id: 'line-1',
        order_id: 'order-1',
      },
      123
    );

    expect(result).toBe(boundStatement);
    expect(prepare).toHaveBeenCalledWith(expect.stringContaining('UPDATE order_lines'));
    expect(bind).toHaveBeenCalledWith(8, 8, 8, 5, 1, 0, 'ready', 123, 'line-1', 'order-1');
  });
});
