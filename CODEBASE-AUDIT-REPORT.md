# 代码质量审查报告

## 📊 概览
- **语言/框架**：JavaScript/Vue 3 + Cloudflare Workers (Hono)
- **审查范围**：全项目（src/、functions/、shared/）
- **扫描版本**：v4（含 Vue 局部函数过滤、barrel 路径验证、迁移残留死代码检测）
- **发现总数**：扫描 86 个标记（⚠ 56 / 🔴 1 / ℹ️ 29），经验证确认 **17 个真实问题**（🔴 高 1 / 🟡 中 6 / 🟢 10）
- **误报率**：约 55%（v4 过滤了 Vue 组件局部函数后，误报从 31 个降至约 20 个）

## 🔴 高优先级问题

### [H1] Repository 层反向依赖 Service 层的 DB 查询函数
- **类型**：架构问题（依赖方向反转）
- **位置**：`functions/repositories/order/mutations.js:19`
- **描述**：`mutations.js` 导入了 `services/order-procurement/order-line-prefetch.js` 中的 `prefetchOrderLineStates`，该函数直接执行 `db.prepare(...)` 数据库查询
- **影响**：Repository 层不应调用 Service 层的数据访问逻辑，违反分层架构。虽然目的是避免 N+1 查询（性能优化），但获取数据的责任应在 Repository 内部
- **建议**：将 `prefetchOrderLineStates` 移到 `functions/repositories/order/` 目录下

## 🟡 中优先级问题

### [M1] 8 个 Repository 的 JS/TS 迁移残留
- **类型**：迁移残留
- **位置**：`functions/repositories/` 下 8 个文件同时存在 `.js` 和 `.ts` 版本
- **涉及文件**：CustomerRepository、NotificationRepository、ProductRepository、ProductVariantRepository、SalespersonRepository、SettingsRepository、SpaceRepository、TagRepository
- **描述**：项目曾启动后端 TS 迁移（commit `e748b63e`），但迁移未完成。`tsconfig.backend.json` 存在但未接入构建流程，所有导入路径使用 `.js` 扩展名，`.js` 文件是活跃的权威版本（最后修改时间晚于 `.ts`）
- **影响**：开发者可能误以为改 `.ts` 就生效，但实际运行的是 `.js`。8 个 `.ts` 文件（共约 3700 行）是死代码
- **建议**：删除 8 个 `.ts` 文件。如后续要重启 TS 迁移，再统一推进

### [M2] Stats.vue 和 SalesRanking.vue 中 4 个完全相同的颜色处理函数
- **类型**：重复定义
- **位置**：`src/views/Stats.vue:334-355`，`src/components/dashboard/SalesRanking.vue:222-243`
- **描述**：`hexToRgb`、`colorToRgb`、`readCssColorChain` 三个函数在两处完全相同。而 `src/utils/dashboard-charts.ts` 中已有功能等价的 `hexToRgbChannels` 和 `colorToRgbChannels`（更健壮，有 `normalizeHex` 预处理）
- **影响**：修改颜色处理逻辑时需要同步两处，容易遗漏
- **建议**：Stats.vue 和 SalesRanking.vue 改为从 `dashboard-charts.ts` 导入，并将 `readCssColorChain` 也提取到该文件

### [M3] formatVariantName 在 2 处完全相同
- **类型**：重复定义
- **位置**：`src/components/pricing/PriceRuleManager.vue:314`，`src/components/product/ProductVariantTable.vue:285`
- **描述**：两处实现完全相同（排序 keys + ` · ` 拼接）。注意 `ProductDetail.vue:559` 的版本逻辑不同（先 `parseJsonObject`，用 ` / ` 拼接），不应合并
- **影响**：修改变体名称格式时需同步两处
- **建议**：提取到 `src/utils/product.ts`，ProductDetail.vue 的不同版本保持独立

### [M4] formatCurrency 在 3 处重复定义（实现不同）
- **类型**：重复定义 + 行为不一致
- **位置**：`src/utils/formatters.ts:255`（已有共享版本）、`src/views/InventoryDashboard.vue:328`、`src/views/Stats.vue:421`
- **描述**：`formatters.ts` 已有完整的 `formatCurrency` 实现（支持 CNY 货币、null/undefined 处理、千分位），但 InventoryDashboard 和 Stats 各自定义了简化版本
- **影响**：不同页面的金额格式化行为不一致（如货币符号、小数位数）
- **建议**：两处改为从 `formatters.ts` 导入

### [M5] order-line-prefetch.js 放在 services 目录但本质是 Repository 级逻辑
- **类型**：架构问题（文件归属不当）
- **位置**：`functions/services/order-procurement/order-line-prefetch.js`
- **描述**：`prefetchOrderLineStates` 包含 `db.prepare(...)` 查询逻辑，本质上是 repository 级别的数据访问操作，却被放在了 `services/` 目录下
- **影响**：误导代码阅读者对层级职责的理解
- **建议**：移到 `functions/repositories/order/` 目录下

## 🟢 低优先级问题

