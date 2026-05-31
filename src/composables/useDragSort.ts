import { ref, type Ref } from 'vue';

interface DragSortOptions<T> {
  onReorder?: (newItems: T[], fromIndex: number, toIndex: number) => void;
}

/**
 * 拖拽排序 Composable
 * 用于列表项目的拖拽重排序
 */
export function useDragSort<T>(items: Ref<T[]>, options: DragSortOptions<T> = {}) {
  const { onReorder } = options;

  const dragIndex: Ref<number | null> = ref(null);
  const dragOverIndex: Ref<number | null> = ref(null);

  // 触摸设备状态
  let touchStartTimer: ReturnType<typeof setTimeout> | null = null;
  let touchDragIndex: number | null = null;

  // ========== 桌面端拖拽 ==========

  const handleDragStart = (index: number, e: DragEvent): void => {
    dragIndex.value = index;
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', String(index));
    }
  };

  const handleDragEnd = (): void => {
    dragIndex.value = null;
    dragOverIndex.value = null;
  };

  const handleDragOver = (index: number): void => {
    if (dragIndex.value !== null && dragIndex.value !== index) {
      dragOverIndex.value = index;
    }
  };

  const handleDragLeave = (): void => {
    dragOverIndex.value = null;
  };

  const handleDrop = (targetIndex: number): void => {
    if (dragIndex.value === null || dragIndex.value === targetIndex) {
      return;
    }

    const newItems = [...items.value];
    const [removed] = newItems.splice(dragIndex.value, 1);
    newItems.splice(targetIndex, 0, removed);

    // SOTA: Do NOT mutate items.value directly if it's a computed property.
    // Component should rely on onReorder callback or emit to update parent state.
    // items.value = newItems; // Removed mutation

    if (onReorder) {
      onReorder(newItems, dragIndex.value, targetIndex);
    }

    dragIndex.value = null;
    dragOverIndex.value = null;
  };

  // ========== 移动端触摸拖拽 ==========

  const handleTouchStart = (index: number, _e: TouchEvent): void => {
    // 长按 500ms 触发拖拽
    touchStartTimer = setTimeout(() => {
      touchDragIndex = index;
      dragIndex.value = index;
      // 添加触觉反馈
      if (navigator.vibrate) {
        navigator.vibrate(50);
      }
    }, 500);
  };

  const handleTouchMove = (e: TouchEvent): void => {
    if (touchDragIndex === null) return;

    const touch = e.touches[0];
    const element = document.elementFromPoint(touch.clientX, touch.clientY);

    if (element) {
      const sortableItem = element.closest('[data-sortable-index]');
      if (sortableItem) {
        const index = parseInt((sortableItem as HTMLElement).dataset.sortableIndex || '', 10);
        if (!isNaN(index) && index !== touchDragIndex) {
          dragOverIndex.value = index;
        }
      }
    }
  };

  const handleTouchEnd = (): void => {
    if (touchStartTimer) {
      clearTimeout(touchStartTimer);
    }

    if (touchDragIndex !== null && dragOverIndex.value !== null) {
      handleDrop(dragOverIndex.value);
    }

    touchDragIndex = null;
    dragIndex.value = null;
    dragOverIndex.value = null;
  };

  // 获取拖拽项目的类名
  const getDragClass = (index: number): string => {
    if (dragIndex.value === index) {
      return 'opacity-50 scale-95';
    }
    if (dragOverIndex.value === index) {
      return 'ring-2 ring-primary ring-offset-2';
    }
    return '';
  };

  return {
    dragIndex,
    dragOverIndex,
    getDragClass,
    // 桌面端事件
    handleDragStart,
    handleDragEnd,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    // 移动端事件
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
  };
}
