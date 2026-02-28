# KK-Image 组合式函数设计文档

## 1. 模块概述

### 1.1 整体架构

```
src/composables/
├── 核心基础设施
│   ├── useAuth.js          # 认证与授权
│   ├── useI18n.js          # 国际化
│   ├── useToast.js         # 消息提示
│   ├── useTheme.js         # 主题切换
│   ├── useResource.js      # 统一资源管理
│   └── useResponsive.js    # 响应式布局
│
├── 业务领域
│   ├── useFileManager.js   # 文件管理
│   ├── useOrders.js        # 订单管理
│   ├── useProducts.js      # 商品管理
│   ├── useSpaces.js        # 空间管理
│   ├── useSalespersons.js  # 销售人员
│   ├── usePurchaseOrders.js# 采购单
│   └── useGoodsOverview.js # 订货总览
│
├── UI交互
│   ├── useModalStack.js    # 模态框堆叠
│   ├── useLightbox.js      # 灯箱预览
│   ├── useDragSort.js      # 拖拽排序
│   ├── useInfiniteScroll.js# 无限滚动
│   └── usePullToRefresh.js # 下拉刷新
│
├── 工具函数
│   ├── useClipboard.js     # 剪贴板
│   ├── useSearch.js        # 搜索
│   ├── useNotifications.js # 通知中心
│   └── useRecentInputs.js  # 最近输入
│
├── 上传与处理
│   ├── useUploadQueue.js   # 上传队列
│   ├── useImageCompression.js # 图片压缩
│   └── useWatermarkSettings.js # 水印设置
│
├── AI功能
│   ├── useAI.js            # AI 面板状态
│   ├── useAIStream.js      # AI 流式响应
│   └── useSmoothTypewriter.js # 打字机效果
│
└── 子模块
    ├── file-manager/
    │   ├── useFileDrag.js      # 文件拖拽
    │   ├── useFileNavigation.js# 文件导航
    │   └── useFileSelection.js # 文件选择
    └── order/
        ├── useOrderBatch.js    # 批量操作
        ├── useOrderFilters.js  # 订单筛选
        └── useOrderModals.js   # 订单模态框
```

**统计**: 共计 **36个组合式函数文件**

### 1.2 设计理念

- **全局状态共享模式**: 使用模块级 `ref()` 创建全局状态，确保跨组件共享
- **关注点分离**: 业务逻辑与 UI 解耦
- **可组合性**: composables 之间相互调用，形成功能复用链

---

## 2. 函数分类

### 2.1 核心基础设施层

| 文件 | 功能 | 状态类型 |
|------|------|----------|
| `useAuth.js` | 用户认证、授权请求封装 | 全局状态 |
| `useI18n.js` | 多语言翻译 | 全局状态 |
| `useToast.js` | 轻量消息提示 | 全局状态 |
| `useTheme.js` | 明暗主题切换 | 全局状态 |
| `useResource.js` | RESTful 资源 CRUD 抽象 | 实例状态 |
| `useResponsive.js` | 断点检测 | 实例状态 |

### 2.2 业务领域层

| 文件 | 功能 | 核心方法 |
|------|------|----------|
| `useFileManager.js` | 文件夹/文件 CRUD | `loadFolderData`, `createFolder`, `deleteFile` |
| `useOrders.js` | 订单管理 | `loadOrders`, `updateOrder`, `changeStatus` |
| `useProducts.js` | 商品与变体管理 | `loadProduct`, `createDimension` |
| `useSpaces.js` | 空间管理 | `loadSpace`, `addFilesToSpace` |
| `useSalespersons.js` | 销售人员管理 | `resetToken`, `copyAccessLink` |
| `usePurchaseOrders.js` | 采购单管理 | `createPO`, `updateStatus` |
| `useGoodsOverview.js` | 订货总览 | `loadData`, `createPOFromSelected` |

### 2.3 UI交互层

| 文件 | 功能 | 关键特性 |
|------|------|----------|
| `useModalStack.js` | 模态框堆叠管理 | z-index 分配、毛玻璃智能控制 |
| `useLightbox.js` | 图片灯箱预览 | 键盘导航、滚轮切换 |
| `useDragSort.js` | 列表拖拽重排 | 桌面端 + 触摸端双支持 |
| `useInfiniteScroll.js` | 上拉加载更多 | IntersectionObserver + 重试 |

### 2.4 上传与AI层

| 文件 | 功能 | 特性 |
|------|------|------|
| `useUploadQueue.js` | 上传队列管理 | 并发控制、秒传预检、速度计算 |
| `useImageCompression.js` | 图片压缩 + 水印 | WebP 输出、SHA-256 哈希 |
| `useAIStream.js` | SSE 流式响应处理 | AbortController、打字机效果 |

---

## 3. 核心函数详解

### 3.1 useResource - 统一资源管理基类

**设计模式**: 模板方法模式 + 乐观更新

