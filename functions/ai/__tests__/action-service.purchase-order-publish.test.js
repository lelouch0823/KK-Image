import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  publish: vi.fn(async () => []),
  runOutboxPoller: vi.fn(async () => ({ claimed: 0, published: 0, failed: 0 })),
  waitUntil: vi.fn(),
}));

vi.mock('../../services/DomainOutboxPublisher.js', () => ({
  DomainOutboxPublisher: vi.fn(() => ({
    publish: mocks.publish,
  })),
}));

vi.mock('../../api/cron/outbox.js', () => ({
  runOutboxPoller: mocks.runOutboxPoller,
}));

import { publishPurchaseOrderCreatedFromAI } from '../action-service.js';

describe('publishPurchaseOrderCreatedFromAI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses a stable command id derived from the AI action session id', async () => {
    await publishPurchaseOrderCreatedFromAI(
      {
        env: { DB: {} },
        c: {
          req: { url: 'http://localhost/api/manage/ai' },
          executionCtx: { waitUntil: mocks.waitUntil },
        },
      },
      {
        sessionId: 'act-po-1',
        created: { id: 'po-1' },
        mode: 'manual',
        items: [{ product_id: 'prod-1' }],
      }
    );

    expect(mocks.publish).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          event_type: 'purchase_order_created',
          aggregate_id: 'po-1',
        }),
      ],
      expect.objectContaining({
        commandId: 'ai_purchase_order:act-po-1',
        correlationId: 'ai_purchase_order:act-po-1',
      })
    );
    expect(mocks.runOutboxPoller).toHaveBeenCalledWith(
      expect.objectContaining({
        workerId: 'purchase_order_created:po-1:ai',
      })
    );
    expect(mocks.waitUntil).toHaveBeenCalledTimes(1);
  });

  it('treats duplicate outbox idempotency keys as already published and still nudges the poller', async () => {
    mocks.publish.mockRejectedValueOnce(
      new Error('D1_ERROR: UNIQUE constraint failed: domain_outbox.idempotency_key')
    );

    await expect(
      publishPurchaseOrderCreatedFromAI(
        {
          env: { DB: {} },
          c: {
            req: { url: 'http://localhost/api/manage/ai' },
            executionCtx: { waitUntil: mocks.waitUntil },
          },
        },
        {
          sessionId: 'act-po-2',
          created: { id: 'po-2' },
          mode: 'from_orders',
          orderIds: ['ord-1'],
        }
      )
    ).resolves.toBeUndefined();

    expect(mocks.runOutboxPoller).toHaveBeenCalledWith(
      expect.objectContaining({
        workerId: 'purchase_order_created_from_orders:po-2:ai',
      })
    );
    expect(mocks.waitUntil).toHaveBeenCalledTimes(1);
  });

  it('rethrows non-duplicate outbox publication failures', async () => {
    mocks.publish.mockRejectedValueOnce(new Error('network down'));

    await expect(
      publishPurchaseOrderCreatedFromAI(
        {
          env: { DB: {} },
          c: {
            req: { url: 'http://localhost/api/manage/ai' },
            executionCtx: { waitUntil: mocks.waitUntil },
          },
        },
        {
          sessionId: 'act-po-3',
          created: { id: 'po-3' },
          mode: 'manual',
          items: [{ product_id: 'prod-1' }],
        }
      )
    ).rejects.toThrow('network down');

    expect(mocks.runOutboxPoller).not.toHaveBeenCalled();
  });
});
