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
});
