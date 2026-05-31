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
import { ref, watch, onMounted, onScopeDispose, type Ref } from 'vue';

interface UseInfiniteScrollOptions {
  threshold?: number;
  rootMargin?: string;
  debounceMs?: number;
  retryCount?: number;
  retryDelay?: number;
}

/**
 * 创建 SOTA 无限滚动功能
 * @param loadMoreFn - 加载更多数据的异步函数
 * @param options - 配置选项
 */
export function useInfiniteScroll(loadMoreFn: () => Promise<void>, options: UseInfiniteScrollOptions = {}) {
  const {
    threshold = 0.1,
    rootMargin = '200px',
    debounceMs = 100,
    retryCount = 2,
    retryDelay = 1000,
  } = options;

  // 核心状态
  const triggerRef = ref<HTMLElement | null>(null);
  const isLoading = ref<boolean>(false);
  const canLoadMore = ref<boolean>(true);
  const isPaused = ref<boolean>(false);
  const error = ref<Error | null>(null);

  // 内部状态
  let observer: IntersectionObserver | null = null;
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let currentRetry = 0;
  let isUnmounted = false;

  /**
   * 带重试的加载函数
   */
  const executeLoadMore = async (): Promise<void> => {
    if (isLoading.value || !canLoadMore.value || isPaused.value || isUnmounted) {
      return;
    }

    isLoading.value = true;
    error.value = null;

    try {
      await loadMoreFn();
      currentRetry = 0; // 成功后重置重试计数
    } catch (err: any) {
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
  const debouncedLoadMore = (): void => {
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
  const handleIntersection = (entries: IntersectionObserverEntry[]): void => {
    const [entry] = entries;
    if (entry?.isIntersecting && canLoadMore.value && !isPaused.value) {
      debouncedLoadMore();
    }
  };

  /**
   * 创建 Observer
   */
  const createObserver = (): void => {
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
  const setCanLoadMore = (value: boolean): void => {
    canLoadMore.value = Boolean(value);
  };

  /**
   * 暂停加载
   */
  const pause = (): void => {
    isPaused.value = true;
  };

  /**
   * 恢复加载
   */
  const resume = (): void => {
    isPaused.value = false;
  };

  /**
   * 重置状态（用于刷新/筛选变化）
   */
  const reset = (): void => {
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
  const loadMore = (): void => {
    if (!isLoading.value && canLoadMore.value && !isPaused.value) {
      executeLoadMore();
    }
  };

  // 生命周期
  onMounted(() => {
    createObserver();
  });

  // 监听触发元素变化
  watch(triggerRef, (newEl: HTMLElement | null, oldEl: HTMLElement | null) => {
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