### [L1] design-system/composed/ 依赖 components/ui/（4 处 import）
- **类型**：架构问题（目录归属）
- **位置**：`src/design-system/composed/` 下 4 个文件
- **描述**：`design-system/composed/` 的组件导入了 `components/ui/` 的原子组件（Modal、Select、AppIcon）。依赖方向本身合理（组合层 -> 原子层），但原子组件未纳入 `design-system` 范围内
- **影响**：`design-system` 无法独立于 `components/ui` 存在
- **建议**：在架构文档中明确 `design-system` 依赖 `components/ui` 作为其原子层，或将原子组件移入 `design-system/primitives/`

### [L2] Repository 层导入 Service 层的纯投影函数（3 处）
- **类型**：架构问题（命名/归属不当）
- **位置**：`functions/repositories/order/helpers.js:12`、`functions/repositories/order/mutations.js:15`
- **描述**：导入的 `projectOrderLineStatus` 是纯函数（无副作用、无 DB 访问），放在 `services/` 下是命名误导，但不构成真正的架构依赖反转
- **影响**：轻微，不影响运行时行为
- **建议**：将 `projectOrderLineStatus` 移到 `repositories/order/` 内部或 `shared/utils/`

### [L3] purchase-order-read-model.js 通过 services barrel 文件间接导入 shared/utils
- **类型**：架构问题（间接路径）
- **位置**：`functions/repositories/purchase-order-read-model.js:7`
- **描述**：通过 `../services/purchase-order-projection.js`（barrel re-export）间接引用 `shared/utils/purchase-order-projection.js`。路径解析正确（`../../shared/utils/` 从 `functions/services/` 回到项目根目录），但 Repository 直接导入 Service 层的 barrel 文件在语义上不够清晰
- **影响**：轻微，路径可正常解析
- **建议**：改为直接导入 `../../shared/utils/purchase-order-projection.js`

### [L4-L10] 其他低优先级问题
- **[L4]** 12 个 Vue 组件超过 600 行（最大 1266 行 ProductImportModal.vue）— 大组件是 Vue 项目的常见模式，非紧急
- **[L5]** `usePurchaseOrders.ts` (707行)、`useProductForm.ts` (660行) 等 composables 较大 — 可考虑拆分但非紧急
- **[L6]** `toFiniteNumber` 在 2 处定义，签名略有不同 — 工具函数，影响小
- **[L7]** `translateWithFallback` 在 2 处定义，参数数量不同 — i18n 工具，影响小
- **[L8]** `formatPurchaseOrderStatusLabel` 在 4 处定义 — 状态标签函数，可能各组件独立维护
- **[L9]** `formatProductStatusLabel` 在 2 处定义 — 同上
- **[L10]** `getStatusVariant` 在 3 处定义 — 状态样式映射，各组件独立

## ❌ 排除的误报（约 20 个）

### v4 脚本自动过滤的 Vue 组件局部函数（约 12 个）
`openCreateModal`、`openPreview`、`confirmDelete`、`copyLink`、`resetState`、`renderText`、`refreshOrderDetail` 等 — 以 `open|close|handle|toggle|submit|confirm|cancel|clear|reset|refresh|render` 开头的函数在 `.vue` 文件中自动排除

### 扫描脚本仍标记但验证为误报（4 个）
| 函数 | 误报原因 |
|------|---------|
| formatPrice | 两处实现不同（toLocaleString vs toFixed） |
| getFileUrl | 一行函数 `(id) => '/file/${id}'`，过于简单不值得提取 |
| openEditModal | 参数名不同（client vs conn），操作不同实体 |
| resetForm | 操作不同表单状态，是 Vue 组件标准模式 |

### 同名但不同值的合理情况（约 18 个）
`addFiles`(4处)、`changePage`(4处)、`formatDate`(5处)、`formatInteger`(2处)、`formatRelativeTime`(2处)、`getMainImageSrc`(3处)、`getTemplateLabel`(4处)、`isColorDimension`(2处)、`isSelected`(3处)、`navigateTo`(3处)、`normalizeVariantStatus`(2处)、`openDetail`(2处)、`openLightbox`(2处)、`openModal`(2处)、`removeFile`(3处)、`resolveAlertThreshold`(3处) — 标记为 ℹ️，扫描脚本正确识别为"值不同"

### 其他排除（3 个）
- `DEFAULT_OPTIONS`(2处) — 不同类型的不同默认值
- `DEFAULT_RGB_CHANNELS`(7处) — 包含引用该常量的函数定义
- `AppIcon.vue`(727行) — 扫描脚本已正确识别为 icon 数据文件

## 🔴 高优先级问题（第二轮新增）

