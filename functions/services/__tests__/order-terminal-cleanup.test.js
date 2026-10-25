import { describe, expect, it, vi } from 'vitest';

/**
 * R5（F5）：终态清算的等值重试必须仍然执行——
 * 终态转换提交后清算失败（D1 瞬时错误），客户端重试同一 void→void 请求；
 * 旧实现的 previousStatus === nextStatus 短路会让清算永远跳过。
 */
vi.mock('../OrderLineFulfillmentService/index.js', () => ({
  OrderLineFulfillmentService: vi.fn(() => ({
    releaseAllLineReservations: vi.fn(async () => [{ order_line_id: 'line-1', released: true }]),
  })),
}));

import { maybeReleaseLineReservations } from '../order-terminal-cleanup.js';

describe('maybeReleaseLineReservations (R5)', () => {
  it('releases reservations when transitioning into a terminal status', async () => {
    const results = await maybeReleaseLineReservations({}, 'order-1', 'confirmed', 'void');
    expect(results).toEqual([{ order_line_id: 'line-1', released: true }]);
  });

  it('still releases on same-status retry (void -> void) after a partial failure', async () => {
    // 旧实现在此短路返回 []，导致 active allocation 永久滞留
    const results = await maybeReleaseLineReservations({}, 'order-1', 'void', 'void');
    expect(results).toEqual([{ order_line_id: 'line-1', released: true }]);
  });

  it('does nothing for non-terminal target statuses', async () => {
    const results = await maybeReleaseLineReservations({}, 'order-1', 'pending', 'confirmed');
    expect(results).toEqual([]);
  });
});
