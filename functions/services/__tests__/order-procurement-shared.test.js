import { describe, expect, it, vi } from 'vitest';

import {
  buildDeleteCommandStatement,
  parseStoredResponse,
  queryCompatibilityProcurementAggregate,
  requireOrderLine,
} from '../order-procurement-shared.js';

describe('order-procurement-shared', () => {
  it('parses stored command responses defensively', () => {
    expect(parseStoredResponse('{"ok":true}')).toEqual({ ok: true });
    expect(parseStoredResponse('not-json')).toBeNull();
    expect(parseStoredResponse('')).toBeNull();
  });

  it('builds the command cleanup statement against command_idempotency', () => {
    const boundStatement = { sql: 'bound-delete' };
    const bind = vi.fn(() => boundStatement);
    const prepare = vi.fn(() => ({ bind }));

    const result = buildDeleteCommandStatement({ prepare }, 'cmd-1');

    expect(prepare).toHaveBeenCalledWith(
      'DELETE FROM command_idempotency WHERE command_id = ?'
    );
    expect(bind).toHaveBeenCalledWith('cmd-1');
    expect(result).toBe(boundStatement);
  });

  it('loads one order line scoped by order id', async () => {
    const first = vi.fn(async () => ({ id: 'line-1', order_id: 'order-1' }));
    const bind = vi.fn(() => ({ first }));
    const prepare = vi.fn(() => ({ bind }));

    await expect(
      requireOrderLine({ prepare }, 'order-1', 'line-1')
    ).resolves.toMatchObject({
      id: 'line-1',
      order_id: 'order-1',
    });

    expect(bind).toHaveBeenCalledWith('line-1', 'order-1');
  });

  it('aggregates compatibility procurement counters for one order', async () => {
    const first = vi.fn(async () => ({
      ordered_qty: 10,
      procured_qty: 10,
      received_qty: 4,
      cancelled_qty: 1,
    }));
    const bind = vi.fn(() => ({ first }));
    const prepare = vi.fn(() => ({ bind }));

    await expect(
      queryCompatibilityProcurementAggregate({ prepare }, 'order-1')
    ).resolves.toEqual({
      ordered_qty: 10,
      procured_qty: 10,
      received_qty: 4,
      cancelled_qty: 1,
    });

    expect(bind).toHaveBeenCalledWith('order-1');
  });
});