### [H2] usePurchaseOrders 12+ 方法重复相同的 API 调用模式
- **类型**：未封装逻辑
- **位置**：`src/composables/usePurchaseOrders.ts:326-615`
- **描述**：`createPO`、`createFromOrders`、`updatePO`、`updateStatus`、`addItems`、`updateItem`、`deleteItem`、`addReceipt`、`reverseReceipt`、`addShortageClosure`、`allocateSuggestions`、`loadSuggestions` 共 12 个方法，结构完全相同：`try { fetch → json → check success → addToast } catch { addToast }`
- **影响**：约 300 行机械性重复代码。修改错误处理逻辑时需同步 12 处
- **建议**：在 `api-helpers.ts` 新增 `apiAction` 高阶函数封装该模式，将 12 个方法简化为单行调用

### [H3] D1 chunk size 重复定义且值不一致（100 vs 98）
- **类型**：重复定义 + 行为不一致
- **位置**：11 个文件
- **描述**：`D1_MAX_IN_CLAUSE_SIZE` 在 8 个文件中定义为 100，但 `ProductVariantRepository.js` 定义为 98。`D1_MAX_BATCH_SIZE`、`D1_CHUNK_SIZE`、`OUTBOX_EVENT_ID_BATCH_SIZE`、`ORDER_MUTATION_BATCH_SIZE` 语义相同但命名和值各异
- **影响**：值不一致可能导致 SQL IN 子句溢出或批次操作行为差异
- **建议**：在 `functions/api/utils/constants.js` 统一定义 `D1_MAX_IN_CLAUSE_SIZE = 100`，所有文件从统一位置导入

### [H4] `MS_PER_DAY` 已存在但 15+ 处手动计算 `24 * 60 * 60 * 1000`
- **类型**：重复定义
- **位置**：`functions/api/utils/constants.js`（已有定义）+ 15+ 处手动计算
- **描述**：`constants.js` 已定义 `MS_PER_DAY = 86_400_000`，但 `orders/list.js`、`spaces/crud.js`、`stats.js`、`profile.js`、`ai-tool-executor.js`、`PaymentRepository.js`、`CustomerRepository.ts`、`SalespersonRepository.js` 等仍在手动计算。风格不统一（有的用 `24 * 60 * 60 * 1000`，有的用 `86400000` 字面量）
- **影响**：修改时间计算逻辑时需同步 15+ 处
- **建议**：全部替换为 `import { MS_PER_DAY } from '...'`

## 🟡 中优先级问题（第二轮新增）

### [M6] `withCache()` TTL 裸数字散落 40+ 处
- **类型**：未封装逻辑
- **位置**：`functions/lib/hono/routes/` 下 40+ 处 `withCache()` 调用
- **描述**：TTL 值为裸数字（15、20、30、60、120、300），无语义化命名。分布：TTL=15（3处，高频数据）、TTL=20（12处，中频）、TTL=30（17处，低频）、TTL=60（5处，统计）
- **建议**：定义语义化常量 `CACHE_TTL_REALTIME=15`、`CACHE_TTL_SHORT=20`、`CACHE_TTL_MEDIUM=30`、`CACHE_TTL_LONG=60`、`CACHE_TTL_STATIC=120`

### [M7] `useFormValidation` 已实现但零采用
- **类型**：架构问题（基础设施未推广）
- **位置**：`src/composables/useFormValidation.ts`（450 行，功能完善）
- **描述**：该 composable 支持 Zod schema 和自定义规则，提供 `getFieldBindings`、`validateField`、`validateAll` 等方法，但 `grep -rn "import.*useFormValidation"` 返回零结果。所有表单验证仍分散在各组件内部
- **影响**：450 行代码未被使用，各组件重复实现验证逻辑
- **建议**：选择 1-2 个表单组件（如 OrderForm、CustomerForm）作为试点采用，验证可用性后逐步推广

### [M8] 分页逻辑三处不一致
- **类型**：重复定义 + 行为不一致
- **位置**：
  - 后端：`stocktakes.js:34` 手动 `Number(c.req.query('page'))` 绕过 `parsePagination`
  - 后端：`audit-logs.js:11` 自定义 `parseIntParam` + `pageSize` 参数名（其他路由用 `limit`）
  - 前端：`useSalesProducts.ts:17` 独立定义 `PaginationMeta`（无 `totalPages`），与 `useResource.ts:23` 的版本不同
- **建议**：后端两处改用 `parsePagination`；前端 `useSalesProducts` 引用 `useResource` 的 `PaginationMeta` 类型

### [M9] JWT 过期时间两处定义且表达式风格不同
- **类型**：重复定义
- **位置**：`functions/lib/hono/routes/v1/auth.js:91`（`7 * 24 * 60 * 60` 内联）、`functions/lib/hono/_shared/auth-helpers.js:29`（`SALES_COOKIE_MAX_AGE = 7 * 24 * 3600`）
- **描述**：值相同（604800 秒）但表达式不同（`60 * 60` vs `3600`），且一个硬编码在函数体中，一个是命名常量
- **建议**：在 `constants.js` 定义 `JWT_EXPIRY_SECONDS = 7 * 24 * 60 * 60`，两处统一引用

