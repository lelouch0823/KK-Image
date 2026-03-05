import { ref, reactive, onScopeDispose, getCurrentScope } from 'vue';
import { useAuth } from './useAuth';
import { useToast } from './useToast';
import { useI18n } from './useI18n';

/**
 * @typedef {Object} ResourceOptions
 * @property {string} [listKey='data'] - 响应中列表数据的键名
 * @property {string} [listPath] - 嵌套路径，如 'data.orders'
 * @property {string} [subKey] - 次级键名
 * @property {number} [retryCount=2] - 自动重试次数
 * @property {number} [retryDelay=1000] - 重试延迟（ms）
 * @property {boolean} [cache=true] - 是否启用缓存
 * @property {number} [cacheTTL=60000] - 缓存有效期（ms，默认 60 秒）
 */

/**
 * @typedef {Object} ResourceState
 * @property {import('vue').Ref<Array>} items - 资源列表
 * @property {import('vue').Ref<boolean>} loading - 加载状态
 * @property {import('vue').Ref<string|null>} error - 错误信息
 * @property {Object} pagination - 分页信息
 * @property {Function} loadItems - 加载列表
 * @property {Function} createItem - 创建资源
 * @property {Function} updateItem - 更新资源
 * @property {Function} deleteItem - 删除资源
 * @property {Function} clearCache - 清空缓存
 * @property {Function} abort - 取消请求
 */

// 全局缓存 Map
const resourceCache = new Map();

/**
 * SOTA 统一资源管理 Composable
 * 支持：分页、加载状态、错误处理、AbortController、缓存、重试、乐观更新
 * @param {string} apiEndpoint - 基础 API 路径
 * @param {ResourceOptions} options - 配置项
 * @returns {ResourceState}
 */
