import { ref } from 'vue';
import { useToast } from '@/composables/useToast';
import { useI18n } from '@/composables/useI18n';
import { API } from '@/utils/constants';
import { useAuth } from '@/composables/useAuth';

export function useOrderModals(orders, refreshOrders, getOrder, updateOrder, addComment) {
    const { t } = useI18n();
    const { addToast } = useToast();
    const { authFetch } = useAuth();

    const showCreateModal = ref(false);
    const showEditModal = ref(false);
    const showDetailModal = ref(false);
    const showStatsModal = ref(false);

    const editingOrder = ref(null);
    const viewingOrder = ref(null);
    const isEditing = ref(false);
    const commenting = ref(false);
    const detailHydrating = ref(false);
    const detailHydrationError = ref('');
    const detailEditLoading = ref(false);
    let detailRequestId = 0;
    let editRequestId = 0;

    // --- Create ---
    const handleCreateOrder = async (data) => {
        try {
            const res = await authFetch(API.MANAGE_ORDERS, {
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
        } catch (_e) {
            addToast({ message: t('common.networkError'), type: 'error' });
        }
    };

    // --- Edit ---
    const openEditModal = async (order) => {
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

    const closeEditModal = async () => {
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
            } catch (_e) {
                if (requestId !== detailRequestId || !showDetailModal.value) return;
                detailHydrationError.value = t('common.networkError');
            } finally {
                if (requestId === detailRequestId) {
                    detailHydrating.value = false;
                }
            }
        }
    };

    const handleEditSubmit = async ({ updates, reason, fileIds, productId, variantId }, paginationPage) => {
        if (isEditing.value) return;
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
    const openDetailModal = async (order) => {
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
        } catch (_e) {
            if (requestId !== detailRequestId || !showDetailModal.value) return false;
            detailHydrationError.value = t('common.networkError');
            return false;
        } finally {
            if (requestId === detailRequestId) {
                detailHydrating.value = false;
            }
        }
    };

    const closeDetailModal = () => {
        detailRequestId += 1;
        showDetailModal.value = false;
        viewingOrder.value = null;
        detailHydrationError.value = '';
        detailHydrating.value = false;
    };

    const handleAdminComment = async (comment) => {
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

    const refreshAfterComment = async () => {
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
        } catch (_e) {
            if (requestId !== detailRequestId || !showDetailModal.value) return;
            detailHydrationError.value = t('common.networkError');
        } finally {
            if (requestId === detailRequestId) {
                detailHydrating.value = false;
            }
        }
    };

    const handleEditFromDetail = async (order) => {
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