### [M10] 后端依赖违规修复未完成（已有修复副本但未切换路径）
- **类型**：架构问题（未完成的修复）
- **位置**：`functions/repositories/order/helpers.js:12`、`mutations.js:15`
- **描述**：`api/utils/order-projection.js` 已存在完全相同的代码，注释明确写道"从 OrderStatusProjectionService 提取为共享工具，使 Repository 层可以直接使用而不反向依赖 Service"。但 `helpers.js` 和 `mutations.js` 的 import 路径从未更新
- **建议**：只需更新 2 个 import 路径即可完成修复

## 🟢 低优先级问题（第二轮新增）

### [L11] 用户 ID 提取方式不一致（id vs sub）
- **类型**：行为不一致
- **位置**：大部分路由用 `c.get('user')?.id`，但 `oauth.js`、`erp-sync.js`、`stocktakes.js`、`orders/create.js` 用 `c.get('user')?.id || c.get('user')?.sub`
- **建议**：在 `authMiddleware` 层面统一 JWT 负载字段名

### [L12] `MAX_ITEMS` 同名不同值（3 处）
- **类型**：重复定义
- **位置**：`useRecentViews.ts`（10）、`useOrders.ts`（200/100）
- **建议**：加业务前缀区分（`MAX_RECENT_VIEW_ITEMS`、`MAX_ORDER_ITEMS`）

### [L13] 限流参数内联在函数体中
- **类型**：魔法数字
- **位置**：`functions/lib/hono/middleware/rateLimit.js:73-74`（`windowMs=60000`、`maxRequests=100`）
- **建议**：提取为模块级常量

## 📈 统计摘要

### 两轮审查总计

| 问题类型 | 第一轮 | 第二轮 | 合计 |
|----------|--------|--------|------|
| 🔴 高优先级 | 1 | 3 | **4** |
| 🟡 中优先级 | 6 | 5 | **11** |
| 🟢 低优先级 | 10 | 3 | **13** |
| **总计** | **17** | **11** | **28** |

### 按问题类型分布

| 问题类型 | 数量 | 占比 |
|----------|------|------|
| 重复定义 | 8 | 29% |
| 未封装逻辑 | 5 | 18% |
| 架构问题 | 7 | 25% |
| 迁移残留 | 1 | 4% |
| 魔法数字 | 4 | 14% |
| 行为不一致 | 3 | 11% |

### v3→v4 扫描脚本改进效果
- Vue 组件局部函数过滤：减少约 12 个误报
- barrel re-export 路径别名处理：减少 1 个误报（toneContract.ts）
- 迁移残留死代码标注：8 个 .ts 文件确认无引用
- 前端依赖方向修正：`design-system → components/ui` 不再标记为违规

### 已有良好实践（值得保持）
- `functions/api/utils/constants.js` 已有 `MS_PER_DAY`、订单状态等常量
- `LOGIN_LOCKOUT_CONFIG` 是配置对象的好范例
- 权限检查统一使用 `requirePermission` 中间件 + `useAccessControl` composable
- i18n fallback 实现正确
- `api-helpers.ts` 已有 `handleApiError`、`parseApiResponse` 等工具（但采用率不足）

## 🔧 扫描脚本优化建议

### 已在 v4 中实现
1. ✅ **排除 Vue 组件内的局部函数**：以 `open|close|handle|toggle|submit|confirm|cancel|clear|reset|refresh|render` 开头的函数自动排除
2. ✅ **barrel re-export 路径别名处理**：跳过 `@/`、`~/`、`#/` 开头的路径
3. ✅ **迁移残留死代码检测**：检查 `.ts` 文件是否被导入引用
4. ✅ **前端依赖方向修正**：`design-system → components/ui` 排除检查

### 待改进
1. **函数体行数比较**：当前的 body size 比较逻辑仍有 shell 错误，需要更精确的函数体边界检测
2. **区分工具函数和组件行为函数**：`formatXxx`、`toXxx`、`parseXxx` 等工具函数才是真正的重复候选；已在 SKILL.md 中记录为规则，但脚本未自动区分
3. **barrel re-export 目标文件存在性验证**：当前只检查了路径别名，对于相对路径的 barrel 文件仍需验证

## 📐 大文件拆分建议

> 以下 5 个文件是项目中行数最多的前端文件，拆分建议基于职责分析，不改变现有功能。

### [F1] ProductImportModal.vue (1266 行)

- **职责分析**：
  - 模板 UI（步骤导航 + 子步骤组件 + 底部操作栏）：~155 行
  - 系统字段定义 `SYSTEM_FIELDS`（18 个字段的 key/label/aliases）：~100 行
  - 工具函数（normalizeNumeric、normalizeStatus、normalizeCurrency、sanitizeOptionsValues、sanitizeMappedRow、formatFileSize 等）：~80 行
  - 文件解析 `processFile`（XLSX 动态导入、列头识别、自动映射）：~80 行
  - 映射确认 `handleConfirmMapping`（规格校验、行级验证、数据清洗）：~255 行
  - 图片匹配与上传 `performImageMatch` + `handleUploadImagesAndNext`：~130 行
  - 导入执行 `handleImport`（分组、分块、统计汇总）：~215 行
  - 状态管理与请求失效逻辑：~50 行
  - 其余（imports、props、watch、step 常量、spec 配置）：~200 行
