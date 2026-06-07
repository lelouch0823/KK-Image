# 管理端订单修复优化 - 商品绑定功能实现计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**目标:** 允许管理员将订单绑定到数据库中现有的商品。绑定后，订单中的商品相关字段（名称、SKU、图片等）将变为只读，并直接从商品数据中获取。如需修改，需要跳转到商品详情页进行操作。

**架构:**

1.  **数据库:** 在 `orders` 表中添加 `product_id` 字段。
2.  **后端:** 更新 `OrderRepository` 以处理 `product_id`。更新订单变更 API 以接收 `productId`，并在绑定时将商品数据同步到订单的 `current_data` 快照中。
    - _决策:_ 我们将继续在 `current_data` 中存储快照，但将其标记为已绑定。这样既保留了订单历史记录，又能限制未来的编辑。
3.  **前端:** 更新 `OrderEditModal`，增加一个商品搜索/选择组件。当选中商品时，自动填充表单字段并禁用编辑。

**技术栈:** Vue 3, Cloudflare D1 (SQLite), Cloudflare Workers (Hono).

---

### 任务 1: 数据库迁移与后端仓库更新

**目标:** 允许 `orders` 表存储 `product_id`，并确保 Repository/API 能够处理它。

**文件:**

- 新建: `migrations/0009_add_product_id_to_orders.sql` (请检查当前最大迁移编号)
- 修改: `functions/repositories/order/queries.js` (Select `product_id`)
- 修改: `functions/repositories/order/mutations.js` (Update `product_id`)
- 修改: `functions/repositories/order/helpers.js` (Map `product_id` to domain object)
- 修改: `functions/lib/hono/routes/manage/orders/detail.js` (Handle `productId` in PATCH)

**步骤 1: 创建迁移**
创建一个新的迁移文件，向 `orders` 表添加 `product_id` (TEXT/UUID) 字段，并添加索引。

**步骤 2: 更新查询与辅助函数**
更新 `functions/repositories/order/queries.js` 中的 `findById` 和 `listForAdmin` 查询，以选择 `o.product_id`。
更新 `functions/repositories/order/helpers.js` 中的 `mapOrderDetail` 和 `mapOrderListItem`，以包含 `productId`。

**步骤 3: 更新变更方法**
更新 `functions/repositories/order/mutations.js` 中的 `updateData`，允许更新 `product_id`。

**步骤 4: 更新 API 路由**
在 `functions/lib/hono/routes/manage/orders/detail.js` (或相应的更新处理程序) 中，从请求体中提取 `productId` 并传递给仓库。

**步骤 5: 后端测试**
验证: 使用 `curl` 或脚本创建/更新一个带有 `productId` 的订单，并验证其是否持久化成功。

---

### 任务 2: 后端商品数据同步逻辑

**目标:** 当订单绑定到商品时，自动更新订单的 `current_data`（名称、SKU、图片等）以匹配商品数据。

**文件:**

- 修改: `functions/lib/hono/routes/manage/orders/detail.js`

**步骤 1: 实现同步逻辑**
在更新 API 中，如果提供了 `productId`:

1.  通过 ID 获取商品信息。
2.  如果找到，使用商品数据更新 `current_data` (name, sku, brand, series 等)。
3.  更新 `product_id`。
4.  _关键点:_ 如果设置了 `productId`，是否允许在同一请求中发送其他字段？允许，但商品数据优先或会覆盖它们。

**步骤 2: 测试同步**
验证: 创建一个订单。使用 `productId` 更新它。验证订单的 `name` 和 `sku` 是否变更为匹配商品的数值。

---

### 任务 3: 前端商品选择组件

**目标:** 创建一个可复用的商品搜索/选择组件 (Autocomplete)。

**文件:**

- 新建: `src/components/product/ProductSelect.vue`

**步骤 1: 创建组件**
实现一个 Combobox/Select 组件，功能如下：

1.  接收 `modelValue` (productId)。
2.  输入时从 `SEARCH_PRODUCTS` API 获取商品。
3.  在下拉列表中显示商品名称 + SKU + 图片。
4.  触发 `update:modelValue` 和 `select` 事件 (附带完整的商品对象)。

---

### 任务 4: 前端订单编辑弹窗集成

**目标:** 将商品绑定功能集成到 `OrderEditModal.vue` 中。

**文件:**

- 修改: `src/components/OrderEditModal.vue`
- 修改: `src/components/OrderFormFields.vue` (可选，可能只需传递 props)

**步骤 1: 添加商品选择器**
在 `OrderEditModal.vue` 的表单顶部添加 `ProductSelect` 组件。

**步骤 2: 实现绑定逻辑**
当选中一个商品时：

1.  更新 `form.productId`。
2.  使用商品数据更新 `form.name`, `sku`, `brand` 等。
3.  设置 `isBound` 标志 (通过检查 `form.productId` 计算得出)。

**步骤 3: 限制编辑**
如果 `isBound` 为 true:

1.  禁用名称、SKU、品牌、系列等输入框。(尺寸/颜色通常是变体，可能仍需保留？_约束假设: 用户表示"订单和商品相关信息无法修改"。通常尺寸/颜色是变体。目前假设：锁定名称、SKU、品牌、系列等通用字段。_)
2.  显示“编辑商品详情”按钮 (链接到 `/products/:id`)。
3.  阻止编辑被锁定的字段。

**步骤 4: API Payload**
更新 `handleSubmit` 以包含 `productId`。

---

### 任务 5: 验证与优化

**目标:** 验证完整流程。

**步骤:**

1.  打开管理端订单列表。
2.  点击“修正” (编辑)。
3.  搜索并选择一个商品。
4.  验证字段是否自动填充并锁定。
5.  保存。
6.  刷新并验证持久化是否成功。
7.  检查“编辑商品”链接是否正常跳转。
