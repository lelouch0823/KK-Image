# 2026-04-10 商品模块全链路代码审计

## 审计目标

- 覆盖商品模块前端、后端、数据层、小程序端及与商品强关联的订单、采购、库存、空间、销售链路代码。
- 审查逻辑闭环、业务一致性、异常边界、状态语义、回滚/并发/缓存/导入导出一致性。
- 边审查边记录问题，不等全部结束后再集中回忆。

## 审计范围

### 商品核心

- `functions/lib/hono/routes/manage/products/**`
- `functions/services/ProductCatalogService.js`
- `functions/repositories/ProductRepository.js`
- `functions/repositories/ProductVariantRepository.js`
- `functions/repositories/ProductDimensionRepository.js`
- `functions/repositories/VariantImageRepository.js`
- `functions/repositories/VariantAuditRepository.js`
- `src/components/product/**`
- `src/composables/useProductForm.js`
- `src/composables/useProducts.js`
- `src/utils/product-image.js`
- `src/utils/variant-meta.js`

### 商品关联链路

- 销售端商品/绑定: `functions/lib/hono/routes/sales/products.js`, `src/components/order/ProductBindingSection.vue`, `minisales/miniprogram/services/sales/products.ts`
- 订单链路: `functions/lib/hono/routes/manage/orders/**`, `functions/lib/hono/routes/sales/orders.js`, `functions/repositories/order/**`, `src/components/order/**`
- 采购/库存链路: `functions/lib/hono/routes/manage/purchase-orders.js`, `functions/services/*purchase*`, `functions/services/Inventory*.js`, `src/components/purchase-order/**`, `src/utils/purchase-order-*`
- 货品总览: `functions/lib/hono/routes/manage/goods-overview.js`, `functions/repositories/GoodsOverviewRepository.js`
- 空间绑定链路: `functions/lib/hono/routes/manage/spaces/**`, `functions/lib/hono/routes/sales/spaces.js`, `src/components/space/**`, `functions/space/**`, `minisales/miniprogram/services/sales/spaces.ts`
- 小程序订单/商品/空间消费端: `minisales/miniprogram/services/sales/{products,orders,spaces}.ts`, `minisales/miniprogram/utils/normalize/{product,order}.ts`, 相关 page/controller/component

## 审计进度

- [x] 建立审计文档与范围
- [x] 商品核心后端路由
- [x] 商品核心服务/仓储
- [x] 商品前端管理端组件与表单
- [x] 导入导出/规格/图片/批量流程
- [x] 销售端商品详情与绑定链路
- [x] 管理端订单创建/编辑/状态流转中的商品绑定
- [x] 采购/库存/货品总览链路
- [x] 空间商品关联链路
- [x] 小程序商品/订单/空间消费链路
- [x] 收口所有关联代码并整理最终结论

## 修复状态

- 截至 2026-04-10，本次审计累计确认的 35 个问题已全部完成修复；以下清单保留为审计基线与增量复查记录。
- 对应修复提交:
  - `a849ceb` / `c4272f7`: 变体图片唯一性、主图切换与批量操作边界
  - `4895358`: 销售侧 `in_stock_only` 约束与假成功状态
  - `38d0279`: 预订单重复采购拦截
  - `c6bc3c3`: 空间商品绑定校验与解绑残留值
  - `3f70954`: 商品导出路由与前端导出契约统一
  - `4c3099b`: 销售商品选择器图片地址规范
  - `662837a`: 导入模式安全兜底与部分成功后的列表刷新闭环
  - `13fb7ee`: 批量导入审计结果与统计字段对齐
  - `adb3fee`: `PUT` 全量替换规格边界与 `PATCH/PUT` 审计变更计数对齐
  - `75d9b7b`: 销售商品列表可售库存过滤对齐
  - `1f2a4b6`: 小程序销售商品绑定字段映射对齐
  - `ede9100`: 小程序复制下单预填绑定卡片信息回填
  - `75d4e0e`: 订单解绑后的需求投影释放对齐
  - `4ce3e3d`: 活跃订单改单时的需求投影重平衡
  - `4b07d31`: 管理端活跃订单商品绑定编辑边界收紧
  - `f6e79f0`: 管理端执行态订单数量编辑边界收紧
  - `76e51ee`: 订单绑定规格镜像字段后端兜底对齐
  - `41d5e35`: 管理端订单销售员改派闭环
  - `8fbc9e2`: 子空间商品绑定持久化与校验闭环
  - `37b6649`: 空间创建可见性设置持久化闭环
  - `e837c63`: 商品导出规格列映射闭环
  - `566f737`: 商品导入零成功批次假成功修复
  - `32705af`: 商品统计弹窗全量口径修复
  - `e64649a`: 商品详情关联空间切换修复
  - `3883e69`: 商品详情关联空间投影字段对齐
  - `7c229b5`: 商品移动端库存口径对齐
  - `b4a66ea`: 商品工作流详情水合竞态修复
  - `221bf84`: 商品详情弹窗关闭链路与详情加载竞态修复
  - `0a38335`: 商品管理页 query.edit 编辑水合竞态修复
  - `52e2a72`: 商品导出弹窗关闭后的旧任务回写修复
  - `3cf6bea`: 商品管理页编辑/分享入口仅认最新水合结果
- 基线验证:
  - 2026-04-10 运行 23 个回归测试文件，共 128 个测试，全部通过。
- 增量验证:
  - 2026-04-10 运行 3 个回归测试文件，共 7 个测试，全部通过。
  - 2026-04-10 运行 1 个回归测试文件，共 15 个测试，全部通过。
  - 2026-04-10 运行 2 个回归测试文件，共 3 个测试，全部通过。
  - 2026-04-10 运行 3 个回归测试文件，共 4 个测试，全部通过。
  - 2026-04-10 运行 2 个回归测试文件，共 17 个测试，全部通过。
  - 2026-04-10 运行 2 个回归测试文件，共 19 个测试，全部通过。
  - 2026-04-10 运行 3 个回归测试文件，共 25 个测试，全部通过。
  - 2026-04-10 运行 3 个回归测试文件，共 27 个测试，全部通过。
  - 2026-04-10 运行 2 个回归测试文件，共 22 个测试，全部通过。
  - 2026-04-10 运行 4 个回归测试文件，共 44 个测试，全部通过。
  - 2026-04-10 运行 3 个回归测试文件，共 15 个测试，全部通过。
  - 2026-04-10 运行 3 个回归测试文件，共 18 个测试，全部通过。
  - 2026-04-10 运行 3 个回归测试文件，共 8 个测试，全部通过。
  - 2026-04-10 运行 1 个回归测试文件，共 13 个测试，全部通过。
  - 2026-04-10 运行 3 个回归测试文件，共 15 个测试，全部通过。
  - 2026-04-10 运行 3 个回归测试文件，共 5 个测试，全部通过。
  - 2026-04-10 运行 2 个回归测试文件，共 5 个测试，全部通过。
  - 2026-04-10 运行 3 个回归测试文件，共 6 个测试，全部通过。
  - 2026-04-10 运行 3 个回归测试文件，共 7 个测试，全部通过。
  - 2026-04-10 运行 2 个回归测试文件，共 21 个测试，全部通过。
  - 2026-04-10 运行 3 个回归测试文件，共 18 个测试，全部通过。
  - 2026-04-10 运行 3 个回归测试文件，共 16 个测试，全部通过。
  - 2026-04-10 运行 4 个回归测试文件，共 22 个测试，全部通过。
- 残余风险:
  - 当前验证以仓储、路由、组件契约和关键链路回归为主，尚未执行浏览器级 E2E 或线上数据回放。

