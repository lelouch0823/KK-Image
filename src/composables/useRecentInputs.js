/**
 * 最近输入历史管理
 * @module composables/useRecentInputs
 */
import { ref } from 'vue';

// localStorage key 前缀
const STORAGE_PREFIX = 'kk-recent-inputs-';

// 每个字段最多存储的历史数量
const MAX_HISTORY_PER_FIELD = 5;

/**
 * 最近输入历史 composable
 * @param {string} namespace - 命名空间，用于区分不同模块的历史
 * @returns {Object}
 */
export function useRecentInputs(namespace = 'order') {
    const storageKey = `${STORAGE_PREFIX}${namespace}`;

    // 内存缓存
    const cache = ref(null);

    /**
     * 从 localStorage 加载历史数据
     * @returns {Object} 字段名到历史列表的映射
     */
    const loadFromStorage = () => {
        if (cache.value) return cache.value;

        try {
            const stored = localStorage.getItem(storageKey);
            cache.value = stored ? JSON.parse(stored) : {};
        } catch (e) {
            console.warn('Failed to load recent inputs:', e);
            cache.value = {};
        }
        return cache.value;
    };

    /**
     * 保存到 localStorage
     * @param {Object} data
     */
    const saveToStorage = (data) => {
        try {
            localStorage.setItem(storageKey, JSON.stringify(data));
            cache.value = data;
        } catch (e) {
            console.warn('Failed to save recent inputs:', e);
        }
    };

    /**
     * 获取某个字段的最近输入历史
     * @param {string} field - 字段名
     * @returns {string[]} 历史列表 (最新在前)
     */
    const getRecent = (field) => {
        const data = loadFromStorage();
        return data[field] || [];
    };

    /**
     * 保存某个字段的输入值到历史
     * @param {string} field - 字段名
     * @param {string} value - 输入值
     */
    const saveRecent = (field, value) => {
        if (!value || typeof value !== 'string') return;

        const trimmed = value.trim();
        if (!trimmed) return;

        const data = loadFromStorage();
        const list = data[field] || [];

        // 移除重复项
        const filtered = list.filter(item => item !== trimmed);

        // 添加到开头
        filtered.unshift(trimmed);

        // 限制数量
        data[field] = filtered.slice(0, MAX_HISTORY_PER_FIELD);

        saveToStorage(data);
    };

    /**
     * 批量保存多个字段的值
     * @param {Object} fields - 字段名到值的映射
     */
    const saveMultiple = (fields) => {
        if (!fields || typeof fields !== 'object') return;

        Object.entries(fields).forEach(([field, value]) => {
            if (value) {
                saveRecent(field, value);
            }
        });
    };

    /**
     * 清除所有历史
     */
    const clearAll = () => {
        try {
            localStorage.removeItem(storageKey);
            cache.value = {};
        } catch (e) {
            console.warn('Failed to clear recent inputs:', e);
        }
    };

    /**
     * 清除某个字段的历史
     * @param {string} field
     */
    const clearField = (field) => {
        const data = loadFromStorage();
        delete data[field];
        saveToStorage(data);
    };

    return {
        getRecent,
        saveRecent,
        saveMultiple,
        clearAll,
        clearField
    };
}