export function useResource(apiEndpoint, options = {}) {
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

    const items = ref([]);
    const loading = ref(false);
    const error = ref(null);
    const errorCode = ref(null);
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
    const getCacheKey = (params) => {
        const key = `${apiEndpoint}?${JSON.stringify(params)}`;
        return key;
    };

    /**
     * 从缓存获取数据
     */
    const getFromCache = (key) => {
        if (!cache) return null;
        const cached = resourceCache.get(key);
        if (!cached) return null;

        const now = Date.now();
        if (now - cached.timestamp > cacheTTL) {
            resourceCache.delete(key);
            return null;
        }
        return cached.data;
    };

    /**
     * 写入缓存
     */
    const setCache = (key, data) => {
        if (!cache) return;
        resourceCache.set(key, {
            data,
            timestamp: Date.now(),
        });
    };

    /**
     * 清空当前资源的所有缓存
     */
    const clearCache = () => {
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
    const retryWithBackoff = async (fn, attempt = 0) => {
        try {
            return await fn();
        } catch (err) {
            if (err.name === 'AbortError') throw err;
            const status = Number(err?.status);
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
    function getByPath(obj, path) {
        return path.split('.').reduce((p, c) => p?.[c], obj);
    }

    /**
     * 加载列表数据 (SOTA 版本)
     * @param {Object} params - 查询参数
     * @param {boolean} [forceRefresh=false] - 强制刷新跳过缓存
     * @returns {Promise<boolean>}
     */
    const loadItems = async (params = {}, forceRefresh = false) => {
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
                items.value = cached.items;
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

            const query = new URLSearchParams(cleanParams);

            const fetchFn = async () => {
                const res = await authFetch(`${apiEndpoint}?${query.toString()}`, {
                    signal: abortController.signal,
                });
                return res.json();
            };

            const res = await retryWithBackoff(fetchFn);

            if (res.success) {
                const listData = listPath
                    ? getByPath(res, listPath)
                    : res[listKey];

                const finalItems = Array.isArray(listData)
                    ? listData
                    : (listData?.[subKey] || []);

                items.value = finalItems;

                // 处理分页
                const meta = res.meta || res.data?.pagination || res.pagination;
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
                });

                return true;
            } else {
                error.value = res.error || res.message || t('common.loadFailed');
                addToast({ message: error.value, type: 'error' });
                return false;
            }
        } catch (e) {
            if (e.name === 'AbortError') {
                console.debug('Request aborted');
                return false;
            }

            const status = Number(e?.status);
            if (status === 401) {
                errorCode.value = 'UNAUTHORIZED';
                error.value = t('common.error.unauthorized') || '未授权';
            } else if (status === 403) {
                errorCode.value = 'FORBIDDEN';
                error.value = e?.data?.error || e?.message || t('common.error.forbidden') || '权限不足';
            } else if (status >= 500) {
                errorCode.value = 'SERVER_ERROR';
                error.value = t('common.error.server_error') || '服务器错误';
            } else {
                errorCode.value = 'NETWORK_ERROR';
                error.value = e?.data?.error || e?.message || t('common.networkError');
            }

            if (errorCode.value !== 'FORBIDDEN' && errorCode.value !== 'UNAUTHORIZED') {
                console.error(`useResource load error [${apiEndpoint}]:`, e);
                addToast({ message: error.value, type: 'error' });
            }
            return false;
        } finally {
            loading.value = false;
        }
    };

    /**
     * 创建资源
     * @param {Object} data
     * @returns {Promise<Object|null>}
     */
    const createItem = async (data) => {
        try {
            const res = await authFetch(apiEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
                signal: abortController.signal,
            }).then(r => r.json());

            if (res.success) {
                addToast({ message: t('common.created'), type: 'success' });
                clearCache(); // 清空缓存以触发重新加载
                return res.data;
            } else {
                addToast({ message: res.error || res.message || t('common.error'), type: 'error' });
                return null;
            }
        } catch (e) {
            if (e.name === 'AbortError') return null;
            addToast({ message: t('common.networkError'), type: 'error' });
            return null;
        }
    };

    /**
     * 更新资源 (乐观更新)
     * @param {string|number} id
     * @param {Object} updates
     * @param {string} [idKey='id']
     * @returns {Promise<boolean>}
     */
    const updateItem = async (id, updates, idKey = 'id') => {
        const idx = items.value.findIndex(item => item[idKey] === id);

        // 1. 保存旧值 (仅当在缓存中找到时)
        const oldItem = idx !== -1 ? { ...items.value[idx] } : null;

        // 2. 乐观更新 (仅当在缓存中找到时)
        if (idx !== -1) {
            items.value[idx] = { ...items.value[idx], ...updates };
        }

        try {
            const res = await authFetch(`${apiEndpoint}/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updates),
                signal: abortController.signal,
            }).then(r => r.json());

            if (res.success) {
                addToast({ message: t('common.updated'), type: 'success' });
                clearCache(); // 清空缓存
                return true;
            } else {
                // 3. 失败回滚 (仅当有旧值时)
                if (oldItem && idx !== -1) {
                    items.value[idx] = oldItem;
                }
                addToast({ message: res.error || t('common.operationFailed'), type: 'error' });
                return false;
            }
        } catch (e) {
            if (e.name === 'AbortError') return false;
            // 3. 失败回滚 (仅当有旧值时)
            if (oldItem && idx !== -1) {
                items.value[idx] = oldItem;
            }
            addToast({ message: t('common.networkError'), type: 'error' });
            return false;
        }
    };

    /**
     * 删除资源 (乐观更新)
     * @param {string|number} id
     * @param {string} [idKey='id']
     * @returns {Promise<boolean>}
     */
    const deleteItem = async (id, idKey = 'id') => {
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
            }).then(r => r.json());

            if (res.success) {
                addToast({ message: t('common.deleted'), type: 'success' });
                clearCache();
                return true;
            } else {
                // 3. 失败回滚
                items.value.splice(idx, 0, oldItem);
                pagination.total = oldTotal;
                addToast({ message: res.error || t('common.error'), type: 'error' });
                return false;
            }
        } catch (e) {
            if (e.name === 'AbortError') return false;
            // 3. 失败回滚
            items.value.splice(idx, 0, oldItem);
            pagination.total = oldTotal;
            addToast({ message: t('common.networkError'), type: 'error' });
            return false;
        }
    };

    /**
     * 取消所有正在进行的请求
     */
    const abort = () => {
        abortController.abort();
    };

    /**
     * 原始请求 (带 Auth 和 BaseURL)
     */
    const rawRequest = async (subPath, options = {}) => {
        const url = subPath ? `${apiEndpoint}${subPath}` : apiEndpoint;
        const res = await authFetch(url, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            signal: abortController.signal
        });
        return res.json();
    };

    return {
        items,
        loading,
        error,
        errorCode,
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
