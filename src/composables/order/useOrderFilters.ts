import { ref, watch } from 'vue';
import { DateUtils } from '@/utils/date';
import { API } from '@/utils/constants';
import { useToast } from '@/composables/useToast';
import { useI18n } from '@/composables/useI18n';
import { useAuth } from '@/composables/useAuth';

function formatBeijingDate(timestamp: number): string {
    if (!timestamp) return '';
    return new Date(Number(timestamp) + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export function useOrderFilters(loadOrders: (params: Record<string, any>) => void) {
    const { t } = useI18n();
    const { addToast } = useToast();
    const { authFetch } = useAuth();

    // 初始化标志，用于在组件挂载时跳过 watch
    const isInitializing = ref<boolean>(true);

    const filterState = ref({
        salesperson: '',
        status: '',
        procurementStatus: '',
        deliveryStatus: '',
        search: '',
    });

    const filterDateRange = ref<{ start: number; end: number }>({ start: 0, end: 0 });
    const exporting = ref<boolean>(false);

    // Watch filter changes (skip during initialization)
    watch(filterState, () => {
        if (!isInitializing.value) {
            handleFilterChange();
        }
    }, { deep: true });

    const handleFilterChange = (): void => {
        loadOrders({
            salesperson: filterState.value.salesperson,
            status: filterState.value.status,
            procurementStatus: filterState.value.procurementStatus,
            deliveryStatus: filterState.value.deliveryStatus,
            search: filterState.value.search,
            startTime: filterDateRange.value.start,
            endTime: filterDateRange.value.end,
            page: 1,
        });
    };

    // 完成初始化，允许 watch 监听后续变化
    const finishInitialization = (): void => {
        isInitializing.value = false;
    };

    const handleDashboardFilter = (type: string): void => {
        if (type === 'today') {
            const start = DateUtils.getBeijingDayStart();
            const end = DateUtils.getBeijingDayEnd();

            filterDateRange.value = { start, end };
            filterState.value.status = '';
            filterState.value.procurementStatus = '';
            filterState.value.deliveryStatus = '';
        } else if (type === 'pending') {
            filterState.value.status = 'pending';
            filterState.value.procurementStatus = '';
            filterState.value.deliveryStatus = '';
            filterDateRange.value = { start: 0, end: 0 };
        } else if (type === 'awaiting_delivery') {
            filterState.value.status = 'fulfilled';
            filterState.value.procurementStatus = '';
            filterState.value.deliveryStatus = 'in_transit';
            filterDateRange.value = { start: 0, end: 0 };
        } else if (['delivered', 'partially_returned', 'returned'].includes(type)) {
            filterState.value.status = '';
            filterState.value.procurementStatus = '';
            filterState.value.deliveryStatus = type;
            filterDateRange.value = { start: 0, end: 0 };
        }

        handleFilterChange();
    };

    const exportOrders = async (): Promise<void> => {
        if (exporting.value) return;
        exporting.value = true;

        try {
            const params = new URLSearchParams();
            if (filterState.value.salesperson) params.set('salesperson', filterState.value.salesperson);
            if (filterState.value.status) params.set('status', filterState.value.status);
            if (filterState.value.procurementStatus) params.set('procurementStatus', filterState.value.procurementStatus);
            if (filterState.value.deliveryStatus) params.set('deliveryStatus', filterState.value.deliveryStatus);
            if (filterState.value.search) params.set('search', filterState.value.search);
            if (filterDateRange.value.start > 0) params.set('from', formatBeijingDate(filterDateRange.value.start));
            if (filterDateRange.value.end > 0) params.set('to', formatBeijingDate(filterDateRange.value.end));

            const url = `${API.MANAGE_ORDER_EXPORT}?${params.toString()}`;
            const response = await authFetch(url);

            const blob = await response.blob();
            const downloadUrl = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = downloadUrl;

            const disposition = response.headers.get('Content-Disposition');
            const filenameMatch = disposition && disposition.match(/filename="?(.+)"?/);
            link.download = filenameMatch
                ? filenameMatch[1]
                : `orders_${new Date().toISOString().slice(0, 10)}.csv`;

            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(downloadUrl);

            addToast({ message: t('order.manage.exportSuccess'), type: 'success' });
        } catch (e: any) {
            console.error('Export error:', e);
            addToast({ message: t('order.manage.exportFailed'), type: 'error' });
        } finally {
            exporting.value = false;
        }
    };

    const refreshOrders = (page: number): void => {
        loadOrders({
            salesperson: filterState.value.salesperson,
            status: filterState.value.status,
            procurementStatus: filterState.value.procurementStatus,
            deliveryStatus: filterState.value.deliveryStatus,
            search: filterState.value.search,
            startTime: filterDateRange.value.start,
            endTime: filterDateRange.value.end,
            page,
        });
    };

    return {
        filterState,
        filterDateRange,
        exporting,
        handleFilterChange,
        handleDashboardFilter,
        exportOrders,
        refreshOrders,
        finishInitialization,
    };
}
