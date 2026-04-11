import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AIActionOrchestrator } from '../action-orchestrator.js';
import { getActionAdapter } from '../action-registry.js';
import { extractActionSlots } from '../slot-extraction.js';
import { resolvePurchaseOrderItemsSlot } from '../slot-resolvers.js';

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
      slotResolvers: {},
      extractActionSlots: () => ({}),
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

  it('extracts initial slots from natural language before deciding missing fields', async () => {
    orchestrator = new AIActionOrchestrator({
      sessionStore,
      getActionAdapter,
      submitters,
      slotResolvers: {},
      extractActionSlots: () => ({ name: 'Alice', phone: '13800000000' }),
    });

    const result = await orchestrator.advance({
      userId: 'user-1',
      text: '新增客户 Alice，电话 13800000000',
    });

    expect(result.kind).toBe('action_preview');
    expect(result.payload.summary).toEqual(expect.objectContaining({ name: 'Alice', phone: '13800000000' }));
  });

  it('merges context-provided slots before evaluating missing fields', async () => {
    orchestrator = new AIActionOrchestrator({
      sessionStore,
      getActionAdapter,
      submitters,
      slotResolvers: {},
      extractActionSlots: () => ({ quantity: 2 }),
    });

    const result = await orchestrator.advance({
      userId: 'user-1',
      text: '创建订单 2 件',
      slots: {
        productName: 'Classic Runner',
        productId: 'prod-1',
        variantId: 'var-1',
        salespersonId: 'sp-1',
      },
    });

    expect(result.kind).toBe('action_preview');
    expect(result.payload.summary).toEqual(
      expect.objectContaining({
        productId: 'prod-1',
        variantId: 'var-1',
        salespersonId: 'sp-1',
        quantity: 2,
      })
    );
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

  it('includes purchase-order side effect metadata in the submitted payload', async () => {
    sessionStore.getLatestActiveSession.mockResolvedValueOnce({
      id: 'act-po-1',
      user_id: 'user-1',
      action_type: 'create_purchase_order',
      entity_type: 'purchase_order',
      status: 'awaiting_confirmation',
      slots_json: JSON.stringify({
        mode: 'manual',
        items: [{ product_id: 'prod-1', variant_id: 'var-1', quantity: 2, unit_cost: 12 }],
      }),
      preview_json: JSON.stringify({ title: '采购单创建预览' }),
    });
    submitters.create_purchase_order = vi.fn(async () => ({
      id: 'po-1',
      label: 'PO-1',
      purchaseOrderCreated: {
        created: { id: 'po-1', po_no: 'PO-1' },
        mode: 'manual',
        orderIds: [],
        items: [{ product_id: 'prod-1', variant_id: 'var-1', quantity: 2, unit_cost: 12 }],
      },
    }));

    orchestrator = new AIActionOrchestrator({
      sessionStore,
      getActionAdapter,
      submitters,
      slotResolvers: {},
      extractActionSlots: () => ({}),
    });

    const result = await orchestrator.advance({
      userId: 'user-1',
      text: '确认',
      confirmation: true,
    });

    expect(result.kind).toBe('action_submitted');
    expect(sessionStore.updateSession).toHaveBeenCalledWith('act-po-1', expect.objectContaining({
      status: 'submitted_pending_effects',
    }));
    expect(result.payload.purchaseOrderCreated).toEqual({
      created: { id: 'po-1', po_no: 'PO-1' },
      mode: 'manual',
      orderIds: [],
      items: [{ product_id: 'prod-1', variant_id: 'var-1', quantity: 2, unit_cost: 12 }],
    });
  });

  it('replays a pending purchase-order submission without re-running the submitter', async () => {
    sessionStore.getLatestActiveSession.mockResolvedValueOnce({
      id: 'act-po-2',
      user_id: 'user-1',
      action_type: 'create_purchase_order',
      entity_type: 'purchase_order',
      status: 'submitted_pending_effects',
      slots_json: JSON.stringify({
        mode: 'manual',
        items: [{ product_id: 'prod-1', variant_id: 'var-1', quantity: 2, unit_cost: 12 }],
      }),
      preview_json: JSON.stringify({
        title: '采购单创建预览',
        submittedPayload: {
          sessionId: 'act-po-2',
          entityType: 'purchase_order',
          createdEntityId: 'po-2',
          createdEntityLabel: 'PO-2',
          purchaseOrderCreated: {
            created: { id: 'po-2', po_no: 'PO-2' },
            mode: 'manual',
            orderIds: [],
            items: [{ product_id: 'prod-1', variant_id: 'var-1', quantity: 2, unit_cost: 12 }],
          },
          targetModule: 'purchase_orders',
          successMessage: '已完成创建，请前往对应模块查看。',
        },
      }),
    });
    submitters.create_purchase_order = vi.fn(async () => ({
      id: 'po-should-not-run',
      label: 'PO-SHOULD-NOT-RUN',
    }));

    orchestrator = new AIActionOrchestrator({
      sessionStore,
      getActionAdapter,
      submitters,
      slotResolvers: {},
      extractActionSlots: () => ({}),
    });

    const result = await orchestrator.advance({
      userId: 'user-1',
      text: '继续',
      confirmation: false,
    });

    expect(result).toEqual({
      kind: 'action_submitted',
      payload: {
        sessionId: 'act-po-2',
        entityType: 'purchase_order',
        createdEntityId: 'po-2',
        createdEntityLabel: 'PO-2',
        purchaseOrderCreated: {
          created: { id: 'po-2', po_no: 'PO-2' },
          mode: 'manual',
          orderIds: [],
          items: [{ product_id: 'prod-1', variant_id: 'var-1', quantity: 2, unit_cost: 12 }],
        },
        targetModule: 'purchase_orders',
        successMessage: '已完成创建，请前往对应模块查看。',
      },
    });
    expect(submitters.create_purchase_order).not.toHaveBeenCalled();
  });

  it('collects the next missing slot from a follow-up user reply', async () => {
    sessionStore.getLatestActiveSession.mockResolvedValueOnce({
      id: 'act-2',
      user_id: 'user-1',
      action_type: 'create_customer',
      entity_type: 'customer',
      status: 'collecting',
      slots_json: JSON.stringify({}),
      preview_json: null,
    });

    const result = await orchestrator.advance({
      userId: 'user-1',
      text: 'Alice',
      confirmation: false,
    });

    expect(result.kind).toBe('action_preview');
    expect(result.payload.summary).toEqual(expect.objectContaining({ name: 'Alice' }));
  });

  it('resolves collected slot values before preview when a slot resolver is configured', async () => {
    sessionStore.getLatestActiveSession.mockResolvedValueOnce({
      id: 'act-3',
      user_id: 'user-1',
      action_type: 'create_order',
      entity_type: 'order',
      status: 'collecting',
      slots_json: JSON.stringify({ productName: 'Classic Runner' }),
      preview_json: null,
    });

    orchestrator = new AIActionOrchestrator({
      sessionStore,
      getActionAdapter,
      submitters,
      slotResolvers: {
        order: {
          salespersonId: vi.fn(async (rawValue) => rawValue === '张三' ? 'sp-1' : rawValue),
        },
      },
      extractActionSlots: () => ({ salespersonId: '张三' }),
    });

    const result = await orchestrator.advance({
      userId: 'user-1',
      text: '张三',
      confirmation: false,
    });

    expect(result.kind).toBe('action_preview');
    expect(result.payload.summary).toEqual(
      expect.objectContaining({
        productName: 'Classic Runner',
        salespersonId: 'sp-1',
      })
    );
  });

  it('resolves order variant from extracted color and size hints', async () => {
    orchestrator = new AIActionOrchestrator({
      sessionStore,
      getActionAdapter,
      submitters,
      slotResolvers: {
        order: {
          variantId: vi.fn(async (_rawValue, slots) => {
            if (slots.productId === 'prod-1' && slots.color === '黑色' && slots.size === '42') return 'var-42-black';
            return _rawValue;
          }),
          productId: vi.fn(async (rawValue) => rawValue),
        },
      },
      extractActionSlots: () => ({
        productName: '跑鞋',
        productId: 'prod-1',
        salespersonId: 'sp-1',
        color: '黑色',
        size: '42',
        quantity: 2,
        variantId: '',
      }),
    });

    const result = await orchestrator.advance({
      userId: 'user-1',
      text: '帮我创建订单，跑鞋 黑色 42码 给张三 2件',
    });

    expect(result.kind).toBe('action_preview');
    expect(result.payload.summary).toEqual(
      expect.objectContaining({
        productId: 'prod-1',
        variantId: 'var-42-black',
      })
    );
  });

  it('resolves manual purchase-order items from variant query', async () => {
    orchestrator = new AIActionOrchestrator({
      sessionStore,
      getActionAdapter,
      submitters,
      slotResolvers: {
        purchase_order: {
          items: vi.fn(async (items) => items.map((item) => ({
            ...item,
            product_id: 'prod-1',
            variant_id: 'var-1',
          }))),
        },
      },
      extractActionSlots: () => ({
        mode: 'manual',
        items: [{ variant_query: '跑鞋 黑色 42', quantity: 20, unit_cost: 60 }],
      }),
    });

    const result = await orchestrator.advance({
      userId: 'user-1',
      text: '创建采购单，跑鞋 黑色 42 补货 20件 单价60',
    });

    expect(result.kind).toBe('action_preview');
    expect(result.payload.summary.items).toEqual([
      expect.objectContaining({
        product_id: 'prod-1',
        variant_id: 'var-1',
        quantity: 20,
      }),
    ]);
  });

  it('requests purchase-order items before previewing manual mode', async () => {
    orchestrator = new AIActionOrchestrator({
      sessionStore,
      getActionAdapter,
      submitters,
      slotResolvers: {},
      extractActionSlots: () => ({
        mode: 'manual',
      }),
    });

    const result = await orchestrator.advance({
      userId: 'user-1',
      text: '创建采购单',
    });

    expect(result.kind).toBe('slot_request');
    expect(result.payload.missingSlots).toContain('items');
  });

  it('keeps collecting purchase-order items until manual items are resolved to concrete variants', async () => {
    orchestrator = new AIActionOrchestrator({
      sessionStore,
      getActionAdapter,
      submitters,
      slotResolvers: {
        purchase_order: {
          items: vi.fn(async (items) => items),
        },
      },
      extractActionSlots: () => ({
        mode: 'manual',
        items: [{ variant_query: '跑鞋 黑色 42', quantity: 20 }],
      }),
    });

    const result = await orchestrator.advance({
      userId: 'user-1',
      text: '创建采购单，跑鞋 黑色 42 补货 20件',
    });

    expect(result.kind).toBe('slot_request');
    expect(result.payload.missingSlots).toContain('items');
  });

  it('accepts plain manual item follow-up text without repeating 采购单 during item collection', async () => {
    sessionStore.getLatestActiveSession.mockResolvedValueOnce({
      id: 'act-1',
      user_id: 'user-1',
      action_type: 'create_purchase_order',
      entity_type: 'purchase_order',
      status: 'collecting',
      slots_json: JSON.stringify({ mode: 'manual' }),
      preview_json: '{}',
    });

    orchestrator = new AIActionOrchestrator({
      sessionStore,
      getActionAdapter,
      submitters,
      slotResolvers: {
        purchase_order: {
          items: vi.fn(async (items) => items.map((item) => ({
            ...item,
            product_id: 'prod-1',
            variant_id: 'var-1',
          }))),
        },
      },
      extractActionSlots,
    });

    const result = await orchestrator.advance({
      userId: 'user-1',
      text: '跑鞋 黑色 42 补货 20件 单价60',
    });

    expect(result.kind).toBe('action_preview');
    expect(result.payload.summary.items).toEqual([
      expect.objectContaining({
        product_id: 'prod-1',
        variant_id: 'var-1',
        quantity: 20,
      }),
    ]);
  });

  it('preserves already-resolved manual items when a follow-up adds another purchase-order item', async () => {
    sessionStore.getLatestActiveSession.mockResolvedValueOnce({
      id: 'act-1',
      user_id: 'user-1',
      action_type: 'create_purchase_order',
      entity_type: 'purchase_order',
      status: 'collecting',
      slots_json: JSON.stringify({
        mode: 'manual',
        items: [
          {
            variant_query: '跑鞋 黑色 42',
            product_id: 'prod-1',
            variant_id: 'var-1',
            quantity: 20,
            unit_cost: 60,
          },
        ],
      }),
      preview_json: '{}',
    });

    orchestrator = new AIActionOrchestrator({
      sessionStore,
      getActionAdapter,
      submitters,
      slotResolvers: {
        purchase_order: {
          items: vi.fn(async (items) => items.map((item, index) => index === 0 && item.product_id
            ? item
            : {
                ...item,
                product_id: 'prod-2',
                variant_id: 'var-2',
              })),
        },
      },
      extractActionSlots,
    });

    const result = await orchestrator.advance({
      userId: 'user-1',
      text: '凉鞋 白色 38 补货 10件 单价50',
    });

    expect(result.kind).toBe('action_preview');
    expect(result.payload.summary.items).toEqual([
      expect.objectContaining({
        product_id: 'prod-1',
        variant_id: 'var-1',
        quantity: 20,
      }),
      expect.objectContaining({
        product_id: 'prod-2',
        variant_id: 'var-2',
        quantity: 10,
      }),
    ]);
  });

  it('returns item candidates and accepts numeric choice for a single ambiguous purchase-order item', async () => {
    const variantRepo = {
      searchForAI: vi.fn()
        .mockResolvedValueOnce({
          items: [
            {
              id: 'var-1',
              product_id: 'prod-1',
              sku: 'SKU-BLK-42-A',
              cost_price: 60,
              variantLabel: '黑色 / 42',
              product: { name: '跑鞋', brand: 'KK' },
            },
            {
              id: 'var-2',
              product_id: 'prod-1',
              sku: 'SKU-BLK-42-B',
              cost_price: 61,
              variantLabel: '黑色 / 42',
              product: { name: '跑鞋', brand: 'KK' },
            },
          ],
          total: 2,
        }),
    };

    orchestrator = new AIActionOrchestrator({
      sessionStore,
      getActionAdapter,
      submitters,
      slotResolvers: {
        purchase_order: {
          items: (items) => resolvePurchaseOrderItemsSlot(items, { variantRepo }),
        },
      },
      extractActionSlots,
    });

    const initial = await orchestrator.advance({
      userId: 'user-1',
      text: '创建采购单，跑鞋 黑色 42 补货 20件 单价60',
    });

    expect(initial.kind).toBe('slot_request');
    expect(initial.payload.fields[0].candidates).toHaveLength(2);

    sessionStore.getLatestActiveSession.mockResolvedValueOnce({
      id: 'act-1',
      user_id: 'user-1',
      action_type: 'create_purchase_order',
      entity_type: 'purchase_order',
      status: 'collecting',
      slots_json: JSON.stringify({
        mode: 'manual',
        items: '',
        __candidateChoices: {
          items: initial.payload.fields[0].candidates,
        },
      }),
      preview_json: '{}',
    });

    const followUp = await orchestrator.advance({
      userId: 'user-1',
      text: '2',
    });

    expect(followUp.kind).toBe('action_preview');
    expect(followUp.payload.summary.items).toEqual([
      expect.objectContaining({
        product_id: 'prod-1',
        variant_id: 'var-2',
        quantity: 20,
      }),
    ]);
  });

  it('keeps resolved items while offering candidates for the ambiguous line in a multi-item draft', async () => {
    const variantRepo = {
      searchForAI: vi.fn()
        .mockResolvedValueOnce({
          items: [{ id: 'var-1', product_id: 'prod-1', cost_price: 60 }],
          total: 1,
        })
        .mockResolvedValueOnce({
          items: [
            {
              id: 'var-2',
              product_id: 'prod-2',
              sku: 'SKU-WHT-38-A',
              cost_price: 50,
              variantLabel: '白色 / 38',
              product: { name: '凉鞋', brand: 'KK' },
            },
            {
              id: 'var-3',
              product_id: 'prod-2',
              sku: 'SKU-WHT-38-B',
              cost_price: 52,
              variantLabel: '白色 / 38',
              product: { name: '凉鞋', brand: 'KK' },
            },
          ],
          total: 2,
        }),
    };

    orchestrator = new AIActionOrchestrator({
      sessionStore,
      getActionAdapter,
      submitters,
      slotResolvers: {
        purchase_order: {
          items: (items) => resolvePurchaseOrderItemsSlot(items, { variantRepo }),
        },
      },
      extractActionSlots,
    });

    const initial = await orchestrator.advance({
      userId: 'user-1',
      text: '创建采购单，跑鞋 黑色 42 补货 20件 单价60；凉鞋 白色 38 补货 10件 单价50',
    });

    expect(initial.kind).toBe('slot_request');
    expect(initial.payload.fields[0].candidates).toHaveLength(2);
    expect(initial.payload.fields[0].candidates[0].value).toEqual([
      expect.objectContaining({
        product_id: 'prod-1',
        variant_id: 'var-1',
        quantity: 20,
      }),
      expect.objectContaining({
        product_id: 'prod-2',
        variant_id: 'var-2',
        quantity: 10,
      }),
    ]);
  });

  it('keeps candidate-driven item choices while continuing to resolve later ambiguous items', async () => {
    const variantRepo = {
      searchForAI: vi.fn()
        .mockResolvedValueOnce({
          items: [
            {
              id: 'var-1',
              product_id: 'prod-1',
              sku: 'SKU-BLK-42-A',
              cost_price: 60,
              variantLabel: '黑色 / 42',
              product: { name: '跑鞋', brand: 'KK' },
            },
            {
              id: 'var-2',
              product_id: 'prod-1',
              sku: 'SKU-BLK-42-B',
              cost_price: 61,
              variantLabel: '黑色 / 42',
              product: { name: '跑鞋', brand: 'KK' },
            },
          ],
          total: 2,
        })
        .mockResolvedValueOnce({
          items: [
            {
              id: 'var-3',
              product_id: 'prod-2',
              sku: 'SKU-WHT-38-A',
              cost_price: 50,
              variantLabel: '白色 / 38',
              product: { name: '凉鞋', brand: 'KK' },
            },
            {
              id: 'var-4',
              product_id: 'prod-2',
              sku: 'SKU-WHT-38-B',
              cost_price: 52,
              variantLabel: '白色 / 38',
              product: { name: '凉鞋', brand: 'KK' },
            },
          ],
          total: 2,
        }),
    };

    orchestrator = new AIActionOrchestrator({
      sessionStore,
      getActionAdapter,
      submitters,
      slotResolvers: {
        purchase_order: {
          items: (items) => resolvePurchaseOrderItemsSlot(items, { variantRepo }),
        },
      },
      extractActionSlots,
    });

    const initial = await orchestrator.advance({
      userId: 'user-1',
      text: '创建采购单，跑鞋 黑色 42 补货 20件 单价60；凉鞋 白色 38 补货 10件 单价50',
    });

    sessionStore.getLatestActiveSession.mockResolvedValueOnce({
      id: 'act-1',
      user_id: 'user-1',
      action_type: 'create_purchase_order',
      entity_type: 'purchase_order',
      status: 'collecting',
      slots_json: JSON.stringify({
        mode: 'manual',
        items: '',
        __candidateChoices: {
          items: initial.payload.fields[0].candidates,
        },
      }),
      preview_json: '{}',
    });

    const secondRound = await orchestrator.advance({
      userId: 'user-1',
      text: '2',
    });

    expect(secondRound.kind).toBe('slot_request');
    expect(secondRound.payload.fields[0].candidates).toHaveLength(2);
    expect(secondRound.payload.fields[0].candidates[0].value).toEqual([
      expect.objectContaining({
        product_id: 'prod-1',
        variant_id: 'var-2',
        quantity: 20,
      }),
      expect.objectContaining({
        product_id: 'prod-2',
        variant_id: 'var-3',
        quantity: 10,
      }),
    ]);
  });

  it('requests order ids before previewing from-orders mode', async () => {
    orchestrator = new AIActionOrchestrator({
      sessionStore,
      getActionAdapter,
      submitters,
      slotResolvers: {},
      extractActionSlots: () => ({
        mode: 'from_orders',
      }),
    });

    const result = await orchestrator.advance({
      userId: 'user-1',
      text: '根据订单创建采购单',
    });

    expect(result.kind).toBe('slot_request');
    expect(result.payload.missingSlots).toContain('order_ids');
  });

  it('resolves multiple manual purchase-order items as a batch', async () => {
    orchestrator = new AIActionOrchestrator({
      sessionStore,
      getActionAdapter,
      submitters,
      slotResolvers: {
        purchase_order: {
          items: vi.fn(async (items) => items.map((item, index) => ({
            ...item,
            product_id: `prod-${index + 1}`,
            variant_id: `var-${index + 1}`,
          }))),
        },
      },
      extractActionSlots: () => ({
        mode: 'manual',
        items: [
          { variant_query: '跑鞋 黑色 42', quantity: 20, unit_cost: 60 },
          { variant_query: '凉鞋 白色 38', quantity: 10, unit_cost: 50 },
        ],
      }),
    });

    const result = await orchestrator.advance({
      userId: 'user-1',
      text: '创建采购单，跑鞋 黑色 42 补货 20件 单价60；凉鞋 白色 38 补货 10件 单价50',
    });

    expect(result.kind).toBe('action_preview');
    expect(result.payload.summary.items).toEqual([
      expect.objectContaining({ product_id: 'prod-1', variant_id: 'var-1', quantity: 20 }),
      expect.objectContaining({ product_id: 'prod-2', variant_id: 'var-2', quantity: 10 }),
    ]);
  });

  it('resolves productId and variantId for orders without page context when resolvers can uniquely match', async () => {
    orchestrator = new AIActionOrchestrator({
      sessionStore,
      getActionAdapter,
      submitters,
      slotResolvers: {
        order: {
          productId: vi.fn(async (_rawValue, slots) => slots.productName === '跑鞋' ? 'prod-1' : _rawValue),
          variantId: vi.fn(async (_rawValue, slots) => {
            if (slots.productId === 'prod-1' && slots.color === '黑色' && slots.size === '42') return 'var-42-black';
            return _rawValue;
          }),
        },
      },
      extractActionSlots: () => ({
        productName: '跑鞋',
        salespersonId: 'sp-1',
        color: '黑色',
        size: '42',
        quantity: 2,
      }),
    });

    const result = await orchestrator.advance({
      userId: 'user-1',
      text: '帮我创建订单，跑鞋 黑色 42码 给张三 2件',
    });

    expect(result.kind).toBe('action_preview');
    expect(result.payload.summary).toEqual(
      expect.objectContaining({
        productId: 'prod-1',
        variantId: 'var-42-black',
      })
    );
  });

  it('runs slot resolvers in dependency-safe order so variantId can depend on resolved productId', async () => {
    const resolverCalls = [];
    orchestrator = new AIActionOrchestrator({
      sessionStore,
      getActionAdapter,
      submitters,
      slotResolvers: {
        order: {
          productId: vi.fn(async (_rawValue, slots) => {
            resolverCalls.push(`product:${slots.productName}`);
            return 'prod-1';
          }),
          variantId: vi.fn(async (_rawValue, slots) => {
            resolverCalls.push(`variant:${slots.productId}`);
            return slots.productId === 'prod-1' ? 'var-1' : '';
          }),
        },
      },
      extractActionSlots: () => ({
        productName: '跑鞋',
        salespersonId: 'sp-1',
        quantity: 1,
      }),
    });

    const result = await orchestrator.advance({
      userId: 'user-1',
      text: '创建订单 跑鞋',
    });

    expect(result.kind).toBe('action_preview');
    expect(result.payload.summary).toEqual(
      expect.objectContaining({
        productId: 'prod-1',
        variantId: 'var-1',
      })
    );
    expect(resolverCalls).toEqual(['product:跑鞋', 'variant:prod-1']);
  });

  it('returns candidate choices in slot_request when a resolver is ambiguous', async () => {
    orchestrator = new AIActionOrchestrator({
      sessionStore,
      getActionAdapter,
      submitters,
      slotResolvers: {
        order: {
          salespersonId: vi.fn(async () => ({
            kind: 'candidates',
            candidates: [
              { value: 'sp-1', label: '张三', description: '深圳店' },
              { value: 'sp-2', label: '张三', description: '广州店' },
            ],
          })),
        },
      },
      extractActionSlots: () => ({
        productName: '跑鞋',
        salespersonId: '张三',
      }),
    });

    const result = await orchestrator.advance({
      userId: 'user-1',
      text: '给张三创建订单，商品名 跑鞋',
    });

    expect(result.kind).toBe('slot_request');
    expect(result.payload.fields).toEqual([
      expect.objectContaining({
        key: 'salespersonId',
        candidates: [
          expect.objectContaining({ value: 'sp-1' }),
          expect.objectContaining({ value: 'sp-2' }),
        ],
      }),
    ]);
  });

  it('accepts a numeric candidate choice in the next collecting turn', async () => {
    sessionStore.getLatestActiveSession.mockResolvedValueOnce({
      id: 'act-4',
      user_id: 'user-1',
      action_type: 'create_order',
      entity_type: 'order',
      status: 'collecting',
      slots_json: JSON.stringify({
        productName: '跑鞋',
        __candidateChoices: {
          salespersonId: [
            { value: 'sp-1', label: '张三', description: '深圳店' },
            { value: 'sp-2', label: '张三', description: '广州店' },
          ],
        },
      }),
      preview_json: null,
    });

    orchestrator = new AIActionOrchestrator({
      sessionStore,
      getActionAdapter,
      submitters,
      slotResolvers: {},
      extractActionSlots: () => ({}),
    });

    const result = await orchestrator.advance({
      userId: 'user-1',
      text: '1',
      confirmation: false,
    });

    expect(result.kind).toBe('action_preview');
    expect(result.payload.summary).toEqual(
      expect.objectContaining({
        salespersonId: 'sp-1',
      })
    );
  });
});
