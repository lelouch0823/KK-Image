import { afterEach, describe, expect, it, vi } from 'vitest';
import { nextTick, ref } from 'vue';
import { useManagedListSelection } from '../useManagedListSelection.js';

describe('useManagedListSelection', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('stores and clears selected ids', () => {
    const { selectedId, selectItem, clearSelection } = useManagedListSelection();

    selectItem({ id: 'customer-1' });
    expect(selectedId.value).toBe('customer-1');

    clearSelection();
    expect(selectedId.value).toBeNull();
  });

  it('clears highlighted id after the timeout', async () => {
    vi.useFakeTimers();
    const { highlightedId, markHighlighted } = useManagedListSelection({ highlightDuration: 3000 });

    markHighlighted('customer-1');
    expect(highlightedId.value).toBe('customer-1');

    vi.advanceTimersByTime(3000);
    await nextTick();

    expect(highlightedId.value).toBeNull();
  });

  it('resets to the first page and opens the created item when it becomes visible', async () => {
    const items = ref([]);
    const resetToFirstPage = vi.fn();
    const openDetail = vi.fn();
    const reload = vi.fn(async () => {
      items.value = [{ id: 'customer-2', name: 'Alice' }];
    });

    const { highlightedId, selectedId, handleCreated } = useManagedListSelection();

    await handleCreated({
      createdId: 'customer-2',
      resetToFirstPage,
      reload,
      getItems: () => items.value,
      openDetail,
      autoOpen: true,
    });

    expect(resetToFirstPage).toHaveBeenCalledOnce();
    expect(reload).toHaveBeenCalledOnce();
    expect(highlightedId.value).toBe('customer-2');
    expect(selectedId.value).toBe('customer-2');
    expect(openDetail).toHaveBeenCalledWith({ id: 'customer-2', name: 'Alice' });
  });

  it('reports when active filters hide the created item', async () => {
    const onHiddenByFilters = vi.fn();
    const reload = vi.fn(async () => {});

    const { selectedId, handleCreated } = useManagedListSelection();

    await handleCreated({
      createdId: 'customer-3',
      resetToFirstPage: vi.fn(),
      reload,
      getItems: () => [{ id: 'customer-4', name: 'Bob' }],
      onHiddenByFilters,
    });

    expect(onHiddenByFilters).toHaveBeenCalledWith('customer-3');
    expect(selectedId.value).toBeNull();
  });
});
