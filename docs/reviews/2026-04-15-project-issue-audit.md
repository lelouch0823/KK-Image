# 2026-04-15 项目问题审查记录

## 当前状态

- 问题真实性审查已完成，`01-30` 全部确认为真实问题。
- 修复计划：[docs/superpowers/plans/2026-04-15-project-issue-audit-remediation.md](/home/bjw/Code/KK-Image/docs/superpowers/plans/2026-04-15-project-issue-audit-remediation.md)
- 结案说明：[docs/reviews/2026-04-15-project-issue-audit-closure-note.md](/home/bjw/Code/KK-Image/docs/reviews/2026-04-15-project-issue-audit-closure-note.md)
- 执行状态：`01-25` 与 `30` 已完成；`26-29` 已完成首轮抽离，但仍保留后续架构治理项。
- 补充说明：新鲜验证中 `pnpm typecheck:minisales` 已证明类型检查覆盖缺口被修复，本轮也已把 `minisales` 接入 root `lint` / `ci-test` 默认门禁。

## 审查范围

- 根前端应用 `src/`
- Cloudflare Functions `functions/`
- 微信小程序子包 `minisales/`
- 工程配置、脚本与文档约束

## 记录格式

每条问题按以下结构记录：

1. 问题编号
2. 严重级别
3. 位置
4. 问题描述
5. 修复建议

## 问题清单

> 审查已完成到 30 条。原始补充证据：首次审查时执行 `pnpm lint`，仓库返回 `34 errors / 70 warnings`，并据此展开后续修复计划。

### 01. 高
- 位置：`package.json:11-13`
- 问题描述：根工程的 `lint` 只扫描 `src` 和 `functions`，`format` 只覆盖 `src/**/*.{js,vue}` 与 `functions/**/*.js`。`minisales/`、`scripts/`、`test/`、`docs/` 下的实际代码和配置全部绕过日常质量门禁。
- 修复建议：把 `minisales`、`scripts`、`test` 纳入统一 lint/format 范围，至少保证新增代码不会落在质检盲区。

### 02. 高
- 位置：`package.json:14-18`
- 问题描述：`ci-test` 只跑 `mocha --exit`，没有覆盖主力单测入口 `pnpm test:unit`。这意味着 Vitest 测试即使全部失败，也不会在当前 CI 脚本上被拦截。
- 修复建议：把 `pnpm test:unit` 纳入 CI 主链路，或者显式拆成前端/后端/集成三段流水线。

### 03. 中
- 位置：`package.json:15-18`
- 问题描述：仓库同时维护 `mocha` 和 `vitest` 两套测试入口，根命令 `test` 指向 Mocha，`test:unit` 指向 Vitest，测试基建和认知成本被人为拆成两套。
- 修复建议：统一测试主入口，保留一个默认 runner，把另一套明确限定为特定场景。

### 04. 高
- 位置：`package.json:32`
- 问题描述：`deploy:verify` 通过 `sleep 5` 等待本地服务启动，这是典型竞争条件。机器慢一点就误报失败，机器快一点则纯浪费时间。
- 修复建议：改成 `wait-on` 之类的显式健康检查，而不是固定睡眠。

### 05. 高
- 位置：`package.json:32`
- 问题描述：`deploy:verify` 末尾用 `pkill -f wrangler` 结束进程，会把当前机器上其他无关的 `wrangler` 进程一并杀掉。
- 修复建议：保存当前脚本启动的子进程 PID，并只清理本次启动的那一个。

### 06. 高
- 位置：`minisales/package.json:6-7`
- 问题描述：`minisales` 的 `typecheck` 通过命令行手工枚举所有 TS 文件。任何新增页面、组件、测试文件，只要忘记补命令，就会直接逃逸出类型检查。
- 修复建议：改为基于 `tsconfig.json` 的 `include/exclude` 管理，让类型检查自动覆盖全量源码。

### 07. 高
- 位置：`eslint.config.js:81-160`，`src/components/__tests__/OrderManager.design-system-migration.test.js:1-16`，以及同类测试文件
- 问题描述：前端测试文件使用 `process.cwd()` 读取源码，但 ESLint 只给 `src/**/*.js` 配了浏览器全局，未声明 Node/Vitest 运行时，导致 `pnpm lint` 出现大量 `process is not defined`。
- 修复建议：为 `src/**/__tests__/**`、`src/**/*.test.js` 单独声明 Node/Vitest globals。

### 08. 中
- 位置：`functions/utils/__tests__/ai-utils-health.test.js:173-182`，`eslint.config.js:162-183`
- 问题描述：后端测试里直接使用 `ReadableStream`，但 `functions/**/*.js` 的 ESLint globals 没有把它声明进去，当前 lint 已经实报 `ReadableStream is not defined`。
- 修复建议：补齐 Workers/Web Streams 相关 globals，或为测试文件单独配置运行环境。

