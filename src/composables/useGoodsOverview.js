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

export function useGoodsOverview() {
    const { authFetch } = useAuth();
    const items = ref([]);
    const summary = ref(null);
    const loading = ref(false);
    const error = ref(null);
    const errorCode = ref(null);
    let listRequestId = 0;
    let summaryRequestId = 0;

    const filters = reactive({
        category: '',
        brand: '',
        shortageOnly: false,
        sort: 'shortage',
    });

    /** 可选的品牌和分类列表（从 API 返回） */
    const availableFilters = ref({ categories: [], brands: [] });

    // ─── 多选状态 ────────────────────────────────────
    const selectedIds = ref(new Set());

    /** 当前选中的完整 item 对象列表 */
    const selectedItems = computed(() =>
        items.value.filter(item => selectedIds.value.has(item.id))
    );

    /** 是否全选 */
    const isAllSelected = computed(() =>
        items.value.length > 0 && selectedIds.value.size === items.value.length
    );

    /** 切换单个 item 的选中状态 */
    const toggleSelect = (item) => {
        const next = new Set(selectedIds.value);
        if (next.has(item.id)) {
            next.delete(item.id);
        } else {
            next.add(item.id);
        }
        selectedIds.value = next;
    };

    /** 切换全选 / 取消全选 */
    const toggleSelectAll = () => {
        if (isAllSelected.value) {
            selectedIds.value = new Set();
        } else {
            selectedIds.value = new Set(items.value.map(i => i.id));
        }
    };

    /** 判断某 item 是否被选中 */
    const isSelected = (item) => selectedIds.value.has(item.id);

    /** 清空选择 */
    const clearSelection = () => {
        selectedIds.value = new Set();
    };

    const resetOverviewState = () => {
        items.value = [];
        availableFilters.value = { categories: [], brands: [] };
        clearSelection();
    };

    const resetSummaryState = () => {
        summary.value = null;
    };

    // ─── 数据加载 ────────────────────────────────────

    const buildOverviewQuery = () => {
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
    const loadData = async () => {
        const requestId = ++listRequestId;
        loading.value = true;
        error.value = null;
        errorCode.value = null;

        try {
            const queryStr = buildOverviewQuery();
            const url = queryStr ? `${API.MANAGE_GOODS_OVERVIEW}?${queryStr}` : API.MANAGE_GOODS_OVERVIEW;

            const res = await authFetch(url);
            const json = await res.json();
            if (requestId !== listRequestId) {
                return false;
            }

            if (json.success) {
                items.value = json.data;
                availableFilters.value = json.filters || { categories: [], brands: [] };
                return true;
            }

            resetOverviewState();
            error.value = json.error || '加载失败';
            return false;
        } catch (e) {
            if (requestId !== listRequestId) {
                return false;
            }
            console.error('loadGoodsOverview failed:', e);
            resetOverviewState();
            const status = Number(e?.status || 0);
            if (status === 403) {
                errorCode.value = 'FORBIDDEN';
                error.value = e?.data?.error || e?.message || '权限不足';
                return false;
            }
            if (status === 401) {
                errorCode.value = 'UNAUTHORIZED';
                error.value = e?.data?.error || e?.message || '未授权';
                return false;
            }
            errorCode.value = 'NETWORK_ERROR';
            error.value = e.message;
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
    const loadSummary = async () => {
        const requestId = ++summaryRequestId;
        try {
            const res = await authFetch(API.MANAGE_GOODS_OVERVIEW_SUMMARY);
            const json = await res.json();
            if (requestId !== summaryRequestId) {
                return false;
            }
            if (json.success) {
                summary.value = json.data;
                return true;
            }
            resetSummaryState();
        } catch (e) {
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
    const exportCSV = () => {
        const queryStr = buildOverviewQuery();
        const link = document.createElement('a');
        link.href = queryStr ? `${API.MANAGE_GOODS_OVERVIEW_EXPORT}?${queryStr}` : API.MANAGE_GOODS_OVERVIEW_EXPORT;
        link.download = '';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const isCreatingPO = ref(false);

    const canRetryHistoricalOrders = (message = '') => {
        const normalized = String(message || '');
        return normalized.includes('仅可采购 active 变体')
            || normalized.includes('变体不存在')
            || normalized.includes('variant_id 与 product_id 不匹配');
    };

    /**
     * 从选中变体创建采购单
     */
    const createPOFromSelected = async () => {
        if (selectedItems.value.length === 0) return { success: false, error: '请选择变体' };
        if (selectedItems.value.some((item) => Number(item?.shortage || 0) <= 0)) {
            return { success: false, error: '仅可为存在缺货的变体创建采购单' };
        }

        isCreatingPO.value = true;
        try {
            // 构建采购单项
            const poItems = selectedItems.value.map(item => ({
                product_id: item.productId || null,
                variant_id: item.variantId || item.id,
                product_name: item.name,
                product_sku: item.sku,
                quantity: Math.max(item.shortage, 0),
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
            const json = await res.json();
            if (json.success) {
                clearSelection();
                return { success: true, data: json.data };
            }

            const fallbackOrderIds = [...new Set(
                selectedItems.value.flatMap((item) => (
                    Array.isArray(item?.orderIds) ? item.orderIds.filter(Boolean) : []
                ))
            )];
            if (canRetryHistoricalOrders(json.error) && fallbackOrderIds.length > 0) {
                const retryRes = await authFetch(API.MANAGE_PURCHASE_ORDER_FROM_ORDERS, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        order_ids: fallbackOrderIds,
                        allocation_method: 'by_quantity',
                    }),
                });
                const retryJson = await retryRes.json();
                if (retryJson.success) {
                    clearSelection();
                    return { success: true, data: retryJson.data };
                }
                return { success: false, error: retryJson.error || '生成失败' };
            }
            return { success: false, error: json.error || '生成失败' };
        } catch (e) {
            console.error('createPOFromSelected failed:', e);
            return { success: false, error: e.message };
        } finally {
            isCreatingPO.value = false;
        }
    };

    /**
     * 初始化：同时加载列表和统计
     */
    const init = async () => {
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
