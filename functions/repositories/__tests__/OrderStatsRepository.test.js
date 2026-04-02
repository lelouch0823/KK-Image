import { describe, expect, it, vi } from 'vitest';
import { OrderStatsRepository } from '../OrderStatsRepository.js';

describe('OrderStatsRepository', () => {
  it('falls back to empty names when current_data is invalid json in recent pending orders', async () => {
    const db = {
      prepare: vi.fn(() => ({
        bind: vi.fn(() => ({
          all: vi.fn(async () => ({
            results: [
              {
                id: 'order-1',
                order_no: 'SO-1',
                current_data: '{',
                created_at: 123,
                status: 'pending',
              },
            ],
          })),
        })),
      })),
    };
    const repo = new OrderStatsRepository(db);

    await expect(repo.getRecentPending(5)).resolves.toEqual([
      {
        id: 'order-1',
        orderNo: 'SO-1',
        name: '',
        createdAt: 123,
        status: 'pending',
      },
    ]);
  });
});
