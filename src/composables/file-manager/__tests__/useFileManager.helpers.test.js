import { describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';
import { useFileDrag } from '../useFileDrag.js';
import { useFileNavigation } from '../useFileNavigation.js';
import { useFileSelection } from '../useFileSelection.js';

describe('file manager helper composables', () => {
  it('navigates into folders and clears selection when provided', () => {
    const loadFolderData = vi.fn();
    const clearSelection = vi.fn();
    const { navigateTo } = useFileNavigation(loadFolderData, clearSelection);

    navigateTo('folder-1');

    expect(clearSelection).toHaveBeenCalledOnce();
    expect(loadFolderData).toHaveBeenCalledWith('folder-1');
  });

  it('navigates without requiring a clear-selection callback', () => {
    const loadFolderData = vi.fn();
    const { navigateTo } = useFileNavigation(loadFolderData);

    navigateTo('folder-2');

    expect(loadFolderData).toHaveBeenCalledWith('folder-2');
  });

  it('toggles, selects, clears, and exposes selected file state', () => {
    const displayedItems = ref([
      { id: 'file-1', name: 'A' },
      { id: 'file-2', name: 'B' },
      { id: 'file-3', name: 'C' },
    ]);
    const selection = useFileSelection(displayedItems);

    selection.toggleSelect({ id: 'file-1' });
    selection.toggleSelect({ id: 'file-2' });

    expect(selection.selectedCount.value).toBe(2);
    expect(selection.getSelectedIdsArray()).toEqual(['file-1', 'file-2']);
    expect(selection.getSelectedItems()).toEqual([
      { id: 'file-1', name: 'A' },
      { id: 'file-2', name: 'B' },
    ]);

    selection.toggleSelect({ id: 'file-1' });
    expect(selection.getSelectedIdsArray()).toEqual(['file-2']);

    selection.selectAll();
    expect(selection.selectedCount.value).toBe(3);

    selection.selectAll();
    expect(selection.selectedCount.value).toBe(0);

    selection.toggleSelect({ id: 'file-3' });
    selection.clearSelection();
    expect(selection.getSelectedIdsArray()).toEqual([]);
  });

  it('tracks drag state only inside a folder and forwards dropped files', () => {
    const currentFolder = ref({ id: 'folder-1' });
    const onFilesDropped = vi.fn();
    const preventDefault = vi.fn();
    const fileA = { name: 'a.png' };
    const fileB = { name: 'b.png' };
    const drag = useFileDrag(currentFolder, onFilesDropped);

    drag.onDragEnter({ preventDefault });
    drag.onDragEnter({ preventDefault });
    expect(drag.isDragging.value).toBe(true);

    drag.onDragLeave({ preventDefault });
    expect(drag.isDragging.value).toBe(true);

    drag.onDragOver({ preventDefault });
    drag.onDrop({
      preventDefault,
      dataTransfer: { files: [fileA, fileB] },
    });

    expect(onFilesDropped).toHaveBeenCalledWith([fileA, fileB]);
    expect(drag.isDragging.value).toBe(false);
  });

  it('ignores drag activation and drop uploads when no folder is active', () => {
    const currentFolder = ref(null);
    const onFilesDropped = vi.fn();
    const preventDefault = vi.fn();
    const drag = useFileDrag(currentFolder, onFilesDropped);

    drag.onDragEnter({ preventDefault });
    expect(drag.isDragging.value).toBe(false);

    drag.onDrop({
      preventDefault,
      dataTransfer: { files: [{ name: 'x.png' }] },
    });

    expect(onFilesDropped).not.toHaveBeenCalled();
    expect(drag.isDragging.value).toBe(false);
  });

  it('turns off drag state when the last drag leave event fires', () => {
    const currentFolder = ref({ id: 'folder-3' });
    const drag = useFileDrag(currentFolder, vi.fn());
    const preventDefault = vi.fn();

    drag.onDragEnter({ preventDefault });
    expect(drag.isDragging.value).toBe(true);

    drag.onDragLeave({ preventDefault });
    expect(drag.isDragging.value).toBe(false);
  });
});
