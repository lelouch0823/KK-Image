# 后端代码全面审查报告

**审查日期**: 2026-06-04
**审查范围**: `functions/` 全目录（repositories、services、routes、middleware、utils）
**审查维度**: 重复定义、封装一致性、代码质量、错误处理、安全风险、工具复用

---

## 一、高优先级问题（影响正确性/安全性）

### 1.1 事务安全缺陷

| 问题 | 文件 | 风险 |
|------|------|------|
| DemandService 库存写入无事务保护 | `services/DemandService.js:114-135` | 3 个独立 `.run()` 非原子，数据不一致 |
| VariantDemandProjection DELETE+INSERT 非原子 | `repositories/VariantDemandProjectionRepository.js:86-104` | INSERT 失败则数据丢失 |
| CategoryRepository DELETE+INSERT 非原子 | `repositories/CategoryRepository.js:167-205` | 关联数据可能清空 |
| PurchaseOrderService 级联更新回滚可能失败 | `services/PurchaseOrderService.js:221-335` | 部分回滚导致不一致 |

### 1.2 安全风险

| 问题 | 文件 | 风险 |
|------|------|------|
| 微信 API 原始错误暴露给客户端 | `routes/sales/profile.js:49` | 信息泄露 |
| settings 接口泄露 AI_API_KEY | `routes/manage/settings.js:145` | 密钥泄露 |
| errorHandler statusMap 引用不存在的错误类 | `middleware/errorHandler.js:33-40` | 4xx 错误全部回退 500 |
| webhook test/retry 无 SSRF 二次校验 | `routes/manage/webhooks.js:236` | SSRF 攻击 |
| backup DELETE 端点缺路径遍历校验 | `routes/manage/backups.js:197` | 路径遍历 |
| UpdateAdminOrderSchema 过于宽松 | `schemas/order.js:55` | 任意字段注入 |

### 1.3 常量值不一致

| 问题 | 文件 | 风险 |
|------|------|------|
| D1 分块大小 100 vs 98 | `ProductVariantRepository.ts:21` vs 8+ 文件 | 运行时错误 |
| normalizeOrderStatus 四处实现行为不同 | 4 个文件 | 状态处理不一致 |
| DEMAND_ACTIVE_STATUSES 重复 4 处 | 3 个文件 | 状态变更遗漏同步 |

---

## 二、中优先级问题（影响维护性/一致性）

### 2.1 重复常量定义

| 常量 | 重复次数 | 命名变体 |
|------|----------|----------|
| D1 分块大小 | 12+ | `D1_MAX_IN_CLAUSE_SIZE`, `D1_MAX_BATCH_SIZE`, `D1_CHUNK_SIZE` |
| WEBHOOK_TIMEOUT_MS | 4 | 统一值 10_000 |
| TZ_OFFSET | 2 | `TZ_OFFSET_MS`, `TZ_OFFSET` |
| DEMAND_ACTIVE_STATUSES | 4 | Set/Array/SQL 字符串 |
| 配送状态枚举 | 5+ | 硬编码数组，未引用 `constants.js` |

### 2.2 重复函数实现

| 函数 | 重复次数 | 涉及文件 |
|------|----------|----------|
| `timingSafeEqual` | 5 | id.js, auth.js, crypto.js, cron-auth.js, ErpSyncService.js |
| `base64UrlEncode/Decode` | 3 | auth.js, id.js, crypto.js |
| `sha256Hex` | 2 | id.js, crypto.js |
| `toNumber` | 3 | purchase-order-read-model.js, PurchaseOrderService.js, InventoryProjectionService.js |
| `normalizeOrderStatus` | 4 | order-state-machine.js, order/helpers.js, OrderDeliveryService.js, order-demand-sync.js |
| `normalizeDeliveryStatus` | 3 | order/helpers.js, OrderDeliveryService.js, constants.js |
| `normalizeFulfillmentStatus` | 2 | order/helpers.js, OrderDeliveryService.js |
| `sanitizeFts5Query` | 2 | search.js, order/queries.js |
| `escapeCSV` | 3 | csv.js, orders/list.js, goods-overview.js |
| `isEmptyValue` | 2 | product-schema.js, variant-matching.js |
| `queryOrderLineCandidates` | 2 | InventoryService.js, DemandService.js |
| `queryCompatibilityOrderLines` | 2 | OrderProcurementDomainService.js, PurchaseOrderShortageClosureService.js |
| `toNonNegativeInt` | 5 | shared/utils, OrderStatusProjectionService.js, OrderLineFulfillmentService.js, PurchaseOrderService.js, InventoryProjectionService.js |
| `placeholders()` 手动实现 | 40+ | 几乎所有 repository |
| `parseInt` 分页解析 | 10+ | 多个路由文件 |

### 2.3 Repository 封装不一致

| 问题 | 涉及范围 |
|------|----------|
| ID 生成混用 `crypto.randomUUID()` vs `generateId()` | ~20 处 |
| 时间戳获取 3 种方式（`Date.now()` / `now()` / `this.now`） | 多个 repository |
| 构造函数签名不一致（`db` / `db, jwtSecret` / `db, deps`） | 多个 repository |
| `delete` 返回值不一致（void / boolean） | 多个 repository |
| `update` 签名不一致（对象 / SQL 片段） | FolderRepository, AlbumRepository |
| TypeScript/JavaScript 混用 | 8 个 TS + 40+ 个 JS |

### 2.4 Service 层职责问题

