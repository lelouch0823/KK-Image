import { ref, computed } from 'vue';

export function useFileSelection(displayedItems) {
    const selectedIds = ref(new Set());

    const toggleSelect = (item) => {
        if (selectedIds.value.has(item.id)) {
            selectedIds.value.delete(item.id);
        } else {
            selectedIds.value.add(item.id);
        }
    };

    const selectAll = () => {
        if (selectedIds.value.size === displayedItems.value.length) {
            selectedIds.value.clear();
        } else {
            displayedItems.value.forEach((f) => selectedIds.value.add(f.id));
        }
    };

    const clearSelection = () => {
        selectedIds.value.clear();
    };

    const selectedCount = computed(() => selectedIds.value.size);

    const getSelectedItems = () => {
        return displayedItems.value.filter(item => selectedIds.value.has(item.id));
    };

    const getSelectedIdsArray = () => {
        return Array.from(selectedIds.value);
    }

    return {
        selectedIds,
        selectedCount, // Exposed for convenience
        toggleSelect,
        selectAll,
        clearSelection,
        getSelectedItems,
        getSelectedIdsArray
    };
}
