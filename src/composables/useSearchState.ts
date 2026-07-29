import { ref, watch, onScopeDispose } from 'vue';

/**
 * 轻量搜索状态 composable（不绑定 API）
 *
 * 提供响应式 searchQuery + 可选 debounce 的 debouncedQuery。
 * 适用于列表页、Picker 等需要本地搜索状态的场景。
 *
 * @example
 * const { searchQuery, debouncedQuery, clearSearch } = useSearchState();
 * watch(debouncedQuery, () => loadItems());
 */

interface SearchStateOptions {
  /** debounce 延迟毫秒数，默认 300ms */
  debounceMs?: number;
}

export function useSearchState(options: SearchStateOptions = {}) {
  const searchQuery = ref('');
  const debouncedQuery = ref('');
  const debounceMs = options.debounceMs ?? 300;

  let timer: ReturnType<typeof setTimeout> | null = null;

  watch(searchQuery, (val) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      debouncedQuery.value = val;
    }, debounceMs);
  });

  onScopeDispose(() => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  });

  const clearSearch = () => {
    searchQuery.value = '';
    debouncedQuery.value = '';
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  };

  return {
    searchQuery,
    debouncedQuery,
    clearSearch,
  };
}