| 问题 | 文件 |
|------|------|
| DomainOutboxConsumers.js 上帝模块（1142 行，7+ 职责） | `services/DomainOutboxConsumers.js` |
| PurchaseOrderService 聚合过多领域逻辑（739 行） | `services/PurchaseOrderService.js` |
| DemandService 混合订单行查询和库存变异 | `services/DemandService.js` |
| InventoryService 同上 | `services/InventoryService.js` |
| PurchaseOrderService 不支持 DI | `services/PurchaseOrderService.js:204-211` |
| StocktakeRepository 混合业务逻辑 | `repositories/StocktakeRepository.js:210-327` |

### 2.5 API 路由层问题

| 问题 | 涉及范围 |
|------|----------|
| Schema 内联在路由文件而非 schemas/ 目录 | 13+ 路由文件 |
| manage/folders.js 与 schemas/folder.js Schema 重复 | 2 文件 |
| v1/webhooks.js 与 manage/webhooks.js 逻辑重复 | 2 文件 |
| 变量命名不一致（`app` vs `categoriesRoute`） | 3 文件 |
| ai.js 严重业务逻辑泄漏（680+ 行） | `routes/manage/ai.js` |
| sales/orders.js 包含大量订单处理逻辑 | `routes/sales/orders.js` |
| search.js 包含原始 SQL 查询 | `routes/manage/search.js` |
| trash.js 直接操作 R2 存储 | `routes/manage/trash.js` |

### 2.6 错误处理不一致

| 问题 | 涉及范围 |
|------|----------|
| errorHandler 用 `error` 字段，response.js 用 `message` 字段 | 2 文件 |
| 部分路由直接 `c.json()` 绕过 errorHandler | 4+ 路由 |
| Repository 层抛出原始 `Error` 而非 AppError 子类 | 5+ repository |
| 硬编码中文/英文错误消息未使用 MSG 常量 | 7+ 路由 |
| ProductProjectionRefreshService 吞没错误 | `services/ProductProjectionRefreshService.js` |
| EmailService/WebhookNotificationService 静默失败 | 2 文件 |

---

## 三、低优先级问题（代码风格/清理）

### 3.1 未使用的工具函数

- `response.js`: `paginatedList`, `list`（已定义但从未使用）
- `id.js`: `isValidUrl`, `isoToTimestamp`
- `date.js`: `getNow`
- `_shared/utils.js`: `toPositiveInt`（仅 barrel 导出，外部未使用）

### 3.2 重复的 SQL 模式

- 库存 COALESCE 表达式重复 27 处
- 日期趋势查询 `DATE(created_at / 1000, 'unixepoch', '+8 hours')` 重复 8+ 处
- 配送状态 CASE 表达式重复 2 处
- RFM 分段逻辑重复 2 处
- 回收站路径 CTE 重复 2 处
- `checkNameConflict` 逻辑重复 2 处

### 3.3 组织问题

- `crypto.js` 与 `id.js` 职责重叠
- `_shared/utils.js` barrel 过度导出
- `routes/manage/utils.js` 命名误导（实际是 check-hash 路由）
- `ai-tool-executor.js` 中的通用工具函数未提取

---

## 四、重构建议（按优先级排序）

### P0: 立即修复（正确性/安全性）

1. **修复 errorHandler statusMap** — 匹配实际错误类名
2. **修复 DemandService 事务安全** — 统一使用 InventoryService.buildMutationStatements + batch
3. **修复微信错误信息泄露** — profile.js 改为通用错误消息
4. **移除 settings API_KEY 返回** — 掩码或省略
5. **修复 D1 分块常量不一致** — 确认 98 vs 100，统一来源
6. **加强 webhook SSRF 防护** — test/retry 前二次校验 URL
7. **加强 backup DELETE 路径遍历防护**

### P1: 消除重复（维护性）

8. **统一常量定义** — D1 分块、WEBHOOK_TIMEOUT、TZ_OFFSET、状态枚举
9. **统一工具函数** — timingSafeEqual、base64Url、sha256Hex、toNumber、placeholders
10. **统一 normalize 系列函数** — normalizeOrderStatus、normalizeDeliveryStatus、normalizeFulfillmentStatus
11. **提取重复 SQL 片段** — 库存 COALESCE、日期趋势、配送状态 CASE
12. **统一 ID 生成和时间戳** — 全部使用 generateId() 和 now()

### P2: 架构改进（可维护性）

13. **拆分 DomainOutboxConsumers.js** — 6 个独立 consumer 模块
14. **拆分 PurchaseOrderService** — CostAllocationService + PurchaseSuggestionService
15. **提取共享订单行查询** — order-line-shared.js
16. **提取幂等命令处理** — executeIdempotentCommand 高阶函数
17. **统一 Repository 封装** — 构造函数、返回值、错误类型
18. **统一错误类型** — Repository 层使用 AppError 子类

### P3: 路由层整理

19. **Schema 迁移到 schemas/ 目录** — 13+ 文件
20. **ai.js 业务逻辑下沉到 Service** — AIService + AIReportService
21. **sales/orders.js 逻辑下沉** — OrderCreationService
22. **search.js SQL 下沉到 SearchRepository**
23. **合并 v1/manage 重复路由** — 或明确职责差异
24. **统一分页验证** — PaginationQuerySchema

---

## 五、影响统计

| 维度 | 问题数 | 涉及文件 |
|------|--------|----------|
| 事务安全 | 4 | 4 文件 |
| 安全风险 | 6 | 6 文件 |
| 重复常量 | 5 类 | 25+ 文件 |
| 重复函数 | 15+ | 50+ 文件 |
| Repository 不一致 | 6 类 | 40+ 文件 |
| Service 职责 | 6 | 6 文件 |
| 路由层问题 | 8 类 | 20+ 文件 |
| 错误处理 | 6 类 | 20+ 文件 |
| 未使用代码 | 4 | 4 文件 |
| SQL 重复 | 6 类 | 15+ 文件 |
