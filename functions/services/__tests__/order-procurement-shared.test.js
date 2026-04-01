import { describe, expect, it, vi } from 'vitest';
import { BadRequestError } from '../../lib/hono/errors.js';

import {
  buildFinalizeCommandStatements,
  buildDeleteCommandStatement,
  cleanupReservedCommand,
  parseStoredResponse,
  queryCompatibilityProcurementAggregate,
  replayReservedCommand,
  resolveReservationOwnership,
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
