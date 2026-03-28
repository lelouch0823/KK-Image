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
});
