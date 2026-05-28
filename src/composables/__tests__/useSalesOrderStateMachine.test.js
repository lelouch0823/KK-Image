import { describe, it, expect, vi } from 'vitest';
import { useSalesOrderStateMachine } from '@/composables/sales/useSalesOrderStateMachine';

describe('useSalesOrderStateMachine', () => {
  it('transitions idle -> loading -> ready', async () => {
    const machine = useSalesOrderStateMachine({
      loadOrders: vi.fn().mockResolvedValue({ ok: true, data: [{ id: 'o-1' }] }),
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
      .mockResolvedValueOnce({ ok: true, data: [{ id: 'o-1' }] });

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

  it('keeps the latest loadOrders state when earlier requests resolve late', async () => {
    let resolveFirst;
    let resolveSecond;
    const machine = useSalesOrderStateMachine({
      loadOrders: vi
        .fn()
        .mockImplementationOnce(
          () =>
            new Promise((resolve) => {
              resolveFirst = resolve;
            })
        )
        .mockImplementationOnce(
          () =>
            new Promise((resolve) => {
              resolveSecond = resolve;
            })
        ),
      createOrder: vi.fn(),
      loadDetail: vi.fn(),
      comment: vi.fn(),
    });

    const firstPending = machine.loadOrders({ search: 'old' });
    const secondPending = machine.loadOrders({ search: 'new' });

    resolveSecond({ ok: true, data: [{ id: 'o-new' }] });
    await secondPending;

    expect(machine.state.value).toBe('ready');
    expect(machine.error.value).toBe(null);

    resolveFirst({ ok: false, error: 'stale boom' });
    await firstPending;

    expect(machine.state.value).toBe('ready');
    expect(machine.error.value).toBe(null);
  });
});