- **拆分方案**：
  - `src/composables/product-import/useImportWorkflow.ts` — 步骤导航状态（currentStep、WORKFLOW_STEPS、step 切换逻辑、request invalidation），约 80 行
  - `src/composables/product-import/useImportParsing.ts` — 文件解析 + 字段映射（processFile、handleConfirmMapping、SYSTEM_FIELDS、specConfigs、rawFileRows、fieldMapping），约 350 行
  - `src/composables/product-import/useImportImageMatch.ts` — 图片匹配与上传（performImageMatch、handleUploadImagesAndNext、imageMatches、imageUploadFiles），约 130 行
  - `src/composables/product-import/useImportExecution.ts` — 导入执行（handleImport、分组逻辑、chunk 处理、importStats 汇总），约 250 行
  - `src/components/product/import/import-validators.ts` — 纯函数工具（normalizeNumeric、normalizeStatus、normalizeCurrency、sanitizeMappedRow、isMeaningfulRow 等），约 100 行
- **复杂度**：高（拆分涉及 4 个 composable 之间的状态传递，需谨慎设计接口）

### [F2] Stats.vue (964 行)

- **职责分析**：
  - 模板 UI（指标卡片、图表容器、排行榜、表格）：~300 行
  - 数据加载 `loadStats`（API 调用、错误处理）：~45 行
  - 图表配置与创建 `createCharts`（7 个 Chart.js 实例）：~450 行
  - 工具函数（formatNumber、configureChartDefaults）：~25 行
  - 生命周期（onMounted、onActivated、MutationObserver 主题监听）：~30 行
  - imports + 状态声明：~60 行
- **拆分方案**：
  - `src/composables/useStatsCharts.ts` — 图表创建逻辑（createCharts 函数、7 个 chart instance 管理、configureChartDefaults），约 470 行。接收 stats ref 作为参数，返回 chart refs 和 createCharts 方法
  - `src/views/stats/StatsMetricSections.vue` — 指标卡片区块子组件（存储指标、业务概览、利润概览、健康状态），约 120 行
  - `src/views/stats/StatsTrafficSection.vue` — 流量趋势 + 文件类型图表区块，约 40 行
  - `src/views/stats/StatsSalesSection.vue` — 销售趋势 + 热销排行 + 销售员业绩图表区块，约 60 行
  - Stats.vue 保留页面编排、数据加载、子组件组合，缩减至约 270 行
- **复杂度**：中（图表 composable 提取较直接，子组件拆分需注意 chart ref 的 DOM 绑定时机）

### [F3] PurchaseOrders.vue (903 行)

- **职责分析**：
  - 模板 UI（列表、分页、6 个 Teleport 弹层/drawer）：~300 行
  - Composable 编排与初始化（7 个 composable 的调用与解构）：~120 行
  - 详情操作处理（handleDetailUpdateItem、handleDetailRemoveItem、handleStatusUpdate）：~60 行
  - 展示层格式化（formatPurchaseCurrency、formatInteger、detailHelpers 对象）：~50 行
  - 路由/生命周期/订阅（onMounted、onActivated、watch、AI 上下文同步）：~100 行
  - 草稿恢复（useFormDraft 集成）：~30 行
  - imports：~80 行
  - 样式（骨架屏 shimmer、侧滑动画）：~45 行
- **拆分方案**：
  - 该文件**已经高度拆分**，7 个 composable 各司其职（usePurchaseOrders、usePurchaseOrderModals、usePurchaseOrderCreateFlow、usePurchaseOrderDetailActions、usePurchaseOrderListPresentation、usePurchaseOrderDetailPresentation、usePurchaseOrderSuggestionPresentation）。页面本身只做"编排"
  - `src/views/purchase-orders/usePurchaseOrderPageLifecycle.ts` — 生命周期与订阅逻辑（onMounted 订阅、onActivated 恢复、onDeactivated 清理 AI 上下文、onUnmounted 退订、路由 query 同步），约 80 行
  - `src/views/purchase-orders/detailHelpers.ts` — detailHelpers 对象的构建（formatInteger、formatPurchaseCurrency、formatDate、getProgressStatusLabel 等打包），约 30 行
  - 样式可移入 `src/views/purchase-orders/purchase-orders.css` 或保留 scoped（行数不多）
  - **总体建议**：该文件拆分优先级低，当前架构已合理。如需拆分，优先提取 lifecycle composable
- **复杂度**：低（已有良好的 composable 拆分基础，仅需微调）

### [F4] usePurchaseOrders.ts (707 行)

