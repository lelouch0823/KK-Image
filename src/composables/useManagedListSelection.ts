import { getCurrentInstance, onBeforeUnmount, ref, type Ref } from 'vue';

interface HasId {
  id?: string | null;
  [key: string]: unknown;
}

interface SelectionOptions {
  highlightDuration?: number;
}

interface RowClassOptions {
  selectedClass?: string;
  highlightClass?: string;
}

interface HandleCreatedOptions {
  createdId?: string | null;
  resetToFirstPage?: () => void;
  reload?: () => Promise<void>;
  getItems?: () => HasId[];
  openDetail?: (item: HasId) => void;
  onHiddenByFilters?: (id: string) => void;
  autoOpen?: boolean;
}

function normalizeId(itemOrId: HasId | string | null | undefined): string | null {
  if (!itemOrId) return null;
  if (typeof itemOrId === 'string') return itemOrId;
  return (itemOrId as HasId).id ?? null;
}

export function useManagedListSelection(options: SelectionOptions = {}) {
  const selectedId: Ref<string | null> = ref(null);
  const highlightedId: Ref<string | null> = ref(null);
  const defaultHighlightDuration = Number(options.highlightDuration) || 3000;
  let highlightTimer: ReturnType<typeof setTimeout> | null = null;

  const clearHighlightTimer = (): void => {
    if (highlightTimer) {
      clearTimeout(highlightTimer);
      highlightTimer = null;
    }
  };

  const selectItem = (itemOrId: HasId | string | null | undefined): void => {
    selectedId.value = normalizeId(itemOrId);
  };

  const clearSelection = (): void => {
    selectedId.value = null;
  };

  const markHighlighted = (id: string | null | undefined, duration = defaultHighlightDuration): void => {
    clearHighlightTimer();
    highlightedId.value = id || null;

    if (!id) return;

    highlightTimer = setTimeout(() => {
      highlightedId.value = null;
      highlightTimer = null;
    }, duration);
  };

  const getRowClass = (
    row: HasId | null | undefined,
    {
      selectedClass = 'bg-(--color-primary-bg)/50',
      highlightClass = 'ring-1 ring-(--color-primary)/40 bg-(--color-primary-bg)/35',
    }: RowClassOptions = {}
  ): string => {
    const classes: string[] = [];

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
  }: HandleCreatedOptions = {}): Promise<HasId | null> => {
    if (!createdId) return null;

    resetToFirstPage?.();
    await reload?.();

    const items = Array.isArray(getItems?.()) ? getItems!() : [];
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