```javascript
export function useResource(apiEndpoint, options = {}) {
  const {
    listKey = 'data',
    retryCount = 2,  // 自动重试次数
    cache = true,    // 启用缓存
    cacheTTL = 60000 // 缓存有效期 60s
  } = options;

  return {
    loadItems,    // 加载列表
    createItem,   // 创建资源
    updateItem,   // 更新资源（乐观更新）
    deleteItem,   // 删除资源（乐观更新）
    clearCache,   // 清空缓存
    abort,        // 取消请求
  };
}
```

**特性**:
- **指数退避重试**: 失败后自动重试，延迟指数递增
- **缓存机制**: 基于 Map 的内存缓存，支持 TTL
- **乐观更新**: 更新/删除时先修改本地状态，失败后回滚

### 3.2 useAuth - 认证核心

```javascript
// 全局状态
const isAuthenticated = ref(false);
const currentUser = ref(null);

export function useAuth() {
  return {
    isAuthenticated,  // 是否已登录
    currentUser,      // 当前用户信息
    checkAuth,        // 检查登录状态
    authFetch,        // 带 Cookie 的 fetch 封装
    logout            // 退出登录
  };
}
```

### 3.3 useUploadQueue - 上传队列管理器

**上传流程**:
```
addFiles() → processQueue() → handleUpload()
                                  ↓
                        ┌─────────────────────┐
                        │ 阶段0: 压缩/水印     │
                        │ 阶段1: SHA-256 哈希  │
                        │ 阶段2: 秒传预检      │
                        │ 阶段3: XHR 上传      │
                        └─────────────────────┘
```

**秒传机制**:
1. 计算文件 SHA-256 哈希
2. 调用预检接口
3. 若哈希已存在，直接完成（秒传）
4. 否则执行实际上传

### 3.4 useAIStream - AI 流式响应

```javascript
export function useAIStream() {
  return {
    stream,            // 发起流式请求
    cancel,            // 取消请求
    fullContent,       // 完整内容
    displayedContent,  // 打字机效果内容
    isTyping,          // 是否在打字
    isLoading,         // 是否在加载
    toolStatus,        // 工具调用状态
  };
}
```

---

## 4. 状态管理

### 4.1 全局状态 vs 实例状态

| 类型 | 定义方式 | 使用场景 |
|------|----------|----------|
| **全局状态** | 模块外 `const ref()` | 跨组件共享（认证、通知、上传队列） |
| **实例状态** | 函数内 `const ref()` | 组件隔离（拖拽、筛选、导航） |

### 4.2 全局状态模块一览

```
useAuth
  ├─ isAuthenticated: ref(false)
  ├─ currentUser: ref(null)
  └─ isLoading: ref(true)

useToast
  └─ toasts: ref([])

useNotifications
  ├─ notifications: ref([])
  ├─ unreadCount: ref(0)
  └─ lastNotificationTime: ref(Date.now())

useUploadQueue
  ├─ queue: ref([])
  └─ isUploading: ref(false)

useModalStack
  └─ openModals: ref([])

useI18n
  └─ currentLocale: ref('zh-CN')
```

### 4.3 乐观更新模式

```javascript
const updateItem = async (id, updates) => {
  // 1. 保存旧值
  const oldItem = { ...items.value[idx] };
  
  // 2. 乐观更新
  items.value[idx] = { ...items.value[idx], ...updates };
  
  try {
    // 3. 发送请求
    const res = await authFetch(...);
    if (!res.success) {
      // 4. 失败回滚
      items.value[idx] = oldItem;
    }
  } catch (e) {
    items.value[idx] = oldItem;
  }
};
```

---

## 5. 设计模式

### 5.1 工厂函数模式

所有 composables 都是工厂函数，每次调用返回新的状态实例：

```javascript
export function useDragSort(items, options = {}) {
  const dragIndex = ref(null);  // 每次调用创建新实例
  return { dragIndex, handleDragStart, ... };
}
```

### 5.2 单例模式（全局状态）

通过模块级变量实现跨组件共享：

```javascript
const isAuthenticated = ref(false);  // 模块级变量
export function useAuth() {
  return { isAuthenticated };  // 所有组件共享同一引用
}
```

### 5.3 组合模式

composables 之间相互组合：

```javascript
// useUploadQueue.js 组合其他 composables
import { useToast } from '@/composables/useToast';
import { useI18n } from '@/composables/useI18n';
```

---

## 6. 最佳实践

### 6.1 状态隔离

仅在需要跨组件共享时使用全局状态，否则使用实例状态。

### 6.2 请求取消

使用 `onScopeDispose` + `AbortController`：

```javascript
let abortController = new AbortController();
onScopeDispose(() => {
  abortController.abort();
});
```

### 6.3 错误处理

统一使用 `useToast` + `useI18n`：

```javascript
try {
  const res = await authFetch(url);
  if (!res.success) {
    addToast({ message: t('common.error'), type: 'error' });
  }
} catch (e) {
  addToast({ message: t('common.networkError'), type: 'error' });
}
```

### 6.4 性能优化

1. 使用 `shallowRef` 存储大对象
2. 防抖/节流高频操作
3. 使用 `computed` 缓存计算结果
