import { describe, expect, it, vi } from 'vitest';
import { createActionOrchestrator, createAIActionService } from '../action-service.js';
import { salespersonActionAdapter } from '../adapters/salesperson.js';

describe('createAIActionService', () => {
  it('keeps slot collection, confirmation, and submit mapping inside the action rail', async () => {
    const orchestrator = {
      advance: vi.fn().mockResolvedValue({
        kind: 'slot_request',
        payload: { sessionId: 'act-1', missingSlots: ['name'] },
      }),
    };
    const service = createAIActionService({
      deriveContextActionSlots: vi.fn().mockResolvedValue({ productId: 'prod-1' }),
      detectExplicitConfirmation: vi.fn().mockReturnValue(false),
      createActionOrchestrator: vi.fn(() => orchestrator),
    });

    const result = await service.handleTurn({
      text: '帮我建商品',
      context: { selectedId: 'prod-1', selectedType: 'product' },
      user: { id: 'u-1' },
    });

    expect(result).toEqual(
      expect.objectContaining({
        handled: true,
        actionResult: expect.objectContaining({ kind: 'slot_request' }),
        event: expect.objectContaining({ type: 'slot_request' }),
      })
    );
    expect(orchestrator.advance).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'u-1',
        text: '帮我建商品',
        slots: { productId: 'prod-1' },
        confirmation: false,
      })
    );
  });

  it('adds a module refresh event after successful submission', async () => {
    const service = createAIActionService({
      deriveContextActionSlots: vi.fn().mockResolvedValue({}),
      detectExplicitConfirmation: vi.fn().mockReturnValue(true),
      createActionOrchestrator: vi.fn(() => ({
        advance: vi.fn().mockResolvedValue({
          kind: 'action_submitted',
          payload: { targetModule: 'orders', createdEntityId: 'ord-1' },
        }),
      })),
    });

    const result = await service.handleTurn({
      text: '确认',
      context: {},
      user: { id: 'u-1' },
    });

    expect(result.refreshEvent).toEqual(
      expect.objectContaining({
        type: 'module_refresh',
        data: expect.objectContaining({
          module: 'orders',
          entityId: 'ord-1',
        }),
      })
    );
  });

  it('surfaces action_denied as a handled AI response', async () => {
    const service = createAIActionService({
      deriveContextActionSlots: vi.fn().mockResolvedValue({}),
      detectExplicitConfirmation: vi.fn().mockReturnValue(false),
      createActionOrchestrator: vi.fn(() => ({
        advance: vi.fn().mockResolvedValue({
          kind: 'action_denied',
          payload: { entityType: 'order', requiredPermission: 'orders:manage' },
        }),
      })),
    });

    const result = await service.handleTurn({
      text: '帮我创建订单',
      context: {},
      user: { id: 'u-1' },
    });

    expect(result).toEqual(
      expect.objectContaining({
        handled: true,
        actionResult: expect.objectContaining({ kind: 'action_denied' }),
        refreshEvent: null,
      })
    );
  });

  it('publishes purchase-order creation side effects after the action rail submits successfully', async () => {
    const publishPurchaseOrderCreated = vi.fn(async () => {});
    const sessionStore = {
      updateSession: vi.fn(async () => ({})),
    };
    const service = createAIActionService({
      deriveContextActionSlots: vi.fn().mockResolvedValue({}),
      detectExplicitConfirmation: vi.fn().mockReturnValue(true),
      publishPurchaseOrderCreated,
      createSessionStore: vi.fn(() => sessionStore),
      createActionOrchestrator: vi.fn(() => ({
        advance: vi.fn().mockResolvedValue({
          kind: 'action_submitted',
          payload: {
            sessionId: 'act-po-1',
            targetModule: 'purchase_orders',
            entityType: 'purchase_order',
            createdEntityId: 'po-1',
            purchaseOrderCreated: {
              created: { id: 'po-1', po_no: 'PO-1' },
              mode: 'manual',
              orderIds: [],
              items: [{ product_id: 'prod-1', variant_id: 'var-1', quantity: 2, unit_cost: 12 }],
            },
          },
        }),
      })),
    });

    const actionContext = {
      env: { DB: {} },
      c: { req: { url: 'http://localhost/api/manage/ai' } },
    };
    const result = await service.handleTurn({
      text: '确认',
      context: {},
      user: { id: 'u-1' },
      actionContext,
    });

    expect(publishPurchaseOrderCreated).toHaveBeenCalledWith(actionContext, {
      created: { id: 'po-1', po_no: 'PO-1' },
      mode: 'manual',
      orderIds: [],
      items: [{ product_id: 'prod-1', variant_id: 'var-1', quantity: 2, unit_cost: 12 }],
      sessionId: 'act-po-1',
    });
    expect(sessionStore.updateSession).toHaveBeenCalledWith('act-po-1', {
      status: 'completed',
    });
    expect(result.refreshEvent).toEqual(
      expect.objectContaining({
        type: 'module_refresh',
        data: expect.objectContaining({
          module: 'purchase_orders',
          entityId: 'po-1',
        }),
      })
    );
  });

  it('publishes product creation side effects after the action rail submits successfully', async () => {
    const publishProductCreated = vi.fn(async () => {});
    const sessionStore = {
      updateSession: vi.fn(async () => ({})),
    };
    const service = createAIActionService({
      deriveContextActionSlots: vi.fn().mockResolvedValue({}),
      detectExplicitConfirmation: vi.fn().mockReturnValue(true),
      publishProductCreated,
      createSessionStore: vi.fn(() => sessionStore),
      createActionOrchestrator: vi.fn(() => ({
        advance: vi.fn().mockResolvedValue({
          kind: 'action_submitted',
          payload: {
            sessionId: 'act-prod-1',
            targetModule: 'products',
            entityType: 'product',
            createdEntityId: 'prod-1',
            productCreated: {
              created: { id: 'prod-1', name: 'Sneaker' },
            },
          },
        }),
      })),
    });

    const actionContext = {
      env: { DB: {} },
      c: { req: { url: 'http://localhost/api/manage/ai' } },
    };
    const result = await service.handleTurn({
      text: '确认',
      context: {},
      user: { id: 'u-1' },
      actionContext,
    });

    expect(publishProductCreated).toHaveBeenCalledWith(actionContext, {
      created: { id: 'prod-1', name: 'Sneaker' },
      sessionId: 'act-prod-1',
    });
    expect(sessionStore.updateSession).toHaveBeenCalledWith('act-prod-1', {
      status: 'completed',
    });
    expect(result.refreshEvent).toEqual(
      expect.objectContaining({
        type: 'module_refresh',
        data: expect.objectContaining({
          module: 'products',
          entityId: 'prod-1',
        }),
      })
    );
  });

  it('publishes order creation side effects after the action rail submits successfully', async () => {
    const publishOrderCreated = vi.fn(async () => {});
    const sessionStore = {
      updateSession: vi.fn(async () => ({})),
    };
    const service = createAIActionService({
      deriveContextActionSlots: vi.fn().mockResolvedValue({}),
      detectExplicitConfirmation: vi.fn().mockReturnValue(true),
      publishOrderCreated,
      createSessionStore: vi.fn(() => sessionStore),
      createActionOrchestrator: vi.fn(() => ({
        advance: vi.fn().mockResolvedValue({
          kind: 'action_submitted',
          payload: {
            sessionId: 'act-order-1',
            targetModule: 'orders',
            entityType: 'order',
            createdEntityId: 'ord-1',
            orderCreated: {
              created: { id: 'ord-1', orderNo: 'ORD-1' },
              salespersonId: 'sp-1',
            },
          },
        }),
      })),
    });

    const actionContext = {
      env: { DB: {} },
      c: { req: { url: 'http://localhost/api/manage/ai' } },
    };
    const result = await service.handleTurn({
      text: '确认',
      context: {},
      user: { id: 'u-1', name: 'AI Admin' },
      actionContext,
    });

    expect(publishOrderCreated).toHaveBeenCalledWith(
      expect.objectContaining({
        ...actionContext,
        user: { id: 'u-1', name: 'AI Admin' },
      }),
      {
        created: { id: 'ord-1', orderNo: 'ORD-1' },
        salespersonId: 'sp-1',
        sessionId: 'act-order-1',
      }
    );
    expect(sessionStore.updateSession).toHaveBeenCalledWith('act-order-1', {
      status: 'completed',
    });
    expect(result.refreshEvent).toEqual(
      expect.objectContaining({
        type: 'module_refresh',
        data: expect.objectContaining({
          module: 'orders',
          entityId: 'ord-1',
        }),
      })
    );
  });

  it('keeps the action session pending when purchase-order post-submit side effects fail', async () => {
    const publishPurchaseOrderCreated = vi.fn(async () => {
      throw new Error('publish failed');
    });
    const sessionStore = {
      updateSession: vi.fn(async () => ({})),
    };
    const service = createAIActionService({
      deriveContextActionSlots: vi.fn().mockResolvedValue({}),
      detectExplicitConfirmation: vi.fn().mockReturnValue(true),
      publishPurchaseOrderCreated,
      createSessionStore: vi.fn(() => sessionStore),
      createActionOrchestrator: vi.fn(() => ({
        advance: vi.fn().mockResolvedValue({
          kind: 'action_submitted',
          payload: {
            sessionId: 'act-po-2',
            targetModule: 'purchase_orders',
            entityType: 'purchase_order',
            createdEntityId: 'po-2',
            purchaseOrderCreated: {
              created: { id: 'po-2', po_no: 'PO-2' },
              mode: 'manual',
              orderIds: [],
              items: [{ product_id: 'prod-1', variant_id: 'var-1', quantity: 2, unit_cost: 12 }],
            },
          },
        }),
      })),
    });

    await expect(
      service.handleTurn({
        text: '确认',
        context: {},
        user: { id: 'u-1' },
        actionContext: { env: { DB: {} }, c: { req: { url: 'http://localhost/api/manage/ai' } } },
      })
    ).rejects.toThrow('publish failed');

    expect(sessionStore.updateSession).not.toHaveBeenCalled();
  });

  it('keeps the action session pending when product post-submit side effects fail', async () => {
    const publishProductCreated = vi.fn(async () => {
      throw new Error('publish failed');
    });
    const sessionStore = {
      updateSession: vi.fn(async () => ({})),
    };
    const service = createAIActionService({
      deriveContextActionSlots: vi.fn().mockResolvedValue({}),
      detectExplicitConfirmation: vi.fn().mockReturnValue(true),
      publishProductCreated,
      createSessionStore: vi.fn(() => sessionStore),
      createActionOrchestrator: vi.fn(() => ({
        advance: vi.fn().mockResolvedValue({
          kind: 'action_submitted',
          payload: {
            sessionId: 'act-prod-2',
            targetModule: 'products',
            entityType: 'product',
            createdEntityId: 'prod-2',
            productCreated: {
              created: { id: 'prod-2', name: 'Sneaker' },
            },
          },
        }),
      })),
    });

    await expect(
      service.handleTurn({
        text: '确认',
        context: {},
        user: { id: 'u-1' },
        actionContext: { env: { DB: {} }, c: { req: { url: 'http://localhost/api/manage/ai' } } },
      })
    ).rejects.toThrow('publish failed');

    expect(sessionStore.updateSession).not.toHaveBeenCalled();
  });
});

describe('AI action authorization metadata', () => {
  it('requires users:write for salesperson creation actions', () => {
    expect(salespersonActionAdapter.requiredPermission).toBe('users:write');
  });

  it('denies write actions that do not declare requiredPermission metadata', async () => {
    const db = {};
    const orchestrator = createActionOrchestrator({
      c: { req: { url: 'http://localhost/api/manage/ai' } },
      env: { DB: db, JWT_SECRET: 'secret' },
      user: { id: 'viewer', role: 'viewer', permissions: ['stats:read'] },
      createManagedOrder: vi.fn(),
      createManagedProduct: vi.fn(),
    });

    await expect(
      orchestrator.canAccessAction(
        { id: 'viewer', role: 'viewer', permissions: ['stats:read'] },
        { entityType: 'salesperson', actionType: 'create_salesperson' }
      )
    ).resolves.toBe(false);
  });
});
