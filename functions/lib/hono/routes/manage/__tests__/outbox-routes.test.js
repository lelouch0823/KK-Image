import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';

const mocks = vi.hoisted(() => ({
  listEvents: vi.fn(),
  getEventDetail: vi.fn(),
}));

vi.mock('../../../../../repositories/OutboxReplayRepository.js', () => ({
  OutboxReplayRepository: vi.fn(() => ({
    listEvents: mocks.listEvents,
    getEventDetail: mocks.getEventDetail,
  })),
}));

vi.mock('../../../middleware/auth.js', () => ({
  requirePermission: () => async (_c, next) => next(),
}));

import outboxApp from '../outbox.js';

function createApp() {
  const app = new Hono();
  app.onError((err, c) =>
    c.json({ success: false, error: err?.message || 'Internal Error' }, Number(err?.statusCode || 500))
  );
  app.route('/api/manage/outbox', outboxApp);
  return app;
}

describe('manage outbox routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listEvents.mockResolvedValue([{
      id: 'evt-1',
      event_type: 'purchase_receipt_recorded',
      consumerJobs: [{ consumer_name: 'notification', status: 'published' }],
      webhookAttempts: [],
    }]);
    mocks.getEventDetail.mockResolvedValue({
      id: 'evt-1',
      event_type: 'purchase_receipt_recorded',
      consumerJobs: [{ consumer_name: 'notification', status: 'published' }],
      webhookAttempts: [{ delivery_key: 'evt-1:wh-1:v1', classification: 'delivered' }],
    });
  });

  it('lists outbox events with stuck-consumer filters for operators', async () => {
    const app = createApp();

    const res = await app.request(
      'http://localhost/api/manage/outbox?eventType=purchase_receipt_recorded&consumerName=notification&status=failed',
      { method: 'GET' },
      { DB: {} },
      { waitUntil: vi.fn() }
    );

    expect(res.status).toBe(200);
    expect(mocks.listEvents).toHaveBeenCalledWith(expect.objectContaining({
      eventType: 'purchase_receipt_recorded',
      consumerName: 'notification',
      status: 'failed',
    }));
  });

  it('returns event detail including consumer jobs and webhook attempts', async () => {
    const app = createApp();

    const res = await app.request(
      'http://localhost/api/manage/outbox/evt-1',
      { method: 'GET' },
      { DB: {} },
      { waitUntil: vi.fn() }
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data).toEqual(expect.objectContaining({
      id: 'evt-1',
      consumerJobs: [expect.objectContaining({ consumer_name: 'notification' })],
      webhookAttempts: [expect.objectContaining({ delivery_key: 'evt-1:wh-1:v1' })],
    }));
  });
});
