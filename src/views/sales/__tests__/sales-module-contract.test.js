import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ref } from 'vue';
import { useOrders } from '@/composables/useOrders';
import { API } from '@/utils/constants';

const mocks = vi.hoisted(() => ({
  authFetch: vi.fn(),
  addToast: vi.fn(),
}));

vi.mock('@/composables/useResource', () => ({
  useResource: () => ({
    loading: ref(false),
    items: ref([]),
    error: ref(null),
    pagination: { page: 1, limit: 20, total: 0, totalPages: 1 },
    abort: vi.fn(),
  }),
}));

vi.mock('@/composables/useAuth', () => ({
  useAuth: () => ({ authFetch: mocks.authFetch }),
}));

vi.mock('@/composables/useToast', () => ({
  useToast: () => ({ addToast: mocks.addToast }),
}));

vi.mock('@/composables/useI18n', () => ({
  useI18n: () => ({ t: (key) => key }),
}));

describe('sales module contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authFetch.mockResolvedValue({
      json: async () => ({ success: true, data: { id: 'o-1' } }),
    });
  });

  it('sales create flow keeps payload compatibility', async () => {
    const { createSalesOrder } = useOrders();
    const token = 'sales-token';

    const boundPayload = {
      name: 'Bound Product',
      quantity: 2,
      productId: 'p-1',
      variantId: 'v-1',
      fileIds: ['f-1', 'f-2'],
    };

    const unboundPayload = {
      name: 'Manual Product',
      quantity: 1,
      color: 'Black',
      fileIds: ['f-3'],
    };

    await createSalesOrder(token, boundPayload);
    await createSalesOrder(token, unboundPayload);

    expect(mocks.authFetch).toHaveBeenNthCalledWith(
      1,
      API.SALES_ORDER_CREATE(token),
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const firstBody = JSON.parse(mocks.authFetch.mock.calls[0][1].body);
    expect(firstBody).toEqual({
      name: 'Bound Product',
      quantity: 2,
      productId: 'p-1',
      variantId: 'v-1',
      fileIds: ['f-1', 'f-2'],
    });

    const secondBody = JSON.parse(mocks.authFetch.mock.calls[1][1].body);
    expect(secondBody).toEqual({
      name: 'Manual Product',
      quantity: 1,
      color: 'Black',
      fileIds: ['f-3'],
    });
    expect(secondBody).not.toHaveProperty('productId');
    expect(secondBody).not.toHaveProperty('variantId');
  });

  it('returns server error details when sales create is rejected', async () => {
    mocks.authFetch.mockResolvedValueOnce({
      json: async () => ({ success: false, error: 'variant must be in stock' }),
    });

    const { createSalesOrder } = useOrders();
    const result = await createSalesOrder('sales-token', {
      name: 'Bound Product',
      quantity: 1,
      productId: 'p-1',
      variantId: 'v-1',
      fileIds: [],
    });

    expect(result).toEqual({
      ok: false,
      error: 'variant must be in stock',
    });
    expect(mocks.addToast).toHaveBeenCalledWith({
      message: 'variant must be in stock',
      type: 'error',
    });
  });
});
