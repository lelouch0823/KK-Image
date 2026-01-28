/**
 * 虚拟滚动 Composable
 * 用于处理长列表的性能优化，只渲染可见区域的项目
 * @module composables/useVirtualScroll
 */
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';

/**
 * @param {Object} options - 配置选项
 * @param {number} options.itemHeight - 每个项目的高度 (px)
 * @param {number} options.bufferSize - 缓冲区大小 (上下各多渲染多少个项目)
 * @param {Ref<Array>} options.items - 数据源
 * @returns {Object} 虚拟滚动状态和方法
 */
export function useVirtualScroll(options) {
  const {
    itemHeight = 100,
    bufferSize = 3,
    items,
  } = options;

  const scrollTop = ref(0);
  const containerHeight = ref(0);

  // 计算可见范围
  const visibleRange = computed(() => {
    const total = items.value.length;
    if (total === 0) return { start: 0, end: 0 };

    const startIdx = Math.max(0, Math.floor(scrollTop.value / itemHeight) - bufferSize);
    const visibleCount = Math.ceil(containerHeight.value / itemHeight);
    const endIdx = Math.min(total, startIdx + visibleCount + bufferSize * 2);

    return { start: startIdx, end: endIdx };
  });

  // 可见项目
  const visibleItems = computed(() => {
    const { start, end } = visibleRange.value;
    return items.value.slice(start, end).map((item, index) => ({
      ...item,
      _virtualIndex: start + index,
    }));
  });

  // 占位高度 (上方)
  const offsetTop = computed(() => visibleRange.value.start * itemHeight);

  // 总高度
  const totalHeight = computed(() => items.value.length * itemHeight);

  // 滚动处理
  const handleScroll = (e) => {
    scrollTop.value = e.target.scrollTop || window.scrollY || document.documentElement.scrollTop;
  };

  // 容器大小处理
  const handleResize = () => {
    containerHeight.value = window.innerHeight;
  };

  onMounted(() => {
    handleResize();
    window.addEventListener('resize', handleResize);
  });

  onUnmounted(() => {
    window.removeEventListener('resize', handleResize);
  });

  return {
    visibleItems,
    offsetTop,
    totalHeight,
    handleScroll,
    visibleRange,
  };
}
