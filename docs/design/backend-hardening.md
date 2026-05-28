# 后端加固设计文档

> 审查后遗留的 4 项改进方案，按独立性和依赖关系排列。

---

## 一、测试旁路 Header 环境控制

### 问题

- `rateLimit.js` 的 `X-Test-Bypass-RateLimit` 和 `ai-rate-limit.js` 的 `x-test-ai-quota-deny` 在生产代码中硬编码，仅靠 loopback 域名保护不够严格。
- 项目未在 `wrangler.toml` 中定义 `NODE_ENV` 或 `ENVIRONMENT`，无法区分环境。

### 方案

```
环境变量：ENVIRONMENT (values: production | preview | development)
```

**改动点：**

1. `functions/_middleware.js` 已读取 `env.ENVIRONMENT`（默认 `'production'`），复用此变量。
2. `rateLimit.js` 的 `shouldBypassGlobalRateLimit`：
   - 增加条件：`env.ENVIRONMENT !== 'production'`
   - 保留 loopback 域名校验（双重保险）
3. `ai-rate-limit.js` 的 `x-test-ai-quota-deny`：
   - 增加条件：仅 `ENVIRONMENT !== 'production'` 时生效
4. `wrangler.toml` 的 `[vars]` 中添加 `ENVIRONMENT = "development"`（local dev）
5. Cloudflare Dashboard 中为 preview/production 环境分别设置 `ENVIRONMENT` 值

**影响范围：** 仅 `rateLimit.js`、`ai-rate-limit.js`、`wrangler.toml`
**风险：** 低。纯防御性改动，不改变任何业务逻辑。

---

## 二、销售端订单 PATCH Zod 验证

### 问题

`PATCH /api/sales/:token/orders/:id` 直接使用 `await c.req.json()`，虽然 `processOrderUpdate` 内部有白名单过滤，但入口缺少类型校验，`productId`/`variantId`/`fileIds` 等字段无类型约束。

### 方案

在 `functions/lib/hono/schemas/sales.js` 中新增：

```js
export const UpdateSalesOrderSchema = z.object({
  reason: z.string().min(1, '修改原因不能为空').max(500),
  productId: z.string().optional(),
  variantId: z.string().optional(),
  fileIds: z.array(z.string()).max(50).optional(),
  updates: z.object({
    name: z.string().max(200).optional(),
    brand: z.string().max(100).optional(),
    category: z.string().max(100).optional(),
    series: z.string().max(100).optional(),
    sku: z.string().max(100).optional(),
    size: z.string().max(50).optional(),
    color: z.string().max(50).optional(),
    material: z.string().max(100).optional(),
    remark: z.string().max(1000).optional(),
    deadline: z.string().optional(),
    quantity: z.number().int().positive().max(99999).optional(),
    image: z.string().optional(),
    image_url: z.string().optional(),
  }).optional(),
}).strict();
```

**改动点：**

1. `functions/lib/hono/sales.js` — 新增 `UpdateSalesOrderSchema`
2. `functions/lib/hono/routes/sales/orders.js` 第 299 行 — 添加 `zValidator('json', UpdateSalesOrderSchema)`
3. 调整解构逻辑：从 `c.req.valid('json')` 取值而非 `await c.req.json()`

**影响范围：** 仅 `sales/orders.js` 和 schema 文件
**风险：** 低。现有的 `processOrderUpdate` 白名单不受影响，Zod 仅做入口校验。

---

## 三、管理端路由批量 Zod 验证

### 问题

管理端 7 个 orders 路由 + products/purchase-orders/notifications 等约 20 处路由缺少 Zod 验证。

### 方案

分批添加，按模块划分：

#### 第一批：Orders（7 处）

| 路由 | Schema 名 | 关键字段 |
|------|----------|---------|
| POST /orders | `CreateAdminOrderSchema` | customerName, lines[], source |
| POST /orders/batch | `BatchCreateOrderSchema` | orders[] (max 50) |
| PATCH /orders/:id | `UpdateAdminOrderSchema` | updates{}, reason |
| PATCH /orders/:id/status | `UpdateOrderStatusSchema` | status (enum), reason |
| PUT /orders/:id | `ReplaceAdminOrderSchema` | 同 Create |
| POST /orders/:id/comments | `AddOrderCommentSchema` | content (1-2000) |
| PATCH /orders/lines/:lineId | `UpdateOrderLineSchema` | quantity, status, remark |

