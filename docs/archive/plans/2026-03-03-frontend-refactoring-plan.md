# Frontend Refactoring Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 重构前端代码，消除重复逻辑，统一使用预设的高级 UI 组件（AppTable, AppFilterBar, StatusBadge），并封装全局 API 请求逻辑以减少样板代码。

**Architecture:** 
1. 封装并引入统一的 `request.js` 工具（或重构现有的封装），接管 `fetch` 请求的 JSON 解析、异常捕获与 `useToast` 提示样板代码。
2. 针对性地重构 `usePurchaseOrders.js` 等核心 Composable，剥离重复的 API 错误捕获结构。
3. 渐进式替换视图文件中的原生 `<table>`、原生 `<input>/<select>` 筛选项和硬编码状态标签为组件库组件。

**Tech Stack:** Vue 3 (Composition API), Tailwind CSS v4, Native Fetch API

---

### Phase 1: Core API & Composables Refactoring

### Task 1: Create standardized API request utility

**Files:**
- Create/Modify: `src/utils/request.js` 

**Step 1: Write implementation**

设计并实现一个通用的 `request` 和 `authRequest` 函数：

```javascript
import { useToast } from '@/composables/useToast';

export async function request(url, options = {}) {
  const { addToast } = useToast();
  try {
    const res = await fetch(url, options);
    const json = await res.json();
    if (!json.success) {
      addToast({ message: json.error || '请求失败', type: 'error' });
    }
    return json;
  } catch (e) {
    console.error(`Request to ${url} failed:`, e);
    addToast({ message: e.message || '网络错误', type: 'error' });
    return { success: false, error: e.message };
  }
}
```

*(如果系统中已存在类似封装，则将其调整为规范的此形态)*

**Step 2: Verify it builds**
Run: `npm run build`
Expected: PASS

**Step 3: Commit**
```bash
git add src/utils/request.js
git commit -m "feat(core): add unified request utility with global error handling"
```

### Task 2: Refactor `usePurchaseOrders.js` to use standardized request

**Files:**
- Modify: `src/composables/usePurchaseOrders.js`

**Step 1: Write implementation**

移除所有的 `try...catch` 和局部的 `addToast`，将原生的 `fetch` 替换为引入的 `request`。

```javascript
import { request } from '@/utils/request';

// 修改示例：
const loadDetail = async (id) => {
  detailLoading.value = true;
  const json = await request(API.MANAGE_PURCHASE_ORDER_BY_ID(id));
  if (json.success) {
    detail.value = json.data;
  }
  detailLoading.value = false;
};
```

**Step 2: Verify it builds**
Run: `npm run build`
Expected: PASS

**Step 3: Commit**
```bash
git add src/composables/usePurchaseOrders.js
git commit -m "refactor(composables): migrate usePurchaseOrders to unified request utility"
```

*(可根据相似步骤，将 Task 2.1 分派给 `useTags.js`, `useSpaces.js` 等)*


---

### Phase 2: UI Components Refactoring

### Task 3: Replace Hardcoded Status Badges in `AuditLogs.vue`

**Files:**
- Modify: `src/views/AuditLogs.vue`

**Step 1: Write implementation**

引入 `StatusBadge` 并替换原生的 `<span>` 徽章：

```html
<script setup>
import StatusBadge from '@/components/ui/StatusBadge.vue';
// ...
</script>

<template>
  <!-- 替换前 -->
  <!-- <span class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium" :class="actionBadgeClass(log.action)"> -->
  
  <!-- 替换后 -->
  <StatusBadge :variant="actionBadgeVariant(log.action)" size="sm">
     ...
  </StatusBadge>
</template>
```

**Step 2: Verify UI Build**
Run: `npm run build`
Expected: PASS

**Step 3: Commit**
```bash
git add src/views/AuditLogs.vue
git commit -m "refactor(ui): replace hardcoded badges with StatusBadge in AuditLogs"
```

### Task 4: Replace Raw Table in `AuditLogs.vue` with `AppTable`

**Files:**
- Modify: `src/views/AuditLogs.vue`

**Step 1: Write implementation**

用 `<AppTable>` 替换原生的 `<table class="w-full text-left text-sm">`结构，将列配置转换为 `AppTable` 的 slots 或标准列属性。

**Step 2: Verify Build**
Run: `npm run build`
Expected: PASS

**Step 3: Commit**
```bash
git add src/views/AuditLogs.vue
git commit -m "refactor(ui): migrate AuditLogs table to AppTable component"
```

### Task 5: Refactor Filters in `GoodsOverview.vue`

**Files:**
- Modify: `src/views/GoodsOverview.vue`

**Step 1: Write implementation**

移除原生的 `<select>` 和 `<input>` 搜索框，使用设计好的 `AppFilterBar` 或 `SearchInput`。

```html
<script setup>
import SearchInput from '@/components/ui/SearchInput.vue';
// ...
</script>

<template>
  <!-- 用 SearchInput 取代原生的 <input> 搜索框 -->
  <SearchInput v-model="searchQuery" placeholder="搜索商品..." />
</template>
```

**Step 2: Verify Build**
Run: `npm run build`
Expected: PASS

**Step 3: Commit**
```bash
git add src/views/GoodsOverview.vue
git commit -m "refactor(ui): adopt SearchInput and standardize filters in GoodsOverview"
```

*(后续依此模式依次重构 `PurchaseOrders.vue`、`Customers.vue` 中的表格、筛选器、徽章等)*
