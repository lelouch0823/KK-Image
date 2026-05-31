/**
 * 最近输入历史管理
 * @module composables/useRecentInputs
 */
import { ref, type Ref } from 'vue';
import { storageGet, storageSet, storageRemove, addToHistoryList } from '@/utils/storage';

const STORAGE_PREFIX = 'kk-recent-inputs-';
const MAX_HISTORY_PER_FIELD = 5;

interface RecentInputsData {
  [field: string]: string[];
}

/**
 * 最近输入历史 composable
 * @param namespace - 命名空间
 */
export function useRecentInputs(namespace = 'order') {
  const storageKey = `${STORAGE_PREFIX}${namespace}`;
  const cache: Ref<RecentInputsData | null> = ref(null);

  const loadFromStorage = (): RecentInputsData => {
    if (cache.value) return cache.value;
    cache.value = storageGet(storageKey, {});
    return cache.value;
  };

  const saveToStorage = (data: RecentInputsData): void => {
    storageSet(storageKey, data);
    cache.value = data;
  };

  const getRecent = (field: string): string[] => {
    const data = loadFromStorage();
    return data[field] || [];
  };

  const saveRecent = (field: string, value: string): void => {
    const data = loadFromStorage();
    data[field] = addToHistoryList(data[field] || [], value, MAX_HISTORY_PER_FIELD);
    saveToStorage(data);
  };

  const saveMultiple = (fields: Record<string, string>): void => {
    if (!fields || typeof fields !== 'object') return;
    const data = loadFromStorage();
    for (const [field, value] of Object.entries(fields)) {
      if (value) {
        data[field] = addToHistoryList(data[field] || [], value, MAX_HISTORY_PER_FIELD);
      }
    }
    saveToStorage(data);
  };

  const clearAll = (): void => {
    storageRemove(storageKey);
    cache.value = {};
  };

  const clearField = (field: string): void => {
    const data = loadFromStorage();
    delete data[field];
    saveToStorage(data);
  };

  return { getRecent, saveRecent, saveMultiple, clearAll, clearField };
}