- **职责分析**：
  - 类型定义（PurchaseOrder、PurchaseOrderItem、PurchaseReceipt、PurchaseOrderDetail、PurchaseOrderStats、PurchaseOrderSuggestion、StatusStyleConfig 及各 Payload 接口）：~155 行
  - 状态声明与初始化（list、detail、suggestions、stats、filters、requestIds）：~35 行
  - 状态颜色映射 `statusConfig`：~35 行
  - 列表加载 `loadList` + 概览加载：~60 行
  - 详情加载 `loadDetail`：~35 行
  - CRUD 操作（createPO、createFromOrders、updatePO、updateStatus）：~90 行
  - 明细操作（addItems、updateItem、removeItem、recordReceipts、reverseReceipt、closeShortages）：~140 行
  - 成本分摊 `allocateCosts`：~25 行
  - 智能建议 `loadSuggestions`：~30 行
  - 统计加载 `loadStats`：~35 行
  - 返回值导出：~40 行
- **拆分方案**：
  - `src/composables/purchase-order/purchase-order-types.ts` — 类型定义（所有 interface），约 155 行
  - `src/composables/purchase-order/usePurchaseOrderCrud.ts` — CRUD 操作（createPO、createFromOrders、updatePO、updateStatus），约 90 行
  - `src/composables/purchase-order/usePurchaseOrderItems.ts` — 明细与收货操作（addItems、updateItem、removeItem、recordReceipts、reverseReceipt、closeShortages、allocateCosts），约 170 行
  - 主 composable 保留状态管理、列表/详情/建议/统计加载、statusConfig，缩减至约 280 行
  - **注意**：此文件已有 `apiAction` 高阶函数的采用（见 [H2] 修复），进一步压缩了行数。如 [H2] 已完成修复，实际可缩减空间更小
- **复杂度**：中（类型提取简单，CRUD/明细拆分需注意共享状态如 detail ref 的写穿逻辑 `canWriteThroughDetail`）

### [F5] useProductForm.ts (660 行)

- **职责分析**：
  - 类型定义（ProductOption、ProductVariant、ProductForm、DimensionArchiveWizard、ValueArchiveWizard、ImageObject 等）：~100 行
  - 表单状态初始化（form reactive、imageObjects、trackedDimensions、variantLocalKeySeed）：~55 行
  - 表单填充与重置（fillFormFromData、resetForm）：~60 行
  - 维度归档向导状态 + 操作（dimensionArchiveWizard、valueArchiveWizard、closeDimensionArchiveWizard、confirmDimensionArchive、closeValueArchiveWizard、confirmValueArchive）：~65 行（调用 createProductFormArchiveActions，逻辑已提取）
  - 选项 CRUD（addOption、removeOption、addOptionValue、removeOptionValue、restoreOptionValue）：~150 行
  - 变体辅助（generateVariants、formatVariantSample、handleUpdateVariantImages、handleBatchBuilderApply）：~60 行
  - trackedDimensions 操作（updateTrackedDimensionValue、findTrackedValueMeta）：~30 行
  - 请求失效与生命周期（invalidateAsyncActions、isAsyncActionActive、watch）：~40 行
  - 提交处理（handleSubmit，通过 createProductFormSubmitHandler 委托）：~25 行
  - 导出与 re-exports：~35 行
- **拆分方案**：
  - **已部分拆分**：该文件已从 `product-form/` 目录提取了 helpers.js、dimensions.js、variants.js、archives.js、archive-actions.js、submission.js 共 6 个子模块
  - `src/composables/product-form/useProductFormOptions.ts` — 选项 CRUD 逻辑（addOption、removeOption、addOptionValue、removeOptionValue、restoreOptionValue、trackedDimensions 操作），约 180 行。接收 form.options、form.variants、editMode、initialData 作为参数
  - `src/composables/product-form/product-form-types.ts` — 类型定义（所有 interface），约 100 行
  - 主 composable 保留表单状态、初始化、变体生成、归档向导编排、提交，缩减至约 350 行
- **复杂度**：中（选项 CRUD 与归档向导有紧密交互，拆分时需注意 asyncActionRequestId 的失效机制跨模块共享）

---

### 拆分优先级总结

| 优先级 | 文件 | 当前行数 | 建议拆分后 | 复杂度 | 理由 |
|--------|------|----------|------------|--------|------|
| 1 | ProductImportModal.vue | 1266 | ~250 (主文件) | 高 | 最大文件，5 个独立职责区块，拆分收益最高 |
| 2 | Stats.vue | 964 | ~270 (主文件) | 中 | 图表逻辑占 47%，提取 composable 后主文件大幅缩减 |
| 3 | usePurchaseOrders.ts | 707 | ~280 (主文件) | 中 | 类型定义 + CRUD 可独立提取 |
| 4 | useProductForm.ts | 660 | ~350 (主文件) | 中 | 已有 6 个子模块，进一步拆分空间有限 |
| 5 | PurchaseOrders.vue | 903 | ~750 (主文件) | 低 | 已高度拆分，仅需微调 |

### 后端大文件拆分建议

> 以下 5 个文件是 `functions/` 下行数最多的生产文件（不含测试）。

### [F6] order/mutations.js (1293 行) — `functions/repositories/order/mutations.js`

