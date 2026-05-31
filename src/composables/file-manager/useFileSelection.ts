import { ref, computed, type Ref } from 'vue';

export function useFileSelection(displayedItems: Ref<any[]>) {
    const selectedIds = ref<Set<any>>(new Set());

    const toggleSelect = (item: any): void => {
        if (selectedIds.value.has(item.id)) {
            selectedIds.value.delete(item.id);
        } else {
            selectedIds.value.add(item.id);
        }
    };

    const selectAll = (): void => {
        if (selectedIds.value.size === displayedItems.value.length) {
            selectedIds.value.clear();
        } else {
            displayedItems.value.forEach((f: any) => selectedIds.value.add(f.id));
        }
    };

    const clearSelection = (): void => {
        selectedIds.value.clear();
    };

    const selectedCount = computed(() => selectedIds.value.size);

    const getSelectedItems = (): any[] => {
        return displayedItems.value.filter((item: any) => selectedIds.value.has(item.id));
    };

    const getSelectedIdsArray = (): any[] => {
        return Array.from(selectedIds.value);
    };

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
