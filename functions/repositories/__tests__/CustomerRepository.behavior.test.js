import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CustomerRepository } from '../CustomerRepository.js';

function createStatement(sql, response = {}) {
  const statement = {
    sql,
    params: [],
    bind: vi.fn((...params) => {
      statement.params = params;
      return statement;
    }),
    first: vi.fn(async () => response.first),
    all: vi.fn(async () => response.all),
    run: vi.fn(async () => response.run),
  };

  return statement;
}

describe('CustomerRepository behavior coverage', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-18T10:00:00.000Z'));
  });

  it('normalizes findById tags for missing, empty, and invalid payloads', async () => {
    const db = {
      prepare: vi
        .fn()
        .mockReturnValueOnce(
          createStatement('SELECT * FROM customers WHERE id = ?', {
            first: { id: 'customer-1', tags: '' },
          })
        )
        .mockReturnValueOnce(
          createStatement('SELECT * FROM customers WHERE id = ?', {
            first: { id: 'customer-2', tags: 'null' },
          })
        )
        .mockReturnValueOnce(
          createStatement('SELECT * FROM customers WHERE id = ?', {
            first: { id: 'customer-3' },
          })
        )
        .mockReturnValueOnce(
          createStatement('SELECT * FROM customers WHERE id = ?', {
            first: null,
          })
        ),
    };

    const repo = new CustomerRepository(db);

    await expect(repo.findById('customer-1')).resolves.toMatchObject({ tags: [] });
    await expect(repo.findById('customer-2')).resolves.toMatchObject({ tags: [] });
    await expect(repo.findById('customer-3')).resolves.toMatchObject({ tags: [] });
    await expect(repo.findById('customer-4')).resolves.toBeNull();
  });

  it('lists customers with pagination-safe bindings and normalized tag arrays', async () => {
    const countStatement = createStatement('SELECT COUNT(*) as total FROM customers', {
      first: { total: 5 },
    });
    const listStatement = createStatement('SELECT * FROM customers', {
      all: {
        results: [
          { id: 'c1', tags: '["vip","wholesale"]' },
          { id: 'c2', tags: '"returning"' },
          { id: 'c3', tags: '' },
        ],
      },
    });
    const db = {
      prepare: vi
        .fn()
        .mockReturnValueOnce(countStatement)
        .mockReturnValueOnce(listStatement),
    };

    const repo = new CustomerRepository(db);

    await expect(repo.list({ page: 2, limit: 2, search: 'Ali' })).resolves.toEqual({
      results: [
        { id: 'c1', tags: ['vip', 'wholesale'] },
        { id: 'c2', tags: ['returning'] },
        { id: 'c3', tags: [] },
      ],
      total: 5,
      pages: 3,
    });

    expect(countStatement.params).toEqual(['%Ali%', '%Ali%', '%Ali%']);
    expect(listStatement.params).toEqual(['%Ali%', '%Ali%', '%Ali%', 2, 2]);
    expect(db.prepare).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('name LIKE ? OR phone LIKE ? OR company LIKE ?')
    );
  });

  it('creates customers with default field fallbacks and serialized tags', async () => {
    vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue('customer-new');

    const insertStatement = createStatement('INSERT INTO customers', {
      run: { success: true, meta: { changes: 1 } },
    });
    const db = {
      prepare: vi.fn().mockReturnValue(insertStatement),
    };

    const repo = new CustomerRepository(db);

    await expect(
      repo.create({
        name: 'Alice',
        tags: ['vip'],
      })
    ).resolves.toEqual({
      id: 'customer-new',
      name: 'Alice',
      tags: ['vip'],
      created_at: Date.now(),
      updated_at: Date.now(),
    });

    expect(insertStatement.params).toEqual([
      'customer-new',
      'Alice',
      '',
      '',
      '',
      '',
      '["vip"]',
      '',
      'admin',
      Date.now(),
      Date.now(),
    ]);
  });

  it('returns false when update receives no mutable fields', async () => {
    const repo = new CustomerRepository({ prepare: vi.fn() });

    await expect(repo.update('customer-1', {})).resolves.toBe(false);
  });

  it('covers delete and hasOrders boolean helpers', async () => {
    const deleteStatement = createStatement('DELETE FROM customers', {
      run: { success: true, meta: { changes: 0 } },
    });
    const orderStatement = createStatement('SELECT COUNT(*) as count FROM orders', {
      first: { count: 2 },
    });
    const db = {
      prepare: vi
        .fn()
        .mockReturnValueOnce(deleteStatement)
        .mockReturnValueOnce(orderStatement),
    };

    const repo = new CustomerRepository(db);

    await expect(repo.delete('customer-1')).resolves.toBe(false);
    await expect(repo.hasOrders('customer-1')).resolves.toBe(true);
    expect(deleteStatement.params).toEqual(['customer-1']);
    expect(orderStatement.params).toEqual(['customer-1']);
  });
});