- **职责分析**：
  - 工具/辅助函数（unread字段映射、归档断言、断言语句、行状态快照、数量规范化、行构建、文件权限校验等）：~270 行
  - 订单创建 `create`：~120 行
  - 订单数据更新 `updateData`、`updateComposite`：~305 行
  - 状态变更 `updateStatus`、`batchUpdateStatus`：~155 行
  - 文件关联更新 `updateFiles`：~20 行
  - 已读/未读标记 `markAsRead`、`setUnread`：~20 行
  - 归档/恢复 `archive`、`restore`：~55 行
  - 级联删除 `deleteWithRelations`：~20 行
  - 兼容层（compat line progress/snapshot，与 order_lines 同步的旧逻辑）：~165 行
- **拆分方案**：
  - `functions/repositories/order/mutation-helpers.js` — 纯无副作用工具函数（unread映射、归档断言、断言语句、行规范化、快照构建、文件权限校验、batch执行），约 270 行
  - `functions/repositories/order/mutations-lifecycle.js` — 归档/恢复/级联删除/已读标记（`archive`、`restore`、`deleteWithRelations`、`markAsRead`、`setUnread`），约 95 行
  - `functions/repositories/order/mutations.js` — 保留核心写操作（`create`、`updateData`、`updateComposite`、`updateStatus`、`updateFiles`、`batchUpdateStatus`），约 770 行
- **复杂度**：中
- **理由**：工具函数和生命周期操作与核心 CRUD 逻辑耦合度低，拆出后 mutations.js 仍保留 770 行但职责更聚焦。兼容层目前与 updateComposite/updateStatus 紧密交织，不建议强行拆分。

### [F7] products/[id].js (1264 行) — `functions/lib/hono/routes/manage/products/[id].js`

- **职责分析**：
  - 幂等辅助函数 + 归档专用辅助：~125 行
  - 错误分类工具函数：~25 行
  - 声明 + 中间件 + 常量：~145 行
  - 商品详情 GET `/:id`：~45 行
  - 商品状态 PATCH `/:id/status`：~35 行
  - 规格维度 CRUD（create/update/archive/restore/values/impact）：~330 行
  - 变体图片 CRUD（add/sort/primary/delete）：~220 行
  - 价格规则 CRUD（get/upsert/delete）：~90 行
  - 商品更新 PATCH `/:id`：~55 行
  - 商品替换 PUT `/:id`：~55 行
  - 商品归档 DELETE `/:id`（含幂等恢复/审计）：~135 行
- **拆分方案**：
  - `functions/lib/hono/routes/manage/products/[id]/dimensions.js` — 规格维度相关路由（create/update/archive/values/restore/impact），约 330 行
  - `functions/lib/hono/routes/manage/products/[id]/variant-images.js` — 变体图片路由（add/sort/primary/delete），约 220 行
  - `functions/lib/hono/routes/manage/products/[id]/price-rules.js` — 价格规则路由（get/upsert/delete），约 90 行
  - `functions/lib/hono/routes/manage/products/[id]/index.js` — 商品主体路由（详情/状态更新/patch/put/archive），约 400 行
- **复杂度**：高
- **理由**：4 个完全独立的子资源域（dimensions、variant-images、price-rules、product core），互相无数据依赖。拆分后 Hono 需要用 `app.route()` 挂载子路由。维度和图片路由各自有大量重复的幂等+审计模式，拆分后可进一步提取公共模式。

### [F8] purchase-orders.js (1193 行) — `functions/lib/hono/routes/manage/purchase-orders.js`

- **职责分析**：
  - 声明 + 辅助函数（幂等、fingerprint、验证等）：~285 行
  - 列表/统计/建议/详情（GET routes）：~60 行
  - 收货 + 收货冲销 + 缺口关闭（POST receipts/reversal/shortage-closures）：~155 行
  - 创建 + 从订单创建（POST /, POST /from-orders）：~215 行
  - 更新 + 状态变更（PUT /:id, PATCH /:id/status）：~155 行
  - 明细操作（POST items, PATCH item, DELETE item）：~130 行
  - 成本分摊（POST /:id/allocate）：~25 行
- **拆分方案**：
  - `functions/lib/hono/routes/manage/purchase-orders/helpers.js` — 幂等键、fingerprint构建、校验辅助、审计声明，约 250 行
  - `functions/lib/hono/routes/manage/purchase-orders/items.js` — 明细 CRUD（POST items, PATCH item, DELETE item），约 130 行
  - `functions/lib/hono/routes/manage/purchase-orders/receipts.js` — 收货、收货冲销、缺口关闭，约 155 行
  - `functions/lib/hono/routes/manage/purchase-orders/index.js` — 列表/统计/建议/详情/创建/更新/状态变更/成本分摊，约 500 行
- **复杂度**：中
- **理由**：辅助函数占文件 24%，与多个路由共享，适合独立为 helpers。明细操作和收货操作是独立的子资源域，各路由间无交叉依赖。

### [F9] orders/detail.js (995 行) — `functions/lib/hono/routes/manage/orders/detail.js`

