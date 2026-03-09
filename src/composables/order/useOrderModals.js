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
        const fullOrder = await getOrder(order.id);
        if (fullOrder) {
            editingOrder.value = fullOrder;
            showEditModal.value = true;
        }
    };

    const closeEditModal = async () => {
        showEditModal.value = false;
        editingOrder.value = null;

        if (showDetailModal.value && viewingOrder.value) {
            const updated = await getOrder(viewingOrder.value.id);
            if (updated) viewingOrder.value = updated;
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
        const fullOrder = await getOrder(order.id);
        if (fullOrder) {
            viewingOrder.value = fullOrder;
            showDetailModal.value = true;

            const idx = orders.value.findIndex((o) => o.id === order.id);
            if (idx !== -1 && orders.value[idx].hasNewFeedback) {
                orders.value[idx].hasNewFeedback = false;
            }
            return true;
        }
        return false;
    };

    const closeDetailModal = () => {
        showDetailModal.value = false;
        viewingOrder.value = null;
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
        const fullOrder = await getOrder(viewingOrder.value.id);
        if (fullOrder) {
            viewingOrder.value = fullOrder;
        }
    };

    const handleEditFromDetail = (order) => {
        editingOrder.value = order;
        showEditModal.value = true;
    };

    return {
        showCreateModal,
        showEditModal,
        showDetailModal,
        showStatsModal,
        editingOrder,
        viewingOrder,
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
