/**
 * 搜索历史管理
 * @module composables/useSearchHistory
 */
import { ref } from 'vue';
import { storageGet, storageSet, storageRemove, addToHistoryList } from '@/utils/storage';

const STORAGE_PREFIX = 'kk-search-history-';
const MAX_HISTORY = 5;

/**
 * 搜索历史 composable
 * @param {string} namespace - 命名空间
 * @returns {Object}
 */
export function useSearchHistory(namespace = 'orders') {
  const storageKey = `${STORAGE_PREFIX}${namespace}`;
  const history = ref([]);

  const loadHistory = () => {
    history.value = storageGet(storageKey, []);
  };

  const saveHistory = () => {
    storageSet(storageKey, history.value);
  };

  const addHistory = (query) => {
    history.value = addToHistoryList(history.value, query, MAX_HISTORY);
    saveHistory();
  };

  const getHistory = () => {
    if (history.value.length === 0) loadHistory();
    return history.value;
  };

  const clearHistory = () => {
    history.value = [];
    storageRemove(storageKey);
  };

  const removeHistory = (query) => {
    history.value = history.value.filter((item) => item !== query);
    saveHistory();
  };

  loadHistory();

  return { history, addHistory, getHistory, clearHistory, removeHistory };
}
