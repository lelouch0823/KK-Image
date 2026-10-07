import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CommandIdempotencyRepository } from '../CommandIdempotencyRepository.js';
import { readFileSync } from 'node:fs';
import path from 'node:path';

function createPreparedStatement(sql, { firstResult = null, runResult = null } = {}) {
  const statement = {
    sql,
    params: [],
    bind: vi.fn((...params) => {
      statement.params = params;
      return statement;
    }),
    first: vi.fn(async () => firstResult),
    run: vi.fn(async () => runResult || { success: true, meta: { changes: 1 } }),
  };
  return statement;
}

function createMockDb({ existingRows = [], stealChanges = 1 } = {}) {
  const rowsByKey = new Map(
    existingRows.map((row) => [`${row.command_type}:${row.scope_key}:${row.idempotency_key}`, row])
  );
  const calls = { stealDeletes: [], inserts: [] };

  return {
    rowsByKey,
    calls,
    prepare: vi.fn((sql) => {
      if (sql.includes('INSERT OR IGNORE INTO command_idempotency')) {
        const statement = createPreparedStatement(sql);
        statement.bind = vi.fn((...params) => {
          statement.params = params;
          statement.run = vi.fn(async () => {
            const [
              id,
              commandType,
              scopeKey,
              idempotencyKey,
              commandId,
              requestFingerprint,
              responseJson,
              status,
              createdAt,
              updatedAt,
            ] = params;
            calls.inserts.push({ id, commandId, status, updatedAt });
            const key = `${commandType}:${scopeKey}:${idempotencyKey}`;
            if (rowsByKey.has(key)) {
              return { success: true, meta: { changes: 0 } };
            }

            rowsByKey.set(key, {
              id,
              command_type: commandType,
              scope_key: scopeKey,
              idempotency_key: idempotencyKey,
              command_id: commandId,
              request_fingerprint: requestFingerprint,
              response_json: responseJson,
              status,
              created_at: createdAt,
              updated_at: updatedAt,
            });
            return { success: true, meta: { changes: 1 } };
          });
          return statement;
        });
        return statement;
      }

      if (sql.includes('SELECT * FROM command_idempotency')) {
        const statement = createPreparedStatement(sql);
        statement.bind = vi.fn((...params) => {
          statement.params = params;
          const [commandType, scopeKey, idempotencyKey] = params;
          statement.first = vi.fn(
            async () => rowsByKey.get(`${commandType}:${scopeKey}:${idempotencyKey}`) || null
          );
          return statement;
        });
        return statement;
      }

      if (sql.includes("status = 'in_flight'") && sql.includes('DELETE FROM command_idempotency')) {
        const statement = createPreparedStatement(sql);
        statement.bind = vi.fn((...params) => {
          statement.params = params;
          statement.run = vi.fn(async () => {
            calls.stealDeletes.push(params);
            const [commandType, scopeKey, idempotencyKey, staleBefore] = params;
            const key = `${commandType}:${scopeKey}:${idempotencyKey}`;
            const row = rowsByKey.get(key);
            if (
              stealChanges === 1 &&
              row &&
              row.status === 'in_flight' &&
              Number(row.updated_at) < Number(staleBefore)
            ) {
              rowsByKey.delete(key);
              return { success: true, meta: { changes: 1 } };
            }
            return { success: true, meta: { changes: 0 } };
          });
          return statement;
        });
        return statement;
      }

      return createPreparedStatement(sql);
    }),
  };
}

