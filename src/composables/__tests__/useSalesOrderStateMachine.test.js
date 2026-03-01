import { describe, it, expect, vi } from 'vitest';
import { useSalesOrderStateMachine } from '@/composables/sales/useSalesOrderStateMachine';

describe('useSalesOrderStateMachine', () => {
  it('transitions idle -> loading -> ready', async () => {
    const machine = useSalesOrderStateMachine({
      loadOrders: vi.fn().mockResolvedValue({ ok: true, data: { orders: [{ id: 'o-1' }] } }),
      createOrder: vi.fn(),
      loadDetail: vi.fn(),
      comment: vi.fn(),
    });

    expect(machine.state.value).toBe('idle');
    const promise = machine.loadOrders();
    expect(machine.state.value).toBe('loading');
    await promise;
    expect(machine.state.value).toBe('ready');
  });

  it('transitions loading -> error and supports retry', async () => {
    const loadOrders = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, error: 'boom' })
      .mockResolvedValueOnce({ ok: true, data: { orders: [{ id: 'o-1' }] } });

    const machine = useSalesOrderStateMachine({
      loadOrders,
      createOrder: vi.fn(),
      loadDetail: vi.fn(),
      comment: vi.fn(),
    });

    await machine.loadOrders();
    expect(machine.state.value).toBe('error');
    expect(machine.error.value).toBe('boom');

    await machine.retry('loadOrders');
    expect(machine.state.value).toBe('ready');
  });
});
