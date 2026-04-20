import { ref } from 'vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useOrderModals } from '../useOrderModals';

const mockAuthFetch = vi.fn();
const mockAddToast = vi.fn();
const mockT = vi.fn((key) => key);

vi.mock('@/composables/useToast', () => ({
  useToast: () => ({ addToast: mockAddToast }),
}));

vi.mock('@/composables/useI18n', () => ({
  useI18n: () => ({ t: mockT }),
}));

vi.mock('@/composables/useAuth', () => ({
  useAuth: () => ({ authFetch: mockAuthFetch }),
}));

vi.mock('@/utils/constants', () => ({
  API: {
    MANAGE_ORDERS: '/api/manage/orders',
  },
}));

function createSubject(overrides = {}) {
  const orders = overrides.orders ?? ref([{ id: 'order-1', hasNewFeedback: true }]);
  const refreshOrders = overrides.refreshOrders ?? vi.fn();
  const getOrder = overrides.getOrder ?? vi.fn(async (id) => ({ id, status: 'full' }));
  const updateOrder = overrides.updateOrder ?? vi.fn(async () => true);
  const addComment = overrides.addComment ?? vi.fn(async () => true);

  return {
    orders,
    refreshOrders,
    getOrder,
    updateOrder,
    addComment,
    modals: useOrderModals(orders, refreshOrders, getOrder, updateOrder, addComment),
  };
}