### 09. 中
- 位置：`eslint.config.js:48-60`
- 问题描述：`better-tailwindcss` 已启用，但没有配置 entry point。当前 lint 输出持续出现 `No tailwind css entry point found at undefined`，让真实问题被大量噪音淹没。
- 修复建议：为插件补充有效的 Tailwind 入口文件，或者暂时关闭相关规则直到配置完整。

### 10. 中
- 位置：`eslint.config.js:45-79`，`functions/lib/hono/routes/manage/__tests__/audit-replay-routes.test.js:113-118`
- 问题描述：Vue 推荐规则被全局展开后，JS 测试里的普通字符串 `name: 'Ops'` 也触发了 `vue/multi-word-component-names`。这是规则作用域泄漏，不是真实业务缺陷。
- 修复建议：把 Vue 规则限制在 `.vue` 文件，避免对纯 JS 测试产生误报。

### 11. 高
- 位置：`README.md:14,84`，`functions/storage/index.js:42-67`
- 问题描述：文档明确写着“默认 R2 存储，Telegram 为可选”，但 `getStorageProvider()` 在未配置时默认回退到 `telegram`。代码和文档已经发生直接冲突。
- 修复建议：把默认提供者改成 `r2`，或同步修正文档和部署要求，避免新环境按照 README 部署后行为不符。

### 12. 高
- 位置：`functions/storage/router.js:60-80`
- 问题描述：`SmartRouter.selectStorage()` 在 `single` / `redundant` 模式下默认返回 `telegram`，继续放大了默认存储与文档不一致的问题。
- 修复建议：和主存储工厂保持同一默认值，避免路由层与实例工厂层行为分叉。

### 13. 中
- 位置：`functions/storage/router.js:17-25`
- 问题描述：智能路由默认规则把 `< 5MB` 文件全部导向 `telegram`。这与 README 中“Telegram 已降级为可选提供者”的产品定位冲突，也让新部署默认依赖了可选模块。
- 修复建议：默认规则应该优先走 `r2`，Telegram 仅在显式启用时参与路由。

### 14. 中
- 位置：`functions/storage/index.js:34-49`
- 问题描述：`providerCache` 的 key 只有 `type`，不包含 `env` 信息。按当前实现推断，在同一进程里切换 preview/prod/test 环境时，可能复用到带旧绑定的 provider 实例。
- 修复建议：缓存 key 至少纳入关键绑定签名，或改成请求级实例化。

### 15. 高
- 位置：`src/utils/variant-meta.js:1-52`，`functions/lib/utils/variant-meta.js:1-52`
- 问题描述：前后端各自维护了一份内容完全一致的 `variant-meta` 工具。任何一侧修正别名、库存状态或展示名逻辑，都有漂移风险。
- 修复建议：抽成真正共享的公共模块，避免双份实现。

### 16. 高
- 位置：`src/utils/purchase-order-progress.js:1-57`，`functions/services/purchase-order-projection.js:1-80`
- 问题描述：采购单数量/进度投影逻辑在前后端重复实现了一份，函数名和核心计算几乎一致。这类规则一旦分叉，会直接导致 UI 与后端状态判断不一致。
- 修复建议：抽取共享投影层，或者至少建立单源生成/镜像机制。

### 17. 中
- 位置：`functions/_shared/utils.js:1-84`，`functions/lib/_shared/utils.js:1-9`，`functions/lib/hono/_shared/utils.js:1-9`
- 问题描述：后端共享工具经过三层 barrel file 转发，导入路径被额外拉长，真实依赖来源越来越难追踪。
- 修复建议：收敛成一层公共出口，避免继续叠加中转 barrel。

### 18. 中
- 位置：`src/utils/sales-space.js:22-58`
- 问题描述：`safeParseObject()`、`safeParseArray()` 在前端空间归一化模块里又手写了一遍，而后端已经有 `safeJsonParse / parseJsonArray / parseJsonObject` 系列工具。
- 修复建议：把 JSON 解析策略沉到统一工具层，避免每个业务模块自带一套容错实现。

### 19. 中
- 位置：`src/composables/useProductForm.js:51-60`
- 问题描述：`useProductForm` 内部再次定义了局部 `parseJson()`。这让“商品表单逻辑”和“基础解析工具”耦在一起，也继续扩散了解析策略的重复定义。
- 修复建议：把 JSON 解析搬到 `src/utils` 公共层，再让 composable 只消费结果。

