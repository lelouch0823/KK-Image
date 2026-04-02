import { describe, expect, it } from 'vitest';
import { buildOrdersListState, filterOrdersBySearch } from '../../../miniprogram/pages/index/controller';

describe('orders list controller', () => {
  it('merges paginated order pages without losing current items', () => {
    const state = buildOrdersListState(
      [{ id: 'o-1', orderNo: 'SO-001' } as any],
      {
        orders: [{ id: 'o-2', orderNo: 'SO-002' } as any],
        pagination: { page: 2, totalPages: 3, total: 2, limit: 20 },
      },
      true
    );

    expect(state.orders.map((item) => item.id)).toEqual(['o-1', 'o-2']);
  });

  it('filters by order number or title', () => {
    const result = filterOrdersBySearch(
      [
        { id: 'o-1', orderNo: 'SO-001', title: 'Poster' } as any,
        { id: 'o-2', orderNo: 'SO-002', title: 'Lamp' } as any,
      ],
      'poster'
    );

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('o-1');
  });
});
