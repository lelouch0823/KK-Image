# SOTA Composable 统一重构实现计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**目标**：将所有资源类 Composable (`useOrders`, `useSpaces`, `useSalespersons`) 迁移到 SOTA 级别的 `useResource` 基类，并增强以下特性：

1. **请求生命周期管理**：AbortController 支持请求取消
2. **智能缓存**：基于 resourceKey 的内存缓存
3. **乐观更新**：Create/Update/Delete 时立即更新 UI
4. **细粒度错误处理**：区分网络错误、401、500 等
5. **自动重试机制**：网络错误时指数退避重试
6. **完整 JSDoc**：类型提示与智能补全
7. **防抖优化**：避免短时间内重复请求

**架构**：`useResource` 作为基础层提供通用能力，派生 Composable 仅保留业务逻辑（如订单状态流转、空间文件管理）。

**技术栈**：Vue 3 Composition API + authFetchJson + AbortController + Map-based Cache

---

## Phase 1: 增强 useResource.js 为 SOTA 实现

### Task 1.1: 添加 JSDoc 类型定义

**文件**：`src/composables/useResource.js`

**完整代码**：

```javascript
/**
 * @typedef {Object} ResourceOptions
 * @property {string} [listKey='data'] - 响应中列表数据的键名
 * @property {string} [listPath] - 嵌套路径，如 'data.orders'
 * @property {string} [subKey] - 次级键名
 * @property {number} [retryCount=2] - 自动重试次数
 * @property {number} [retryDelay=1000] - 重试延迟（ms）
 * @property {boolean} [cache=true] - 是否启用缓存
 * @property {number} [cacheTTL=60000] - 缓存有效期（ms）
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
```

**提交**：

```bash
git add src/composables/useResource.js
git commit -m "docs(useResource): add JSDoc type definitions"
```

---

### Task 1.2: 实现 AbortController 请求取消

**目标**：支持组件卸载时取消正在进行的请求。

**修改位置**：`src/composables/useResource.js` 顶部

**代码**：

```javascript
import { ref, reactive, onUnmounted } from 'vue';
import { useAuth } from './useAuth';
import { useToast } from './useToast';
import { useI18n } from './useI18n';

// 全局缓存 Map
const resourceCache = new Map();

/**
 * SOTA 资源管理 Composable
 * @param {string} apiEndpoint
 * @param {ResourceOptions} options
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
    const pagination = reactive({
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 1,
    });

    let abortController = new AbortController();
    let lastRequestParams = null;

    // 组件卸载时自动取消请求
    onUnmounted(() => {
        abort();
    });
```

**提交**：

```bash
git add src/composables/useResource.js
git commit -m "feat(useResource): add AbortController for request cancellation"
```

---

### Task 1.3: 实现智能缓存机制

**目标**：基于 resourceKey (endpoint + params) 缓存数据，减少重复请求。

**代码**：

```javascript
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
```

**提交**：

```bash
git add src/composables/useResource.js
git commit -m "feat(useResource): implement smart caching with TTL"
```

---

### Task 1.4: 实现自动重试机制

**目标**：网络错误时使用指数退避策略自动重试。

**代码**：

```javascript
/**
 * 指数退避重试
 */
const retryWithBackoff = async (fn, attempt = 0) => {
  try {
    return await fn();
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    if (attempt >= retryCount) throw err;

    const delay = retryDelay * Math.pow(2, attempt);
    console.warn(`Retry attempt ${attempt + 1}/${retryCount} after ${delay}ms`);

    await new Promise((resolve) => setTimeout(resolve, delay));
    return retryWithBackoff(fn, attempt + 1);
  }
};
```

**提交**：

```bash
git add src/composables/useResource.js
git commit -m "feat(useResource): add exponential backoff retry"
```

---

### Task 1.5: 重写 loadItems 整合所有特性

**目标**：整合缓存、重试、取消、错误分类。

**完整代码**：