### 20. 中
- 位置：`functions/api/utils/order-binding-snapshot.js:4-14`
- 问题描述：`parseOptionsValues()` 又是一份局部 JSON 解析逻辑，与其他 `safeJsonParse` 家族重复。
- 修复建议：统一复用已有解析工具，不再在业务文件里就地包 `JSON.parse`。

### 21. 高
- 位置：`src/components/product/ProductDetail.vue:333`，`src/views/sales/SalesFormView.vue:119`，`src/components/OrderEditModal.vue:261`，`src/components/OrderCreateModal.vue:88`，`src/composables/useUploadQueue.js:317`
- 问题描述：前端多个组件和 composable 还在散落地直接 `JSON.parse(...)`。这导致 fallback 规则、错误处理和返回类型在不同页面都不统一。
- 修复建议：建立单一 `safeParseObject/safeParseArray` 工具，并清理所有临时解析逻辑。

### 22. 中
- 位置：`src/composables/useProductForm.js:8-16`，`src/views/PurchaseOrders.vue:2537`，`src/components/product/ProductCreateModal.vue:360-369`
- 问题描述：`CURRENCY_OPTIONS` / `CURRENCY_SYMBOLS` 是明显的公共常量，却被定义在 `useProductForm` 里，同时又被 `PurchaseOrders.vue` 反向引用。公共定义被埋在业务 composable 中，层次已经错位。
- 修复建议：把货币常量独立到 `src/constants` 或 `src/utils`。

### 23. 高
- 位置：`src/views/Space.vue:74-108`
- 问题描述：公开空间页把 `document` 模板直接映射到 `SpaceMasonry.vue`，并在注释里写明“暂复用 Masonry”。这不是实现完成，而是把功能缺口硬编码进生产分支。
- 修复建议：实现专门的 document 模板组件，至少保证文档类空间和图库类空间的布局行为分离。

### 24. 高
- 位置：`src/views/sales/SalesSpaceDetailView.vue:47-74`
- 问题描述：销售端空间详情页重复了同样的 `document -> SpaceMasonry` 映射，说明这个缺口已经在两条用户链路同时存在。
- 修复建议：抽统一模板映射层，并补齐 document 模板实现。

### 25. 中
- 位置：`src/components/space/`
- 问题描述：当前 `src/components/space` 下只有 `SpaceCollection.vue`、`SpaceMasonry.vue`、`SpaceProductDetail.vue` 等组件，没有任何独立的 document 模板组件。前两个问题不是偶发误引用，而是功能本身未落地。
- 修复建议：补充 `SpaceDocument.vue`，并把两条路由视图统一接入。

### 26. 高
- 位置：`src/views/PurchaseOrders.vue`（`3768` 行）
- 问题描述：采购单视图已经演变成巨型单文件组件，列表、统计、详情、弹窗、动作编排和格式化逻辑全部堆在一处，修改边界非常模糊。
- 修复建议：按“列表壳层 / 详情壳层 / 业务动作 / 展示组件”拆分，优先抽出 modal 和 progress 相关逻辑。

### 27. 高
- 位置：`src/composables/useProductForm.js`（`1097` 行）
- 问题描述：这个 composable 同时管理货币常量、JSON 解析、维度归档、变体同步、表单状态、API 提交和 UI wizard。职责过载已经影响复用和测试定位。
- 修复建议：按“表单状态”“维度编辑”“变体同步”“提交适配”拆成多个 composable/utility。

### 28. 高
- 位置：`functions/services/ProductCatalogService.js`（`974` 行）
- 问题描述：商品目录服务混合了 payload 校验、导入模式、回滚载荷、图片同步、缓存失效、仓储调用等多种职责，已经接近“服务总线”而不是单一 service。
- 修复建议：拆成 `import orchestrator`、`variant sync`、`rollback`、`cache invalidation` 等更小服务。

### 29. 高
- 位置：`functions/repositories/PurchaseOrderRepository.js`（`960` 行）
- 问题描述：采购单仓储同时承担了快照格式化、单号生成、明细汇总、CRUD、统计查询和展示态投影，Repository 与 Domain Projection 的边界已被打穿。
- 修复建议：把快照/投影/编号生成拆出独立 helper 或 service，Repository 只保留数据访问。

### 30. 中
- 位置：`functions/api/utils/id.js:91-96`，`functions/api/utils/file-utils.js:81-82,100-101`，`functions/lib/hono/routes/manage/products/[id].js:20-23`，`functions/repositories/order/mutations.js:23-25`，`functions/utils/ai-utils.js:1-11`
- 问题描述：当前 lint 已经暴露出一批确定性的死代码/无效抑制项，包括未使用变量、未使用导入、无效 `eslint-disable` 和空实现 helper。这类问题分散虽小，但会持续污染质量信号。
- 修复建议：先清掉这批确定性死代码，再收紧 lint 门禁，避免同类问题反复回流。