#### 第二批：Products（4 处）

| 路由 | Schema 名 |
|------|----------|
| POST /products | `CreateProductSchema` |
| PATCH /products/:id | `UpdateProductSchema` |
| PUT /products/:id | `ReplaceProductSchema` |
| POST /products/batch | `BatchImportProductSchema` |

#### 第三批：其他（~10 处）

- `purchase-orders.js` — 8 处写操作
- `notifications.js` — 1 处
- `audit-replay.js` — 1 处

**改动点：**

1. 新建 `functions/lib/hono/schemas/order.js` — Orders 相关 schema
2. 新建 `functions/lib/hono/schemas/product.js` — Products 相关 schema
3. 新建 `functions/lib/hono/schemas/purchase-order.js` — 采购单 schema
4. 各路由文件添加 `zValidator('json', XxxSchema)`

**实施策略：** 逐模块 PR，每个 PR 独立可合并，避免大爆炸式改动。

**影响范围：** 约 20 个路由文件 + 4 个新 schema 文件
**风险：** 中。需确保 schema 宽松 enough 不阻断现有合法请求。建议先上线 `strip()` 模式（忽略未知字段），观察日志无误后再切 `.strict()`。

---

## 四、响应格式统一

### 问题

列表接口返回结构不一致：

| 接口 | 数据字段 | 分页位置 | 分页字段 |
|------|---------|---------|---------|
| tags | `tags` (顶层) | 无分页 | — |
| albums/folders/trash | `data: [...]` | 顶层 `pagination` | page/limit/total/totalPages |
| orders | `data.orders` | `data.pagination` | page/limit/total/totalPages |
| customers | `data.list` | `data` 内 | page/limit/total/totalPages |
| shares | `data.items` | `data` 内 | page/total/totalPages |
| products | `data: [...]` | `meta` | total/page/limit |
| salespersons | `data.salespersons` | `data.pagination` | page/limit/total/totalPages |
| audit-logs | `data: [...]` | 顶层 `pagination` | page/pageSize/total/totalPages |

### 方案

定义统一的列表响应规范：

```js
// functions/api/utils/response.js 新增
export function paginatedList(data, pagination, extra = {}) {
  return {
    success: true,
    data,
    pagination: {
      page: pagination.page,
      limit: pagination.limit,
      total: pagination.total,
      totalPages: Math.ceil(pagination.total / pagination.limit),
    },
    ...extra,
  };
}

export function list(data, extra = {}) {
  return {
    success: true,
    data,
    ...extra,
  };
}
```

**统一规范：**

```jsonc
// 列表（有分页）
{
  "success": true,
  "data": [...],
  "pagination": { "page": 1, "limit": 20, "total": 100, "totalPages": 5 }
}

// 列表（无分页）
{ "success": true, "data": [...] }

// 单条
{ "success": true, "data": { ... } }

// 操作成功
{ "success": true, "message": "..." }
```

**迁移策略（渐进式）：**

1. 新增 `paginatedList()` / `list()` 辅助函数
2. 新接口强制使用新格式
3. 旧接口分批迁移（每个模块一个 PR）
4. 迁移期间前端做兼容处理：
   ```js
   const items = res.data ?? res.data?.list ?? res.data?.orders ?? res.data?.items ?? []
   const pagination = res.pagination ?? res.data?.pagination ?? res.meta
   ```
5. 全部迁移完成后删除兼容代码

**影响范围：** 全部列表接口（~15 个）+ 对应前端调用
**风险：** 高。前端必须同步改动，否则数据解析失败。建议：
- 先在 preview 环境验证
- 每个模块独立 PR，前端+后端同 PR 提交
- 保留 1-2 个版本的兼容层

---

## 实施顺序建议

| 优先级 | 任务 | 工作量 | 依赖 |
|--------|------|--------|------|
| P0 | 测试旁路 Header 环境控制 | 0.5d | 无 |
| P1 | 销售端订单 PATCH Zod 验证 | 0.5d | 无 |
| P2 | 管理端 Orders Zod 验证 | 1d | 无 |
| P3 | 管理端 Products/其他 Zod 验证 | 1.5d | P2 完成后可并行 |
| P4 | 响应格式统一 | 3-5d | 需前端配合 |

P0-P2 可立即开始，无外部依赖。P4 建议排到下一个迭代，与前端团队协调。
