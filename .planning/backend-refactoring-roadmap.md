# 后端大型重构任务开发计划

**创建日期**: 2026-06-04
**基于**: 后端代码全面审查报告 (backend-audit-2026-06.md)
**前置工作**: P0-P3 基础重构已完成（120+ 处问题修复）

---

## 一、任务总览

| 编号 | 任务 | 优先级 | 复杂度 | 预估工时 | 依赖 |
|------|------|--------|--------|----------|------|
| R1 | 拆分 DomainOutboxConsumers.js | 高 | 高 | 3-4 天 | 无 |
| R2 | 拆分 PurchaseOrderService | 高 | 中 | 2-3 天 | 无 |
| R3 | ai.js 业务逻辑下沉 | 高 | 高 | 3-4 天 | 无 |
| R4 | sales/orders.js 逻辑下沉 | 中 | 中 | 2 天 | 无 |
| R5 | search.js SQL 下沉 | 中 | 低 | 1 天 | 无 |
| R6 | Schema 迁移到 schemas/ 目录 | 中 | 中 | 2 天 | 无 |
| R7 | 合并 v1/manage 重复路由 | 低 | 高 | 3 天 | R6 |
| R8 | 统一 Repository 封装 | 中 | 中 | 2-3 天 | 无 |
| R9 | 合并重复 SQL 片段 | 低 | 低 | 1 天 | 无 |

**总预估工时**: 19-23 天

---

## 二、详细任务说明

### R1: 拆分 DomainOutboxConsumers.js（1142 行 → 6 个模块）

**目标**: 将上帝模块拆分为独立的 consumer 模块

**当前问题**:
- 单文件 1142 行，承担 7+ 个职责
- 缓存失效、通知创建、Webhook 分发、渠道通知、邮件发送、审计事件、读模型刷新全部混在一起
- `resolveExpandedCacheUrls` 函数超过 100 行，包含 12 个 if 分支

**拆分方案**:
```
functions/services/
├── DomainOutboxConsumers.js          # 精简为注册表（~100 行）
└── consumers/
    ├── audit-consumer.js             # auditOutboxEvent（~80 行）
    ├── cache-consumer.js             # invalidateReceiptCaches + 缓存 URL 解析（~150 行）
    ├── notification-consumer.js      # notifyOutboxEvent + 通知内容解析（~120 行）
    ├── webhook-consumer.js           # webhookOutboxEvent（~80 行）
    ├── channel-notify-consumer.js    # channelNotifyOutboxEvent（~100 行）
    └── email-consumer.js             # emailNotifyOutboxEvent（~80 行）
```

**实施步骤**:
1. 创建 `consumers/` 目录
2. 逐一提取 consumer 函数：
   - `audit-consumer.js`: 提取 `auditOutboxEvent` 函数
   - `cache-consumer.js`: 提取 `invalidateReceiptCaches` + `resolveExpandedCacheUrls`
   - `notification-consumer.js`: 提取 `notifyOutboxEvent` + 通知标题/内容/接收人解析
   - `webhook-consumer.js`: 提取 `webhookOutboxEvent`
   - `channel-notify-consumer.js`: 提取 `channelNotifyOutboxEvent`
   - `email-consumer.js`: 提取 `emailNotifyOutboxEvent`
3. 修改 `DomainOutboxConsumers.js` 为纯注册表，import 并调用各 consumer
4. 运行测试验证

**风险点**:
- consumer 之间可能有隐式依赖
- 缓存 URL 解析逻辑复杂，需仔细测试
- 通知内容解析涉及多语言模板

**测试策略**:
- 为每个 consumer 编写独立单元测试
- 运行现有 outbox 相关测试
- 手动测试通知发送流程

---

### R2: 拆分 PurchaseOrderService（739 行 → 3 个服务）

**目标**: 将聚合的领域逻辑拆分为独立子服务

**当前问题**:
- 单文件 739 行，包含状态机、成本分摊、采购建议、库存更新等多个子领域
- 构造函数硬编码实例化，不支持 DI

**拆分方案**:
```
functions/services/
├── PurchaseOrderService.js           # 精简为核心状态机（~300 行）
├── CostAllocationService.js          # 成本分摊逻辑（~150 行）
└── PurchaseSuggestionService.js      # 采购建议逻辑（~200 行）
```

