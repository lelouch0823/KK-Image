import { getCurrentInstance, onBeforeUnmount, ref } from 'vue';

function normalizeId(itemOrId) {
  if (!itemOrId) return null;
  if (typeof itemOrId === 'string') return itemOrId;
  return itemOrId.id ?? null;
}

export function useManagedListSelection(options = {}) {
  const selectedId = ref(null);
  const highlightedId = ref(null);
  const defaultHighlightDuration = Number(options.highlightDuration) || 3000;
  let highlightTimer = null;

  const clearHighlightTimer = () => {
    if (highlightTimer) {
      clearTimeout(highlightTimer);
      highlightTimer = null;
    }
  };

  const selectItem = (itemOrId) => {
    selectedId.value = normalizeId(itemOrId);
  };

  const clearSelection = () => {
    selectedId.value = null;
  };

  const markHighlighted = (id, duration = defaultHighlightDuration) => {
    clearHighlightTimer();
    highlightedId.value = id || null;

    if (!id) return;

    highlightTimer = setTimeout(() => {
      highlightedId.value = null;
      highlightTimer = null;
    }, duration);
  };

  const getRowClass = (
    row,
    {
      selectedClass = 'bg-(--color-primary-bg)/50',
      highlightClass = 'ring-1 ring-(--color-primary)/40 bg-(--color-primary-bg)/35',
    } = {}
  ) => {
    const classes = [];

    if (selectedId.value && row?.id === selectedId.value) {
      classes.push(selectedClass);
    }
    if (highlightedId.value && row?.id === highlightedId.value) {
      classes.push(highlightClass);
    }

    return classes.join(' ').trim();
  };

  const handleCreated = async ({
    createdId,
    resetToFirstPage,
    reload,
    getItems,
    openDetail,
    onHiddenByFilters,
    autoOpen = false,
  } = {}) => {
    if (!createdId) return null;

    resetToFirstPage?.();
    await reload?.();

    const items = Array.isArray(getItems?.()) ? getItems() : [];
    const createdItem = items.find((item) => item?.id === createdId) || null;

    if (!createdItem) {
      onHiddenByFilters?.(createdId);
      return null;
    }

    markHighlighted(createdId);

    if (autoOpen && typeof openDetail === 'function') {
      selectItem(createdItem);
      openDetail(createdItem);
    }

    return createdItem;
  };

  if (getCurrentInstance()) {
    onBeforeUnmount(() => {
      clearHighlightTimer();
    });
  }

  return {
    selectedId,
    highlightedId,
    selectItem,
    clearSelection,
    markHighlighted,
    getRowClass,
    handleCreated,
  };
}