describe('useOrderModals', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates orders through the managed auth client and handles backend failures', async () => {
    mockAuthFetch
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ success: true }),
      })
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ success: false, error: 'create failed' }),
      })
      .mockRejectedValueOnce(new Error('network down'));

    const { modals, refreshOrders } = createSubject();

    modals.showCreateModal.value = true;
    await modals.handleCreateOrder({ name: 'Premium Bag', note: 'alpha' });
    expect(mockAuthFetch).toHaveBeenNthCalledWith(
      1,
      '/api/manage/orders',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          productName: 'Premium Bag',
          name: 'Premium Bag',
          note: 'alpha',
        }),
      })
    );
    expect(refreshOrders).toHaveBeenCalledWith(1);
    expect(modals.showCreateModal.value).toBe(false);

    await modals.handleCreateOrder({ name: 'Broken' });
    expect(mockAddToast).toHaveBeenCalledWith({ message: 'create failed', type: 'error' });

    await modals.handleCreateOrder({ name: 'Offline' });
    expect(mockAddToast).toHaveBeenCalledWith({ message: 'common.networkError', type: 'error' });
  });

  it('opens edit modal with the latest resolved detail only', async () => {
    let resolveFirst;
    let resolveSecond;
    const getOrder = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFirst = resolve;
          })
      )
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveSecond = resolve;
          })
      );

    const { modals } = createSubject({ getOrder });
    const first = modals.openEditModal({ id: 'order-1' });
    const second = modals.openEditModal({ id: 'order-2' });

    resolveSecond({ id: 'order-2', status: 'newest' });
    await expect(second).resolves.toBe(true);
    expect(modals.editingOrder.value).toEqual({ id: 'order-2', status: 'newest' });
    expect(modals.showEditModal.value).toBe(true);

    resolveFirst({ id: 'order-1', status: 'stale' });
    await expect(first).resolves.toBe(false);
    expect(modals.editingOrder.value).toEqual({ id: 'order-2', status: 'newest' });
  });

  it('closes edit modal and rehydrates detail modal on success and fallback branches', async () => {
    const getOrder = vi
      .fn()
      .mockResolvedValueOnce({ id: 'order-1', status: 'updated' })
      .mockResolvedValueOnce(null)
      .mockRejectedValueOnce(new Error('network down'));

    const { modals } = createSubject({ getOrder });
    modals.showDetailModal.value = true;
    modals.viewingOrder.value = { id: 'order-1', status: 'old' };
    modals.showEditModal.value = true;
    modals.editingOrder.value = { id: 'order-1' };

    await modals.closeEditModal();
    expect(modals.showEditModal.value).toBe(false);
    expect(modals.viewingOrder.value).toEqual({ id: 'order-1', status: 'updated' });

    modals.showEditModal.value = true;
    modals.editingOrder.value = { id: 'order-1' };
    await modals.closeEditModal();
    expect(modals.detailHydrationError.value).toBe('common.loadFailed');

    modals.showEditModal.value = true;
    modals.editingOrder.value = { id: 'order-1' };
    await modals.closeEditModal();
    expect(modals.detailHydrationError.value).toBe('common.networkError');
  });

  it('submits edits once and refreshes the requested page on success', async () => {
    const updateOrder = vi.fn(async () => true);
    const { modals, refreshOrders } = createSubject({ updateOrder });
    modals.editingOrder.value = { id: 'order-1' };

    await modals.handleEditSubmit(
      {
        updates: { status: 'ordered' },
        reason: 'audit',
        fileIds: ['file-1'],
        productId: 'prod-1',
        variantId: 'variant-1',
      },
      3
    );

    expect(updateOrder).toHaveBeenCalledWith(
      'order-1',
      { status: 'ordered' },
      'audit',
      ['file-1'],
      'prod-1',
      'variant-1'
    );
    expect(refreshOrders).toHaveBeenCalledWith(3);
    expect(modals.isEditing.value).toBe(false);
  });

  it('opens detail modal, clears new feedback markers, and reports load failures', async () => {
    const getOrder = vi
      .fn()
      .mockResolvedValueOnce({ id: 'order-1', status: 'loaded' })
      .mockResolvedValueOnce(null)
      .mockRejectedValueOnce(new Error('network down'));

    const { modals, orders } = createSubject({ getOrder });

    await expect(modals.openDetailModal({ id: 'order-1' })).resolves.toBe(true);
    expect(modals.viewingOrder.value).toEqual({ id: 'order-1', status: 'loaded' });
    expect(orders.value[0].hasNewFeedback).toBe(false);

    await expect(modals.openDetailModal({ id: 'order-1' })).resolves.toBe(false);
    expect(modals.detailHydrationError.value).toBe('common.loadFailed');

    await expect(modals.openDetailModal({ id: 'order-1' })).resolves.toBe(false);
    expect(modals.detailHydrationError.value).toBe('common.networkError');
    modals.closeDetailModal();
    expect(modals.viewingOrder.value).toBeNull();
    expect(modals.showDetailModal.value).toBe(false);
  });

  it('guards comment submission and refreshes detail after successful admin comments', async () => {
    const getOrder = vi.fn(async () => ({ id: 'order-1', comments: ['latest'] }));
    const addComment = vi.fn(async () => true);
    const { modals } = createSubject({ getOrder, addComment });

    await modals.handleAdminComment('   ');
    expect(addComment).not.toHaveBeenCalled();

    modals.showDetailModal.value = true;
    modals.viewingOrder.value = { id: 'order-1' };
    await modals.handleAdminComment('approved');

    expect(addComment).toHaveBeenCalledWith('order-1', 'approved');
    expect(modals.viewingOrder.value).toEqual({ id: 'order-1', comments: ['latest'] });
    expect(modals.commenting.value).toBe(false);
  });

  it('hydrates detail after comments and from detail-edit actions', async () => {
    const getOrder = vi
      .fn()
      .mockResolvedValueOnce(null)
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce({ id: 'order-1', status: 'edit-target' });
    const { modals } = createSubject({ getOrder });

    modals.showDetailModal.value = true;
    modals.viewingOrder.value = { id: 'order-1' };

    await modals.refreshAfterComment();
    expect(modals.detailHydrationError.value).toBe('common.loadFailed');

    await modals.refreshAfterComment();
    expect(modals.detailHydrationError.value).toBe('common.networkError');

    await modals.handleEditFromDetail({ id: 'order-1' });
    expect(modals.detailEditLoading.value).toBe(false);
    expect(modals.editingOrder.value).toEqual({ id: 'order-1', status: 'edit-target' });

    modals.detailEditLoading.value = true;
    await modals.handleEditFromDetail({ id: 'order-2' });
    expect(getOrder).toHaveBeenCalledTimes(3);
  });
});