**实施步骤**:
1. 提取 `CostAllocationService`:
   - `allocateCosts` 方法（按件数/按金额两种算法）
   - 相关的辅助函数
2. 提取 `PurchaseSuggestionService`:
   - `getSuggestions` 方法（含复杂 SQL 和降级查询）
   - 相关的查询逻辑
3. 修改 `PurchaseOrderService`:
   - 注入 `CostAllocationService` 和 `PurchaseSuggestionService`
   - 构造函数改为 DI 模式: `constructor(db, deps = {})`
4. 更新调用方

**风险点**:
- 成本分摊与状态机有交互
- 采购建议查询可能被其他地方调用
- 需要保持向后兼容的 API

**测试策略**:
- 为 CostAllocationService 编写单元测试
- 为 PurchaseSuggestionService 编写单元测试
- 运行现有采购单相关测试

---

### R3: ai.js 业务逻辑下沉（680+ 行 → Service 层）

**目标**: 将路由层的业务逻辑抽取到 Service 层

**当前问题**:
- 单文件 680+ 行，包含完整业务逻辑
- 工具函数内联（parseBooleanFlag、logModelUsageTelemetry 等）
- 配置解析逻辑在路由层（resolveAIRuntimeEnv）
- /chat 和 /stream handler 重复大量逻辑

**拆分方案**:
```
functions/services/
├── AIService.js                      # /chat 和 /stream 核心流程（~300 行）
├── AIReportService.js                # /report 数据聚合（~100 行）
└── AIConfigService.js                # 配置解析逻辑（~80 行）

functions/lib/hono/routes/manage/
└── ai.js                             # 精简为路由层（~100 行）
```

**实施步骤**:
1. 提取 `AIConfigService`:
   - `resolveAIRuntimeEnv` 函数
   - 配置解析相关辅助函数
2. 提取 `AIService`:
   - `/chat` handler 核心逻辑
   - `/stream` handler 核心逻辑
   - tool 执行循环
   - telemetry 记录
3. 提取 `AIReportService`:
   - `/report` handler 数据聚合
   - 报告生成逻辑
4. 精简 `ai.js` 路由文件:
   - 仅保留参数验证、中间件编排、响应格式化
5. 提取内联工具函数到 `ai-utils.js`

**风险点**:
- AI 流式响应（SSE）处理复杂
- tool_calls 循环逻辑需要仔细测试
- telemetry 记录不能丢失

**测试策略**:
- 为 AIService 编写单元测试（mock OpenAI API）
- 为 AIConfigService 编写单元测试
- 运行现有 AI 相关测试
- 手动测试流式响应

---

### R4: sales/orders.js 逻辑下沉

**目标**: 将订单创建/修改的业务逻辑抽取到 Service 层

**当前问题**:
- 包含订单行数据规范化、商品/变体绑定验证、需求同步、文件归档等复杂业务
- 修改订单处理器中包含绑定快照构建、字段过滤、需求同步、状态流转

**拆分方案**:
```
functions/services/
└── OrderCreationService.js           # 订单创建/修改流程（~200 行）

functions/lib/hono/routes/sales/
└── orders.js                         # 精简为路由层（~150 行）
```

**实施步骤**:
1. 提取 `OrderCreationService`:
   - `normalizeOrderLines` - 订单行数据规范化
   - `validateProductVariantBinding` - 商品/变体绑定验证
   - `buildBindingSnapshot` - 快照构建
   - `syncDemand` - 需求同步
   - `archiveFiles` - 文件归档
2. 修改 `orders.js` 路由:
   - 仅保留参数验证和响应格式化
3. 复用已有的 `DemandService` 和 `DomainOutboxPublisher`

**风险点**:
- 订单创建流程涉及多表操作
- 需求同步需要与 DemandService 协调
- 文件归档涉及 R2 操作

**测试策略**:
- 为 OrderCreationService 编写单元测试
- 运行现有订单相关测试
- 手动测试订单创建/修改流程

---

### R5: search.js SQL 下沉

**目标**: 将搜索 SQL 查询抽取到 SearchRepository