describe('CommandIdempotencyRepository', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('creates or loads a scoped receipt command idempotency record', async () => {
    const existingRow = {
      id: 'cmd-row-existing',
      command_type: 'purchase_receipt_record',
      scope_key: 'po-1',
      idempotency_key: 'idem-1',
      command_id: 'cmd-existing',
      request_fingerprint: 'fp-1',
      response_json: '{"ok":true}',
      status: 'committed',
      created_at: 1700000000000,
      updated_at: 1700000000001,
    };
    const db = createMockDb({ existingRows: [existingRow] });
    const repo = new CommandIdempotencyRepository(db, {
      now: () => 1710000000000,
      uuid: vi
        .fn()
        .mockReturnValueOnce('cmd-row-existing-attempt')
        .mockReturnValueOnce('cmd-existing-attempt')
        .mockReturnValueOnce('cmd-row-new')
        .mockReturnValueOnce('cmd-new'),
    });

    const loaded = await repo.reserveReceiptCommand('po-1', 'idem-1', 'fp-1');
    expect(loaded).toEqual({
      existing: true,
      record: existingRow,
      insertStatement: null,
      ownsReservation: false,
    });

    const created = await repo.reserveReceiptCommand('po-2', 'idem-2', 'fp-2');
    expect(created.existing).toBe(false);
    expect(created.ownsReservation).toBe(true);
    expect(created.record).toEqual(
      expect.objectContaining({
        id: 'cmd-row-new',
        command_type: 'purchase_receipt_record',
        scope_key: 'po-2',
        idempotency_key: 'idem-2',
        command_id: 'cmd-new',
        request_fingerprint: 'fp-2',
        status: 'in_flight',
        created_at: 1710000000000,
        updated_at: 1710000000000,
      })
    );
    expect(created.insertStatement).toBeNull();
  });

  it('buildFinalizeStatement supports persisting failed command states', () => {
    const db = createMockDb();
    const repo = new CommandIdempotencyRepository(db, {
      now: () => 1710000000000,
    });

    const statement = repo.buildFinalizeStatement('cmd-1', { ok: false }, 'failed');

    expect(statement.params).toEqual([
      JSON.stringify({ ok: false }),
      'failed',
      1710000000000,
      'cmd-1',
    ]);
  });

  it('takes over a stale in_flight record so the same key can re-execute after a crash', async () => {
    // Worker 在 reserve 之后、finalize 之前被杀：记录停留 in_flight，
    // 超过 stale 窗口后同键重试应原子接管（DELETE 谓词 + 重新预留）并重新执行
    const staleRow = {
      id: 'cmd-row-stale',
      command_type: 'order_line_ship',
      scope_key: 'order_line_ship:admin-1',
      idempotency_key: 'idem-stale',
      command_id: 'cmd-dead',
      request_fingerprint: 'fp-1',
      response_json: null,
      status: 'in_flight',
      created_at: 1709990000000,
      updated_at: 1709990000000, // 远早于 staleBefore
    };
    const db = createMockDb({ existingRows: [staleRow] });
    const repo = new CommandIdempotencyRepository(db, {
      now: () => 1710000000000,
      uuid: vi
        .fn()
        .mockReturnValueOnce('cmd-row-new')
        .mockReturnValueOnce('cmd-new'),
    });

    const result = await repo.reserveCommand(
      'order_line_ship',
      'order_line_ship:admin-1',
      'idem-stale',
      'fp-1'
    );

    expect(db.calls.stealDeletes).toHaveLength(1);
    // DELETE 带时间戳谓词（status='in_flight' AND updated_at < staleBefore）
    expect(db.calls.stealDeletes[0][3]).toBe(1710000000000 - 10 * 60 * 1000);
    expect(result.existing).toBe(false);
    expect(result.ownsReservation).toBe(true);
    expect(result.record).toEqual(
      expect.objectContaining({ command_id: 'cmd-new', status: 'in_flight' })
    );
    expect(db.rowsByKey.size).toBe(1);
  });

  it('does not take over a fresh in_flight record and keeps reporting it as existing', async () => {
    const freshRow = {
      id: 'cmd-row-fresh',
      command_type: 'order_line_ship',
      scope_key: 'order_line_ship:admin-1',
      idempotency_key: 'idem-fresh',
      command_id: 'cmd-live',
      request_fingerprint: 'fp-1',
      response_json: null,
      status: 'in_flight',
      created_at: 1710000000000,
      updated_at: 1710000000000, // 刚刚更新，未超 stale 窗口
    };
    const db = createMockDb({ existingRows: [freshRow] });
    const repo = new CommandIdempotencyRepository(db, {
      now: () => 1710000000000,
    });

    const result = await repo.reserveCommand(
      'order_line_ship',
      'order_line_ship:admin-1',
      'idem-fresh',
      'fp-1'
    );

    expect(result.existing).toBe(true);
    expect(result.ownsReservation).toBe(false);
    expect(result.record?.command_id).toBe('cmd-live');
    // 未超窗口：不发起接管
    expect(db.calls.stealDeletes).toHaveLength(0);
  });

  it('falls back to the existing reservation when the stale steal loses a concurrent race', async () => {
    // 接管 DELETE 输给并发接管者（changes=0）：回退为 existing 记录，不双预留
    const staleRow = {
      id: 'cmd-row-stale-race',
      command_type: 'order_line_ship',
      scope_key: 'order_line_ship:admin-1',
      idempotency_key: 'idem-race',
      command_id: 'cmd-dead-race',
      request_fingerprint: 'fp-1',
      response_json: null,
      status: 'in_flight',
      created_at: 1709990000000,
      updated_at: 1709990000000,
    };
    const db = createMockDb({ existingRows: [staleRow], stealChanges: 0 });
    const repo = new CommandIdempotencyRepository(db, {
      now: () => 1710000000000,
    });

    const result = await repo.reserveCommand(
      'order_line_ship',
      'order_line_ship:admin-1',
      'idem-race',
      'fp-1'
    );

    expect(db.calls.stealDeletes).toHaveLength(1);
    expect(result.existing).toBe(true);
    expect(result.ownsReservation).toBe(false);
  });

  it('does not take over committed records even when they are old', async () => {
    const committedRow = {
      id: 'cmd-row-committed',
      command_type: 'order_line_ship',
      scope_key: 'order_line_ship:admin-1',
      idempotency_key: 'idem-committed',
      command_id: 'cmd-done',
      request_fingerprint: 'fp-1',
      response_json: '{"ok":true}',
      status: 'committed',
      created_at: 1709990000000,
      updated_at: 1709990000000,
    };
    const db = createMockDb({ existingRows: [committedRow] });
    const repo = new CommandIdempotencyRepository(db, {
      now: () => 1710000000000,
    });

    const result = await repo.reserveCommand(
      'order_line_ship',
      'order_line_ship:admin-1',
      'idem-committed',
      'fp-1'
    );

    expect(result.existing).toBe(true);
    expect(result.record?.status).toBe('committed');
    expect(db.calls.stealDeletes).toHaveLength(0);
  });

  it('migration 0055 command idempotency status check includes failed', () => {
    const migrationPath = path.resolve(
      process.cwd(),
      'migrations/0055_command_idempotency_and_outbox.sql'
    );
    const sql = readFileSync(migrationPath, 'utf8');
    const commandIdempotencyTable =
      sql.match(
        /CREATE TABLE IF NOT EXISTS command_idempotency[\s\S]*?\);\n\nCREATE UNIQUE INDEX/
      )?.[0] || '';

    expect(commandIdempotencyTable).toContain("'failed'");
  });
});
