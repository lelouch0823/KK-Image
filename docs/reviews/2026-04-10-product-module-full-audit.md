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

- 截至 2026-04-10，本次审计确认的 8 个问题已全部完成修复，以下原始问题清单作为审计基线保留。
- 对应修复提交:
  - `a849ceb` / `c4272f7`: 变体图片唯一性、主图切换与批量操作边界
  - `4895358`: 销售侧 `in_stock_only` 约束与假成功状态
  - `38d0279`: 预订单重复采购拦截
  - `c6bc3c3`: 空间商品绑定校验与解绑残留值
  - `3f70954`: 商品导出路由与前端导出契约统一
  - `4c3099b`: 销售商品选择器图片地址规范
- 最终验证:
  - 2026-04-10 运行 23 个回归测试文件，共 128 个测试，全部通过。
- 残余风险:
  - 当前验证以仓储、路由、组件契约和关键链路回归为主，尚未执行浏览器级 E2E 或线上数据回放。

## 问题清单（审计基线，已全部修复）

### Critical

- 暂无

### High

- `VariantImageRepository.addImage()` 允许同一变体重复插入相同图片，也允许在 `isPrimary=true` 时直接新增一条新的主图记录而不清除旧主图，导致单个变体可能同时存在多个主图、重复图记录，破坏图片顺序和主图唯一性约束。[functions/repositories/VariantImageRepository.js](/home/bjw/Code/KK-Image/functions/repositories/VariantImageRepository.js#L11)
- `VariantImageRepository.setPrimary()` 先把该变体全部图片置为非主图，再按 `imageId` 更新目标图；但它没有校验目标图片是否存在，若 `imageId` 不存在会返回成功且让该变体失去所有主图。[functions/repositories/VariantImageRepository.js](/home/bjw/Code/KK-Image/functions/repositories/VariantImageRepository.js#L99)
- 销售端下单/改单后端没有强制执行前端声明的“仅可选择有库存变体”策略。`ProductBindingSection` 和小程序绑定组件都把销售场景固定成 `in_stock_only`，但销售 API 只校验商品/变体存在且为 `active`，不校验 `available_quantity/stock_quantity > 0`，因此绕过前端即可把缺货变体绑定到销售订单，破坏销售侧“只卖可售库存”的业务约束。[src/views/sales/SalesFormView.vue](/home/bjw/Code/KK-Image/src/views/sales/SalesFormView.vue#L9) [functions/lib/hono/routes/sales/orders.js](/home/bjw/Code/KK-Image/functions/lib/hono/routes/sales/orders.js#L74) [functions/api/utils/validation.js](/home/bjw/Code/KK-Image/functions/api/utils/validation.js#L5)
- 采购链路没有阻止同一个预订单被重复采购。无论是手工 `POST /purchase-orders/:id/items`、前端 `OrderPickerModal`，还是 `createFromOrders()`，都只检查订单 `status === 'confirmed'` 与商品/变体匹配，却没有校验 `procurement_status`、也没有校验该 `pre_order_id` 是否已存在于其他未完成采购单中，导致同一订单可被多个采购单重复拉起，直接放大补货量与在途量。[functions/lib/hono/routes/manage/purchase-orders.js](/home/bjw/Code/KK-Image/functions/lib/hono/routes/manage/purchase-orders.js#L156) [src/components/purchase-order/OrderPickerModal.vue](/home/bjw/Code/KK-Image/src/components/purchase-order/OrderPickerModal.vue#L268) [functions/services/PurchaseOrderService.js](/home/bjw/Code/KK-Image/functions/services/PurchaseOrderService.js#L373)

### Medium

- 管理端 `/api/manage/products/export` 路由实现与当前前端导出链路语义不一致：它始终忽略筛选条件、仅导出商品汇总字段、不导出变体级字段，并在后台异常时把错误文本直接写进 CSV 流返回 `200`，不利于调用方准确识别失败。[functions/lib/hono/routes/manage/products/export.js](/home/bjw/Code/KK-Image/functions/lib/hono/routes/manage/products/export.js#L7)
- `ProductBindingSection.handleProductSelect()` 只要商品详情里存在任意变体就直接发出 `product-fetch-success`，即使在当前策略下所有变体都不可选、`initSelectionFromVariants()` 已经把 `selectedVariantId` 留空。销售页收到这个成功事件后会清空错误提示，但并未真正绑定商品，最终形成“选了商品却没有可售变体、页面也不报错”的假成功状态。[src/components/order/ProductBindingSection.vue](/home/bjw/Code/KK-Image/src/components/order/ProductBindingSection.vue#L601) [src/views/sales/SalesFormView.vue](/home/bjw/Code/KK-Image/src/views/sales/SalesFormView.vue#L9)
- 空间商品绑定接口在创建和更新时调用 `validateProductVariantBinding(..., { checkExistence: false })`，只校验 `productId/variantId` 是否成对出现，不校验商品是否存在、变体是否属于商品，也不校验是否仍然有效。结果是后台可以写入任意伪造的商品/变体关联，后续空间列表、详情和销售端空间消费只能得到空 JOIN 或陈旧映射。[functions/lib/hono/routes/manage/spaces/crud.js](/home/bjw/Code/KK-Image/functions/lib/hono/routes/manage/spaces/crud.js#L162) [functions/lib/hono/routes/manage/spaces/crud.js](/home/bjw/Code/KK-Image/functions/lib/hono/routes/manage/spaces/crud.js#L250) [functions/api/utils/validation.js](/home/bjw/Code/KK-Image/functions/api/utils/validation.js#L25)

### Low

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
