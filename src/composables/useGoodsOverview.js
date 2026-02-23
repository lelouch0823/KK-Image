/**
 * 订货总览 Composable (Goods Overview)
 * ====================================
 *
 * 封装订货总览页面的数据获取、筛选和导出逻辑。
 *
 * @module composables/useGoodsOverview
 */

import { ref, reactive, watch } from 'vue';
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

    /**
     * 初始化：同时加载列表和统计
     */
    const init = async () => {
        await Promise.all([loadData(), loadSummary()]);
    };

    // 筛选条件变化时自动重新加载
    watch(filters, () => {
        loadData();
    });

    return {
        items,
        summary,
        loading,
        error,
        filters,
        availableFilters,
        loadData,
        loadSummary,
        exportCSV,
        init,
    };
}