**当前问题**:
- 4 个搜索函数（searchFiles、searchProducts、searchOrders、searchCustomers）直接编写 SQL
- 包含 FTS5 MATCH + LIKE 降级逻辑
- FTS 表检测缓存逻辑

**拆分方案**:
```
functions/repositories/
└── SearchRepository.js               # 搜索查询（~200 行）

functions/lib/hono/routes/manage/
└── search.js                         # 精简为路由层（~80 行）
```

**实施步骤**:
1. 创建 `SearchRepository`:
   - `searchFiles(query, options)`
   - `searchProducts(query, options)`
   - `searchOrders(query, options)`
   - `searchCustomers(query, options)`
   - FTS 表检测缓存逻辑
2. 修改 `search.js` 路由:
   - 仅保留参数验证、scope 路由、响应格式化
3. 复用已有的 `sanitizeFts5Query`（已提取到 fts.js）

**风险点**:
- FTS5 查询语法复杂
- LIKE 降级逻辑需要保持
- 搜索结果排序需要保持一致

**测试策略**:
- 为 SearchRepository 编写单元测试
- 运行现有搜索相关测试
- 手动测试搜索功能

---

### R6: Schema 迁移到 schemas/ 目录

**目标**: 将路由内联的 Zod Schema 迁移到 schemas/ 目录

**当前问题**:
- 13+ 路由文件将 Schema 内联定义
- manage/folders.js 与 schemas/folder.js 重复定义
- v1/webhooks.js 与 manage/webhooks.js 重复定义

**迁移清单**:
| 路由文件 | Schema | 目标文件 |
|----------|--------|----------|
| manage/customers.js | CreateCustomerSchema, UpdateCustomerSchema, 等 7 个 | schemas/customer.js |
| manage/salespersons.js | CreateSalespersonSchema, UpdateSalespersonSchema | schemas/salesperson.js |
| manage/notifications.js | CreateNotificationSchema | schemas/notification.js |
| manage/tags.js | CreateTagSchema, AssignTagSchema | schemas/tag.js |
| manage/settings.js | BatchSettingsSchema, UpdateSettingSchema, 等 4 个 | schemas/settings.js |
| manage/files.js | DeleteFilesSchema, MoveFilesSchema, RenameFileSchema | schemas/file.js（扩展） |
| manage/folders.js | CreateFolderSchema, UpdateFolderSchema | schemas/folder.js（统一） |
| manage/trash.js | RestoreSchema, DeleteTrashSchema | schemas/trash.js |
| manage/stocktakes.js | CreateStocktakeSchema, 等 3 个 | schemas/stocktake.js |
| manage/webhooks.js | CreateWebhookSchema, UpdateWebhookSchema | schemas/webhook.js |
| v1/webhooks.js | CreateWebhookSchema | schemas/webhook.js（复用） |
| sales/auth.js | SalesAuthSchema | schemas/sales.js（扩展） |

**实施步骤**:
1. 创建缺失的 schema 文件
2. 逐一迁移 Schema:
   - 从路由文件中提取 Schema 定义
   - 放入对应的 schema 文件
   - 更新路由文件的 import
3. 消除重复定义（folders.js、webhooks.js）
4. 运行测试验证

**风险点**:
- Schema 可能有细微差异需要统一
- 需要保持向后兼容的验证行为

**测试策略**:
- 运行现有 schema 测试
- 运行路由测试验证接口行为不变

---

### R7: 合并 v1/manage 重复路由

**目标**: 明确 v1 和 manage 路由的职责差异，消除重复

**当前问题**:
- v1/files.js 和 manage/files.js 功能高度重复
- v1/folders.js 和 manage/folders.js 功能高度重复
- v1/webhooks.js 和 manage/webhooks.js 功能高度重复

**方案选择**:

**方案 A: v1 成为 manage 的薄代理**
```js
// v1/files.js
import { filesRoute } from '../manage/files.js';
export default filesRoute;
```

**方案 B: 明确职责差异**
- v1: 面向外部 API，简化版本，只读 + 基本操作
- manage: 面向管理后台，完整功能

**方案 C: 废弃 v1 路由**
- 如果 v1 路由未被外部使用，直接废弃

