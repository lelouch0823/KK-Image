import { ref, computed, type Ref } from 'vue';

/** 可选择项接口 */
interface SelectableItem {
    id: string;
    [key: string]: unknown;
}

export function useFileSelection(displayedItems: Ref<SelectableItem[]>) {
    const selectedIds = ref<Set<string>>(new Set());

    const toggleSelect = (item: SelectableItem): void => {
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
            displayedItems.value.forEach((f) => selectedIds.value.add(f.id));
        }
    };

    const clearSelection = (): void => {
        selectedIds.value.clear();
    };

    const selectedCount = computed(() => selectedIds.value.size);

    const getSelectedItems = (): SelectableItem[] => {
        return displayedItems.value.filter((item) => selectedIds.value.has(item.id));
    };

    const getSelectedIdsArray = (): string[] => {
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
