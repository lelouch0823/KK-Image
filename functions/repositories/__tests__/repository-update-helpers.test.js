import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CustomerRepository } from '../CustomerRepository.ts';
import { SalespersonRepository } from '../SalespersonRepository.js';
import { FileRepository } from '../FileRepository.js';

function createStatement(sql) {
  const statement = {
    sql,
    params: [],
    bind: vi.fn((...params) => {
      statement.params = params;
      return statement;
    }),
    run: vi.fn(),
  };
  return statement;
}

function createDb() {
  const statements = [];
  return {
    db: {
      prepare: vi.fn((sql) => {
        const statement = createStatement(sql);
        statements.push(statement);
        return statement;
      }),
    },
    statements,
  };
}

describe('repository update helper convergence', () => {
  let db;

  beforeEach(() => {
    ({ db } = createDb());
  });

  it('CustomerRepository.update returns true for no-op updates when record still exists', async () => {
    const repo = new CustomerRepository(db);
    const statement = createStatement('UPDATE customers');
    statement.run.mockResolvedValue({ success: true, meta: { changes: 0 } });
    db.prepare.mockReturnValueOnce(statement);
    db.prepare.mockReturnValueOnce({
      bind: vi.fn(() => ({
        first: vi.fn(async () => ({ id: 'customer-1' })),
      })),
    });

    const updatePromise = repo.update('customer-1', { remark: 'note', name: 'Alice' });

    await expect(updatePromise).resolves.toBe(true);
    expect(db.prepare).toHaveBeenCalledWith(expect.stringContaining('UPDATE customers SET name = ?, remark = ?, updated_at = ? WHERE id = ?'));
  });

  it('SalespersonRepository.update returns true for no-op updates when record still exists', async () => {
    const repo = new SalespersonRepository(db, 'jwt-secret');
    const statement = createStatement('UPDATE salespersons');
    statement.run.mockResolvedValue({ success: true, meta: { changes: 0 } });
    db.prepare.mockReturnValueOnce(statement);
    db.prepare.mockReturnValueOnce({
      bind: vi.fn(() => ({
        first: vi.fn(async () => ({ id: 'sales-1' })),
      })),
    });

    const updatePromise = repo.update('sales-1', { phone: '138', name: 'Bob' });

    await expect(updatePromise).resolves.toBe(true);
    expect(db.prepare).toHaveBeenCalledWith(expect.stringContaining('UPDATE salespersons SET name = ?, phone = ?, updated_at = ? WHERE id = ?'));
  });

  it('FileRepository.update uses deterministic set clause ordering', async () => {
    const repo = new FileRepository(db);
    const statement = createStatement('UPDATE files');
    statement.run.mockResolvedValue({ success: true, meta: { changes: 1 } });
    db.prepare.mockReturnValueOnce(statement);

    const updatePromise = repo.update('file-1', { storage_key: 'key-1', name: 'hero.jpg' });
    statement.run.mockResolvedValue({ success: true, meta: { changes: 1 } });

    await updatePromise;
    expect(db.prepare).toHaveBeenCalledWith('UPDATE files SET name = ?, storage_key = ?, updated_at = ? WHERE id = ?');
  });

  it('SalespersonRepository.recordLogin returns false when D1 reports zero changes', async () => {
    const repo = new SalespersonRepository(db, 'jwt-secret');
    const statement = createStatement('UPDATE salespersons');
    statement.run.mockResolvedValue({ success: true, meta: { changes: 0 } });
    db.prepare.mockReturnValueOnce(statement);

    await expect(repo.recordLogin('sales-1', '127.0.0.1', 'browser')).resolves.toBe(false);
  });

  it('CustomerRepository preserves scalar tag payloads as single-item arrays', async () => {
    const repo = new CustomerRepository(db);
    db.prepare.mockReturnValueOnce({
      bind: vi.fn(() => ({
        first: vi.fn(async () => ({
          id: 'customer-1',
          tags: '"vip"',
        })),
      })),
    });

    const customer = await repo.findById('customer-1');
    expect(customer.tags).toEqual(['vip']);
  });
});
