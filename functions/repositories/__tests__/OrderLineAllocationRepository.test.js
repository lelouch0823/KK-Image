import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OrderLineAllocationRepository } from '../OrderLineAllocationRepository.js';

function createMockDb() {
  return {
    prepare: vi.fn((sql) => {
      const statement = {
        sql,
        bind: vi.fn(function bindStatement() {
          statement.params = Array.from(arguments);
          return statement;
        }),
        run: vi.fn(async () => ({ success: true })),
      };
      return statement;
    }),
  };
}

describe('OrderLineAllocationRepository', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('defaults released allocations to released status', async () => {
    const now = 1720000000000;
    vi.spyOn(Date, 'now').mockReturnValue(now);
    const db = createMockDb();
    const repo = new OrderLineAllocationRepository(db);

    const created = await repo.create({
      id: 'alloc-1',
      order_line_id: 'line-1',
      inventory_event_id: 'event-1',
      allocated_qty: 5,
      released_qty: 2,
      released_at: now + 1000,
    });

    expect(db.prepare).toHaveBeenCalledTimes(1);
    expect(db.prepare.mock.results[0].value.run).toHaveBeenCalledTimes(1);
    const bindArgs = db.prepare.mock.results[0].value.bind.mock.calls[0];
    expect(bindArgs[5]).toBe(2);
    expect(bindArgs[6]).toBe('released');
    expect(bindArgs[8]).toBe(now + 1000);
    expect(created.status).toBe('released');
  });

  it('lists only active allocations with remaining quantity for an order line', async () => {
    const db = {
      prepare: vi.fn((sql) => {
        const statement = {
          sql,
          bind: vi.fn(() => statement),
          all: vi.fn(async () => ({
            results: [
              {
                id: 'alloc-1',
                order_line_id: 'line-1',
                variant_id: 'var-1',
                inventory_event_id: 'evt-1',
                allocated_qty: 4,
                released_qty: 1,
                status: 'active',
                allocated_at: 1710000000000,
                released_at: 1710000001000,
                created_at: 1710000000000,
                updated_at: 1710000001000,
              },
            ],
          })),
        };
        return statement;
      }),
    };
    const repo = new OrderLineAllocationRepository(db);

    const rows = await repo.listActiveByOrderLine('line-1');

    expect(db.prepare).toHaveBeenCalledWith(expect.stringContaining('FROM order_line_allocations'));
    expect(db.prepare).toHaveBeenCalledWith(expect.stringContaining("status = 'active'"));
    expect(rows).toEqual([
      expect.objectContaining({
        id: 'alloc-1',
        allocated_qty: 4,
        released_qty: 1,
        status: 'active',
      }),
    ]);
  });

  it('keeps partially released allocations active until the full quantity is released', () => {
    const now = 1720000000000;
    const db = createMockDb();
    const repo = new OrderLineAllocationRepository(db);

    const statement = repo.buildReleaseStatement(
      {
        id: 'alloc-1',
        allocated_qty: 5,
        released_qty: 1,
        status: 'active',
      },
      2,
      { now }
    );

    const bindArgs = statement.bind.mock.calls[0];
    expect(bindArgs[0]).toBe(3);
    expect(bindArgs[2]).toBe('active');
    expect(bindArgs[4]).toBe('alloc-1');
  });

  it('marks allocations released when the remaining quantity is fully released', () => {
    const now = 1720000000000;
    const db = createMockDb();
    const repo = new OrderLineAllocationRepository(db);

    const statement = repo.buildReleaseStatement(
      {
        id: 'alloc-1',
        allocated_qty: 5,
        released_qty: 1,
        status: 'active',
      },
      4,
      { now }
    );

    const bindArgs = statement.bind.mock.calls[0];
    expect(bindArgs[0]).toBe(5);
    expect(bindArgs[1]).toBe(now);
    expect(bindArgs[2]).toBe('released');
  });
});
