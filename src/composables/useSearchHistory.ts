/**
 * 搜索历史管理
 * @module composables/useSearchHistory
 */
import { ref, type Ref } from 'vue';
import { storageGet, storageSet, storageRemove, addToHistoryList } from '@/utils/storage';

const STORAGE_PREFIX = 'kk-search-history-';
const MAX_HISTORY = 5;

/**
 * 搜索历史 composable
 * @param namespace - 命名空间
 */
export function useSearchHistory(namespace = 'orders') {
  const storageKey = `${STORAGE_PREFIX}${namespace}`;
  const history: Ref<string[]> = ref([]);

  const loadHistory = (): void => {
    history.value = storageGet(storageKey, []);
  };

  const saveHistory = (): void => {
    storageSet(storageKey, history.value);
  };

  const addHistory = (query: string): void => {
    history.value = addToHistoryList(history.value, query, MAX_HISTORY);
    saveHistory();
  };

  const getHistory = (): string[] => {
    if (history.value.length === 0) loadHistory();
    return history.value;
  };

  const clearHistory = (): void => {
    history.value = [];
    storageRemove(storageKey);
  };

  const removeHistory = (query: string): void => {
    history.value = history.value.filter((item) => item !== query);
    saveHistory();
  };

  loadHistory();

  return { history, addHistory, getHistory, clearHistory, removeHistory };
}
