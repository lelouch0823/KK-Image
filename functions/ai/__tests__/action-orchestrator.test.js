import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AIActionOrchestrator } from '../action-orchestrator.js';
import { getActionAdapter } from '../action-registry.js';

function createSessionStoreMock() {
  return {
    getLatestActiveSession: vi.fn(async () => null),
    createSession: vi.fn(async (payload) => ({
      id: 'act-1',
      status: 'collecting',
      slots_json: '{}',
      ...payload,
    })),
    updateSession: vi.fn(async (_id, patch) => patch),
  };
}

describe('AIActionOrchestrator', () => {
  let sessionStore;
  let submitters;
  let orchestrator;

  beforeEach(() => {
    sessionStore = createSessionStoreMock();
    submitters = {
      create_order: vi.fn(async () => ({ id: 'ord-1', label: 'ORD-1' })),
      create_customer: vi.fn(async () => ({ id: 'cus-1', label: 'Alice' })),
    };
    orchestrator = new AIActionOrchestrator({
      sessionStore,
      getActionAdapter,
      submitters,
    });
  });

  it('returns slot_request when required fields are missing', async () => {
    const result = await orchestrator.advance({
      userId: 'user-1',
      text: '帮我创建订单',
      slots: { productName: 'Classic Runner' },
    });

    expect(result.kind).toBe('slot_request');
    expect(result.payload.missingSlots).toContain('salespersonId');
    expect(submitters.create_order).not.toHaveBeenCalled();
  });

  it('returns action_preview when required fields are complete', async () => {
    const result = await orchestrator.advance({
      userId: 'user-1',
      text: '帮我新增客户',
      slots: { name: 'Alice' },
    });

    expect(result.kind).toBe('action_preview');
    expect(result.payload.summary).toEqual(
      expect.objectContaining({ name: 'Alice' })
    );
    expect(submitters.create_customer).not.toHaveBeenCalled();
  });

  it('submits only after explicit confirmation in awaiting_confirmation state', async () => {
    sessionStore.getLatestActiveSession.mockResolvedValueOnce({
      id: 'act-1',
      user_id: 'user-1',
      action_type: 'create_customer',
      entity_type: 'customer',
      status: 'awaiting_confirmation',
      slots_json: JSON.stringify({ name: 'Alice' }),
      preview_json: JSON.stringify({ title: '客户创建预览' }),
    });

    const result = await orchestrator.advance({
      userId: 'user-1',
      text: '确认',
      confirmation: true,
    });

    expect(result.kind).toBe('action_submitted');
    expect(submitters.create_customer).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Alice' })
    );
    expect(result.payload.targetModule).toBe('customers');
  });
});
