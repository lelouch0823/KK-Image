import { reactive, computed } from 'vue';

/**
 * 分页状态管理 composable
 *
 * 统一管理 page / limit / total / totalPages 状态，
 * 提供 resetToFirst / setFromResponse / canLoadMore 等辅助方法。
 *
 * @example
 * const { pagination, setFromResponse, resetToFirst, canLoadMore } = usePagination();
 * // 加载数据后：
 * setFromResponse(result.pagination);
 * // 搜索时重置：
 * resetToFirst();
 */

interface PaginationOptions {
  defaultPage?: number;
  defaultLimit?: number;
}

interface PaginationState {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export function usePagination(options: PaginationOptions = {}) {
  const pagination = reactive<PaginationState>({
    page: options.defaultPage ?? 1,
    limit: options.defaultLimit ?? 20,
    total: 0,
    totalPages: 1,
  });

  /** 从 API 响应的 pagination 对象同步状态 */
  const setFromResponse = (response: { page?: number; total?: number; totalPages?: number }) => {
    if (response.page != null) pagination.page = response.page;
    if (response.total != null) pagination.total = response.total;
    if (response.totalPages != null) pagination.totalPages = response.totalPages;
  };

  /** 重置到第一页 */
  const resetToFirst = () => {
    pagination.page = 1;
  };

  /** 是否还有更多页可加载 */
  const canLoadMore = computed(() => pagination.page < pagination.totalPages);

  return {
    pagination,
    setFromResponse,
    resetToFirst,
    canLoadMore,
  };
}
