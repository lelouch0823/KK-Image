import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockAuthFetch = vi.fn();
globalThis.fetch = vi.fn(() =>
  Promise.reject(new Error('direct fetch should not be used in manage composables'))
);

const mocks = vi.hoisted(() => ({
  addToast: vi.fn(),
}));

vi.mock('@/utils/constants', () => ({
  API: {
    MANAGE_OUTBOX: '/api/manage/outbox',
    MANAGE_OUTBOX_BY_ID: (id) => `/api/manage/outbox/${id}`,
    MANAGE_AUDIT_REPLAY_DRY_RUN: '/api/manage/audit-replay/dry-run',
    MANAGE_AUDIT_REPLAY_EXECUTE: '/api/manage/audit-replay/execute',
  },
}));

vi.mock('../useToast', () => ({
  useToast: () => ({ addToast: mocks.addToast }),
}));

vi.mock('../useI18n', () => ({
  useI18n: () => ({ t: (key, fallback) => fallback || key }),
}));

vi.mock('../useAuth', () => ({
  useAuth: () => ({ authFetch: mockAuthFetch }),
}));

describe('useOutboxOps', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads outbox events with eventType, consumerName, and status filters', async () => {
    mockAuthFetch.mockResolvedValueOnce({
      json: () =>
        Promise.resolve({
          success: true,
          data: [{ id: 'evt-1', event_type: 'purchase_receipt_recorded' }],
          meta: {
            limit: 100,
            isTruncated: true,
          },
        }),
    });

    const { useOutboxOps } = await import('../useOutboxOps');
    const { loadEvents, events, listMeta } = useOutboxOps();
    const ok = await loadEvents({
      eventType: 'purchase_receipt_recorded',
      consumerName: 'notification',
      status: 'failed',
    });

    expect(ok).toBe(true);
    expect(events.value).toEqual([{ id: 'evt-1', event_type: 'purchase_receipt_recorded' }]);
    expect(listMeta.value).toEqual({
      limit: 100,
      isTruncated: true,
    });
    expect(mockAuthFetch).toHaveBeenCalledWith(
      '/api/manage/outbox?eventType=purchase_receipt_recorded&consumerName=notification&status=failed'
    );
  });

  it('loads one outbox event detail and submits dry-run then execute replay', async () => {
    mockAuthFetch
      .mockResolvedValueOnce({
        json: () =>
          Promise.resolve({
            success: true,
            data: {
              id: 'evt-1',
              consumerJobs: [{ consumer_name: 'notification', status: 'failed' }],
            },
          }),
      })
      .mockResolvedValueOnce({
        json: () =>
          Promise.resolve({
            success: true,
            data: { runId: 'dry-1', affectedEvents: ['evt-1'] },
          }),
      })
      .mockResolvedValueOnce({
        json: () =>
          Promise.resolve({
            success: true,
            data: { runId: 'exec-1', replayedEvents: ['evt-1'] },
          }),
      });

    const { useOutboxOps } = await import('../useOutboxOps');
    const { loadEventDetail, eventDetail, dryRunReplay, executeReplay } = useOutboxOps();

    const detail = await loadEventDetail('evt-1');
    const dryRun = await dryRunReplay({
      scopeType: 'event',
      scopeId: 'evt-1',
      consumerName: 'notification',
    });
    const execute = await executeReplay({
      scopeType: 'event',
      scopeId: 'evt-1',
      consumerName: 'notification',
    });

    expect(detail).toEqual({
      id: 'evt-1',
      consumerJobs: [{ consumer_name: 'notification', status: 'failed' }],
    });
    expect(eventDetail.value?.id).toBe('evt-1');
    expect(dryRun).toEqual({ runId: 'dry-1', affectedEvents: ['evt-1'] });
    expect(execute).toEqual({ runId: 'exec-1', replayedEvents: ['evt-1'] });
    expect(mockAuthFetch).toHaveBeenNthCalledWith(1, '/api/manage/outbox/evt-1');
    expect(mockAuthFetch).toHaveBeenNthCalledWith(
      2,
      '/api/manage/audit-replay/dry-run',
      expect.objectContaining({ method: 'POST' })
    );
    expect(mockAuthFetch).toHaveBeenNthCalledWith(
      3,
      '/api/manage/audit-replay/execute',
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('keeps the newest list result when earlier requests resolve later', async () => {
    let resolveFirst;
    let resolveSecond;
    const firstResponse = new Promise((resolve) => {
      resolveFirst = resolve;
    });
    const secondResponse = new Promise((resolve) => {
      resolveSecond = resolve;
    });

    mockAuthFetch.mockReturnValueOnce(firstResponse).mockReturnValueOnce(secondResponse);

    const { useOutboxOps } = await import('../useOutboxOps');
    const { loadEvents, events, loading } = useOutboxOps();

    const firstLoad = loadEvents({ eventType: 'older' });
    const secondLoad = loadEvents({ eventType: 'newer' });

    resolveSecond({
      json: () =>
        Promise.resolve({
          success: true,
          data: [{ id: 'evt-new', event_type: 'newer' }],
        }),
    });
    await secondLoad;

    resolveFirst({
      json: () =>
        Promise.resolve({
          success: true,
          data: [{ id: 'evt-old', event_type: 'older' }],
        }),
    });
    await firstLoad;

    expect(events.value).toEqual([{ id: 'evt-new', event_type: 'newer' }]);
    expect(loading.value).toBe(false);
  });

  it('keeps the newest event detail when earlier detail requests resolve later', async () => {
    let resolveFirst;
    let resolveSecond;
    const firstResponse = new Promise((resolve) => {
      resolveFirst = resolve;
    });
    const secondResponse = new Promise((resolve) => {
      resolveSecond = resolve;
    });

    mockAuthFetch.mockReturnValueOnce(firstResponse).mockReturnValueOnce(secondResponse);

    const { useOutboxOps } = await import('../useOutboxOps');
    const { loadEventDetail, eventDetail, detailLoading } = useOutboxOps();

    const firstLoad = loadEventDetail('evt-old');
    const secondLoad = loadEventDetail('evt-new');

    resolveSecond({
      json: () =>
        Promise.resolve({
          success: true,
          data: { id: 'evt-new', event_type: 'newer' },
        }),
    });
    await secondLoad;

    resolveFirst({
      json: () =>
        Promise.resolve({
          success: true,
          data: { id: 'evt-old', event_type: 'older' },
        }),
    });
    await firstLoad;

    expect(eventDetail.value).toEqual({ id: 'evt-new', event_type: 'newer' });
    expect(detailLoading.value).toBe(false);
  });
});
