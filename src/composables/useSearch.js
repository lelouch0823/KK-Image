import { ref, watch } from 'vue';

const searchQuery = ref('');
const searchResults = ref([]);
const isSearching = ref(false);

let searchTimeout = null;

const performSearch = async (query) => {
    if (!query) {
        searchResults.value = [];
        return;
    }

    isSearching.value = true;
    try {
        const res = await fetch(`/api/manage/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        if (data.success) {
            searchResults.value = data.data;
        } else {
            searchResults.value = [];
        }
    } catch (err) {
        console.error('Search failed', err);
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
        performSearch
    };
}
