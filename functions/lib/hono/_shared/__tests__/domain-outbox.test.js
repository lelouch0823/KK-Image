import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  publish: vi.fn(async (events) => events),
  countAvailableJobs: vi.fn(async () => 1),
  runOutboxPoller: vi.fn(async () => ({ claimed: 0, published: 0, failed: 0 })),
}));

vi.mock('../../../../services/DomainOutboxPublisher.js', () => ({
  DomainOutboxPublisher: vi.fn(() => ({
    publish: mocks.publish,
  })),
}));

vi.mock('../../../../services/DomainOutboxDispatchService.js', () => ({
  DomainOutboxDispatchService: vi.fn(() => ({
    countAvailableJobs: mocks.countAvailableJobs,
  })),
}));

vi.mock('../../../../api/cron/outbox.js', () => ({
  runOutboxPoller: mocks.runOutboxPoller,
}));

import { publishDomainEventsAndPoll } from '../domain-outbox.js';

function createContext() {
  return {
    env: { DB: { prepare: vi.fn(), batch: vi.fn() } },
    req: { url: 'https://kk.example.com/api/manage/folders' },
    executionCtx: {
      waitUntil: vi.fn((promise) => promise),
    },
  };
}

describe('domain outbox helper', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.countAvailableJobs.mockResolvedValue(1);
  });

  it('does not eagerly schedule the poller for low-backlog non-order events', async () => {
    const c = createContext();

    await publishDomainEventsAndPoll(c, [{
      event_type: 'folder_updated',
      aggregate_type: 'folder',
      aggregate_id: 'folder-1',
      payload: { folder_id: 'folder-1' },
    }]);

    expect(mocks.publish).toHaveBeenCalledTimes(1);
    expect(mocks.countAvailableJobs).toHaveBeenCalledTimes(1);
    expect(c.executionCtx.waitUntil).not.toHaveBeenCalled();
    expect(mocks.runOutboxPoller).not.toHaveBeenCalled();
  });

  it('still schedules the poller immediately for order-domain events', async () => {
    const c = createContext();

    await publishDomainEventsAndPoll(c, [{
      event_type: 'order_created_by_admin',
      aggregate_type: 'order',
      aggregate_id: 'order-1',
      payload: { order_id: 'order-1' },
    }]);

    expect(c.executionCtx.waitUntil).toHaveBeenCalledTimes(1);
    expect(mocks.runOutboxPoller).toHaveBeenCalledTimes(1);
  });

  it('still schedules the poller immediately for webhook-only events', async () => {
    const c = createContext();

    await publishDomainEventsAndPoll(c, [{
      event_type: 'file_uploaded',
      aggregate_type: 'file',
      aggregate_id: 'file-1',
      payload: { file_id: 'file-1' },
    }]);

    expect(c.executionCtx.waitUntil).toHaveBeenCalledTimes(1);
    expect(mocks.countAvailableJobs).not.toHaveBeenCalled();
    expect(mocks.runOutboxPoller).toHaveBeenCalledTimes(1);
  });
});