- **职责分析**：
  - 辅助函数（行规范化、状态断言、outbox调度等）：~135 行
  - 声明 + 中间件 + 常量：~95 行
  - 订单详情 GET `/:id`（含文件/时间轴/支付/利润聚合）：~65 行
  - 物流查询 GET `/:id/logistics` + 更新 PATCH `/:id/logistics`：~80 行
  - 订单修改 PATCH `/:id`（含绑定验证、行规范化、需求同步）：~250 行
  - 状态变更 PATCH `/:id/status`：~120 行
  - 确认送达 POST `/:id/delivery-confirmation`：~80 行
  - 添加备注 POST `/:id/comment`：~60 行
  - 归档/恢复/删除（archive/restore/delete）：~95 行
- **拆分方案**：
  - `functions/lib/hono/routes/manage/orders/detail/helpers.js` — 行规范化、状态断言、outbox调度、admin actor等，约 135 行
  - `functions/lib/hono/routes/manage/orders/detail/logistics.js` — 物流查询+更新（GET/PATCH `/:id/logistics`），约 80 行
  - `functions/lib/hono/routes/manage/orders/detail/mutations.js` — 订单修改+状态变更（PATCH `/:id`, PATCH `/:id/status`），约 370 行
  - `functions/lib/hono/routes/manage/orders/detail/lifecycle.js` — 送达确认+备注+归档+恢复+删除，约 295 行
  - `functions/lib/hono/routes/manage/orders/detail/index.js` — 详情查询 + 路由挂载，约 80 行
- **复杂度**：中
- **理由**：PATCH `/:id` 是文件中最复杂的路由（250 行），包含绑定验证、行水合、需求同步等逻辑，与 PATCH `/:id/status` 共享状态断言，适合放在同一 mutations.js。物流和生命周期操作是完全独立的子域。

### [F10] OrderLineFulfillmentService.js (847 行) — `functions/services/OrderLineFulfillmentService.js`

- **职责分析**：
  - 模块级工具函数（数量计算、return reason、断言、batch执行）：~100 行
  - 构造函数 + 需求投影刷新：~25 行
  - 行预留 `reserveLine`：~60 行
  - 行释放 `releaseLine`：~70 行
  - 行发货 `shipLine`：~115 行
  - 行撤销发货 `unshipLine`：~70 行
  - 行退货 `returnLine`：~90 行
  - 查询/断言方法（requireOrderLine、assertVariantBacked、assertUnshipAllowed、assertReturnAllowed、getReturnedQuantity、deriveNextOrderDeliveryStatus）：~90 行
  - 状态构建方法（buildNextLineState、buildOrderTouchStatement）：~20 行
  - 发货台账 + 库存变动声明（buildShipmentLedgerStatement、buildReservationMovementStatements）：~100 行
  - Outbox + 命令结果构建（buildOutboxStatements、buildCommandResult）：~75 行
- **拆分方案**：
  - `functions/services/order-line-fulfillment/validators.js` — 查询/断言方法（requireOrderLine、assertVariantBacked、assertUnshipAllowed、assertReturnAllowed、getReturnedQuantity、deriveNextOrderDeliveryStatus），约 90 行
  - `functions/services/order-line-fulfillment/statement-builders.js` — 发货台账、库存变动、outbox、命令结果构建（buildShipmentLedgerStatement、buildReservationMovementStatements、buildOutboxStatements、buildCommandResult），约 175 行
  - `functions/services/order-line-fulfillment/index.js` — 类定义 + 5个命令方法 + 构造函数，约 460 行
  - `functions/services/order-line-fulfillment/helpers.js` — 模块级工具函数（getRemainingLineQuantity、getReadyLineQuantity 等），约 100 行
- **复杂度**：中
- **理由**：5 个命令方法共享大量基础设施（断言、batch执行、outbox构建、状态投影），将基础设施提取为独立模块后，主类聚焦于业务流程编排。validators 和 statement-builders 被所有命令方法共同依赖，提取后可独立测试。

### 后端拆分优先级总结

| 优先级 | 文件 | 当前行数 | 建议拆分后 | 复杂度 | 理由 |
|--------|------|----------|------------|--------|------|
| 1 | order/mutations.js | 1293 | ~770 (主文件) | 中 | 最大文件，helpers 提取收益高 |
| 2 | products/[id].js | 1264 | ~400 (index.js) | 高 | 4 个独立子资源域，拆后结构清晰 |
| 3 | purchase-orders.js | 1193 | ~500 (index.js) | 中 | helpers + items/receipts 可独立 |
| 4 | orders/detail.js | 995 | ~80 (index.js) | 中 | 按职责层拆为 5 个文件 |
| 5 | OrderLineFulfillmentService.js | 847 | ~460 (index.js) | 中 | validators + builders 提取 |

**共同模式**：这 5 个文件都存在"辅助函数/工具代码占总行数 15-25%"的问题，优先提取 helpers 模块收益最高。路由文件适合按子资源域拆分为目录结构，服务文件适合按职责层（验证/声明构建/业务编排）拆分。
