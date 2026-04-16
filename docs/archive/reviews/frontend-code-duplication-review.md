# 前端代码重复与未抽取公共组件审查报告

本报告概述了 KK-Image 前端项目中未完全遵循项目设计模式、存在代码过度冗余以及未能有效利用现有公共组件的情况。

## 1. 原生 `<table>` 与 `AppTable.vue` 的混用
**问题描述：**
项目中虽然已经封装了高度可复用的 `src/components/ui/AppTable.vue`（支持插槽和分页集成），但在多个核心视图组件中，依然在使用硬编码的 Tailwind 原生 `<table>` 结构。这导致了表格样式、响应式布局及列宽处理的不一致。

**主要受影响文件：**
- `src/views/PurchaseOrders.vue` （出现多处原生 table）
- `src/views/GoodsOverview.vue` （出现多处原生 table）
- `src/views/Customers.vue`
- `src/views/AuditLogs.vue`
- `src/views/FileManager/TrashModal.vue`

**建议方案：**
统一使用 `AppTable.vue`，剥离重复的 `<thead>` 和 `<tbody>` 设计。对于过于复杂的表格操作，可通过自定义 Slot 的方式兼容，而非退回原生标签。

---

## 2. API 调用与错误处理样板代码严重重复 (Boilerplate)
**问题描述：**
几乎所有的业务组合式函数（Composables）都在重复书写原生的 `fetch` 调用、`try { ... } catch (e) { ... }` 块以及响应结构的判空、UI 提示代码（`useToast` / `addToast`）。这违反了 DRY 原则，增加了维护接口和统一拦截器的难度。

**主要受影响文件：**
- `src/composables/usePurchaseOrders.js`
- `src/composables/useSpaces.js`
- `src/composables/useTags.js`
- `src/composables/useSalesProducts.js`
- 各个直接发起 API 请求的组件（如 `AuditLogs.vue`, `Space.vue`）

**示例重复代码：**
```javascript
try {
  const res = await fetch(API_URL);
  const json = await res.json();
  if (json.success) {
      // 成功处理
  } else {
      addToast({ message: json.error, type: 'error' });
  }
} catch (e) {
  addToast({ message: e.message, type: 'error' });
}
```

**建议方案：**
在 `src/utils/` 下创建一个核心的请求实例或封装好 `authFetch` / `request`，由其代为处理底层数据 JSON 解析、错误 `throw` 以及默认的 `useToast` 拦截展示。Composables 只需处理快乐路径（Happy Path）。

---

## 3. 表单搜索、筛选控件（Filter Bar）未复用
**问题描述：**
UI 组件库中存在设计良好的 `src/components/ui/AppFilterBar.vue` 组件，但在实际的所有 `views` 视图中却**一次都没有被使用**。同时，很多页面都在硬编码大量重复的 Tailwind `<input type="text">` 和 `<select>` 作为列表筛选条件。

**主要受影响文件：**
- `src/views/GoodsOverview.vue` （多处原生 `select` 和按钮布局）
- `src/views/PurchaseOrders.vue`
- `src/views/AuditLogs.vue`
- `src/views/sales/SalesListView.vue` （冗余的手写 `input` 搜索框）

**建议方案：**
废除各页面重复冗长的内联手写的搜索表单节点，全面接入 `AppFilterBar.vue` 或 `SearchInput.vue`。

---

## 4. 状态徽章（Status Tags/Badges）的手写硬编码
**问题描述：**
尽管存在 `src/components/ui/StatusBadge.vue` 组件处理状态流转和颜色，但一些页面出于快捷或其他原因，仍堆砌了大量的 Tailwind 颜色 class 组合（如 `bg-success/10 text-success rounded px-2 py-0.5`），这些状态 UI 在多处散落极易引发主题不统一。

**主要受影响文件：**
- `src/views/Stats.vue`
- `src/views/FileManager/FileTable.vue`
- `src/views/Dashboard.vue`
- `src/views/AuditLogs.vue`

**建议方案：**
统一抽取使用 `StatusBadge.vue`（提供 `success`, `info`, `danger`, `warning`, `default` 等变体枚举）。

---

## 5. 分页逻辑 (Pagination) 散布于底层
**问题描述：**
目前系统中有 `Pagination.vue` 组件，但这导致各处的 `Composables` （如 `useOrders.js`、`usePurchaseOrders.js`）都要在底层硬编码自己的 `filters.page` 和 `filters.limit` 逻辑。

**建议方案：**
抽取一个高阶复用挂载层如 `usePaginationList(fetchFn)` 组件。将状态流、分页器的控制流做一层收口，不必每个模块重复声明。
