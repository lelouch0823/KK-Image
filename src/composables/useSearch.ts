import { ref, watch, onScopeDispose } from 'vue';
import { useAuth } from '@/composables/useAuth';
import { extractErrorMessage } from '@/utils/api-helpers';

interface SearchResponse {
    success: boolean;
    data?: unknown[];
}

// 模块级共享 ref - FileManagerToolbar（输入端）和 FileManager/index.vue（消费端）共享同一 searchQuery
const searchQuery = ref<string>('');
const searchResults = ref<unknown[]>([]);
const isSearching = ref<boolean>(false);
const searchError = ref<string | null>(null);

let sharedSearchTimeout: ReturnType<typeof setTimeout> | null = null;
let watcherRefCount = 0;
let stopSharedWatch: (() => void) | null = null;

const performSearch = async (query: string, authFetch: (url: string) => Promise<Response>): Promise<void> => {
    if (!query) {
        searchResults.value = [];
        searchError.value = null;
        return;
    }

    isSearching.value = true;
    searchError.value = null;
    try {
        const res = await authFetch(`/api/manage/search?q=${encodeURIComponent(query)}`);
        const data: SearchResponse = await res.json() as SearchResponse;
        if (data.success) {
            searchResults.value = data.data ?? [];
        } else {
            searchResults.value = [];
        }
    } catch (err: unknown) {
        console.error('Search failed', err);
        searchError.value = extractErrorMessage(err, '搜索失败');
        searchResults.value = [];
    } finally {
        isSearching.value = false;
    }
};

export function useSearch() {
    const { authFetch } = useAuth();

    // 引用计数：确保 watch 只注册一次，所有组件卸载后才清理
    watcherRefCount++;
    if (!stopSharedWatch) {
        stopSharedWatch = watch(searchQuery, (newVal: string) => {
            if (sharedSearchTimeout) clearTimeout(sharedSearchTimeout);
            sharedSearchTimeout = setTimeout(() => {
                performSearch(newVal, authFetch);
            }, 400);
        });
    }

    onScopeDispose(() => {
        watcherRefCount--;
        if (watcherRefCount <= 0 && stopSharedWatch) {
            if (sharedSearchTimeout) clearTimeout(sharedSearchTimeout);
            sharedSearchTimeout = null;
            stopSharedWatch();
            stopSharedWatch = null;
            watcherRefCount = 0;
        }
    });

    return {
        searchQuery,
        searchResults,
        isSearching,
        searchError,
        performSearch: (query: string) => performSearch(query, authFetch),
    };
}
