import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CommandIdempotencyRepository } from '../CommandIdempotencyRepository.js';

function createPreparedStatement(sql, { firstResult = null } = {}) {
  const statement = {
    sql,
    params: [],
    bind: vi.fn((...params) => {
      statement.params = params;
      return statement;
    }),
    first: vi.fn(async () => firstResult),
    run: vi.fn(async () => ({ success: true, meta: { changes: 1 } })),
  };
  return statement;
}

function createMockDb({ existingRow = null } = {}) {
  return {
    prepare: vi.fn((sql) => {
      if (sql.includes('SELECT * FROM command_idempotency')) {
        const statement = createPreparedStatement(sql);
        statement.bind = vi.fn((...params) => {
          statement.params = params;
          const [, scopeKey, idempotencyKey] = params;
          statement.first = vi.fn(async () => (
            existingRow
            && existingRow.scope_key === scopeKey
            && existingRow.idempotency_key === idempotencyKey
              ? existingRow
              : null
          ));
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
    const db = createMockDb({ existingRow });
    const repo = new CommandIdempotencyRepository(db, {
      now: () => 1710000000000,
      uuid: vi.fn()
        .mockReturnValueOnce('cmd-row-new')
        .mockReturnValueOnce('cmd-new'),
    });

    const loaded = await repo.reserveReceiptCommand('po-1', 'idem-1', 'fp-1');
    expect(loaded).toEqual({
      existing: true,
      record: existingRow,
      insertStatement: null,
    });

    const created = await repo.reserveReceiptCommand('po-2', 'idem-2', 'fp-2');
    expect(created.existing).toBe(false);
    expect(created.record).toEqual(expect.objectContaining({
      id: 'cmd-row-new',
      command_type: 'purchase_receipt_record',
      scope_key: 'po-2',
      idempotency_key: 'idem-2',
      command_id: 'cmd-new',
      request_fingerprint: 'fp-2',
      status: 'in_flight',
      created_at: 1710000000000,
      updated_at: 1710000000000,
    }));
    expect(created.insertStatement?.sql).toContain('INSERT INTO command_idempotency');
    expect(created.insertStatement?.params).toEqual([
      'cmd-row-new',
      'purchase_receipt_record',
      'po-2',
      'idem-2',
      'cmd-new',
      'fp-2',
      null,
      'in_flight',
      1710000000000,
      1710000000000,
    ]);
  });
});
