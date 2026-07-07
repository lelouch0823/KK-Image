import { ref, reactive, onScopeDispose, getCurrentScope } from 'vue';
import { useAuth } from './useAuth';
import { useToast } from './useToast';
import { useI18n } from './useI18n';
import { ErrorCode, isAuthError } from '@/utils/error-codes';

// Re-export from shared types
export type { ResourceItem, ApiResponse, PaginationMeta } from '@/utils/api-types';

/** 缓存条目结构 */
interface CacheEntry {
    items: unknown[];
    pagination: PaginationMeta;
    timestamp: number;
}

interface ResourceOptions {
    listKey?: string;
    listPath?: string;
    subKey?: string;
    retryCount?: number;
    retryDelay?: number;
    cache?: boolean;
    cacheTTL?: number;
}

/** 带状态信息的错误对象 */
interface ErrorWithStatus extends Error {
    status?: number;
    data?: { error?: string };
}

// 全局缓存 Map（带 LRU 淘汰）
const CACHE_MAX_SIZE = 100;
const resourceCache = new Map<string, CacheEntry>();

function evictOldCacheEntries(): void {
    if (resourceCache.size <= CACHE_MAX_SIZE) return;
    const entriesToDelete = resourceCache.size - CACHE_MAX_SIZE;
    const keys = resourceCache.keys();
    for (let i = 0; i < entriesToDelete; i++) {
        const next = keys.next();
        if (next.value) resourceCache.delete(next.value);
    }
}

/**
 * SOTA 统一资源管理 Composable
 * 支持：分页、加载状态、错误处理、AbortController、缓存、重试、乐观更新
 * @param apiEndpoint - 基础 API 路径
 * @param options - 配置项
 */
