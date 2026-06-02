import { ref, watch, onUnmounted, type Ref } from 'vue';
import { useAuth } from '@/composables/useAuth';

interface AutocompleteOptions<T = unknown> {
  /** 搜索 API 路径，如 '/api/manage/customers/suggest' */
  fetchUrl: string;
  /** 触发搜索的最小字符数 */
  minChars?: number;
  /** 防抖延迟（毫秒） */
  debounce?: number;
  /** 将 API 返回的条目映射为 { value, label } */
  mapItem?: (item: T) => { value: string; label: string; raw: T };
}

interface SuggestionItem<T = unknown> {
  value: string;
  label: string;
  raw: T;
}

/**
 * 自动补全 Composable
 * 封装防抖搜索、加载状态、建议列表管理
 */
export function useAutocomplete<T = unknown>(options: AutocompleteOptions<T>) {
  const { fetchUrl, minChars = 2, debounce = 300, mapItem } = options;

  const { authFetch } = useAuth();

  const suggestions: Ref<SuggestionItem<T>[]> = ref([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let abortController: AbortController | null = null;

  /** 默认映射：假设 API 返回 { id, name, ... } */
  const defaultMapItem = (item: T): SuggestionItem<T> => {
    const obj = item as Record<string, unknown>;
    return {
      value: String(obj.id ?? ''),
      label: String(obj.name ?? ''),
      raw: item,
    };
  };

  const mapper = mapItem ?? defaultMapItem;

  /** 执行搜索 */
  async function search(query: string): Promise<void> {
    if (!query || query.trim().length < minChars) {
      suggestions.value = [];
      return;
    }

    // 取消上一次未完成的请求
    if (abortController) {
      abortController.abort();
    }
    abortController = new AbortController();

    loading.value = true;
    error.value = null;

    try {
      const url = `${fetchUrl}?q=${encodeURIComponent(query.trim())}`;
      const res = await authFetch(url, { signal: abortController.signal });
      const json = await res.json();

      if (json.success && Array.isArray(json.data)) {
        suggestions.value = json.data.map(mapper);
      } else {
        suggestions.value = [];
      }
    } catch (err: unknown) {
      // 忽略被取消的请求
      if (err instanceof DOMException && err.name === 'AbortError') return;
      console.error('Autocomplete fetch error:', err);
      error.value = (err as Error).message || '搜索失败';
      suggestions.value = [];
    } finally {
      loading.value = false;
    }
  }

  /** 防抖搜索 */
  function debouncedSearch(query: string): void {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    if (!query || query.trim().length < minChars) {
      suggestions.value = [];
      return;
    }
    debounceTimer = setTimeout(() => {
      search(query);
    }, debounce);
  }

  /** 清空建议 */
  function clear(): void {
    suggestions.value = [];
    error.value = null;
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    if (abortController) {
      abortController.abort();
    }
  }

  onUnmounted(() => {
    if (debounceTimer) clearTimeout(debounceTimer);
    if (abortController) abortController.abort();
  });

  return {
    suggestions,
    loading,
    error,
    search,
    debouncedSearch,
    clear,
  };
}