## 问题清单（审计基线，已全部修复）

### Critical

- 暂无

### High

- `VariantImageRepository.addImage()` 允许同一变体重复插入相同图片，也允许在 `isPrimary=true` 时直接新增一条新的主图记录而不清除旧主图，导致单个变体可能同时存在多个主图、重复图记录，破坏图片顺序和主图唯一性约束。[functions/repositories/VariantImageRepository.js](/home/bjw/Code/KK-Image/functions/repositories/VariantImageRepository.js#L11)
- `VariantImageRepository.setPrimary()` 先把该变体全部图片置为非主图，再按 `imageId` 更新目标图；但它没有校验目标图片是否存在，若 `imageId` 不存在会返回成功且让该变体失去所有主图。[functions/repositories/VariantImageRepository.js](/home/bjw/Code/KK-Image/functions/repositories/VariantImageRepository.js#L99)
- 销售端下单/改单后端没有强制执行前端声明的“仅可选择有库存变体”策略。`ProductBindingSection` 和小程序绑定组件都把销售场景固定成 `in_stock_only`，但销售 API 只校验商品/变体存在且为 `active`，不校验 `available_quantity/stock_quantity > 0`，因此绕过前端即可把缺货变体绑定到销售订单，破坏销售侧“只卖可售库存”的业务约束。[src/views/sales/SalesFormView.vue](/home/bjw/Code/KK-Image/src/views/sales/SalesFormView.vue#L9) [functions/lib/hono/routes/sales/orders.js](/home/bjw/Code/KK-Image/functions/lib/hono/routes/sales/orders.js#L74) [functions/api/utils/validation.js](/home/bjw/Code/KK-Image/functions/api/utils/validation.js#L5)
- 销售端商品列表路由注释声明“只返回可售商品”，但实际只按 `status: 'active'` 检索，未附带 `hasStock: 'in_stock'`。结果是销售页和小程序商品选择器会持续展示没有任何可下单规格的商品，用户点进详情后才在二次过滤时收到“暂无可下单规格”，形成可复现的死胡同选择链路。[functions/lib/hono/routes/sales/products.js](/home/bjw/Code/KK-Image/functions/lib/hono/routes/sales/products.js#L22) [src/components/product/ProductSelect.vue](/home/bjw/Code/KK-Image/src/components/product/ProductSelect.vue#L142) [minisales/miniprogram/components/sales/product-binding/index.ts](/home/bjw/Code/KK-Image/minisales/miniprogram/components/sales/product-binding/index.ts#L87)
- 订单解绑商品时，销售端和管理端都会把顶级 `productId/variantId` 更新为 `null`，但随后调用 `DemandService.syncOrderTransition()` 时仍用 `normalizedVariantId ?? order.variantId` 回退旧规格 ID。结果是订单已经解绑，需求/预留投影却继续挂在旧变体上，库存需求无法真正释放，造成订单主记录与需求投影分叉。[functions/lib/hono/routes/sales/orders.js](/home/bjw/Code/KK-Image/functions/lib/hono/routes/sales/orders.js#L335) [functions/lib/hono/routes/manage/orders/detail.js](/home/bjw/Code/KK-Image/functions/lib/hono/routes/manage/orders/detail.js#L198)
- 管理端允许在 `confirmed/production/shipping/arrived` 等需求活跃状态下继续改单，但订单详情更新路由只调用一次 `DemandService.syncOrderTransition()`，而该服务只根据状态迁移决定预留增减。结果是同状态下换绑/解绑规格或改数量时，旧规格预留不会释放、新规格或新数量也不会补齐，`inventory_balances.reserved` 会和订单当前绑定/数量持续漂移。[functions/lib/hono/routes/manage/orders/detail.js](/home/bjw/Code/KK-Image/functions/lib/hono/routes/manage/orders/detail.js#L201) [functions/services/DemandService.js](/home/bjw/Code/KK-Image/functions/services/DemandService.js#L86)
- 管理端订单编辑弹窗和 `PATCH /api/manage/orders/:id` 仍允许对 `confirmed/production/shipping/arrived` 这类活跃订单直接改商品绑定。即便需求投影已经能重平衡，采购进度、收货事实、发货扣减和订单行兼容快照也无法无损迁移到另一商品/规格，最终会让订单头、订单行和履约事实分叉。[src/components/OrderEditModal.vue](/home/bjw/Code/KK-Image/src/components/OrderEditModal.vue#L30) [functions/lib/hono/routes/manage/orders/detail.js](/home/bjw/Code/KK-Image/functions/lib/hono/routes/manage/orders/detail.js#L127)
- 管理端订单编辑弹窗和 `PATCH /api/manage/orders/:id` 仍允许对 `shipping/arrived/delivered` 等执行态订单直接改数量。该链路不会同步重算已采购/已收货/已发货事实，也不会补做库存发货差额校正，结果是订单头数量会和订单行履约进度、采购进度乃至已扣减库存脱节。[src/components/OrderEditModal.vue](/home/bjw/Code/KK-Image/src/components/OrderEditModal.vue#L37) [functions/lib/hono/routes/manage/orders/detail.js](/home/bjw/Code/KK-Image/functions/lib/hono/routes/manage/orders/detail.js#L135) [functions/repositories/order/mutations.js](/home/bjw/Code/KK-Image/functions/repositories/order/mutations.js#L455)
- 采购链路没有阻止同一个预订单被重复采购。无论是手工 `POST /purchase-orders/:id/items`、前端 `OrderPickerModal`，还是 `createFromOrders()`，都只检查订单 `status === 'confirmed'` 与商品/变体匹配，却没有校验 `procurement_status`、也没有校验该 `pre_order_id` 是否已存在于其他未完成采购单中，导致同一订单可被多个采购单重复拉起，直接放大补货量与在途量。[functions/lib/hono/routes/manage/purchase-orders.js](/home/bjw/Code/KK-Image/functions/lib/hono/routes/manage/purchase-orders.js#L156) [src/components/purchase-order/OrderPickerModal.vue](/home/bjw/Code/KK-Image/src/components/purchase-order/OrderPickerModal.vue#L268) [functions/services/PurchaseOrderService.js](/home/bjw/Code/KK-Image/functions/services/PurchaseOrderService.js#L373)
- 批量导入的 `import_mode` 兜底策略不安全。`normalizeImportMode()` 只接受精确的 `safe_merge`，其它任何值都会静默降级成 `replace`；而 `batchImport()` 后续会据此走 `replaceMissing` 和“排除未匹配旧变体”的覆盖分支。结果是只要请求方传错枚举值、大小写或脏数据，就会从预期的安全合并直接切到全覆盖导入，造成已有规格/变体被覆盖或归档。[functions/services/ProductCatalogService.js](/home/bjw/Code/KK-Image/functions/services/ProductCatalogService.js#L105) [functions/services/ProductCatalogService.js](/home/bjw/Code/KK-Image/functions/services/ProductCatalogService.js#L733)

### Medium

- `PUT /api/manage/products/:id` 标记为“Full Update / product.replace”，但当请求同时替换变体而省略 `dimensions` 时，服务层会静默回退到现有规格定义，不会执行缺失规格归档，也不会要求调用方显式声明“保留还是清空规格”。结果是 `PUT` 在规格维度上退化成部分更新，和同接口已实现的“全量替换会归档缺失规格/规格值”语义不一致，外部调用方容易在无感知下保留旧规格数据。[functions/services/ProductCatalogService.js](/home/bjw/Code/KK-Image/functions/services/ProductCatalogService.js#L595) [functions/lib/hono/routes/manage/products/[id].js](/home/bjw/Code/KK-Image/functions/lib/hono/routes/manage/products/[id].js#L475)
- 小程序销售商品绑定组件在构造已绑定商品字段时，只从 `options.color/material` 这两个固定键取值；而销售商品详情返回的 `optionsValues` 常常使用维度 id 或原始维度名。结果是绑定带颜色/材质规格的商品后，小程序表单里的 `color/material` 经常保持为空，同时 `size` 又把所有规格值混在一起，和 PC 销售端按维度标签拆分字段的行为不一致，导致订单镜像字段质量下降。[minisales/miniprogram/components/sales/product-binding/index.ts](/home/bjw/Code/KK-Image/minisales/miniprogram/components/sales/product-binding/index.ts#L35) [src/views/sales/SalesFormView.vue](/home/bjw/Code/KK-Image/src/views/sales/SalesFormView.vue#L118)
- 管理端/销售端后端在创建或改绑订单商品时，没有根据已校验的 `variantId` 反推 `size/color/material` 等镜像字段，而是直接信任请求体。结果是只要绕过 PC/小程序前端，订单可以绑定到正确规格，却同时写入空白或错误的规格摘要，造成订单详情、打印单和人工履约视图展示错规格。[functions/lib/hono/routes/sales/orders.js](/home/bjw/Code/KK-Image/functions/lib/hono/routes/sales/orders.js#L82) [functions/lib/hono/routes/manage/orders/detail.js](/home/bjw/Code/KK-Image/functions/lib/hono/routes/manage/orders/detail.js#L148) [functions/lib/hono/routes/manage/orders/create-order.js](/home/bjw/Code/KK-Image/functions/lib/hono/routes/manage/orders/create-order.js#L20)
- 管理端订单编辑弹窗允许改派销售员，但 `PATCH /api/manage/orders/:id` 只把 `salespersonId` 留在 `updates` 里，既没有把它当成顶级列变更传入 `processOrderUpdate()`，仓储层 `updateComposite()` 也不会写回 `orders.salesperson_id`。结果是前端显示“保存成功”，实际订单仍留在旧销售员名下，形成可复现的假成功改派。[src/components/OrderEditModal.vue](/home/bjw/Code/KK-Image/src/components/OrderEditModal.vue#L527) [functions/lib/hono/routes/manage/orders/detail.js](/home/bjw/Code/KK-Image/functions/lib/hono/routes/manage/orders/detail.js#L190) [functions/repositories/order/mutations.js](/home/bjw/Code/KK-Image/functions/repositories/order/mutations.js#L482)
- 管理端 `/api/manage/products/export` 路由实现与当前前端导出链路语义不一致：它始终忽略筛选条件、仅导出商品汇总字段、不导出变体级字段，并在后台异常时把错误文本直接写进 CSV 流返回 `200`，不利于调用方准确识别失败。[functions/lib/hono/routes/manage/products/export.js](/home/bjw/Code/KK-Image/functions/lib/hono/routes/manage/products/export.js#L7)
- `ProductBindingSection.handleProductSelect()` 只要商品详情里存在任意变体就直接发出 `product-fetch-success`，即使在当前策略下所有变体都不可选、`initSelectionFromVariants()` 已经把 `selectedVariantId` 留空。销售页收到这个成功事件后会清空错误提示，但并未真正绑定商品，最终形成“选了商品却没有可售变体、页面也不报错”的假成功状态。[src/components/order/ProductBindingSection.vue](/home/bjw/Code/KK-Image/src/components/order/ProductBindingSection.vue#L601) [src/views/sales/SalesFormView.vue](/home/bjw/Code/KK-Image/src/views/sales/SalesFormView.vue#L9)
- 空间商品绑定接口在创建和更新时调用 `validateProductVariantBinding(..., { checkExistence: false })`，只校验 `productId/variantId` 是否成对出现，不校验商品是否存在、变体是否属于商品，也不校验是否仍然有效。结果是后台可以写入任意伪造的商品/变体关联，后续空间列表、详情和销售端空间消费只能得到空 JOIN 或陈旧映射。[functions/lib/hono/routes/manage/spaces/crud.js](/home/bjw/Code/KK-Image/functions/lib/hono/routes/manage/spaces/crud.js#L162) [functions/lib/hono/routes/manage/spaces/crud.js](/home/bjw/Code/KK-Image/functions/lib/hono/routes/manage/spaces/crud.js#L250) [functions/api/utils/validation.js](/home/bjw/Code/KK-Image/functions/api/utils/validation.js#L25)
- 子空间创建链路前端虽然允许携带 `productId/variantId`，但 `POST /api/manage/spaces/:id/subspaces` 的 schema、校验和仓储插入都没有把 `productId` 当正式字段处理。结果是商品型子空间创建后只留下孤立 `variant_id` 或直接丢失整组商品绑定，后续空间列表、详情和按商品聚合的分享空间都无法正确命中子空间记录。[src/components/SpaceCreateModal.vue](/home/bjw/Code/KK-Image/src/components/SpaceCreateModal.vue#L247) [functions/lib/hono/routes/manage/spaces/subspaces.js](/home/bjw/Code/KK-Image/functions/lib/hono/routes/manage/spaces/subspaces.js#L32) [functions/repositories/SpaceRepository.js](/home/bjw/Code/KK-Image/functions/repositories/SpaceRepository.js#L362)
- `SpaceCreateModal` 在创建顶级空间和子空间时都允许设置 `shareMode/sharedSalespersonIds`，但两个创建接口的 schema 与仓储插入都没有接住这组字段。结果是用户首提时看到“创建成功”，实际空间统一回退成默认不可见范围，选择性分享给销售员的设置会整组丢失，必须再进编辑页补一次才能生效。[src/components/SpaceCreateModal.vue](/home/bjw/Code/KK-Image/src/components/SpaceCreateModal.vue#L102) [functions/lib/hono/routes/manage/spaces/crud.js](/home/bjw/Code/KK-Image/functions/lib/hono/routes/manage/spaces/crud.js#L42) [functions/lib/hono/routes/manage/spaces/subspaces.js](/home/bjw/Code/KK-Image/functions/lib/hono/routes/manage/spaces/subspaces.js#L32) [functions/repositories/SpaceRepository.js](/home/bjw/Code/KK-Image/functions/repositories/SpaceRepository.js#L194)
- 商品导出工具只从 `options_values.color/size/material` 这几个固定键提取 `Color/Size/Material` 三列，但当前规格值常常以维度 ID 或中文维度名存储。结果是变体明明有完整规格，`options_json` 也带值，导出的固定规格列却会大面积空白，破坏采购/选品表格的可读性，而且前端导出和后端 CSV 导出都会中招。[src/components/product/export/export-utils.js](/home/bjw/Code/KK-Image/src/components/product/export/export-utils.js#L1) [functions/lib/hono/routes/manage/products/export.js](/home/bjw/Code/KK-Image/functions/lib/hono/routes/manage/products/export.js#L1)
- 商品导入弹窗把后端返回的 `count` 用 `result.count || chunk.length` 计入成功数，导致 `count: 0` 这种“整批零成功”的合法返回被错误回退成整批成功。结果是只要某批次全部失败但接口仍返回 `success: true` 以承载错误明细，前端就会把该批记成成功、触发 `emit('success')` 并刷新列表，形成可复现的假成功导入。[src/components/product/ProductImportModal.vue](/home/bjw/Code/KK-Image/src/components/product/ProductImportModal.vue#L831)
- 商品统计弹窗 `ProductStats` 没有接收父级数据，也不会自行拉取商品列表，却直接从一份全新的 `useProducts()` 状态里读取统计值。结果是统计概览默认显示全 0；即使未来改成读取当前页数据，`库存预警/库存总值` 也会继续被错误限定在当前分页，而不是完整筛选结果。[src/components/product/ProductStats.vue](/home/bjw/Code/KK-Image/src/components/product/ProductStats.vue#L1) [src/components/ProductManager.vue](/home/bjw/Code/KK-Image/src/components/ProductManager.vue#L91)
- 商品详情里的关联分享空间只在 `onMounted()` 时加载一次。`ProductWorkflowModal` 或其它父组件复用同一 `ProductDetail` 实例查看第二件商品时，右侧“关联分享空间”仍保留上一件商品的数据，形成跨商品串视图；快速切换时还会有旧请求回写新详情的竞态风险。[src/components/product/ProductDetail.vue](/home/bjw/Code/KK-Image/src/components/product/ProductDetail.vue#L357)
- 商品详情的关联空间展示仍混用了后端原始字段名 `view_count/is_public/share_token`，但管理端空间接口投影给前端的是 `viewCount/isPublic/shareToken`。结果是详情右侧的浏览量与 Public 徽标长期不显示，复制分享链接逻辑也继续依赖兼容回退字段，和当前前端数据契约不一致。[src/components/product/ProductDetail.vue](/home/bjw/Code/KK-Image/src/components/product/ProductDetail.vue#L85)
- 商品移动端列表 `ProductGrid` 仍用 `stock_quantity` 显示库存和低库存标记，而桌面 `ProductTable` 已经统一改用投影后的 `available_quantity`。结果是同一商品在移动端和桌面端会显示两套库存数字，低库存标记也会在移动端错判。[src/components/product/ProductGrid.vue](/home/bjw/Code/KK-Image/src/components/product/ProductGrid.vue#L39) [src/components/product/ProductTable.vue](/home/bjw/Code/KK-Image/src/components/product/ProductTable.vue#L183)
- `ProductWorkflowModal` 在详情渐进式水合期间如果父级切到另一件商品，旧商品的 `loadProduct()` Promise 仍会在返回后覆盖 `currentProduct`。结果是详情弹窗会短暂或持续回跳到上一件商品，编辑入口也可能基于过期商品草稿打开，形成可复现的串详情竞态。[src/components/product/ProductWorkflowModal.vue](/home/bjw/Code/KK-Image/src/components/product/ProductWorkflowModal.vue#L98)
- `ProductDetailModal` 没有把内层 `Modal` 的 `close` 事件向外透传，采购页却依赖外层 `@close` 清理 `viewProductId`；同时详情加载也没有按 `productId` 隔离请求和重载条件。结果是采购单里的商品详情弹窗点击关闭按钮/遮罩后父级状态不收口，且快速切换商品或切到另一商品 ID 时会继续显示旧详情，形成关闭链路与详情加载双重未闭环。[src/components/product/ProductDetailModal.vue](/home/bjw/Code/KK-Image/src/components/product/ProductDetailModal.vue#L2) [src/views/PurchaseOrders.vue](/home/bjw/Code/KK-Image/src/views/PurchaseOrders.vue#L2248)
- `ProductManager.handleQueryEditOpen()` 在 `query.edit` 自动补齐编辑数据时没有绑定请求生命周期。用户如果在“加载完整商品数据”期间主动关闭编辑弹窗，旧的 `loadProduct()` Promise 返回后仍会调用 `handleEdit(product)`，把已经关闭的编辑弹窗重新打开，并覆盖当前编辑上下文，形成可复现的反复弹开竞态。[src/components/ProductManager.vue](/home/bjw/Code/KK-Image/src/components/ProductManager.vue#L328)
- `ProductExportModal` 允许在导出生成中通过模态框默认关闭动作直接关掉弹窗，但关闭后并不会废弃当前导出任务。旧的 `fetchAllProducts()/loadProduct()` 链路跑完后仍会把 `readyToDownload/generatedBlob` 写回已关闭的组件，用户重新打开弹窗时会看到上一轮旧筛选条件生成好的文件，形成可复现的旧结果串写。[src/components/product/ProductExportModal.vue](/home/bjw/Code/KK-Image/src/components/product/ProductExportModal.vue#L123)
- `ProductManager` 的列表“编辑”和“分享”入口共用 `hydrateProductWithVariants()`，但没有请求先后隔离。用户在列表上连续点击两件商品时，先点的旧请求如果后返回，会把后点商品的编辑草稿或分享目标覆盖掉，最终弹出错误商品的编辑/分享上下文。[src/components/ProductManager.vue](/home/bjw/Code/KK-Image/src/components/ProductManager.vue#L387)
- 商品导入弹窗对“部分成功”没有向父级发出成功事件。`handleImport()` 只有在“零失败且零冲突”时才 `emit('success')`，但前面已经把存在成功导入记录的部分成功结果标记为 `importResult.success = true`，页脚按钮也允许用户直接关闭弹窗。`ProductManager` 依赖这个事件刷新列表，因此一旦导入结果里同时包含成功项和失败项/冲突项，弹窗可关闭但列表不会刷新，用户要手动刷新后才能看到已导入的商品。[src/components/product/ProductImportModal.vue](/home/bjw/Code/KK-Image/src/components/product/ProductImportModal.vue#L865) [src/components/product/ProductImportModal.vue](/home/bjw/Code/KK-Image/src/components/product/ProductImportModal.vue#L881) [src/components/ProductManager.vue](/home/bjw/Code/KK-Image/src/components/ProductManager.vue#L398)
- 批量导入路由的审计语义已经与服务层返回脱节。`POST /api/manage/products/batch` 无论 `batchImport()` 是否真正导入成功，都固定把审计结果写成 `result: 'success'`；同时它写入审计元数据的 `imported/created/updated` 读取的是不存在的顶层字段，而服务层真实返回的是 `count` 与 `summary.createdProducts/updatedProducts`。结果是导入全失败时审计仍显示成功，而成功导入时关键统计又可能长期记录为 `null`，削弱后台审计可追溯性。[batch.js](/home/bjw/Code/KK-Image/functions/lib/hono/routes/manage/products/batch.js#L19) [ProductCatalogService.js](/home/bjw/Code/KK-Image/functions/services/ProductCatalogService.js#L887)

### Low

- `PATCH /api/manage/products/:id` 与 `PUT /api/manage/products/:id` 路由写审计时，把服务层返回的数字型 `result.changes` 当成数组读取，导致 `metadata.changeCount` 长期为 `undefined`，后台无法直接从审计记录看到这次商品更新声明变更了多少主数据字段。[functions/lib/hono/routes/manage/products/[id].js](/home/bjw/Code/KK-Image/functions/lib/hono/routes/manage/products/[id].js#L452)
- 小程序销售订单详情页走“复制下单”时，`buildDuplicatePrefill()` 和 `buildFormPrefillState()` 只回填了 `productId/variantId/name/sku` 等基础字段，没有把商品主图和规格摘要带回绑定卡片。结果是复制后虽然仍保持商品绑定关系，但绑定区会退化成无图、无规格标签的半残状态，用户难以快速确认复制的是否还是原规格。[minisales/miniprogram/pages/detail/controller.ts](/home/bjw/Code/KK-Image/minisales/miniprogram/pages/detail/controller.ts#L337) [minisales/miniprogram/pages/form/controller.ts](/home/bjw/Code/KK-Image/minisales/miniprogram/pages/form/controller.ts#L67) [minisales/miniprogram/components/sales/product-binding/index.wxml](/home/bjw/Code/KK-Image/minisales/miniprogram/components/sales/product-binding/index.wxml#L10)
- `SpaceCreateModal.unbindProduct()` 只清空了 `productId`，没有同步清空 `variantId`。用户在创建商品型空间时若先绑定再解绑，表单会残留失效的 `variantId`，提交时被后端以“`productId is required when variantId is provided`”拒绝，形成可复现的创建阻塞。[src/components/SpaceCreateModal.vue](/home/bjw/Code/KK-Image/src/components/SpaceCreateModal.vue#L226)
- 销售模式的 `ProductSelect` 直接把 `primaryImage` 拼成 `/file/${primaryImage}`，而销售商品列表接口返回的 `primaryImage` 可能已经是完整 URL 或以 `/` 开头的路径。对这类商品，选择器缩略图会被拼成错误地址（如 `/file/https://...`），与项目里其它图片解析工具的容错行为不一致。[src/components/product/ProductSelect.vue](/home/bjw/Code/KK-Image/src/components/product/ProductSelect.vue#L194) [functions/lib/hono/routes/sales/products.js](/home/bjw/Code/KK-Image/functions/lib/hono/routes/sales/products.js#L37)

## 修复计划

- 详细执行计划已单独整理到 [2026-04-10-product-module-remediation.md](/home/bjw/Code/KK-Image/docs/superpowers/plans/2026-04-10-product-module-remediation.md)。
- 建议修复顺序:
  - 第一阶段: 先修复图片主图唯一性与主图切换原子性，先止住商品主数据继续被污染。
  - 第二阶段: 修复销售绑定链路，统一后端与前端/小程序的 `in_stock_only` 语义，避免继续生成错误销售订单。
  - 第三阶段: 修复采购重复绑定，同步封堵手工加单、从订单建单、前端选择器三个入口。
  - 第四阶段: 修复空间商品绑定校验与商品型空间解绑残留值问题，消除失效关联与创建阻塞。
  - 第五阶段: 收口导出语义与低风险一致性问题，最后跑完整回归并更新本审计文档状态。

## 审计日志

### 2026-04-10 轮次 1

- 建立审计文档。
- 已确认本轮需要覆盖商品核心模块，以及订单、采购、库存、空间、销售端、小程序消费端关联代码。
- 下一步进入商品核心后端与仓储层深度审查。

### 2026-04-10 轮次 2

- 已完成商品核心后端路由、服务、仓储第一轮通读，补看了图片仓储、导出路由与现有测试覆盖。
- 记录了 2 个高风险问题:
  - 变体图片主图唯一性失效
  - 指定不存在图片为主图会把变体变成“无主图”
- 记录了 1 个中风险问题:
  - 旧的 `/api/manage/products/export` 路由与当前前端变体导出链路语义脱节，且失败语义不正确
- 下一步转到商品前端管理端、导入导出组件和规格编辑交互，继续核对是否还有业务闭环缺口。

### 2026-04-10 轮次 3

- 已完成订单绑定链路审查，覆盖管理端下单/编辑、销售端下单、后端销售订单接口与小程序销售下单组件。
- 新增 1 个高风险问题:
  - 销售端 API 未强制执行 `in_stock_only` 选型策略，可被请求绕过绑定缺货变体
- 新增 1 个中风险问题:
  - 商品绑定组件在“存在变体但当前策略下无可选变体”时错误地发出成功事件，造成假成功 UI
- 下一步继续收口采购/库存/空间链路，并检查是否还有商品导入、批量、图片管理侧的遗漏。

### 2026-04-10 轮次 4

- 已完成采购单、需求/库存投影、货品总览、空间绑定链路及小程序空间/订单/商品消费侧主路径审查。
- 新增 1 个高风险问题:
  - 同一预订单可以被重复加入多个采购单，导致采购需求和在途量重复计算
- 新增 1 个中风险问题:
  - 空间商品绑定接口不校验商品/变体真实存在性，允许写入失效关联
- 剩余工作集中在商品导入、批量工具、图片管理与少量边缘入口，完成后统一收口最终结论。

### 2026-04-10 轮次 5

- 已补扫商品导入、批量生成、图片管理与空间创建等边缘入口。
- 新增 2 个低风险问题:
  - 商品型空间创建流程解绑后残留 `variantId`
  - 销售端商品选择器对绝对图片地址重复拼接 `/file/`
- 剩余工作主要是把已审代码范围和问题文档最终收口，确保没有遗漏关联模块。

### 2026-04-10 轮次 6

- 已完成本次“商品模块 + 全部强关联链路”代码审计收口，范围覆盖管理端商品、销售端商品绑定、订单、采购、库存、货品总览、空间共享及小程序消费侧。
- 本文档已汇总当前确认的问题、严重级别与代码位置，可作为后续逐项修复的基线。

### 2026-04-10 轮次 7

- 已按修复计划顺序完成全部整改，并分别提交独立修复提交。
- 已完成扩展后的总回归，覆盖商品图片、销售绑定、采购、空间、导出和商品管理 UI 相关关键用例。
- 当前审计问题状态已由“待修复”更新为“已全部修复”，后续若有新增缺陷，应另起增量审计记录。

### 2026-04-10 轮次 8

- 对已修复代码做增量复查，重点补扫了商品导入、批量导入策略、列表刷新和缓存相关闭环。
- 新增 1 个高风险问题:
  - 批量导入 `import_mode` 非法值会静默落到 `replace`
- 新增 1 个中风险问题:
  - 导入存在部分成功时，父级商品列表不会自动刷新

### 2026-04-10 轮次 9

- 已完成轮次 8 新增问题修复:
  - `import_mode` 空值现在默认回到 `safe_merge`，非法值直接拒绝，不再静默切换到 `replace`
  - 导入结果只要存在成功写入，就会向父级发出成功事件刷新商品列表；失败/冲突提示仍然保留
- 对应修复提交: `662837a fix: harden product import flow boundaries`

### 2026-04-10 轮次 10

- 继续增量复查商品批量导入与共享请求层。
- 新增 1 个中风险问题:
  - 批量导入路由的审计结果与统计字段已和服务层返回结构脱节，可能长期误报成功并丢失有效统计

### 2026-04-10 轮次 11

- 已完成轮次 10 新增问题修复:
  - 批量导入审计 `result` 现在根据 `batchImport().success` 写入
  - 审计 `metadata` 现在使用服务层真实返回的 `count` 与 `summary` 字段，不再写失效字段
- 对应修复提交: `13fb7ee fix: align product batch import audit semantics`

### 2026-04-10 轮次 12

- 继续增量复查 `PUT /api/manage/products/:id` 与 `PATCH /api/manage/products/:id` 之间的语义边界。
- 新增 1 个中风险问题:
  - `PUT` 在替换变体时若省略 `dimensions`，会静默保留旧规格，导致“全量替换”在规格维度退化成部分更新
- 下一步通过失败测试明确边界，再决定采用显式拒绝还是自动清空的修复策略。

### 2026-04-10 轮次 13

- 继续复查商品更新路由与审计契约对齐情况。
- 新增 1 个低风险问题:
  - `PATCH/PUT` 更新路由把数字型 `changes` 当数组读取，导致商品更新审计里的 `changeCount` 长期缺失

### 2026-04-10 轮次 14

- 已完成轮次 12 与轮次 13 新增问题修复:
  - `PUT` 在替换变体且存在规格数据时，若未显式提交 `dimensions`，现在会直接拒绝歧义请求；无规格商品的简单全量替换不受影响
  - `PATCH/PUT` 商品更新审计现在会正确写入数字型 `changeCount`
- 增量回归:
  - `functions/services/__tests__/ProductCatalogService.put-boundaries.test.js`
  - `functions/services/__tests__/ProductCatalogService.import-mode.test.js`
  - `functions/lib/hono/routes/manage/products/__tests__/product-update-audit-metadata.test.js`
- 对应修复提交: `adb3fee fix: tighten product replace boundaries and audit metadata`

### 2026-04-10 轮次 15

- 继续增量复查销售端商品选择链路，覆盖销售商品列表、销售商品详情、PC 销售绑定组件和小程序商品绑定组件。
- 新增 1 个高风险问题:
  - 销售商品列表接口未强制筛掉无库存商品，导致销售端持续展示“点进去也不能下单”的死胡同商品
- 下一步补失败测试并修复列表过滤契约。

### 2026-04-10 轮次 16

- 已完成轮次 15 新增问题修复:
  - 销售商品列表接口现在固定附带 `hasStock: 'in_stock'`，与“仅可选择有库存变体”的销售策略保持一致
- 增量回归:
  - `functions/lib/hono/routes/sales/__tests__/sales-routes-resilience.test.js`
- 对应修复提交: `75d9b7b fix: filter sales products to in-stock items`

### 2026-04-10 轮次 17

- 继续增量复查小程序销售商品绑定与 PC 销售商品绑定的字段映射一致性。
- 新增 1 个中风险问题:
  - 小程序商品绑定没有按维度标签拆分 `color/material/size`，导致绑定规格字段和 PC 销售端不一致
- 下一步补纯函数回归测试并对齐映射逻辑。

### 2026-04-10 轮次 18

- 已完成轮次 17 新增问题修复:
  - 小程序销售商品绑定现在会结合 `dimensionMap` 按维度标签拆分 `color/material/size`，不再把全部规格值混进 `size`
- 增量回归:
  - `test/minisales-product-binding.test.js`
  - `test/minisales-product-binding-component.test.js`
- 对应修复提交: `1f2a4b6 fix: align minisales product binding fields`

### 2026-04-10 轮次 19

- 继续增量复查小程序订单详情复制预填与商品绑定卡片回显。
- 新增 1 个低风险问题:
  - 复制下单预填没有回填绑定卡片所需的主图和规格摘要，导致绑定关系虽保留但确认信息缺失
- 下一步补纯函数测试并对齐预填字段。

### 2026-04-10 轮次 20

- 已完成轮次 19 新增问题修复:
  - 小程序复制下单预填现在会把绑定卡片需要的 `primaryImage` 和 `variantLabel` 一并回填
- 增量回归:
  - `test/minisales-product-binding.test.js`
  - `test/minisales-product-binding-component.test.js`
  - `test/minisales-form-prefill.test.js`
- 对应修复提交: `ede9100 fix: restore minisales duplicate binding context`

### 2026-04-10 轮次 21

- 继续增量复查订单更新链路与商品解绑后的需求投影一致性。
- 新增 1 个高风险问题:
  - 销售端和管理端订单解绑商品时，需求同步仍沿用旧 `variantId`，会把需求继续挂在已解绑的旧商品规格上
- 下一步补销售端/管理端双向回归，再修复解绑后的需求同步参数。

### 2026-04-10 轮次 22

- 已完成轮次 21 新增问题修复:
  - 销售端和管理端订单更新路由现在会区分“显式传 `variantId: null` 解绑”和“未传 `variantId`”，需求同步只在后者才回退旧规格 ID
- 增量回归:
  - `functions/lib/hono/routes/sales/__tests__/sales-routes-resilience.test.js`
  - `functions/lib/hono/routes/manage/orders/__tests__/detail-update-demand-sync.test.js`
- 对应修复提交: `75d4e0e fix: release demand projection on order unbind`

### 2026-04-10 轮次 23

- 继续深挖订单需求同步后，新增 1 个高风险问题:
  - 管理端在需求活跃状态下改单时，若换绑/解绑规格或修改数量，需求同步不会对旧投影做释放、也不会对新投影做补挂，导致库存预留与订单当前状态漂移
- 销售端同类风险已排除:
  - 销售端只允许编辑 `pending` 订单，不存在对活跃需求订单直接改单的入口
- 下一步补管理端 confirmed 场景回归测试，再把“旧投影释放 + 新投影建立”收敛成统一同步工具。

### 2026-04-10 轮次 24

- 已完成轮次 23 新增问题修复:
  - 新增 `order-demand-sync` 工具，订单更新时会按前后状态、规格和数量判断是走单次状态同步，还是执行“释放旧投影 + 建立新投影”的重平衡
  - 管理端活跃订单在解绑规格或修改数量时，需求/预留投影现在会和订单当前绑定/数量保持一致
- 增量回归:
  - `functions/lib/hono/routes/sales/__tests__/sales-routes-resilience.test.js`
  - `functions/lib/hono/routes/manage/orders/__tests__/detail-update-demand-sync.test.js`
- 对应修复提交: `4ce3e3d fix: rebalance demand sync on active order edits`

### 2026-04-10 轮次 25

- 继续深挖管理端活跃订单改单链路，新增 1 个高风险问题:
  - 管理端仍允许对活跃订单直接改商品绑定；需求投影虽可重平衡，但采购/收货/发货事实和订单行快照无法安全迁移到新绑定
- 下一步不再继续堆叠迁移补丁，而是把商品绑定编辑边界收紧到非活跃订单。

### 2026-04-10 轮次 26

- 已完成轮次 25 新增问题修复:
  - 管理端订单更新路由现在只允许 `pending/rejected/void` 订单改商品绑定，活跃订单会直接拒绝绑定编辑请求
  - 管理端订单编辑弹窗对同类活跃订单也会忽略绑定/解绑操作，避免用户在前端进入无效流程
- 增量回归:
  - `functions/lib/hono/routes/sales/__tests__/sales-routes-resilience.test.js`
  - `functions/lib/hono/routes/manage/orders/__tests__/detail-update-demand-sync.test.js`
  - `src/components/order/__tests__/OrderEditModal.variant-lock.test.js`
- 对应修复提交: `4b07d31 fix: restrict active order binding edits`

### 2026-04-10 轮次 27

- 继续复查活跃订单结构性编辑边界，新增 1 个高风险问题:
  - 管理端仍允许对 `shipping/arrived/delivered` 等执行态订单直接改数量，导致订单头数量与采购/收货/发货事实无法一致迁移
- 下一步把数量编辑能力收紧到 `pending/confirmed/rejected/void`，避免执行态订单继续制造履约事实漂移。

### 2026-04-10 轮次 28

- 已完成轮次 27 新增问题修复:
  - 管理端订单更新路由现在只允许 `pending/confirmed/rejected/void` 订单改数量，`shipping/arrived/delivered` 等执行态订单会直接拒绝
  - 管理端订单编辑弹窗对执行态订单同步锁定数量输入，避免用户在前端进入无效提交流程
- 增量回归:
  - `functions/lib/hono/routes/sales/__tests__/sales-routes-resilience.test.js`
  - `functions/lib/hono/routes/manage/orders/__tests__/detail-update-demand-sync.test.js`
  - `src/components/order/__tests__/OrderEditModal.variant-lock.test.js`
- 对应修复提交: `f6e79f0 fix: lock quantity edits on progressed orders`

### 2026-04-10 轮次 29

- 继续复查订单商品绑定契约，新增 1 个中风险问题:
  - 管理端/销售端后端在商品绑定创建或改绑时没有根据已校验变体反推规格镜像字段，绕过前端可写入“绑定对了，但规格摘要错了”的脏订单
- 下一步把规格镜像字段回填逻辑收敛成后端共享 helper，并接入订单创建/编辑链路。

### 2026-04-10 轮次 30

- 已完成轮次 29 新增问题修复:
  - 新增 `order-binding-snapshot` helper，按 `variant.options_values + product.dimension_map` 统一反推 `sku/color/material/size`
  - 销售端创建/编辑、管理端创建/编辑在存在有效商品绑定时，都会用后端反推结果兜底规格镜像字段，不再信任脏请求体
- 增量回归:
  - `functions/lib/hono/routes/sales/__tests__/sales-routes-resilience.test.js`
  - `functions/lib/hono/routes/manage/orders/__tests__/detail-update-demand-sync.test.js`
- 对应修复提交: `76e51ee fix: sync order binding snapshot fields`

### 2026-04-10 轮次 31

- 继续复查管理端订单编辑契约，新增 1 个中风险问题:
  - 管理端弹窗允许改派销售员，但后端更新流程没有真正持久化 `salesperson_id`，导致改派“假成功”
- 下一步把销售员改派纳入订单顶级列变更闭环，并补仓储层回归。

### 2026-04-10 轮次 32

- 已完成轮次 31 新增问题修复:
  - 管理端订单更新路由现在会把 `salespersonId` 作为独立顶级列变更传入更新流程
  - `processOrderUpdate()` 与 `updateComposite()` 现已支持 `salesperson_id` 持久化，改派后的域事件也会携带新销售员
- 增量回归:
  - `functions/lib/hono/routes/sales/__tests__/sales-routes-resilience.test.js`
  - `functions/lib/hono/routes/manage/orders/__tests__/detail-update-demand-sync.test.js`
  - `functions/repositories/__tests__/order-mutations.test.js`
  - `src/components/order/__tests__/OrderEditModal.variant-lock.test.js`
- 对应修复提交: `41d5e35 fix: persist order salesperson reassignment`

### 2026-04-10 轮次 33

- 继续复查空间商品链路，新增 1 个中风险问题:
  - 子空间创建入口允许绑定商品和规格，但后端子空间创建 schema、校验和仓储插入都没有完整接住 `productId/variantId`，会生成缺失商品主键的脏子空间绑定
- 下一步把子空间商品绑定纳入与顶级空间一致的校验/持久化闭环，并补路由与仓储回归。

### 2026-04-10 轮次 34

- 已完成轮次 33 新增问题修复:
  - 子空间创建路由现在会接收并校验 `productId/variantId`，非法半绑定会直接拒绝
  - 子空间仓储插入现已同步持久化 `product_id + variant_id`，并把新绑定纳入缓存失效与审计元数据
- 增量回归:
  - `functions/lib/hono/routes/manage/spaces/__tests__/subspaces-routes.test.js`
  - `functions/lib/hono/routes/manage/__tests__/spaces-crud-validation.test.js`
  - `functions/repositories/__tests__/SpaceRepository.test.js`
- 对应修复提交: `8fbc9e2 fix: persist subspace product bindings`

### 2026-04-10 轮次 35

- 继续复查空间创建表单与后端契约，新增 1 个中风险问题:
  - 顶级空间和子空间创建弹窗都允许配置销售可见性，但创建接口未持久化 `shareMode/sharedSalespersonIds`，导致创建成功后实际分享范围回退默认值
- 下一步把创建链路与编辑链路对齐，补齐 `share_mode` 入库和选择性分享销售员写入。

### 2026-04-10 轮次 36

- 已完成轮次 35 新增问题修复:
  - 顶级空间和子空间创建接口现在都会接收并持久化 `shareMode`
  - 创建时选择性分享的销售员列表现已同步写入 `space_salesperson_shares`，首提即可生效，不再需要二次编辑补录
- 增量回归:
  - `functions/lib/hono/routes/manage/__tests__/spaces-crud-validation.test.js`
  - `functions/lib/hono/routes/manage/spaces/__tests__/subspaces-routes.test.js`
  - `functions/repositories/__tests__/SpaceRepository.test.js`
- 对应修复提交: `37b6649 fix: persist space visibility on create`

### 2026-04-10 轮次 37

- 继续复查商品导出链路，新增 1 个中风险问题:
  - 商品导出的 `Color/Size/Material` 固定列只认英文固定键，遇到维度 ID 或中文维度名时会导出空白规格列
- 下一步把规格列提取逻辑改成基于 `dimension_map + 维度标签别名` 的统一映射，并让后端导出路由补齐维度映射上下文。

### 2026-04-10 轮次 38

- 已完成轮次 37 新增问题修复:
  - 导出工具现已通过 `dimension_map` 和中英文维度标签别名回填 `Color/Size/Material`
  - 管理端后端 CSV 导出现在会一并加载 `dimension_map`，与前端导出保持同一套规格映射语义
- 增量回归:
  - `src/components/product/export/__tests__/export-utils.test.js`
  - `src/components/product/__tests__/ProductExportModal.filters.test.js`
  - `functions/lib/hono/routes/manage/products/__tests__/export-route.test.js`
- 对应修复提交: `e837c63 fix: map export spec columns from dimension labels`

### 2026-04-10 轮次 39

- 继续复查商品导入状态聚合逻辑，新增 1 个中风险问题:
  - 导入弹窗会把后端返回的 `count: 0` 错算成整批成功数量，导致零成功批次也可能触发“导入成功”后续流程
- 下一步把导入结果聚合中的数值读取统一改成“显式保留 0”，消除零值被 `||` 吃掉的假成功。

### 2026-04-10 轮次 40

- 已完成轮次 39 新增问题修复:
  - 导入弹窗现已统一按显式数值累加 `count/created/updated/conflicts/failedProducts`，合法的 `0` 不再回退成默认整批值
  - 整批零成功时 `importResult.success` 将保持失败态，也不会再错误触发父级 `success` 事件
- 增量回归:
  - `src/components/product/__tests__/ProductImportModal.variant-first.test.js`
- 对应修复提交: `566f737 fix: avoid false success on zero-count imports`

### 2026-04-10 轮次 41

- 继续复查商品管理页边缘弹窗，新增 1 个中风险问题:
  - 商品统计弹窗没有加载任何商品数据，统计默认全 0；并且统计口径天然偏向当前分页，无法反映完整筛选结果
- 下一步让统计弹窗在打开时按当前筛选条件拉完整分页数据，再按全量结果计算库存预警和库存总值。

### 2026-04-10 轮次 42

- 已完成轮次 41 新增问题修复:
  - `ProductStats` 现在会在弹窗打开时按当前筛选条件拉取完整分页结果，不再读取空状态
  - 库存预警、库存总值与总商品数现已统一按完整筛选结果统计，避免被当前页数据截断
- 增量回归:
  - `src/components/product/__tests__/ProductStats.test.js`
  - `src/components/__tests__/ProductManager.create-success-ux.test.js`
  - `src/components/__tests__/ProductManager.variant-hydration.test.js`
- 对应修复提交: `32705af fix: load complete product stats for modal`

### 2026-04-10 轮次 43

- 继续复查商品详情与空间关联链路，新增 1 个中风险问题:
  - 商品详情组件切换商品时不会重载关联空间，导致同一详情实例查看多件商品时出现上一件商品的分享空间残留
- 下一步把关联空间读取改成跟随 `product.id` 变化重载，并补竞态保护，避免旧请求回写。

### 2026-04-10 轮次 44

- 已完成轮次 43 新增问题修复:
  - 商品详情组件现在会跟随 `product.id` 变化重载关联空间列表，不再复用旧商品结果
  - 关联空间加载新增请求序号保护，快速切换商品时旧请求不会回写新详情
- 增量回归:
  - `src/components/product/__tests__/ProductDetail.associated-spaces.test.js`
  - `src/components/product/__tests__/ProductDetailModal.fetch-variants.test.js`
  - `src/components/product/__tests__/product-inventory-projection-consumers.test.js`
- 对应修复提交: `e64649a fix: reload product detail spaces on change`

### 2026-04-10 轮次 45

- 继续复查商品详情的空间展示契约，新增 1 个低风险问题:
  - 详情页关联空间展示仍读取 snake_case 字段，导致浏览量与公开状态在当前 camelCase 投影下无法显示
- 下一步把详情页完全对齐到前端空间投影字段，并补源码契约与交互回归。

### 2026-04-10 轮次 46

- 已完成轮次 45 新增问题修复:
  - 商品详情关联空间展示现已统一读取 `viewCount/isPublic/shareToken`，不再混用旧 snake_case 字段
  - 已补源码契约与 UI 回归，确保空间列表投影字段继续保持 camelCase
- 增量回归:
  - `src/components/product/__tests__/ProductDetail.associated-spaces.test.js`
  - `src/components/product/__tests__/product-inventory-projection-consumers.test.js`
- 对应修复提交: `3883e69 fix: align product detail space projection fields`

### 2026-04-10 轮次 47

- 继续复查商品列表展示契约，新增 1 个低风险问题:
  - 移动端商品卡片仍读取 `stock_quantity`，和桌面端基于 `available_quantity` 的库存口径不一致
- 下一步把移动端库存展示与低库存标记统一切到可用库存投影，消除跨端数字分叉。

### 2026-04-10 轮次 48

- 已完成轮次 47 新增问题修复:
  - `ProductGrid` 现在与桌面端一致，统一按 `available_quantity -> available -> stock_quantity` 展示库存
  - 移动端低库存标记也已同步切换到可用库存口径，不再与桌面端出现不同判定
- 增量回归:
  - `src/components/product/__tests__/ProductGrid.available-stock.test.js`
  - `src/components/product/__tests__/ProductFilters.desktop-layout.test.js`
  - `src/components/product/__tests__/product-inventory-projection-consumers.test.js`
- 对应修复提交: `7c229b5 fix: align mobile product stock display`

### 2026-04-10 轮次 49

- 继续复查商品详情工作流组件，新增 1 个中风险问题:
  - 详情渐进式水合缺少请求隔离，切换商品时旧请求会回写新商品详情
- 下一步给详情水合链路补请求序号隔离，并在切换商品时废弃旧 Promise 状态。

### 2026-04-10 轮次 50

- 已完成轮次 49 新增问题修复:
  - `ProductWorkflowModal` 现在会在切换商品或关闭弹窗时废弃旧的详情水合请求
  - 旧商品水合结果不会再覆盖新商品详情，详情查看与编辑入口都改为跟随当前商品稳定更新
- 增量回归:
  - `src/components/product/__tests__/ProductWorkflowModal.test.js`
  - `src/components/product/__tests__/ProductDetailModal.fetch-variants.test.js`
  - `src/components/product/__tests__/ProductDetail.associated-spaces.test.js`
- 对应修复提交: `b4a66ea fix: isolate product workflow hydration requests`

### 2026-04-10 轮次 51

- 继续复查采购页商品详情弹窗与商品详情加载链路，新增 1 个中风险问题:
  - `ProductDetailModal` 未向父级透传 `close`，且切换 `productId` 时缺少请求隔离与强制重载
- 下一步把弹窗关闭事件、详情请求序号和 `productId` 变更重载条件一起收口，补采购页关联回归。

### 2026-04-10 轮次 52

- 已完成轮次 51 新增问题修复:
  - `ProductDetailModal` 现在会把内层 `Modal` 的 `close` 事件向外透传，采购页关闭动作重新闭环
  - 详情加载新增请求序号隔离，切换 `productId` 或关闭弹窗时旧请求不会再回写
  - 无 `initialData` 的复用场景改为按 `productId` 强制重载，采购页切商品不再沿用旧详情
- 增量回归:
  - `src/components/product/__tests__/ProductDetailModal.fetch-variants.test.js`
  - `src/views/__tests__/PurchaseOrders.detail-shell.test.js`
- 对应修复提交: `221bf84 fix: stabilize product detail modal lifecycle`

### 2026-04-10 轮次 53

- 继续复查商品管理页查询态编辑入口，新增 1 个中风险问题:
  - `query.edit` 自动水合期间关闭编辑弹窗，旧请求返回后仍会重新打开弹窗
- 下一步给 `handleQueryEditOpen()` 增加请求序号隔离，并在弹窗关闭时废弃旧的编辑水合请求。

### 2026-04-10 轮次 54

- 已完成轮次 53 新增问题修复:
  - `ProductManager` 现在会为 `query.edit` 自动水合请求分配序号，关闭编辑弹窗后旧请求不会再回写
  - 用户在加载中主动关闭编辑弹窗时，旧请求不会再次调用 `handleEdit()` 把弹窗拉起
- 增量回归:
  - `src/components/__tests__/ProductManager.variant-hydration.test.js`
  - `src/components/product/__tests__/ProductWorkflowModal.test.js`
  - `src/components/product/__tests__/ProductDetailModal.fetch-variants.test.js`
- 对应修复提交: `0a38335 fix: isolate query edit hydration lifecycle`

### 2026-04-10 轮次 55

- 继续复查商品导出弹窗异步链路，新增 1 个中风险问题:
  - 导出进行中关闭弹窗，旧导出任务完成后仍会把旧文件状态写回组件
- 下一步为导出流程加运行序号，关闭弹窗时废弃旧导出任务，并补关闭后不回写的回归。

### 2026-04-10 轮次 56

- 已完成轮次 55 新增问题修复:
  - `ProductExportModal` 现在会为每轮导出分配运行序号，关闭弹窗后旧任务不会再回写 `readyToDownload/generatedBlob`
  - 导出文件名生成改为在有效任务末尾一次性提交，重新打开弹窗不会再看到上一轮关闭前的旧结果
- 增量回归:
  - `src/components/product/__tests__/ProductExportModal.filters.test.js`
  - `src/components/__tests__/ProductManager.variant-hydration.test.js`
  - `src/components/product/__tests__/ProductDetailModal.fetch-variants.test.js`
- 对应修复提交: `52e2a72 fix: discard stale product export runs`

### 2026-04-10 轮次 57

- 继续复查商品管理页列表入口，新增 1 个中风险问题:
  - 连续点击不同商品的“编辑/分享”时，旧的详情水合结果会覆盖最新一次操作目标
- 下一步为 `handleEditWithHydration()` 与 `handleShare()` 加请求先后隔离，只认最新一次点击。

### 2026-04-10 轮次 58

- 已完成轮次 57 新增问题修复:
  - `ProductManager` 现在为编辑/分享入口各自维护最新请求序号，旧请求不会再覆盖当前商品上下文
  - 创建弹窗关闭、query.edit 自动水合、分享弹窗关闭时都会同步废弃对应旧请求，避免状态回写错目标
- 增量回归:
  - `src/components/__tests__/ProductManager.variant-hydration.test.js`
  - `src/components/product/__tests__/ProductExportModal.filters.test.js`
  - `src/components/product/__tests__/ProductDetailModal.fetch-variants.test.js`
  - `src/components/product/__tests__/ProductWorkflowModal.test.js`
- 对应修复提交: `3cf6bea fix: keep latest product manager hydration`