export function useResource<T extends ResourceItem = ResourceItem>(apiEndpoint: string, options: ResourceOptions = {}) {
    const {
        listKey = 'data',
        listPath,
        subKey,
        retryCount = 2,
        retryDelay = 1000,
        cache = true,
        cacheTTL = 60000,
    } = options;

    const { authFetch } = useAuth();
    const { addToast } = useToast();
    const { t } = useI18n();

    const items = ref<T[]>([]) as import('vue').Ref<T[]>;
    const loading = ref<boolean>(false);
    const error = ref<string | null>(null);
    const errorCode = ref<string | null>(null);
    const lastResponse = ref<ApiResponse | null>(null);
    const pagination = reactive({
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 1,
    });

    let abortController = new AbortController();

    // 仅在存在活动 effect scope 时注册清理，避免在普通函数上下文触发 Vue 警告
    if (getCurrentScope()) {
        onScopeDispose(() => {
            abort();
        });
    }

    /**
     * 生成缓存键
     */
    const getCacheKey = (params: Record<string, string | number | boolean>): string => {
        const key = `${apiEndpoint}?${JSON.stringify(params)}`;
        return key;
    };

    /**
     * 从缓存获取数据
     */
    const getFromCache = (key: string): CacheEntry | null => {
        if (!cache) return null;
        const cached = resourceCache.get(key);
        if (!cached) return null;

        const now = Date.now();
        if (now - cached.timestamp > cacheTTL) {
            resourceCache.delete(key);
            return null;
        }
        return cached;
    };

    /**
     * 写入缓存
     */
    const setCache = (key: string, data: CacheEntry): void => {
        if (!cache) return;
        evictOldCacheEntries();
        resourceCache.set(key, data);
    };

    /**
     * 清空当前资源的所有缓存
     */
    const clearCache = (): void => {
        const prefix = apiEndpoint;
        for (const key of resourceCache.keys()) {
            if (key.startsWith(prefix)) {
                resourceCache.delete(key);
            }
        }
    };

    /**
     * 指数退避重试
     */
    const retryWithBackoff = async <R>(fn: () => Promise<R>, attempt: number = 0): Promise<R> => {
        try {
            return await fn();
        } catch (err: unknown) {
            const errorWithStatus = err as ErrorWithStatus;
            if (errorWithStatus.name === 'AbortError') throw err;
            const status = Number(errorWithStatus?.status);
            // 仅重试可恢复错误：网络异常(无 status)、429、5xx
            const shouldRetry = !Number.isFinite(status) || status === 429 || status >= 500;
            if (!shouldRetry) throw err;
            if (attempt >= retryCount) throw err;

            const delay = retryDelay * Math.pow(2, attempt);
            console.warn(`Retry attempt ${attempt + 1}/${retryCount} after ${delay}ms`);

            await new Promise(resolve => setTimeout(resolve, delay));
            return retryWithBackoff(fn, attempt + 1);
        }
    };

    /**
     * 辅助函数：根据路径获取对象值
     */
    function getByPath(obj: unknown, path: string): unknown {
        return path.split('.').reduce((p: unknown, c: string) => {
            if (p !== null && p !== undefined && typeof p === 'object') {
                return (p as Record<string, unknown>)?.[c];
            }
            return undefined;
        }, obj);
    }

    /**
     * 加载列表数据 (SOTA 版本)
     * @param params - 查询参数
     * @param forceRefresh - 强制刷新跳过缓存
     */
    const loadItems = async (params: Record<string, string | number | boolean> = {}, forceRefresh: boolean = false): Promise<boolean> => {
        // 取消之前的请求
        abort();
        abortController = new AbortController();

        loading.value = true;
        error.value = null;
        errorCode.value = null;

        const cacheKey = getCacheKey(params);

        // 检查缓存
        if (!forceRefresh) {
            const cached = getFromCache(cacheKey);
            if (cached) {
                items.value = cached.items as T[];
                Object.assign(pagination, cached.pagination);
                loading.value = false;
                return true;
            }
        }

        try {
            // 过滤掉 undefined 和 null 的参数
            const cleanParams = Object.fromEntries(
                Object.entries({
                    page: params.page || pagination.page,
                    limit: params.limit || pagination.limit,
                    ...params,
                }).filter(([_, v]) => v !== undefined && v !== null && v !== '')
            );

            const query = new URLSearchParams(cleanParams as Record<string, string>);

            const fetchFn = async (): Promise<ApiResponse> => {
                const res = await authFetch(`${apiEndpoint}?${query.toString()}`, {
                    signal: abortController.signal,
                });
                return res.json() as Promise<ApiResponse>;
            };

            const res = await retryWithBackoff(fetchFn);
            lastResponse.value = res;

            if (res.success) {
                const listData = listPath
                    ? getByPath(res, listPath)
                    : (res as Record<string, unknown>)[listKey];

                const finalItems = Array.isArray(listData)
                    ? listData
                    : (subKey && listData && typeof listData === 'object' ? (listData as Record<string, unknown[]>)[subKey] : []) || [];

                items.value = finalItems as T[];

                // 处理分页（统一使用顶层 pagination 字段）
                const meta = res.pagination;
                if (meta) {
                    pagination.page = meta.page || pagination.page;
                    pagination.limit = meta.limit || pagination.limit;
                    pagination.total = meta.total || 0;
                    pagination.totalPages = meta.totalPages || Math.ceil(pagination.total / pagination.limit) || 1;
                }

                // 写入缓存
                setCache(cacheKey, {
                    items: finalItems,
                    pagination: { ...pagination },
                    timestamp: Date.now(),
                });

                return true;
            } else {
                error.value = res.error || res.message || t('common.loadFailed');
                addToast({ message: error.value as string, type: 'error' });
                return false;
            }
        } catch (e: unknown) {
            const err = e as ErrorWithStatus;
            if (err.name === 'AbortError') {
                console.debug('Request aborted');
                return false;
            }

            const status = Number(err?.status);
            if (status === 401) {
                errorCode.value = ErrorCode.UNAUTHORIZED;
                error.value = t('common.error.unauthorized');
            } else if (status === 403) {
                errorCode.value = ErrorCode.FORBIDDEN;
                error.value = err?.data?.error || err?.message || t('common.error.forbidden');
            } else if (status >= 500) {
                errorCode.value = ErrorCode.SERVER_ERROR;
                error.value = t('common.error.server_error');
            } else {
                errorCode.value = ErrorCode.NETWORK_ERROR;
                error.value = err?.data?.error || err?.message || t('common.networkError');
            }

            if (!isAuthError(errorCode.value)) {
                console.error(`useResource load error [${apiEndpoint}]:`, e);
                addToast({ message: error.value as string, type: 'error' });
            }
            return false;
        } finally {
            loading.value = false;
        }
    };

    /**
     * 创建资源
     * @param data
     */
    const createItem = async (data: Record<string, unknown>): Promise<T | null> => {
        try {
            const res = await authFetch(apiEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
                signal: abortController.signal,
            }).then(r => r.json() as Promise<ApiResponse>);

            if (res.success) {
                addToast({ message: t('common.created'), type: 'success' });
                clearCache(); // 清空缓存以触发重新加载
                return res.data as T;
            } else {
                addToast({ message: res.error || res.message || t('common.error'), type: 'error' });
                return null;
            }
        } catch (e: unknown) {
            const err = e as ErrorWithStatus;
            if (err.name === 'AbortError') return null;
            addToast({ message: t('common.networkError'), type: 'error' });
            return null;
        }
    };

    /**
     * 更新资源 (乐观更新)
     * @param id
     * @param updates
     * @param idKey
     */
    const updateItem = async (id: string | number, updates: Record<string, unknown>, idKey: string = 'id'): Promise<boolean> => {
        const idx = items.value.findIndex(item => item[idKey] === id);

        // 1. 保存旧值 (仅当在缓存中找到时)
        const oldItem = idx !== -1 ? { ...items.value[idx] } : null;

        // 2. 乐观更新 (仅当在缓存中找到时)
        if (idx !== -1) {
            (items.value as Record<string, unknown>[])[idx] = { ...items.value[idx], ...updates };
        }

        try {
            const res = await authFetch(`${apiEndpoint}/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updates),
                signal: abortController.signal,
            }).then(r => r.json() as Promise<ApiResponse>);

            if (res.success) {
                addToast({ message: t('common.updated'), type: 'success' });
                clearCache(); // 清空缓存
                return true;
            } else {
                // 3. 失败回滚 (仅当有旧值时)
                if (oldItem && idx !== -1) {
                    (items.value as Record<string, unknown>[])[idx] = oldItem;
                }
                addToast({ message: res.error || t('common.operationFailed'), type: 'error' });
                return false;
            }
        } catch (e: unknown) {
            const err = e as ErrorWithStatus;
            if (err.name === 'AbortError') return false;
            // 3. 失败回滚 (仅当有旧值时)
            if (oldItem && idx !== -1) {
                (items.value as Record<string, unknown>[])[idx] = oldItem;
            }
            addToast({ message: t('common.networkError'), type: 'error' });
            return false;
        }
    };

    /**
     * 删除资源 (乐观更新)
     * @param id
     * @param idKey
     */
    const deleteItem = async (id: string | number, idKey: string = 'id'): Promise<boolean> => {
        const idx = items.value.findIndex(item => item[idKey] === id);
        if (idx === -1) return false;

        // 1. 保存旧值
        const oldItem = { ...items.value[idx] };
        const oldTotal = pagination.total;

        // 2. 乐观删除
        items.value.splice(idx, 1);
        pagination.total--;

        try {
            const res = await authFetch(`${apiEndpoint}/${id}`, {
                method: 'DELETE',
                signal: abortController.signal,
            }).then(r => r.json() as Promise<ApiResponse>);

            if (res.success) {
                addToast({ message: t('common.deleted'), type: 'success' });
                clearCache();
                return true;
            } else {
                // 3. 失败回滚
                items.value.splice(idx, 0, oldItem as T);
                pagination.total = oldTotal;
                addToast({ message: res.error || t('common.error'), type: 'error' });
                return false;
            }
        } catch (e: unknown) {
            const err = e as ErrorWithStatus;
            if (err.name === 'AbortError') return false;
            // 3. 失败回滚
            items.value.splice(idx, 0, oldItem as T);
            pagination.total = oldTotal;
            addToast({ message: t('common.networkError'), type: 'error' });
            return false;
        }
    };

    /**
     * 取消所有正在进行的请求
     */
    const abort = (): void => {
        abortController.abort();
    };

    /**
     * 原始请求 (带 Auth 和 BaseURL)
     */
    const rawRequest = async (subPath: string, options: RequestInit = {}): Promise<ApiResponse> => {
        const url = subPath ? `${apiEndpoint}${subPath}` : apiEndpoint;
        const res = await authFetch(url, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...(options.headers || {}),
            },
            signal: abortController.signal
        });
        return res.json() as Promise<ApiResponse>;
    };

    return {
        items,
        loading,
        error,
        errorCode,
        lastResponse,
        pagination,
        loadItems,
        createItem,
        updateItem,
        deleteItem,
        clearCache,
        abort,
        rawRequest,
    };
}
