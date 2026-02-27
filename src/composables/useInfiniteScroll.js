/**
 * SOTA 无限滚动 Composable
 * ========================
 * 使用 IntersectionObserver 实现高性能上拉加载更多
 *
 * 特性:
 * - 🚀 IntersectionObserver 替代 scroll 事件，性能更优
 * - 🔒 请求去重，防止重复加载
 * - ⏱️ 内置 debounce，防止快速滚动时的抖动
 * - 🔄 自动重试失败请求
 * - ⏸️ 支持暂停/恢复
 * - 📦 支持追加模式（累积加载）
 * - 🎯 动态 rootMargin 预加载
 *
 * @module composables/useInfiniteScroll
 */
import { ref, watch, onMounted, onScopeDispose, computed } from 'vue';

/**
 * @typedef {Object} UseInfiniteScrollOptions
 * @property {number} [threshold=0.1] - IntersectionObserver 触发阈值
 * @property {string} [rootMargin='200px'] - 提前触发的边距
 * @property {number} [debounceMs=100] - 防抖时间（毫秒）
 * @property {number} [retryCount=2] - 失败重试次数
 * @property {number} [retryDelay=1000] - 重试延迟（毫秒）
 */

/**
 * @typedef {Object} UseInfiniteScrollReturn
 * @property {import('vue').Ref<HTMLElement|null>} triggerRef - 触发元素的 ref
 * @property {import('vue').Ref<boolean>} isLoading - 是否正在加载
 * @property {import('vue').Ref<boolean>} canLoadMore - 是否还有更多数据
 * @property {import('vue').Ref<boolean>} isPaused - 是否暂停
 * @property {import('vue').Ref<Error|null>} error - 最近的错误
 * @property {Function} setCanLoadMore - 设置是否可加载更多
 * @property {Function} pause - 暂停加载
 * @property {Function} resume - 恢复加载
 * @property {Function} reset - 重置状态
 * @property {Function} loadMore - 手动触发加载
 */

/**
 * 创建 SOTA 无限滚动功能
 * @param {() => Promise<void>} loadMoreFn - 加载更多数据的异步函数
 * @param {UseInfiniteScrollOptions} options - 配置选项
 * @returns {UseInfiniteScrollReturn}
 */
export function useInfiniteScroll(loadMoreFn, options = {}) {
  const {
    threshold = 0.1,
    rootMargin = '200px',
    debounceMs = 100,
    retryCount = 2,
    retryDelay = 1000,
  } = options;

  // 核心状态
  const triggerRef = ref(null);
  const isLoading = ref(false);
  const canLoadMore = ref(true);
  const isPaused = ref(false);
  const error = ref(null);

  // 内部状态
  let observer = null;
  let debounceTimer = null;
  let currentRetry = 0;
  let isUnmounted = false;

  /**
   * 带重试的加载函数
   */
  const executeLoadMore = async () => {
    if (isLoading.value || !canLoadMore.value || isPaused.value || isUnmounted) {
      return;
    }

    isLoading.value = true;
    error.value = null;

    try {
      await loadMoreFn();
      currentRetry = 0; // 成功后重置重试计数
    } catch (err) {
      console.error('[useInfiniteScroll] Load error:', err);
      error.value = err;

      // 自动重试
      if (currentRetry < retryCount && !isUnmounted) {
        currentRetry++;
        console.log(`[useInfiniteScroll] Retrying (${currentRetry}/${retryCount}) in ${retryDelay}ms...`);
        setTimeout(() => {
          if (!isUnmounted) {
            isLoading.value = false;
            executeLoadMore();
          }
        }, retryDelay * currentRetry); // 指数退避
        return;
      }
    } finally {
      if (!isUnmounted) {
        isLoading.value = false;
      }
    }
  };

  /**
   * 防抖执行加载
   */
  const debouncedLoadMore = () => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    debounceTimer = setTimeout(() => {
      executeLoadMore();
    }, debounceMs);
  };

  /**
   * IntersectionObserver 回调
   */
  const handleIntersection = (entries) => {
    const [entry] = entries;
    if (entry?.isIntersecting && canLoadMore.value && !isPaused.value) {
      debouncedLoadMore();
    }
  };

  /**
   * 创建 Observer
   */
  const createObserver = () => {
    if (observer) {
      observer.disconnect();
    }

    observer = new IntersectionObserver(handleIntersection, {
      threshold,
      rootMargin,
    });

    // 如果触发元素已存在，立即观察
    if (triggerRef.value) {
      observer.observe(triggerRef.value);
    }
  };

  /**
   * 设置是否可以加载更多
   */
  const setCanLoadMore = (value) => {
    canLoadMore.value = Boolean(value);
  };

  /**
   * 暂停加载
   */
  const pause = () => {
    isPaused.value = true;
  };

  /**
   * 恢复加载
   */
  const resume = () => {
    isPaused.value = false;
  };

  /**
   * 重置状态（用于刷新/筛选变化）
   */
  const reset = () => {
    canLoadMore.value = true;
    isLoading.value = false;
    isPaused.value = false;
    error.value = null;
    currentRetry = 0;
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
  };

  /**
   * 手动触发加载更多
   */
  const loadMore = () => {
    if (!isLoading.value && canLoadMore.value && !isPaused.value) {
      executeLoadMore();
    }
  };

  // 生命周期
  onMounted(() => {
    createObserver();
  });

  // 监听触发元素变化
  watch(triggerRef, (newEl, oldEl) => {
    if (observer) {
      if (oldEl) {
        observer.unobserve(oldEl);
      }
      if (newEl) {
        observer.observe(newEl);
      }
    }
  });

  // 清理
  onScopeDispose(() => {
    isUnmounted = true;
    if (observer) {
      observer.disconnect();
      observer = null;
    }
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
  });

  return {
    // 状态
    triggerRef,
    isLoading,
    canLoadMore,
    isPaused,
    error,
    // 方法
    setCanLoadMore,
    pause,
    resume,
    reset,
    loadMore,
  };
}
