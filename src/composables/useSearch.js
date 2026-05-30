import { ref, watch } from 'vue';
import { useAuth } from '@/composables/useAuth';
import { extractErrorMessage } from '@/utils/api-helpers';

const searchQuery = ref('');
const searchResults = ref([]);
const isSearching = ref(false);
const searchError = ref(null);

let searchTimeout = null;
const { authFetch } = useAuth();

const performSearch = async (query) => {
    if (!query) {
        searchResults.value = [];
        searchError.value = null;
        return;
    }

    isSearching.value = true;
    searchError.value = null;
    try {
        const res = await authFetch(`/api/manage/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        if (data.success) {
            searchResults.value = data.data;
        } else {
            searchResults.value = [];
        }
    } catch (err) {
        console.error('Search failed', err);
        searchError.value = extractErrorMessage(err, '搜索失败');
        searchResults.value = [];
    } finally {
        isSearching.value = false;
    }
};

watch(searchQuery, (newVal) => {
    if (searchTimeout) clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
        performSearch(newVal);
    }, 400);
});

export function useSearch() {
    return {
        searchQuery,
        searchResults,
        isSearching,
        searchError,
        performSearch
    };
}
