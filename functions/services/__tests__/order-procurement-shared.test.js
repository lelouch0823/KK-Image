import { describe, expect, it, vi } from 'vitest';
import { BadRequestError } from '../../lib/hono/errors.js';

import {
  buildFinalizeCommandStatements,
  buildDeleteCommandStatement,
  buildPurchaseOrderItemCancelledQtyStatement,
  buildPurchaseOrderItemReceivedQtyStatement,
  cleanupReservedCommand,
  parseStoredResponse,
  queryInventoryBalance,
  queryCompatibilityProcurementAggregate,
  replayReservedCommand,
  resolveReservationOwnership,
  requirePurchaseOrder,
  requirePurchaseOrderItemForPo,
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

  it('resolves reservation ownership from ownsReservation or insertStatement', () => {
    expect(resolveReservationOwnership({ ownsReservation: true, insertStatement: null })).toBe(true);
    expect(resolveReservationOwnership({ ownsReservation: false, insertStatement: { sql: 'insert' } })).toBe(false);
    expect(resolveReservationOwnership({ insertStatement: { sql: 'insert' } })).toBe(true);
    expect(resolveReservationOwnership({ insertStatement: null })).toBe(false);
  });

  it('replays committed command responses when reservation already exists', () => {
    const replay = replayReservedCommand(
      {
        existing: true,
        record: {
          request_fingerprint: '{"k":"v"}',
          status: 'committed',
          response_json: '{"ok":true}',
        },
      },
      '{"k":"v"}',
      {
        mismatchMessage: 'mismatch',
        inFlightMessage: 'in-flight',
      }
    );

    expect(replay).toEqual({ ok: true });
  });

  it('rejects mismatched fingerprints and in-flight reservations', () => {
    expect(() =>
      replayReservedCommand(
        {
          existing: true,
          record: {
            request_fingerprint: '{"old":true}',
            status: 'committed',
            response_json: '{"ok":true}',
          },
        },
        '{"new":true}',
        {
          mismatchMessage: 'mismatch',
          inFlightMessage: 'in-flight',
        }
      )
    ).toThrow(BadRequestError);

    expect(() =>
      replayReservedCommand(
        {
          existing: true,
          record: {
            request_fingerprint: '{"k":"v"}',
            status: 'in_flight',
            response_json: null,
          },
        },
        '{"k":"v"}',
        {
          mismatchMessage: 'mismatch',
          inFlightMessage: 'in-flight',
        }
      )
    ).toThrow(BadRequestError);
  });

  it('cleans up reserved commands only when the service owns the reservation', async () => {
    const repoDeleteStatement = { run: vi.fn(async () => ({ success: true })) };
    const fallbackDeleteStatement = { run: vi.fn(async () => ({ success: true })) };
    const commandIdempotencyRepo = {
      buildDeleteStatement: vi.fn(() => repoDeleteStatement),
    };
    const db = {
      prepare: vi.fn(() => ({
        bind: vi.fn(() => fallbackDeleteStatement),
      })),
    };

    await cleanupReservedCommand({
      commandIdempotencyRepo,
      db,
      ownsReservation: true,
      commandId: 'cmd-1',
    });
    await cleanupReservedCommand({
      commandIdempotencyRepo,
      db,
      ownsReservation: false,
      commandId: 'cmd-2',
    });

    expect(commandIdempotencyRepo.buildDeleteStatement).toHaveBeenCalledTimes(1);
    expect(repoDeleteStatement.run).toHaveBeenCalledTimes(1);
    expect(db.prepare).not.toHaveBeenCalled();
  });

  it('builds finalize statements by appending purchase-order touch and command finalize writes', () => {
    const extraStatement = { sql: 'extra' };
    const touchStatement = { sql: 'touch' };
    const finalizeStatement = { sql: 'finalize' };
    const db = {
      prepare: vi.fn(() => ({
        bind: vi.fn(() => touchStatement),
      })),
    };
    const commandIdempotencyRepo = {
      buildFinalizeStatement: vi.fn(() => finalizeStatement),
    };

    const statements = buildFinalizeCommandStatements({
      db,
      commandIdempotencyRepo,
      purchaseOrderId: 'po-1',
      timestamp: 123,
      commandId: 'cmd-1',
      response: { ok: true },
      leadingStatements: [extraStatement],
    });

    expect(statements).toEqual([extraStatement, touchStatement, finalizeStatement]);
    expect(commandIdempotencyRepo.buildFinalizeStatement).toHaveBeenCalledWith(
      'cmd-1',
      { ok: true },
      'committed'
    );
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

  it('loads one purchase order and enforces allowed statuses when configured', async () => {
    const first = vi.fn(async () => ({ id: 'po-1', status: 'shipping' }));
    const bind = vi.fn(() => ({ first }));
    const prepare = vi.fn(() => ({ bind }));

    await expect(
      requirePurchaseOrder({ prepare }, 'po-1', {
        allowedStatuses: ['ordered', 'shipping'],
        invalidStatusMessage: 'invalid status',
      })
    ).resolves.toEqual({
      id: 'po-1',
      status: 'shipping',
    });

    await expect(
      requirePurchaseOrder({ prepare }, 'po-1', {
        allowedStatuses: ['ordered'],
        invalidStatusMessage: 'invalid status',
      })
    ).rejects.toThrow('invalid status');
  });

  it('loads purchase-order items scoped to their purchase order', async () => {
    const first = vi.fn(async () => ({
      id: 'poi-1',
      po_id: 'po-1',
      quantity: 5,
      received_qty: 2,
      cancelled_qty: 1,
    }));
    const bind = vi.fn(() => ({ first }));
    const prepare = vi.fn(() => ({ bind }));

    await expect(
      requirePurchaseOrderItemForPo({ prepare }, 'po-1', 'poi-1', {
        select:
          'id, po_id, quantity, received_qty, cancelled_qty',
      })
    ).resolves.toEqual({
      id: 'poi-1',
      po_id: 'po-1',
      quantity: 5,
      received_qty: 2,
      cancelled_qty: 1,
    });

    const foreignFirst = vi.fn(async () => ({ id: 'poi-1', po_id: 'po-2' }));
    const foreignBind = vi.fn(() => ({ first: foreignFirst }));
    const foreignPrepare = vi.fn(() => ({ bind: foreignBind }));

    await expect(
      requirePurchaseOrderItemForPo({ prepare: foreignPrepare }, 'po-1', 'poi-1')
    ).rejects.toThrow('采购单明细不属于当前采购单');
  });

  it('queries inventory balance with stable normalization and empty-id shortcut', async () => {
    const first = vi.fn(async () => ({
      variant_id: 'var-1',
      on_hand: '5',
      reserved: null,
      available: '4',
    }));
    const bind = vi.fn(() => ({ first }));
    const prepare = vi.fn(() => ({ bind }));

    await expect(queryInventoryBalance({ prepare }, '')).resolves.toBeNull();
    await expect(queryInventoryBalance({ prepare }, 'var-1')).resolves.toEqual({
      variant_id: 'var-1',
      on_hand: 5,
      reserved: 0,
      available: 4,
    });
  });

  it('builds received-qty purchase-order item statements with optimistic guards', () => {
    const boundStatement = { sql: 'bound' };
    const bind = vi.fn(() => boundStatement);
    const prepare = vi.fn(() => ({ bind }));

    const result = buildPurchaseOrderItemReceivedQtyStatement(
      { prepare },
      'po-1',
      {
        id: 'poi-1',
        received_qty: 2,
        cancelled_qty: 1,
      },
      {
        nextReceivedQty: 5,
        nextDisplayStatus: 'partially_received',
        requiredRemainingQty: 3,
      }
    );

    expect(result).toBe(boundStatement);
    expect(prepare).toHaveBeenCalledWith(expect.stringContaining('UPDATE purchase_order_items'));
    expect(bind).toHaveBeenCalledWith(5, 'partially_received', 'poi-1', 'po-1', 2, 1, 3);
  });

  it('builds cancelled-qty purchase-order item revert statements with display-status guards', () => {
    const boundStatement = { sql: 'bound' };
    const bind = vi.fn(() => boundStatement);
    const prepare = vi.fn(() => ({ bind }));

    const result = buildPurchaseOrderItemCancelledQtyStatement(
      { prepare },
      'po-1',
      {
        id: 'poi-1',
        received_qty: 7,
      },
      {
        nextCancelledQty: 0,
        nextDisplayStatus: 'partially_received',
        expectedCancelledQty: 3,
        expectedDisplayStatus: 'received',
      }
    );

    expect(result).toBe(boundStatement);
    expect(prepare).toHaveBeenCalledWith(expect.stringContaining('UPDATE purchase_order_items'));
    expect(bind).toHaveBeenCalledWith(0, 'partially_received', 'poi-1', 'po-1', 7, 3, 'received');
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
