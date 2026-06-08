import { ref } from 'vue';
import { useToast } from '@/composables/useToast';
import { useI18n } from '@/composables/useI18n';
import { useAuth } from '@/composables/useAuth';
import { API } from '@/utils/constants';
import { escapeHtml } from '@/utils/html';

interface ConfirmDialogData {
    show: boolean;
    title: string;
    message: string;
    type: string;
    loading: boolean;
    onConfirm: () => void;
}

interface OrderWithStatus {
    id: string;
    status: string;
    orderNo?: string;
    productName?: string | null;
    salespersonName?: string | null;
    createdAt?: string | number | null;
    [key: string]: unknown;
}

export function useOrderBatch(
    refreshOrders: (page: number) => void,
    batchAction: (ids: string[], action: string, reason?: string) => Promise<unknown>,
    changeStatus: (id: string, status: string) => Promise<boolean>,
    getOrder?: (id: string) => Promise<OrderWithStatus | null>,
) {
    const { t } = useI18n();
    const { addToast } = useToast();
    const { authFetch } = useAuth();

    const selectedIds = ref<string[]>([]);
    const batchProcessing = ref<boolean>(false);
    const batchExporting = ref<boolean>(false);

    const confirmData = ref<ConfirmDialogData>({
        show: false,
        title: '',
        message: '',
        type: 'primary',
        loading: false,
        onConfirm: () => { },
    });

    const handleBatchAction = (action: string, paginationPage: number): void => {
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
        } else if (action === 'export') {
            // 导出不需要确认，直接执行
            handleBatchExport();
            return;
        } else if (action === 'print') {
            // 打印不需要确认，直接执行
            handleBatchPrint();
            return;
        }

        confirmData.value = {
            show: true,
            title,
            message,
            type,
            loading: false,
            onConfirm: async () => {
                confirmData.value.loading = true;
                try {
                    const result = await batchAction(selectedIds.value, action);
                    if (result) {
                        selectedIds.value = [];
                        await refreshOrders(paginationPage);
                        confirmData.value.show = false;
                    }
                } finally {
                    confirmData.value.loading = false;
                }
            },
        };
    };

    /**
     * 批量变更状态
     */
    const handleBatchChangeStatus = (status: string, paginationPage: number): void => {
        if (batchProcessing.value || selectedIds.value.length === 0) return;

        const count = selectedIds.value.length;
        const statusLabel = t(`order.statuses.${status}`, status);

        confirmData.value = {
            show: true,
            title: t('order.manage.batchChangeStatus'),
            message: t('order.manage.batchChangeStatusConfirm', { count, status: statusLabel }),
            type: status === 'void' ? 'danger' : 'primary',
            loading: false,
            onConfirm: async () => {
                confirmData.value.loading = true;
                batchProcessing.value = true;
                try {
                    const result = await batchAction(selectedIds.value, 'status', status);
                    if (result) {
                        selectedIds.value = [];
                        await refreshOrders(paginationPage);
                        confirmData.value.show = false;
                    }
                } finally {
                    confirmData.value.loading = false;
                    batchProcessing.value = false;
                }
            },
        };
    };

    /**
     * 批量导出选中订单
     */
    const handleBatchExport = async (): Promise<void> => {
        if (batchExporting.value || selectedIds.value.length === 0) return;

        batchExporting.value = true;
        try {
            const params = new URLSearchParams();
            selectedIds.value.forEach(id => params.append('ids', id));

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
        } catch (e: unknown) {
            console.error('Batch export error:', e);
            addToast({ message: t('order.manage.exportFailed'), type: 'error' });
        } finally {
            batchExporting.value = false;
        }
    };

    /**
     * 批量打印选中订单
     */
    const handleBatchPrint = async (): Promise<void> => {
        if (batchProcessing.value || selectedIds.value.length === 0) return;

        batchProcessing.value = true;
        try {
            // 获取选中订单的详情
            const orders: OrderWithStatus[] = [];
            if (getOrder) {
                for (const id of selectedIds.value) {
                    const order = await getOrder(id);
                    if (order) orders.push(order);
                }
            }

            if (orders.length === 0) {
                addToast({ message: t('common.loadFailed'), type: 'error' });
                return;
            }

            // 生成打印内容
            const printContent = generatePrintContent(orders);

            // 打开新窗口并打印
            const printWindow = window.open('', '_blank');
            if (printWindow) {
                printWindow.document.write(printContent);
                printWindow.document.close();
                printWindow.onload = () => {
                    printWindow.print();
                };
            }
        } catch (e: unknown) {
            console.error('Batch print error:', e);
            addToast({ message: t('common.operationFailed'), type: 'error' });
        } finally {
            batchProcessing.value = false;
        }
    };

    /**
     * 生成打印 HTML 内容
     */
    const generatePrintContent = (orders: OrderWithStatus[]): string => {
        const orderRows = orders.map(order => `
            <tr>
                <td>${escapeHtml(order.orderNo || order.id)}</td>
                <td>${escapeHtml(order.productName || '-')}</td>
                <td>${escapeHtml(t(`order.statuses.${order.status}`, order.status))}</td>
                <td>${escapeHtml(String(order.quantity || 1))}</td>
                <td>${escapeHtml(order.salespersonName || '-')}</td>
                <td>${escapeHtml(order.createdAt ? new Date(order.createdAt).toLocaleDateString() : '-')}</td>
            </tr>
        `).join('');

        return `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <title>订单打印</title>
                <style>
                    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 20px; }
                    h1 { font-size: 18px; margin-bottom: 16px; }
                    table { width: 100%; border-collapse: collapse; font-size: 12px; }
                    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                    th { background-color: #f5f5f5; font-weight: 600; }
                    .meta { color: #666; font-size: 12px; margin-bottom: 12px; }
                    @media print {
                        body { padding: 0; }
                        @page { margin: 1cm; }
                    }
                </style>
            </head>
            <body>
                <h1>订单列表</h1>
                <p class="meta">打印时间: ${new Date().toLocaleString()} | 共 ${orders.length} 个订单</p>
                <table>
                    <thead>
                        <tr>
                            <th>订单编号</th>
                            <th>商品名称</th>
                            <th>状态</th>
                            <th>数量</th>
                            <th>销售员</th>
                            <th>创建时间</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${orderRows}
                    </tbody>
                </table>
            </body>
            </html>
        `;
    };

    const handleVoidOrder = (order: OrderWithStatus): void => {
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
        batchExporting,
        confirmData,
        handleBatchAction,
        handleBatchChangeStatus,
        handleBatchExport,
        handleBatchPrint,
        handleVoidOrder,
    };
}