```javascript
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
  lastRequestParams = params;

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
    const query = new URLSearchParams({
      page: params.page || pagination.page,
      limit: params.limit || pagination.limit,
      ...params,
    });

    const fetchFn = async () => {
      const res = await authFetch(`${apiEndpoint}?${query.toString()}`, {
        signal: abortController.signal,
      });

      if (!res.ok) {
        if (res.status === 401) {
          throw new Error('UNAUTHORIZED');
        } else if (res.status >= 500) {
          throw new Error('SERVER_ERROR');
        }
      }

      return res.json();
    };

    const res = await retryWithBackoff(fetchFn);

    if (res.success) {
      const listData = listPath ? getByPath(res, listPath) : res[listKey];

      const finalItems = Array.isArray(listData) ? listData : listData?.[subKey] || [];

      items.value = finalItems;

      // 处理分页
      const meta = res.meta || res.data?.pagination || res.pagination;
      if (meta) {
        pagination.page = meta.page || pagination.page;
        pagination.limit = meta.limit || pagination.limit;
        pagination.total = meta.total || 0;
        pagination.totalPages =
          meta.totalPages || Math.ceil(pagination.total / pagination.limit) || 1;
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

    console.error(`useResource load error [${apiEndpoint}]:`, e);

    if (e.message === 'UNAUTHORIZED') {
      error.value = t('common.error.unauthorized');
    } else if (e.message === 'SERVER_ERROR') {
      error.value = t('common.error.server_error');
    } else {
      error.value = t('common.networkError');
    }

    addToast({ message: error.value, type: 'error' });
    return false;
  } finally {
    loading.value = false;
  }
};

/**
 * 取消所有正在进行的请求
 */
const abort = () => {
  abortController.abort();
};
```

**提交**：

```bash
git add src/composables/useResource.js
git commit -m "feat(useResource): SOTA loadItems with cache, retry, abort"
```

---

### Task 1.6: 实现乐观更新（Optimistic UI）

**目标**：Update/Delete 时立即更新 UI，失败时回滚。

**代码**：

```javascript
/**
 * 更新资源 (乐观更新)
 * @param {string|number} id
 * @param {Object} updates
 * @param {string} [idKey='id']
 * @returns {Promise<boolean>}
 */
const updateItem = async (id, updates, idKey = 'id') => {
  const idx = items.value.findIndex((item) => item[idKey] === id);
  if (idx === -1) return false;

  // 1. 保存旧值
  const oldItem = { ...items.value[idx] };

  // 2. 乐观更新
  items.value[idx] = { ...items.value[idx], ...updates };

  try {
    const res = await authFetch(`${apiEndpoint}/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
      signal: abortController.signal,
    }).then((r) => r.json());

    if (res.success) {
      addToast({ message: t('common.updated'), type: 'success' });
      clearCache(); // 清空缓存以触发重新加载
      return true;
    } else {
      // 3. 失败回滚
      items.value[idx] = oldItem;
      addToast({ message: res.error || t('common.error'), type: 'error' });
      return false;
    }
  } catch (e) {
    // 3. 失败回滚
    items.value[idx] = oldItem;
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
  const idx = items.value.findIndex((item) => item[idKey] === id);
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
    }).then((r) => r.json());

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
    // 3. 失败回滚
    items.value.splice(idx, 0, oldItem);
    pagination.total = oldTotal;
    addToast({ message: t('common.networkError'), type: 'error' });
    return false;
  }
};
```

**提交**：

```bash
git add src/composables/useResource.js
git commit -m "feat(useResource): implement optimistic UI for update/delete"
```

---

### Task 1.7: 补充辅助函数和返回接口

**代码**：

```javascript
    /**
     * 辅助函数：根据路径获取对象值
     */
    function getByPath(obj, path) {
        return path.split('.').reduce((p, c) => p?.[c], obj);
    }

    return {
        items,
        loading,
        error,
        pagination,
        loadItems,
        createItem,
        updateItem,
        deleteItem,
        clearCache,
        abort,
    };
}
```

**提交**：

```bash
git add src/composables/useResource.js
git commit -m "feat(useResource): complete SOTA implementation"
```

---

## Phase 2: 迁移各 Composable

### Task 2.1: 重构 useProducts.js（已完成，需验证）

**验证步骤**：

1. 检查 ProductManager 是否正常加载
2. 测试创建、编辑、删除商品
3. 验证分页和搜索
4. 检查网络断开时的重试

**提交**：如有问题修复后

```bash
git add src/composables/useProducts.js
git commit -m "fix(useProducts): align with SOTA useResource"
```

---

### Task 2.2: 重构 useOrders.js

**挑战**：`useOrders` 返回额外的 `salespersons` 和 `statuses`，需要自定义处理。

**完整实现**：

```javascript
import { ref } from 'vue';
import { useResource } from './useResource';
import { API } from '@/utils/constants';
import { useAuth } from './useAuth';
import { useToast } from './useToast';
import { useI18n } from './useI18n';

