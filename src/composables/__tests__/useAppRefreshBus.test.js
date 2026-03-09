import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useAppRefreshBus, resetAppRefreshBusForTests } from '../useAppRefreshBus.js';

describe('useAppRefreshBus', () => {
  beforeEach(() => {
    resetAppRefreshBusForTests();
  });

  it('publishes refresh events to matching module subscribers', () => {
    const { publishRefresh, subscribeModule } = useAppRefreshBus();
    const handler = vi.fn();
    const stop = subscribeModule('orders', handler);

    publishRefresh({ module: 'orders', reason: 'ai_created', entityId: 'ord-1' });

    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        module: 'orders',
        reason: 'ai_created',
        entityId: 'ord-1',
      })
    );

    stop();
  });

  it('ignores non-matching module events', () => {
    const { publishRefresh, subscribeModule } = useAppRefreshBus();
    const handler = vi.fn();

    subscribeModule('customers', handler);
    publishRefresh({ module: 'orders', reason: 'notification' });

    expect(handler).not.toHaveBeenCalled();
  });
});
