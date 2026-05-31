/**
 * 订货总览 Composable (Goods Overview)
 * ====================================
 *
 * 封装订货总览页面的数据获取、筛选、多选和导出逻辑。
 *
 * @module composables/useGoodsOverview
 */

import { ref, reactive, computed, watch } from 'vue';
import { API } from '@/utils/constants';
import { useAuth } from '@/composables/useAuth';
import { useI18n } from '@/composables/useI18n';
import { handleApiError } from '@/utils/api-helpers';

/** 货品概览项接口 */
interface GoodsOverviewItem {
    id: string;
    name: string;
    sku?: string;
    category?: string;
    brand?: string;
    shortage?: number;
    avgUnitCost?: number;
    productId?: string;
    variantId?: string;
    orderIds?: string[];
    [key: string]: unknown;
}

/** 概览统计接口 */
interface GoodsSummary {
    totalProducts?: number;
    totalShortage?: number;
    totalValue?: number;
    [key: string]: unknown;
}

/** 可用筛选项接口 */
interface AvailableFilters {
    categories: string[];
    brands: string[];
}

/** 概览 API 响应 */
interface GoodsOverviewApiResponse {
    success: boolean;
    data?: GoodsOverviewItem[];
    filters?: AvailableFilters;
    error?: string;
    [key: string]: unknown;
}

/** 统计 API 响应 */
interface GoodsSummaryApiResponse {
    success: boolean;
    data?: GoodsSummary;
    [key: string]: unknown;
}

/** 采购单创建结果 */
interface POResult {
    success: boolean;
    data?: unknown;
    error?: string;
}

/** 采购单 API 响应 */
interface POApiResponse {
    success: boolean;
    data?: unknown;
    error?: string;
    [key: string]: unknown;
}

