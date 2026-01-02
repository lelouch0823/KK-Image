/**
 * 搜索历史管理
 * @module composables/useSearchHistory
 */
import { ref } from 'vue';

// localStorage key 前缀
const STORAGE_PREFIX = 'kk-search-history-';

// 最多存储的历史数量
const MAX_HISTORY = 5;

/**
 * 搜索历史 composable
 * @param {string} namespace - 命名空间，用于区分不同模块的历史
 * @returns {Object}
 */
export function useSearchHistory(namespace = 'orders') {
  const storageKey = `${STORAGE_PREFIX}${namespace}`;

  // 历史列表
  const history = ref([]);

  /**
   * 从 localStorage 加载历史
   */
  const loadHistory = () => {
    try {
      const stored = localStorage.getItem(storageKey);
      history.value = stored ? JSON.parse(stored) : [];
    } catch (e) {
      console.warn('Failed to load search history:', e);
      history.value = [];
    }
  };

  /**
   * 保存到 localStorage
   */
  const saveHistory = () => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(history.value));
    } catch (e) {
      console.warn('Failed to save search history:', e);
    }
  };

  /**
   * 添加搜索历史
   * @param {string} query - 搜索词
   */
  const addHistory = (query) => {
    if (!query || typeof query !== 'string') return;

    const trimmed = query.trim();
    if (!trimmed) return;

    // 移除重复项
    const filtered = history.value.filter((item) => item !== trimmed);

    // 添加到开头
    filtered.unshift(trimmed);

    // 限制数量
    history.value = filtered.slice(0, MAX_HISTORY);

    saveHistory();
  };

  /**
   * 获取历史列表
   * @returns {string[]}
   */
  const getHistory = () => {
    if (history.value.length === 0) {
      loadHistory();
    }
    return history.value;
  };

  /**
   * 清除所有历史
   */
  const clearHistory = () => {
    history.value = [];
    try {
      localStorage.removeItem(storageKey);
    } catch (e) {
      console.warn('Failed to clear search history:', e);
    }
  };

  /**
   * 删除单条历史
   * @param {string} query
   */
  const removeHistory = (query) => {
    history.value = history.value.filter((item) => item !== query);
    saveHistory();
  };

  // 初始化加载
  loadHistory();

  return {
    history,
    addHistory,
    getHistory,
    clearHistory,
    removeHistory,
  };
}
