import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  isCronAuthorized: vi.fn(),
  findStalePending: vi.fn(),
  findApproachingDeadline: vi.fn(),
  publish: vi.fn(async () => []),
  runOutboxPoller: vi.fn(async () => ({ claimed: 0, published: 0, failed: 0 })),
}));

vi.mock('../../utils/cron-auth.js', async () => {
  const actual = await vi.importActual('../../utils/cron-auth.js');
  return {
    ...actual,
    isCronAuthorized: mocks.isCronAuthorized,
  };
});

vi.mock('../../../repositories/OrderRepository.js', () => ({
  OrderRepository: vi.fn(() => ({
    findStalePending: mocks.findStalePending,
    findApproachingDeadline: mocks.findApproachingDeadline,
  })),
}));

vi.mock('../../../services/DomainOutboxPublisher.js', () => ({
  DomainOutboxPublisher: vi.fn(() => ({
    publish: mocks.publish,
  })),
}));

vi.mock('../outbox.js', () => ({
  runOutboxPoller: mocks.runOutboxPoller,
}));

import { onRequest } from '../reminders.js';

function createDbMock() {
  return {
    prepare: vi.fn((sql) => {
      if (sql.includes('FROM domain_outbox')) {
        return {
          bind: vi.fn(() => ({
            all: vi.fn(async () => ({ results: [] })),
          })),
        };
      }

      throw new Error(`Unexpected SQL: ${sql}`);
    }),
  };
}

describe('cron reminders outbox publishing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isCronAuthorized.mockReturnValue(true);
    mocks.findStalePending.mockResolvedValue([{ id: 'o-pending', order_no: 'SO-PENDING' }]);
    mocks.findApproachingDeadline.mockResolvedValue([
      {
        id: 'o-deadline',
        order_no: 'SO-DEADLINE',
        salesperson_id: 'sp-2',
        deadline_date: '2026-04-01',
      },
    ]);
  });

  it('publishes reminder events through outbox and runs the poller', async () => {
    const response = await onRequest({
      env: { DB: createDbMock(), CRON_SECRET: 'secret' },
      request: new Request('https://kk.example.com/api/cron/reminders', {
        method: 'POST',
        headers: { Authorization: 'Bearer secret' },
      }),
    });

    expect(response.status).toBe(200);
    expect(mocks.publish).toHaveBeenCalledWith([
      expect.objectContaining({
        event_type: 'order_pending_reminder_due',
        aggregate_id: 'o-pending',
        payload: expect.objectContaining({
          order_id: 'o-pending',
          order_no: 'SO-PENDING',
          receiver: 'admin',
          sub_type: 'pending_timeout',
        }),
      }),
      expect.objectContaining({
        event_type: 'order_deadline_reminder_due',
        aggregate_id: 'o-deadline',
        payload: expect.objectContaining({
          order_id: 'o-deadline',
          order_no: 'SO-DEADLINE',
          receiver: 'sales',
          salesperson_id: 'sp-2',
          deadline: '2026-04-01',
        }),
      }),
      expect.objectContaining({
        event_type: 'order_deadline_reminder_due',
        aggregate_id: 'o-deadline',
        payload: expect.objectContaining({
          order_id: 'o-deadline',
          order_no: 'SO-DEADLINE',
          receiver: 'admin',
          deadline: '2026-04-01',
        }),
      }),
    ]);
    expect(mocks.runOutboxPoller).toHaveBeenCalledTimes(1);

    const payload = await response.json();
    expect(payload).toEqual(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          processed: expect.objectContaining({
            pending: 1,
            approaching: 1,
            notificationsSent: 3,
          }),
        }),
      })
    );
  });

  it('loads approaching deadlines from the repository instead of ad-hoc SQL', async () => {
    const response = await onRequest({
      env: {
        DB: {
          prepare: vi.fn((sql) => {
            if (sql.includes('FROM domain_outbox')) {
              return {
                bind: vi.fn(() => ({
                  all: vi.fn(async () => ({ results: [] })),
                })),
              };
            }
            throw new Error(`Unexpected SQL: ${sql}`);
          }),
        },
        CRON_SECRET: 'secret',
      },
      request: new Request('https://kk.example.com/api/cron/reminders', {
        method: 'POST',
        headers: { Authorization: 'Bearer secret' },
      }),
    });

    expect(response.status).toBe(200);
    expect(mocks.findApproachingDeadline).toHaveBeenCalledTimes(1);
  });
});
