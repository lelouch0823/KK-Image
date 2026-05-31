import { ref, type Ref } from 'vue';
import { useToast } from '@/composables/useToast';
import { useI18n } from '@/composables/useI18n';
import { API } from '@/utils/constants';
import { useAuth } from '@/composables/useAuth';

/** 订单基础接口 */
interface Order {
    id: string;
    name?: string;
    hasNewFeedback?: boolean;
    [key: string]: unknown;
}

/** API 响应结构 */
interface OrderApiResponse {
    success: boolean;
    error?: string;
    data?: unknown;
    [key: string]: unknown;
}

/** 编辑提交参数 */
interface EditSubmitParams {
    updates: Record<string, unknown>;
    reason?: string;
    fileIds?: string[];
    productId?: string;
    variantId?: string;
}

export function useOrderModals(
    orders: Ref<Order[]>,
    refreshOrders: (page: number) => void,
    getOrder: (id: string) => Promise<Order | null>,
    updateOrder: (id: string, updates: Record<string, unknown>, reason?: string, fileIds?: string[], productId?: string, variantId?: string) => Promise<boolean>,
    addComment: (id: string, comment: string) => Promise<boolean>
) {
    const { t } = useI18n();
    const { addToast } = useToast();
    const { authFetch } = useAuth();

    const showCreateModal = ref<boolean>(false);
    const showEditModal = ref<boolean>(false);
    const showDetailModal = ref<boolean>(false);
    const showStatsModal = ref<boolean>(false);

    const editingOrder = ref<Order | null>(null);
    const viewingOrder = ref<Order | null>(null);
    const isEditing = ref<boolean>(false);
    const commenting = ref<boolean>(false);
    const detailHydrating = ref<boolean>(false);
    const detailHydrationError = ref<string>('');
    const detailEditLoading = ref<boolean>(false);
    let detailRequestId = 0;
    let editRequestId = 0;

    // --- Create ---
    const handleCreateOrder = async (data: Record<string, unknown>): Promise<void> => {
        try {
            const res: OrderApiResponse = await authFetch(API.MANAGE_ORDERS, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    productName: data.name, // Mapping
                    ...data,
                }),
            }).then((r) => r.json());

            if (res.success) {
                addToast({ message: t('order.manage.createSuccess') || '订单创建成功', type: 'success' });
                showCreateModal.value = false;
                refreshOrders(1);
            } else {
                addToast({ message: res.error || t('common.operationFailed'), type: 'error' });
            }
        } catch (_e: unknown) {
            addToast({ message: t('common.networkError'), type: 'error' });
        }
    };

    // --- Edit ---
    const openEditModal = async (order: Order): Promise<boolean> => {
        const requestId = ++editRequestId;
        const fullOrder = await getOrder(order.id);
        if (requestId !== editRequestId) return false;
        if (fullOrder) {
            editingOrder.value = fullOrder;
            showEditModal.value = true;
            return true;
        }
        return false;
    };

    const closeEditModal = async (): Promise<void> => {
        editRequestId += 1;
        showEditModal.value = false;
        editingOrder.value = null;

        if (showDetailModal.value && viewingOrder.value) {
            const requestId = ++detailRequestId;
            detailHydrationError.value = '';
            detailHydrating.value = true;
            try {
                const updated = await getOrder(viewingOrder.value.id);
                if (requestId !== detailRequestId || !showDetailModal.value) return;
                if (updated) {
                    viewingOrder.value = updated;
                } else {
                    detailHydrationError.value = t('common.loadFailed');
                }
            } catch (_e: unknown) {
                if (requestId !== detailRequestId || !showDetailModal.value) return;
                detailHydrationError.value = t('common.networkError');
            } finally {
                if (requestId === detailRequestId) {
                    detailHydrating.value = false;
                }
            }
        }
    };

    const handleEditSubmit = async ({ updates, reason, fileIds, productId, variantId }: EditSubmitParams, paginationPage: number): Promise<void> => {
        if (isEditing.value || !editingOrder.value) return;
        isEditing.value = true;
        try {
            const success = await updateOrder(editingOrder.value.id, updates, reason, fileIds, productId, variantId);
            if (success) {
                closeEditModal();
                refreshOrders(paginationPage);
            }
        } finally {
            isEditing.value = false;
        }
    };

    // --- Detail ---
    const openDetailModal = async (order: Order): Promise<boolean> => {
        const requestId = ++detailRequestId;
        viewingOrder.value = order ? { ...order } : null;
        showDetailModal.value = true;
        detailHydrationError.value = '';
        detailHydrating.value = true;

        const idx = orders.value.findIndex((o) => o.id === order.id);
        if (idx !== -1 && orders.value[idx].hasNewFeedback) {
            orders.value[idx].hasNewFeedback = false;
        }

        try {
            const fullOrder = await getOrder(order.id);
            if (requestId !== detailRequestId || !showDetailModal.value) return false;
            if (fullOrder) {
                viewingOrder.value = fullOrder;
                return true;
            }
            detailHydrationError.value = t('common.loadFailed');
            return false;
        } catch (_e: unknown) {
            if (requestId !== detailRequestId || !showDetailModal.value) return false;
            detailHydrationError.value = t('common.networkError');
            return false;
        } finally {
            if (requestId === detailRequestId) {
                detailHydrating.value = false;
            }
        }
    };

    const closeDetailModal = (): void => {
        detailRequestId += 1;
        showDetailModal.value = false;
        viewingOrder.value = null;
        detailHydrationError.value = '';
        detailHydrating.value = false;
    };

    const handleAdminComment = async (comment: string): Promise<void> => {
        if (!viewingOrder.value || !comment.trim() || commenting.value) return;

        commenting.value = true;
        try {
            const success = await addComment(viewingOrder.value.id, comment);
            if (success) {
                await refreshAfterComment();
            }
        } finally {
            commenting.value = false;
        }
    };

    const refreshAfterComment = async (): Promise<void> => {
        if (!viewingOrder.value) return;
        const requestId = ++detailRequestId;
        detailHydrationError.value = '';
        detailHydrating.value = true;
        try {
            const fullOrder = await getOrder(viewingOrder.value.id);
            if (requestId !== detailRequestId || !showDetailModal.value) return;
            if (fullOrder) {
                viewingOrder.value = fullOrder;
            } else {
                detailHydrationError.value = t('common.loadFailed');
            }
        } catch (_e: unknown) {
            if (requestId !== detailRequestId || !showDetailModal.value) return;
            detailHydrationError.value = t('common.networkError');
        } finally {
            if (requestId === detailRequestId) {
                detailHydrating.value = false;
            }
        }
    };

    const handleEditFromDetail = async (order: Order): Promise<void> => {
        if (!order?.id || detailEditLoading.value) return;
        detailEditLoading.value = true;
        try {
            await openEditModal(order);
        } finally {
            detailEditLoading.value = false;
        }
    };

    return {
        showCreateModal,
        showEditModal,
        showDetailModal,
        showStatsModal,
        editingOrder,
        viewingOrder,
        detailHydrating,
        detailHydrationError,
        detailEditLoading,
        isEditing,

        handleCreateOrder,
        openEditModal,
        closeEditModal,
        handleEditSubmit,
        openDetailModal,
        closeDetailModal,
        handleAdminComment,
        refreshAfterComment,
        handleEditFromDetail,
        commenting
    };
}
