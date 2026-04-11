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

function createMockDb({ existingRows = [] } = {}) {
  const rowsByKey = new Map(
    existingRows.map((row) => [`${row.command_type}:${row.scope_key}:${row.idempotency_key}`, row])
  );

  return {
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

  it('migration 0055 command idempotency status check includes failed', () => {
    const migrationPath = path.resolve(process.cwd(), 'migrations/0055_command_idempotency_and_outbox.sql');
    const sql = readFileSync(migrationPath, 'utf8');
    const commandIdempotencyTable = sql.match(
      /CREATE TABLE IF NOT EXISTS command_idempotency[\s\S]*?\);\n\nCREATE UNIQUE INDEX/
    )?.[0] || '';

    expect(commandIdempotencyTable).toContain("'failed'");
  });
});
