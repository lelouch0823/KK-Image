import { ref } from 'vue';
import { useToast } from '@/composables/useToast';
import { useI18n } from '@/composables/useI18n';

export function useOrderBatch(refreshOrders, batchAction, changeStatus) {
    const { t } = useI18n();
    const { addToast } = useToast();

    const selectedIds = ref([]);
    const batchProcessing = ref(false);

    const confirmData = ref({
        show: false,
        title: '',
        message: '',
        type: 'primary',
        loading: false,
        onConfirm: () => { },
    });

    const handleBatchAction = (action, paginationPage) => {
        if (batchProcessing.value || selectedIds.value.length === 0) return;

        const count = selectedIds.value.length;
        let title = '';
        let message = '';
        let type = 'primary';

        if (action === 'confirm') {
            title = t('order.manage.batchConfirm');
            message = t('order.manage.batchConfirmConfirm', { count });
            type = 'primary';
        } else if (action === 'reject') {
            title = t('order.manage.batchReject');
            message = t('order.manage.batchRejectConfirm', { count });
            type = 'warning';
        } else if (action === 'void') {
            title = t('order.manage.batchVoid');
            message = t('order.manage.batchVoidConfirm', { count });
            type = 'danger';
        }

        confirmData.value = {
            show: true,
            title,
            message,
            type,
            onConfirm: async () => {
                confirmData.value.loading = true;
                try {
                    const result = await batchAction(selectedIds.value, action);
                    if (result) {
                        selectedIds.value = [];
                        await refreshOrders({ page: paginationPage });
                        confirmData.value.show = false;
                    }
                } finally {
                    confirmData.value.loading = false;
                }
            },
        };
    };

    const handleVoidOrder = (order) => {
        confirmData.value = {
            show: true,
            title: t('common.confirm'),
            message: t('order.actions.voidConfirm'),
            type: 'danger',
            loading: false,
            onConfirm: async () => {
                confirmData.value.loading = true;
                try {
                    const success = await changeStatus(order.id, 'void');
                    if (success) {
                        order.status = 'void';
                        addToast({ message: t('order.actions.voidSuccess'), type: 'success' });
                        confirmData.value.show = false;
                    }
                } finally {
                    confirmData.value.loading = false;
                }
            },
        };
    };

    return {
        selectedIds,
        batchProcessing,
        confirmData,
        handleBatchAction,
        handleVoidOrder,
    };
}
