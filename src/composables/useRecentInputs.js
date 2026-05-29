/**
 * 最近输入历史管理
 * @module composables/useRecentInputs
 */
import { ref } from 'vue';
import { storageGet, storageSet, storageRemove, addToHistoryList } from '@/utils/storage';

const STORAGE_PREFIX = 'kk-recent-inputs-';
const MAX_HISTORY_PER_FIELD = 5;

/**
 * 最近输入历史 composable
 * @param {string} namespace - 命名空间
 * @returns {Object}
 */
export function useRecentInputs(namespace = 'order') {
  const storageKey = `${STORAGE_PREFIX}${namespace}`;
  const cache = ref(null);

  const loadFromStorage = () => {
    if (cache.value) return cache.value;
    cache.value = storageGet(storageKey, {});
    return cache.value;
  };

  const saveToStorage = (data) => {
    storageSet(storageKey, data);
    cache.value = data;
  };

  const getRecent = (field) => {
    const data = loadFromStorage();
    return data[field] || [];
  };

  const saveRecent = (field, value) => {
    const data = loadFromStorage();
    data[field] = addToHistoryList(data[field] || [], value, MAX_HISTORY_PER_FIELD);
    saveToStorage(data);
  };

  const saveMultiple = (fields) => {
    if (!fields || typeof fields !== 'object') return;
    const data = loadFromStorage();
    for (const [field, value] of Object.entries(fields)) {
      if (value) {
        data[field] = addToHistoryList(data[field] || [], value, MAX_HISTORY_PER_FIELD);
      }
    }
    saveToStorage(data);
  };

  const clearAll = () => {
    storageRemove(storageKey);
    cache.value = {};
  };

  const clearField = (field) => {
    const data = loadFromStorage();
    delete data[field];
    saveToStorage(data);
  };

  return { getRecent, saveRecent, saveMultiple, clearAll, clearField };
}