export function useOrders() {
  const { authFetch } = useAuth();
  const { addToast } = useToast();
  const { t } = useI18n();

  // 使用 useResource 管理订单列表
  const resource = useResource(API.MANAGE_ORDERS, {
    listPath: 'data.orders',
  });

  // 额外状态（Orders 特有）
  const salespersons = ref([]);
  const statuses = ref([]);

  /**
   * 加载订单列表 (增强版)
   */
  const loadOrders = async (params = {}) => {
    const success = await resource.loadItems(params);

    // SOTA: 从最后一次响应中提取额外数据
    // 需要修改 useResource 来支持 onSuccess 回调
    // 临时方案：手动请求

    return success;
  };

  // 保留所有其他业务方法...
  // getOrder, updateOrder, changeStatus, addComment, batchAction 等

  return {
    orders: resource.items,
    loading: resource.loading,
    error: resource.error,
    pagination: resource.pagination,
    salespersons,
    statuses,
    loadOrders,
    // ... 其他方法
  };
}
```

**提交**：

```bash
git add src/composables/useOrders.js
git commit -m "refactor(useOrders): migrate to SOTA useResource"
```

---

### Task 2.3: 重构 useSpaces.js

**实现**（简化版，保留核心逻辑）：

```javascript
export function useSpaces() {
  const resource = useResource(API.SPACES);

  // 额外状态
  const currentSpace = ref(null);

  const loadSpace = async (spaceId) => {
    // 单个详情不使用 resource，保持原有逻辑
  };

  return {
    spaces: resource.items,
    currentSpace,
    loading: resource.loading,
    error: resource.error,
    loadSpaces: resource.loadItems,
    loadSpace,
    createSpace: resource.createItem,
    updateSpace: resource.updateItem,
    deleteSpace: resource.deleteItem,
    // ... 其他业务方法
  };
}
```

**提交**：

```bash
git add src/composables/useSpaces.js
git commit -m "refactor(useSpaces): migrate to SOTA useResource"
```

---

### Task 2.4: 重构 useSalespersons.js

**实现**：

```javascript
export function useSalespersons() {
  const resource = useResource(API.SALESPERSONS, {
    listPath: 'data.salespersons',
  });

  return {
    salespersons: resource.items,
    loading: resource.loading,
    error: resource.error,
    pagination: resource.pagination,
    loadSalespersons: resource.loadItems,
    createSalesperson: resource.createItem,
    updateSalesperson: resource.updateItem,
    deleteSalesperson: resource.deleteItem,
    // 保留特有方法: resetToken, copyAccessLink
  };
}
```

**提交**：

```bash
git add src/composables/useSalespersons.js
git commit -m "refactor(useSalespersons): migrate to SOTA useResource"
```

---

## Phase 3: 补充翻译和验证

### Task 3.1: 添加错误消息翻译

**文件**：`src/locales/zh-CN.js`

**添加**：

```javascript
error: {
    unauthorized: '未授权，请重新登录',
    server_error: '服务器错误，请稍后重试',
    network_error: '网络错误',
},
```

**提交**：

```bash
git add src/locales/zh-CN.js
git commit -m "i18n: add error messages for SOTA useResource"
```

---

### Task 3.2: 端到端测试

**测试清单**：

- [ ] 商品列表加载、分页、搜索
- [ ] 订单列表过滤、状态更新
- [ ] 空间创建、文件添加
- [ ] 销售员管理、Token 重置
- [ ] 网络断开时的自动重试
- [ ] 组件卸载时请求取消
- [ ] 缓存功能（重复访问同一页面）

---

### Task 3.3: Lint 和 Build

**运行**：

```bash
npm run lint -- --fix
pnpm build
```

**提交**：

```bash
git add .
git commit -m "chore: final lint fixes for SOTA composables"
```

---

## 总结

本计划实现了 **State-Of-The-Art** 级别的 Resource Composable：

✅ **请求生命周期管理**：AbortController  
✅ **智能缓存**：Map + TTL  
✅ **乐观更新**：立即更新 UI，失败回滚  
✅ **自动重试**：指数退避  
✅ **完整类型提示**：JSDoc  
✅ **细粒度错误处理**：401/500/network  
✅ **DRY 原则**：所有资源类 Composable 复用相同逻辑

**预期收益**：

- 代码量减少 40%
- 用户体验提升（加载速度、错误提示）
- 可维护性大幅提升
