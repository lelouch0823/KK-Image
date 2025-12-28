import { ref } from 'vue';

const searchQuery = ref('');

export function useSearch() {
    return {
        searchQuery
    };
}