export function useGoodsOverview() {
    const { authFetch } = useAuth();
    const { t } = useI18n();
    const items = ref<GoodsOverviewItem[]>([]);
    const summary = ref<GoodsSummary | null>(null);
    const loading = ref<boolean>(false);
    const error = ref<string | null>(null);
    const errorCode = ref<string | null>(null);
    let listRequestId = 0;
    let summaryRequestId = 0;

    const filters = reactive({
        category: '',
        brand: '',
        shortageOnly: false,
        sort: 'shortage',
    });

    /** 可选的品牌和分类列表（从 API 返回） */
    const availableFilters = ref<AvailableFilters>({ categories: [], brands: [] });

    // ─── 多选状态 ────────────────────────────────────
    const selectedIds = ref<Set<string>>(new Set());

    /** 当前选中的完整 item 对象列表 */
    const selectedItems = computed(() =>
        items.value.filter(item => selectedIds.value.has(item.id))
    );

    /** 是否全选 */
    const isAllSelected = computed(() =>
        items.value.length > 0 && selectedIds.value.size === items.value.length
    );

    /** 切换单个 item 的选中状态 */
    const toggleSelect = (item: GoodsOverviewItem): void => {
        const next = new Set(selectedIds.value);
        if (next.has(item.id)) {
            next.delete(item.id);
        } else {
            next.add(item.id);
        }
        selectedIds.value = next;
    };

    /** 切换全选 / 取消全选 */
    const toggleSelectAll = (): void => {
        if (isAllSelected.value) {
            selectedIds.value = new Set();
        } else {
            selectedIds.value = new Set(items.value.map(i => i.id));
        }
    };

    /** 判断某 item 是否被选中 */
    const isSelected = (item: GoodsOverviewItem): boolean => selectedIds.value.has(item.id);

    /** 清空选择 */
    const clearSelection = (): void => {
        selectedIds.value = new Set();
    };

    const resetOverviewState = (): void => {
        items.value = [];
        availableFilters.value = { categories: [], brands: [] };
        clearSelection();
    };

    const resetSummaryState = (): void => {
        summary.value = null;
    };

    // ─── 数据加载 ────────────────────────────────────

    const buildOverviewQuery = (): string => {
        const params = new URLSearchParams();
        if (filters.category) params.set('category', filters.category);
        if (filters.brand) params.set('brand', filters.brand);
        if (filters.shortageOnly) params.set('shortageOnly', '1');
        if (filters.sort) params.set('sort', filters.sort);
        return params.toString();
    };

    /**
     * 加载分析数据
     */
    const loadData = async (): Promise<boolean> => {
        const requestId = ++listRequestId;
        loading.value = true;
        error.value = null;
        errorCode.value = null;

        try {
            const queryStr = buildOverviewQuery();
            const url = queryStr ? `${API.MANAGE_GOODS_OVERVIEW}?${queryStr}` : API.MANAGE_GOODS_OVERVIEW;

            const res = await authFetch(url);
            const json: GoodsOverviewApiResponse = await res.json();
            if (requestId !== listRequestId) {
                return false;
            }

            if (json.success) {
                items.value = json.data || [];
                availableFilters.value = json.filters || { categories: [], brands: [] };
                return true;
            }

            resetOverviewState();
            error.value = json.error || t('common.loadFailed');
            return false;
        } catch (e: unknown) {
            if (requestId !== listRequestId) {
                return false;
            }
            console.error('loadGoodsOverview failed:', e);
            resetOverviewState();
            const { code, message } = handleApiError(e, { t, addToast: undefined, fallbackKey: 'common.loadFailed' });
            errorCode.value = code;
            error.value = message;
            return false;
        } finally {
            if (requestId === listRequestId) {
                loading.value = false;
            }
        }
    };

    /**
     * 加载管道概览统计
     */
    const loadSummary = async (): Promise<boolean> => {
        const requestId = ++summaryRequestId;
        try {
            const res = await authFetch(API.MANAGE_GOODS_OVERVIEW_SUMMARY);
            const json: GoodsSummaryApiResponse = await res.json();
            if (requestId !== summaryRequestId) {
                return false;
            }
            if (json.success) {
                summary.value = json.data || null;
                return true;
            }
            resetSummaryState();
        } catch (e: unknown) {
            if (requestId !== summaryRequestId) {
                return false;
            }
            console.error('loadGoodsOverviewSummary failed:', e);
            resetSummaryState();
        }
        return false;
    };

    /**
     * 导出 CSV
     */
    const exportCSV = (): void => {
        const queryStr = buildOverviewQuery();
        const link = document.createElement('a');
        link.href = queryStr ? `${API.MANAGE_GOODS_OVERVIEW_EXPORT}?${queryStr}` : API.MANAGE_GOODS_OVERVIEW_EXPORT;
        link.download = '';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const isCreatingPO = ref<boolean>(false);

    const canRetryHistoricalOrders = (message: string = ''): boolean => {
        const normalized = String(message || '');
        return normalized.includes('仅可采购 active 变体')
            || normalized.includes('变体不存在')
            || normalized.includes('variant_id 与 product_id 不匹配');
    };

    /**
     * 从选中变体创建采购单
     */
    const createPOFromSelected = async (): Promise<POResult> => {
        if (selectedItems.value.length === 0) return { success: false, error: '请选择变体' };
        if (selectedItems.value.some((item) => Number(item?.shortage || 0) <= 0)) {
            return { success: false, error: '仅可为存在缺货的变体创建采购单' };
        }

        isCreatingPO.value = true;
        try {
            // 构建采购单项
            const poItems = selectedItems.value.map((item) => ({
                product_id: item.productId || null,
                variant_id: item.variantId || item.id,
                product_name: item.name,
                product_sku: item.sku,
                quantity: Math.max(item.shortage || 0, 0),
                unit_cost: item.avgUnitCost || 0,
            }));

            const res = await authFetch(API.MANAGE_PURCHASE_ORDERS, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    allocation_method: 'by_quantity',
                    items: poItems,
                }),
            });
            const json: POApiResponse = await res.json();
            if (json.success) {
                clearSelection();
                return { success: true, data: json.data };
            }

            const fallbackOrderIds = [...new Set(
                selectedItems.value.flatMap((item) => (
                    Array.isArray(item?.orderIds) ? item.orderIds.filter(Boolean) : []
                ))
            )];
            if (canRetryHistoricalOrders(json.error || '') && fallbackOrderIds.length > 0) {
                const retryRes = await authFetch(API.MANAGE_PURCHASE_ORDER_FROM_ORDERS, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        order_ids: fallbackOrderIds,
                        allocation_method: 'by_quantity',
                    }),
                });
                const retryJson: POApiResponse = await retryRes.json();
                if (retryJson.success) {
                    clearSelection();
                    return { success: true, data: retryJson.data };
                }
                return { success: false, error: retryJson.error || '生成失败' };
            }
            return { success: false, error: json.error || '生成失败' };
        } catch (e: unknown) {
            console.error('createPOFromSelected failed:', e);
            const message = e instanceof Error ? e.message : '生成失败';
            return { success: false, error: message };
        } finally {
            isCreatingPO.value = false;
        }
    };

    /**
     * 初始化：同时加载列表和统计
     */
    const init = async (): Promise<void> => {
        // 重置数据以触发骨架屏展示
        resetSummaryState();
        resetOverviewState();
        await Promise.all([loadData(), loadSummary()]);
    };

    // 筛选条件变化时自动重新加载
    watch(filters, () => {
        clearSelection();
        loadData();
    });

    return {
        items,
        summary,
        loading,
        error,
        errorCode,
        filters,
        availableFilters,
        // 多选
        selectedIds,
        selectedItems,
        isAllSelected,
        toggleSelect,
        toggleSelectAll,
        isSelected,
        clearSelection,
        // 数据操作
        loadData,
        loadSummary,
        exportCSV,
        createPOFromSelected,
        isCreatingPO,
        init,
    };
}