**实施步骤**:
1. 分析 v1 路由的使用情况
2. 选择方案并实施
3. 更新 API 文档
4. 运行测试验证

**风险点**:
- 可能有外部系统依赖 v1 路由
- 需要确认 API 版本策略

---

### R8: 统一 Repository 封装

**目标**: 统一所有 Repository 的构造函数、返回值、错误处理

**当前问题**:
- 构造函数签名不一致（db / db, jwtSecret / db, deps）
- delete 返回值不一致（void / boolean）
- update 签名不一致（对象 / SQL 片段）
- TypeScript/JavaScript 混用

**统一规范**:
```js
// 构造函数
constructor(db, deps = {}) {
  this.db = db;
  this.now = deps.now || Date.now;
}

// 返回值
create() → { id }
findById() → object | null
update() → boolean (是否实际更新)
delete() → boolean (是否实际删除)
```

**实施步骤**:
1. 定义 Repository 接口规范
2. 逐一更新 Repository:
   - 统一构造函数签名
   - 统一返回值类型
   - 统一错误处理
3. 更新调用方
4. 运行测试验证

**风险点**:
- 可能有代码依赖当前的返回值格式
- TypeScript Repository 需要更新类型定义

---

### R9: 合并重复 SQL 片段

**目标**: 提取重复的 SQL 表达式为常量或函数

**当前问题**:
- 日期趋势查询 `DATE(created_at / 1000, 'unixepoch', '+8 hours')` 重复 8+ 处
- 配送状态 CASE 表达式重复 2 处
- 销售员订单数统计子查询重复 2 处
- 回收站路径 CTE 重复 2 处

**提取方案**:
```js
// lib/db/date-sql.js
export const CHINA_DATE_EXPR = "DATE(created_at / 1000, 'unixepoch', '+8 hours')";

// lib/db/order-sql.js
export function buildDeliveryStatusCase(tableAlias) { ... }

// lib/repositories/shared-ctes.js
export const TRASH_PATHS_CTE = "WITH RECURSIVE folder_paths AS ...";
```

**实施步骤**:
1. 创建 `lib/db/date-sql.js`
2. 创建 `lib/db/order-sql.js`
3. 提取共享 CTE
4. 更新所有引用
5. 运行测试验证

---

## 三、实施顺序建议

### 第一阶段（1-2 周）: 高优先级 + 低风险
1. **R5: search.js SQL 下沉**（1 天）- 最简单，快速收益
2. **R6: Schema 迷移到 schemas/**（2 天）- 纯重构，无逻辑变更
3. **R9: 合并重复 SQL 片段**（1 天）- 纯重构，无逻辑变更

### 第二阶段（2-3 周）: 中优先级 + 中风险
4. **R2: 拆分 PurchaseOrderService**（2-3 天）- 明确的子领域边界
5. **R4: sales/orders.js 逻辑下沉**（2 天）- 复用已有 Service
6. **R8: 统一 Repository 封装**（2-3 天）- 逐步推进

### 第三阶段（3-4 周）: 高优先级 + 高风险
7. **R1: 拆分 DomainOutboxConsumers.js**（3-4 天）- 核心模块，需仔细测试
8. **R3: ai.js 业务逻辑下沉**（3-4 天）- 复杂业务逻辑

### 第四阶段（可选）: 低优先级
9. **R7: 合并 v1/manage 重复路由**（3 天）- 需确认使用情况

---

## 四、验收标准

每个任务完成后需要满足：

1. **测试通过**: `pnpm test:unit:run` 全部通过
2. **Lint 通过**: `pnpm lint` 无新增错误
3. **功能不变**: API 行为保持一致
4. **代码质量**:
   - 单文件不超过 300 行
   - 单一职责原则
   - 无重复代码
5. **文档更新**: 更新相关的 CLAUDE.md 或 README

---

## 五、风险缓解

1. **分支策略**: 每个任务在独立分支开发，完成后合并
2. **渐进式重构**: 每次只改一个模块，确保可回滚
3. **测试先行**: 重构前先补充缺失的测试
4. **代码审查**: 重大变更需要 review
5. **灰度发布**: 先在 preview 环境验证
