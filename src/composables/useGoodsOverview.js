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

export function useGoodsOverview() {
    const items = ref([]);
    const summary = ref(null);
    const loading = ref(false);
    const error = ref(null);

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

    // ─── 数据加载 ────────────────────────────────────

    /**
     * 加载分析数据
     */
    const loadData = async () => {
        loading.value = true;
        error.value = null;

        try {
            const params = new URLSearchParams();
            if (filters.category) params.set('category', filters.category);
            if (filters.brand) params.set('brand', filters.brand);
            if (filters.shortageOnly) params.set('shortageOnly', '1');
            if (filters.sort) params.set('sort', filters.sort);

            const queryStr = params.toString();
            const url = queryStr ? `${API.MANAGE_GOODS_OVERVIEW}?${queryStr}` : API.MANAGE_GOODS_OVERVIEW;

            const res = await fetch(url);
            const json = await res.json();

            if (json.success) {
                items.value = json.data.items;
                availableFilters.value = json.data.filters || { categories: [], brands: [] };
            } else {
                error.value = json.error || '加载失败';
            }
        } catch (e) {
            console.error('loadGoodsOverview failed:', e);
            error.value = e.message;
        } finally {
            loading.value = false;
        }
    };

    /**
     * 加载管道概览统计
     */
    const loadSummary = async () => {
        try {
            const res = await fetch(API.MANAGE_GOODS_OVERVIEW_SUMMARY);
            const json = await res.json();
            if (json.success) {
                summary.value = json.data;
            }
        } catch (e) {
            console.error('loadGoodsOverviewSummary failed:', e);
        }
    };

    /**
     * 导出 CSV
     */
    const exportCSV = () => {
        const link = document.createElement('a');
        link.href = API.MANAGE_GOODS_OVERVIEW_EXPORT;
        link.download = '';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const isCreatingPO = ref(false);

    /**
     * 从选中商品创建采购单
     * 收集所有选中商品关联的 confirmed 订单 ID，调用采购单 API
     */
    const createPOFromSelected = async () => {
        if (selectedItems.value.length === 0) return { success: false, error: '请选择商品' };

        isCreatingPO.value = true;
        try {
            // 构建采购单项
            const poItems = selectedItems.value.map(item => ({
                product_id: item.id,
                product_name: item.name,
                product_sku: item.sku,
                quantity: Math.max(item.shortage, 0),
                unit_cost: item.avgUnitCost || 0,
            }));

            const res = await fetch(API.MANAGE_PURCHASE_ORDERS, {
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
        summary.value = null;
        items.value = [];
        clearSelection();
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
