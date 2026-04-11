import { describe, expect, it, vi } from 'vitest';
import { createAIActionService } from '../action-service.js';

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

    expect(result).toEqual(expect.objectContaining({
      handled: true,
      actionResult: expect.objectContaining({ kind: 'slot_request' }),
      event: expect.objectContaining({ type: 'slot_request' }),
    }));
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

    expect(result.refreshEvent).toEqual(expect.objectContaining({
      type: 'module_refresh',
      data: expect.objectContaining({
        module: 'orders',
        entityId: 'ord-1',
      }),
    }));
  });

  it('publishes purchase-order creation side effects after the action rail submits successfully', async () => {
    const publishPurchaseOrderCreated = vi.fn(async () => {});
    const service = createAIActionService({
      deriveContextActionSlots: vi.fn().mockResolvedValue({}),
      detectExplicitConfirmation: vi.fn().mockReturnValue(true),
      publishPurchaseOrderCreated,
      createActionOrchestrator: vi.fn(() => ({
        advance: vi.fn().mockResolvedValue({
          kind: 'action_submitted',
          payload: {
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

    const actionContext = { env: { DB: {} }, c: { req: { url: 'http://localhost/api/manage/ai' } } };
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
    });
    expect(result.refreshEvent).toEqual(expect.objectContaining({
      type: 'module_refresh',
      data: expect.objectContaining({
        module: 'purchase_orders',
        entityId: 'po-1',
      }),
    }));
  });
});
