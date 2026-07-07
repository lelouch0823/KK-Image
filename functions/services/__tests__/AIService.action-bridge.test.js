import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createManagedOrder: vi.fn(),
  archiveFiles: vi.fn(),
  handleTurn: vi.fn(),
}));

vi.mock('../OrderCreationService.js', () => ({
  OrderCreationService: vi.fn(() => ({
    createManagedOrder: mocks.createManagedOrder,
    archiveFiles: mocks.archiveFiles,
  })),
}));

vi.mock('../../ai/action-service.js', () => ({
  createAIActionService: vi.fn(() => ({
    handleTurn: mocks.handleTurn,
  })),
}));

import { AIService } from '../AIService.js';

describe('AIService action bridge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createManagedOrder.mockResolvedValue({
      id: 'order-1',
      orderNo: 'SO-1',
      salespersonId: 'sp-1',
      fileIds: ['file-1', 'file-2'],
    });
    mocks.archiveFiles.mockResolvedValue({ success: true, count: 2 });
    mocks.handleTurn.mockImplementation(async ({ actionContext, user }) => {
      const created = await actionContext.createManagedOrder(
        actionContext.c,
        {
          productName: 'Sample',
          salespersonId: 'sp-1',
          fileIds: ['file-1', 'file-2'],
        },
        user,
        { skipOrderCreatedEvent: true }
      );
      return { handled: true, actionResult: { kind: 'action_submitted', payload: { created } } };
    });
  });

  it('archives attached files after AI-created orders use the service bridge', async () => {
    const service = new AIService(
      {},
      {
        orderStatsRepo: {},
        systemStatsRepo: {},
        orderRepo: {},
        orderTimelineRepo: {},
        productRepo: {},
        variantRepo: {},
        customerRepo: {},
        goodsOverviewRepo: {},
        purchaseOrderRepo: {},
      }
    );
    const c = {
      env: { DB: {}, R2_BUCKET: {} },
      req: { url: 'http://localhost/api/manage/ai/chat' },
      executionCtx: { waitUntil: vi.fn() },
    };

    await service._tryHandleAction({
      latestUserText: '确认',
      clientContext: {},
      user: { id: 'admin-1', name: 'Admin' },
      c,
      runtimeEnv: {},
    });

    expect(mocks.createManagedOrder).toHaveBeenCalledTimes(1);
    expect(mocks.archiveFiles).toHaveBeenCalledWith(c.env, ['file-1', 'file-2'], 'SO-1');
  });
});
