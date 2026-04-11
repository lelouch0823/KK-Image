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

- 截至 2026-04-11，本次审计累计确认的 125 个问题已全部完成修复；以下清单保留为审计基线与增量复查记录。
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
  - `40d4889`: 商品导入弹窗关闭后的旧任务回写修复
  - `a814e4a`: 商品导入图片上传步骤关闭后的旧任务回写修复
  - `1a0cfd1`: 订单商品绑定组件仅认最新详情加载结果
  - `2259aa6`: 空间商品编辑器仅认最新刷新结果
  - `bd4a758`: 商品表单规格归档向导仅认当前弹窗上下文的异步结果
  - `28e0735`: 商品表单保存提交仅认当前弹窗上下文的异步结果
  - `8dc71e6`: 销售商品查询状态改为实例隔离并只认最新搜索结果
  - `2014b42`: 商品统计弹窗仅认当前筛选轮次的全量统计结果
  - `1fcdcfc`: 采购商品选择器仅认当前打开轮次与当前搜索结果
  - `7094210`: 采购订单选择器仅认当前订单详情预览请求
  - `9fe0ca2`: 采购单详情加载仅认最新请求结果
  - `799d0db`: 采购建议列表仅认最新加载结果
  - `38a7bb4`: 采购统计卡片仅认最新加载结果
  - `98c04f2`: 采购单列表仅认最新筛选/分页请求结果
  - `df769ed`: 采购详情写操作仅允许回写当前打开的采购单
  - `e8a2865`: 管理端与销售端订单列表状态拆分，并只认最新列表请求结果
  - `5d6b42b`: 销售订单详情页在路由切单时重载，并阻断旧详情回写
  - `6de7bab`: 订单管理页详情/编辑模态只认当前水合请求结果
  - `d9ce028`: 销售统计页只认当前 token 的最新统计请求结果
  - `a2ae14b`: 销售空间页只认当前 token 的最新空间列表请求结果
  - `c07defb`: 销售通知模式会跟随最新 token 切换，并阻断旧通知请求回写
  - `629bb8f`: 销售入口页认证只认当前 token 的最新认证结果
  - `b1f09a2`: 管理端挂载时会重置通知模式回 admin，并清空旧销售通知状态
  - `4e936a8`: 销售订单列表搜索改为走服务端查询并支持当前搜索结果分页
  - `5c04f98`: Dashboard 订单详情抽屉只认当前详情请求结果
  - `c1c1999`: 货品总览列表和汇总只认当前筛选轮次的最新请求结果
  - `844b179`: 销售订单状态机只认当前动作的最新状态迁移结果
  - `b5ce2aa`: 货品总览禁止为非缺货项静默生成采购单
  - `470323b`: 商品导入阻断“同名多行但未提供 SPU”的歧义分组
  - `fe6c80f`: 商品空间公开页切换空间时重置媒体索引与 PDF 预览状态
  - `bf2faf0`: 商品空间公开页只认当前 token 的最新空间加载结果
  - `b40d979`: 密码保护商品空间访问补齐浏览量与访问日志记录
  - `5b80156`: 密码保护商品空间 POST 访问补齐私有/过期校验
  - `a6cd71f`: 商品空间前端正确识别密码门禁响应
  - `2223e18`: 商品空间密码提交只认当前 token 的最新结果
  - `5e7c3a7`: 商品空间未完成人机验证时切 token 不再绕过 Turnstile
  - `fc1ae7c`: 商品空间模板数据优先投影变体 SKU 和变体主图
  - `cf6a23d`: 商品空间模板数据优先投影变体材质
  - `8ab147f`: 商品空间编辑器绑定变体时同步变体材质
  - `e86694a`: 小程序销售空间详情会补齐商品模板图片预览文件
  - `861a651`: 管理员预览私有合集时补齐私有子空间可见性
  - `ec1675a`: 空间批量下载在全失败时不再假成功
  - `c5d8961`: 管理端与销售端空间主列表排除子空间
  - `4262e29`: 空间详情弹窗与子空间列表只认当前上下文
  - `0ec730d`: 空间详情弹窗写操作失败时不再假成功
  - `753b08c`: 空间创建弹窗阻断重复提交
  - `031178e`: 空间删除失败时保留确认弹窗
  - `ab321f7`: 空间可见性设置只在保存确认后清脏
  - `746e756`: 商品详情关联空间复制链接统一走共享剪贴板 helper
  - `34be40a`: 空间商品编辑器媒体操作失败时不再假成功
  - `6b0f0e7`: 空间商品编辑器媒体回刷不再覆盖未保存草稿
  - `f80e5c5`: 空间详情切换到加载失败的新空间时清理旧详情
  - `f00d15f`: 商品导入预览冲突复制统一走共享剪贴板 helper
  - `fe79d15`: 管理端商品选择器补齐本地错误态与重试入口
  - `07a9a1c`: 商品导入图片上传全失败时不再假成功进入预览
  - `845c9dd`: 商品导入剔除未解析的本地图片文件名脏数据
  - `c5bb847`: 商品工作流弹窗切商品时清理旧编辑错误
  - `6fa20b0`: 商品导入图片部分成功时改为警告提示
  - `0346601`: 商品详情背景补全失败时保留当前快照
  - `cb8fbc4`: 商品导出详情补全失败时中止导出
  - `cc418b0`: 商品导出弹窗会话重置、导出条件变更后旧下载失效、商品选择器上下文切换重载
  - `dd323d5`: 商品统计弹窗刷新失败时清理旧统计结果
  - `7c79bb4`: 商品 PATCH/PUT 在仅提交 dimensions 时真正执行规格同步
  - `c5e9811`: 商品导入在整批冲突跳过时保留冲突结果而不误记为失败
  - `ee0f12c`: 商品预警阈值为 0 时不再被仓储和前端错误回退成 10
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
  - 2026-04-10 运行 6 个回归测试文件，共 10 个测试，全部通过。
  - 2026-04-10 运行 6 个回归测试文件，共 8 个测试，全部通过。
  - 2026-04-10 运行 4 个回归测试文件，共 13 个测试，全部通过。
  - 2026-04-10 运行 6 个回归测试文件，共 8 个测试，全部通过。
  - 2026-04-10 运行 6 个回归测试文件，共 8 个测试，全部通过。
  - 2026-04-10 运行 7 个回归测试文件，共 10 个测试，全部通过。
  - 2026-04-10 运行 6 个回归测试文件，共 10 个测试，全部通过。
  - 2026-04-11 运行 3 个回归测试文件，共 11 个测试，全部通过。
  - 2026-04-11 运行 5 个回归测试文件，共 21 个测试，全部通过。
  - 2026-04-11 运行 5 个回归测试文件，共 23 个测试，全部通过。
  - 2026-04-11 运行 7 个回归测试文件，共 28 个测试，全部通过。
  - 2026-04-11 运行 2 个回归测试文件，共 23 个测试，全部通过。
  - 2026-04-11 运行 2 个回归测试文件，共 18 个测试，全部通过。
  - 2026-04-11 运行 2 个回归测试文件，共 24 个测试，全部通过。
  - 2026-04-11 运行 2 个回归测试文件，共 25 个测试，全部通过。
  - 2026-04-11 运行 3 个回归测试文件，共 13 个测试，全部通过。
  - 2026-04-11 运行 2 个回归测试文件，共 26 个测试，全部通过。
  - 2026-04-11 运行 3 个回归测试文件，共 14 个测试，全部通过。
  - 2026-04-11 运行 3 个回归测试文件，共 13 个测试，全部通过。
  - 2026-04-10 运行 5 个回归测试文件，共 9 个测试，全部通过。
  - 2026-04-10 运行 6 个回归测试文件，共 9 个测试，全部通过。
  - 2026-04-10 运行 3 个回归测试文件，共 14 个测试，全部通过。
  - 2026-04-10 运行 1 个回归测试文件，共 6 个测试，全部通过。
  - 2026-04-10 运行 5 个回归测试文件，共 9 个测试，全部通过。
  - 2026-04-10 运行 1 个回归测试文件，共 7 个测试，全部通过。
  - 2026-04-10 运行 1 个回归测试文件，共 16 个测试，全部通过。
  - 2026-04-10 运行 1 个回归测试文件，共 1 个测试，全部通过。
  - 2026-04-10 运行 2 个回归测试文件，共 2 个测试，全部通过。
  - 2026-04-10 运行 3 个回归测试文件，共 3 个测试，全部通过。
  - 2026-04-10 运行 3 个回归测试文件，共 5 个测试，全部通过。
  - 2026-04-10 运行 3 个回归测试文件，共 6 个测试，全部通过。
  - 2026-04-10 运行 3 个回归测试文件，共 7 个测试，全部通过。
  - 2026-04-10 运行 3 个回归测试文件，共 8 个测试，全部通过。
  - 2026-04-10 运行 1 个回归测试文件，共 2 个测试，全部通过。
  - 2026-04-10 运行 1 个回归测试文件，共 2 个测试，全部通过。
  - 2026-04-10 运行 2 个回归测试文件，共 7 个测试，全部通过。
  - 2026-04-10 运行 2 个回归测试文件，共 3 个测试，全部通过。
  - 2026-04-10 运行 2 个回归测试文件，共 21 个测试，全部通过。
  - 2026-04-10 运行 3 个回归测试文件，共 18 个测试，全部通过。
  - 2026-04-10 运行 3 个回归测试文件，共 16 个测试，全部通过。
  - 2026-04-10 运行 4 个回归测试文件，共 22 个测试，全部通过。
  - 2026-04-10 运行 3 个回归测试文件，共 28 个测试，全部通过。
  - 2026-04-10 运行 4 个回归测试文件，共 33 个测试，全部通过。
  - 2026-04-10 运行 4 个回归测试文件，共 45 个测试，全部通过。
  - 2026-04-10 运行 5 个回归测试文件，共 49 个测试，全部通过。
  - 2026-04-10 运行 4 个回归测试文件，共 28 个测试，全部通过。
  - 2026-04-10 运行 3 个回归测试文件，共 12 个测试，全部通过。
  - 2026-04-10 运行 3 个回归测试文件，共 19 个测试，全部通过。
  - 2026-04-10 运行 3 个回归测试文件，共 19 个测试，全部通过。
  - 2026-04-10 运行 2 个回归测试文件，共 19 个测试，全部通过。
  - 2026-04-10 运行 2 个回归测试文件，共 20 个测试，全部通过。
  - 2026-04-10 运行 2 个回归测试文件，共 32 个测试，全部通过。
  - 2026-04-10 运行 2 个回归测试文件，共 33 个测试，全部通过。
  - 2026-04-10 运行 2 个回归测试文件，共 34 个测试，全部通过。
  - 2026-04-10 运行 2 个回归测试文件，共 35 个测试，全部通过。
  - 2026-04-10 运行 2 个回归测试文件，共 36 个测试，全部通过。
  - 2026-04-11 运行 3 个回归测试文件，共 32 个测试，全部通过。
  - 2026-04-11 运行 3 个回归测试文件，共 13 个测试，全部通过。
  - 2026-04-11 运行 3 个回归测试文件，共 8 个测试，全部通过。
  - 2026-04-11 运行 2 个回归测试文件，共 31 个测试，全部通过。
  - 2026-04-11 运行 6 个回归测试文件，共 26 个测试，全部通过。
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
- 密码保护的公开空间 `POST /api/space/:token` 只校验密码，不校验 `is_public` 和 `expires_at`。结果是只要知道分享 token 和密码，就能直接绕过“私有空间不可公开访问”与“过期空间不可访问”的限制，属于公开空间访问控制缺口。[functions/api/space/[token].js](/home/bjw/Code/KK-Image/functions/api/space/[token].js#L202)

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
- `ProductImportModal` 允许在导入进行中通过模态框默认关闭动作直接关掉弹窗，但关闭后既不会重置导入步骤，也不会废弃当前 `importProducts()` 请求。旧导入结果返回后仍会回写 `importResult` 并触发成功事件，重新打开弹窗还会停留在上一轮残留状态，形成导入链路的旧结果串写。[src/components/product/ProductImportModal.vue](/home/bjw/Code/KK-Image/src/components/product/ProductImportModal.vue#L134)
- `ProductImportModal` 的图片上传步骤同样没有绑定生命周期。用户在第 3 步匹配图片后，如果关闭弹窗，旧的 `authFetch(...upload...)` 循环完成后仍会继续给 `parsedItems` 注入图片 ID、弹成功提示并把流程推进到预览页，形成图片上传阶段的旧结果串写。[src/components/product/ProductImportModal.vue](/home/bjw/Code/KK-Image/src/components/product/ProductImportModal.vue#L671)
- `ProductBindingSection.handleProductSelect()` 在订单绑定链路里直接串行拉商品详情，但没有隔离请求先后。用户快速切换两件商品时，先点商品的旧请求如果后返回，会把后点商品的规格集、默认选中变体和 `select/product-fetch-success` 事件一起覆盖掉，导致订单绑定到错误商品。[src/components/order/ProductBindingSection.vue](/home/bjw/Code/KK-Image/src/components/order/ProductBindingSection.vue#L600)
- `SpaceProductEditor.initData()` 会在首屏、文件刷新和文件增删后多次重跑，但没有隔离请求先后。旧的 `loadSpace()/loadProduct()` 调用如果后返回，会把刚刷新得到的新空间名、商品绑定和模板字段覆盖成旧值，导致空间商品编辑器出现可复现的回跳。[src/components/SpaceProductEditor.vue](/home/bjw/Code/KK-Image/src/components/SpaceProductEditor.vue#L452)
- `useProductForm` 的规格维度/规格值归档相关异步动作没有绑定弹窗生命周期。编辑商品时如果在 `previewDimensionImpact/archiveDimension/archiveDimensionValue/restoreDimensionValue` 未完成前关闭弹窗或切到另一件商品，旧请求返回后仍会把当前表单重新打开到旧归档向导，甚至继续改写新商品的规格表单状态。[src/composables/useProductForm.js](/home/bjw/Code/KK-Image/src/composables/useProductForm.js#L357) [src/components/product/ProductCreateModal.vue](/home/bjw/Code/KK-Image/src/components/product/ProductCreateModal.vue#L387)
- `ProductCreateModal/useProductForm` 的保存提交同样没有绑定弹窗生命周期。用户在保存商品时仍然可以关闭弹窗或切到另一件商品，旧的 `createProduct/updateProduct` 请求返回后会继续弹成功提示、向父级发出 `success` 并再次 `emit('update:modelValue', false)`，从而把当前新开的商品弹窗也一起关掉，形成商品保存链路的假成功和串上下文关闭。[src/composables/useProductForm.js](/home/bjw/Code/KK-Image/src/composables/useProductForm.js#L373) [src/composables/useProductForm.js](/home/bjw/Code/KK-Image/src/composables/useProductForm.js#L925)
- `useSalesProducts` 把 `products/loading/error/meta/lastQuery` 做成了模块级单例，同时销售商品列表请求也没有先后隔离。结果是多个销售商品选择器或商品绑定场景会共用同一份查询状态，彼此搜索会互相覆盖；同一个选择器里快速连续搜索时，旧关键字的慢请求也可能在后返回后覆盖新结果，把下拉列表回跳到过期商品集。[src/composables/useSalesProducts.js](/home/bjw/Code/KK-Image/src/composables/useSalesProducts.js#L1) [src/components/product/ProductSelect.vue](/home/bjw/Code/KK-Image/src/components/product/ProductSelect.vue#L148) [src/components/order/ProductBindingSection.vue](/home/bjw/Code/KK-Image/src/components/order/ProductBindingSection.vue#L287)
- `ProductStats` 会在统计弹窗打开后随筛选条件反复重跑全量分页统计，但没有隔离整轮统计请求。用户快速切换筛选条件时，旧筛选的慢请求在后返回后仍会把 `statsProducts/statsTotal` 覆盖成过期结果，导致统计弹窗显示上一组筛选的商品总数、低库存数量和库存总值。[src/components/product/ProductStats.vue](/home/bjw/Code/KK-Image/src/components/product/ProductStats.vue#L53) [src/components/ProductManager.vue](/home/bjw/Code/KK-Image/src/components/ProductManager.vue#L92)
- `ProductPickerModal` 在采购商品选择链路里会随打开弹窗和搜索关键字反复请求 `loadActiveVariants()`，但缺少请求先后与弹窗生命周期隔离。旧搜索或上一次打开弹窗的慢请求在后返回后，仍会把当前变体列表覆盖成过期结果，导致采购选择器显示错批商品并污染当前勾选上下文。[src/components/purchase-order/ProductPickerModal.vue](/home/bjw/Code/KK-Image/src/components/purchase-order/ProductPickerModal.vue#L170) [src/views/PurchaseOrders.vue](/home/bjw/Code/KK-Image/src/views/PurchaseOrders.vue#L975)
- `OrderPickerModal` 的订单详情预览没有隔离 `getOrder()` 请求先后。用户在采购建单时连续查看两张预订单，或在详情预览中途关闭抽屉后重开另一张订单，旧详情请求返回后仍会覆盖当前 `viewingOrder/detailError/loadingDetail`，导致采购侧看到错误订单详情。[src/components/purchase-order/OrderPickerModal.vue](/home/bjw/Code/KK-Image/src/components/purchase-order/OrderPickerModal.vue#L170) [src/views/PurchaseOrders.vue](/home/bjw/Code/KK-Image/src/views/PurchaseOrders.vue#L2338)
- `usePurchaseOrders.loadDetail()` 本身也没有隔离请求先后。采购页主抽屉在快速切换采购单、重复刷新或并发执行 `refreshPurchaseOrderViews()` 时，旧的详情请求在后返回后仍会覆盖当前 `detail/detailLoading`，导致采购单详情面板回跳到上一单。[src/composables/usePurchaseOrders.js](/home/bjw/Code/KK-Image/src/composables/usePurchaseOrders.js#L97) [src/views/PurchaseOrders.vue](/home/bjw/Code/KK-Image/src/views/PurchaseOrders.vue#L3063)
- `usePurchaseOrders.loadSuggestions()` 也没有隔离请求先后。采购建议弹窗连续打开、刷新或重试时，旧的建议结果在后返回后仍会覆盖当前 `suggestions/suggestionsLoading`，导致商品缺口建议回跳到旧快照。[src/composables/usePurchaseOrders.js](/home/bjw/Code/KK-Image/src/composables/usePurchaseOrders.js#L415) [src/views/PurchaseOrders.vue](/home/bjw/Code/KK-Image/src/views/PurchaseOrders.vue#L3597)
- `usePurchaseOrders.loadStats()` 同样缺少请求先后隔离。采购页列表/建议弹窗并发触发总览刷新时，旧统计请求在后返回后仍会覆盖当前 `stats`，导致顶部采购统计卡片回跳到旧口径。[src/composables/usePurchaseOrders.js](/home/bjw/Code/KK-Image/src/composables/usePurchaseOrders.js#L438) [src/views/PurchaseOrders.vue](/home/bjw/Code/KK-Image/src/views/PurchaseOrders.vue#L3577)
- `usePurchaseOrders.loadList()` 也缺少请求先后隔离。采购页快速切换状态筛选、分页或在刷新总览时并发触发列表请求，旧列表结果在后返回后仍会覆盖当前 `list/total/loading`，导致采购单列表回跳到旧筛选页。[src/composables/usePurchaseOrders.js](/home/bjw/Code/KK-Image/src/composables/usePurchaseOrders.js#L53) [src/views/PurchaseOrders.vue](/home/bjw/Code/KK-Image/src/views/PurchaseOrders.vue#L3068)
- `usePurchaseOrders.updatePO()/allocateCosts()` 会在成功后直接把响应写回 `detail`，却不校验当前详情上下文是否还停留在同一张采购单。用户在旧请求未完成前切到另一张采购单时，旧写操作响应仍会把当前详情改回旧单，形成详情写回串上下文。[src/composables/usePurchaseOrders.js](/home/bjw/Code/KK-Image/src/composables/usePurchaseOrders.js#L228) [src/composables/usePurchaseOrders.js](/home/bjw/Code/KK-Image/src/composables/usePurchaseOrders.js#L412)
- `useOrders` 同时把管理端订单列表和销售端订单列表绑在同一份模块级 `resource` 上，而 `loadOrders()/loadSalesOrders()` 两条链路又都缺少请求先后隔离。结果是管理端筛选/分页的旧请求会覆盖新列表，销售端加载订单也会把管理端 `orders/loading/pagination/error` 一起改写，形成跨模块串状态和旧结果回跳。[src/composables/useOrders.js](/home/bjw/Code/KK-Image/src/composables/useOrders.js#L16) [src/views/Sales.vue](/home/bjw/Code/KK-Image/src/views/Sales.vue#L180) [src/components/OrderManager.vue](/home/bjw/Code/KK-Image/src/components/OrderManager.vue#L243)
- `SalesDetailView` 只在 `onMounted()` 时拉一次销售订单详情，没有监听路由里的订单 ID 变化，也没有隔离详情请求先后。销售端如果在详情页内通过通知或其它跳转切到另一张订单，组件复用时会继续停留在旧订单；旧详情慢请求在后返回时还会覆盖当前详情上下文。[src/views/sales/SalesDetailView.vue](/home/bjw/Code/KK-Image/src/views/sales/SalesDetailView.vue#L76) [src/views/Sales.vue](/home/bjw/Code/KK-Image/src/views/Sales.vue#L284) [src/components/order/SalesNotificationList.vue](/home/bjw/Code/KK-Image/src/components/order/SalesNotificationList.vue#L168)
- `useOrderModals` 在订单管理页里负责详情/编辑模态的订单水合，但 `openDetailModal/openEditModal/refreshAfterComment/closeEditModal` 都没有校验请求上下文。用户连续切两张订单、关闭详情后重开、或在详情里快速切换编辑目标时，旧的 `getOrder()` 结果会把当前 `viewingOrder/editingOrder/detailHydrating` 回写成上一张订单，造成详情/编辑串单。[src/composables/order/useOrderModals.js](/home/bjw/Code/KK-Image/src/composables/order/useOrderModals.js#L24) [src/components/OrderManager.vue](/home/bjw/Code/KK-Image/src/components/OrderManager.vue#L296)
- `SalesStats` 会在 token 变化和重试时重复触发统计请求，但没有隔离请求先后。销售端如果在同一统计页实例内切换 token，旧 token 的慢请求在后返回后仍会覆盖当前统计卡片，把页面回跳成上一位销售的统计数据。[src/components/order/SalesStats.vue](/home/bjw/Code/KK-Image/src/components/order/SalesStats.vue#L99) [src/views/sales/SalesStatsView.vue](/home/bjw/Code/KK-Image/src/views/sales/SalesStatsView.vue#L2)
- `SalesSpacesView` 只在首次挂载时加载一次空间列表，也没有隔离请求先后。销售端如果在同一组件实例内切换 token，空间页不会自动刷新到新 token；旧 token 的慢请求在后返回后还会覆盖当前空间列表，导致空间页串到上一位销售的数据。[src/views/sales/SalesSpacesView.vue](/home/bjw/Code/KK-Image/src/views/sales/SalesSpacesView.vue#L105)
- 销售端通知链路同时存在两个生命周期空洞：`Sales.vue` 只在首次挂载后调用一次 `setSalesMode(accessToken)`，route token 切换后不会把通知模式切到新 token；同时 `useNotifications.fetchNotifications()` 也没有隔离请求先后，旧 token/旧模式的慢请求会在后返回后覆盖当前通知列表与未读数。[src/views/Sales.vue](/home/bjw/Code/KK-Image/src/views/Sales.vue#L292) [src/composables/useNotifications.js](/home/bjw/Code/KK-Image/src/composables/useNotifications.js#L66)
- `Sales.vue` 的 `checkAuth()/handleLogin()` 也没有隔离 token 维度的认证请求先后。销售入口页如果在旧 token 的认证尚未完成时切到新 token，旧认证结果返回后仍会把当前页面的 `isAuthenticated/salesperson` 写成上一位销售，造成销售身份和当前 token 对不上。[src/views/Sales.vue](/home/bjw/Code/KK-Image/src/views/Sales.vue#L292)
- 通知中心的管理端回切链路也不完整：`Header` 挂载时没有显式调用 `setAdminMode()`，而 `useNotifications.setAdminMode()` 本身也不会清空旧销售通知状态。结果是从销售端回到管理端时，Header 首轮轮询仍可能继续打旧销售 token，页面也会短暂显示旧销售通知与未读数。[src/components/layout/Header.vue](/home/bjw/Code/KK-Image/src/components/layout/Header.vue#L183) [src/composables/useNotifications.js](/home/bjw/Code/KK-Image/src/composables/useNotifications.js#L42)
- 销售订单列表页的搜索没有接入后端查询。`SalesListView` 只是对当前已加载订单做本地过滤，并在搜索时直接禁用无限滚动；而销售端订单 API 与 `useOrders.loadSalesOrders()` 本身都支持 `search`。结果是未加载到本地的历史订单永远搜不到，销售搜索链路在业务上不闭环。[src/views/sales/SalesListView.vue](/home/bjw/Code/KK-Image/src/views/sales/SalesListView.vue#L67) [src/views/Sales.vue](/home/bjw/Code/KK-Image/src/views/Sales.vue#L222) [src/composables/useOrders.js](/home/bjw/Code/KK-Image/src/composables/useOrders.js#L338)
- `Dashboard` 首页里的订单详情抽屉也实现了一套独立的详情水合，但 `viewOrder()/refreshOrderDetail()` 没有隔离请求先后。快速连续查看两张订单、关闭抽屉后旧请求才返回，或评论后详情刷新并发时，旧的 `getOrder()` 结果会把当前 `viewingOrder/detailHydrating` 覆盖成上一张订单。[src/views/Dashboard.vue](/home/bjw/Code/KK-Image/src/views/Dashboard.vue#L409)
- `useGoodsOverview` 的列表和汇总加载都没有请求先后隔离，而筛选变化会自动触发 `loadData()`。快速切换货品总览筛选或并发触发初始化/刷新时，旧筛选的列表结果和旧汇总结果会在后返回后覆盖当前总览，导致短缺列表与汇总卡片回跳到上一轮筛选口径。[src/composables/useGoodsOverview.js](/home/bjw/Code/KK-Image/src/composables/useGoodsOverview.js#L70)
- 销售端的 `useSalesOrderStateMachine` 只包了一层状态流转，但没有隔离动作请求先后。搜索、重试或切换页面时如果同时触发多次 `loadOrders/loadDetail/comment`，旧请求仍会把 `state/error` 回写成 `error/empty`，即使底层数据已经是新的成功结果。[src/composables/sales/useSalesOrderStateMachine.js](/home/bjw/Code/KK-Image/src/composables/sales/useSalesOrderStateMachine.js#L22)
- 货品总览页允许用户选中任意条目后直接“生成采购单”，但 `createPOFromSelected()` 只是把 `shortage <= 0` 的项数量压成 `0`，而后端数量校验与仓储写入会把 `0` 继续归一成 `1`。结果是用户可以对不缺货的货品静默生成 1 件采购明细，业务上直接错单。[src/composables/useGoodsOverview.js](/home/bjw/Code/KK-Image/src/composables/useGoodsOverview.js#L151) [functions/services/purchase-order-constraints.js](/home/bjw/Code/KK-Image/functions/services/purchase-order-constraints.js#L17) [functions/repositories/PurchaseOrderRepository.js](/home/bjw/Code/KK-Image/functions/repositories/PurchaseOrderRepository.js#L409)
- 商品导入弹窗对“部分成功”没有向父级发出成功事件。`handleImport()` 只有在“零失败且零冲突”时才 `emit('success')`，但前面已经把存在成功导入记录的部分成功结果标记为 `importResult.success = true`，页脚按钮也允许用户直接关闭弹窗。`ProductManager` 依赖这个事件刷新列表，因此一旦导入结果里同时包含成功项和失败项/冲突项，弹窗可关闭但列表不会刷新，用户要手动刷新后才能看到已导入的商品。[src/components/product/ProductImportModal.vue](/home/bjw/Code/KK-Image/src/components/product/ProductImportModal.vue#L865) [src/components/product/ProductImportModal.vue](/home/bjw/Code/KK-Image/src/components/product/ProductImportModal.vue#L881) [src/components/ProductManager.vue](/home/bjw/Code/KK-Image/src/components/ProductManager.vue#L398)
- 批量导入路由的审计语义已经与服务层返回脱节。`POST /api/manage/products/batch` 无论 `batchImport()` 是否真正导入成功，都固定把审计结果写成 `result: 'success'`；同时它写入审计元数据的 `imported/created/updated` 读取的是不存在的顶层字段，而服务层真实返回的是 `count` 与 `summary.createdProducts/updatedProducts`。结果是导入全失败时审计仍显示成功，而成功导入时关键统计又可能长期记录为 `null`，削弱后台审计可追溯性。[batch.js](/home/bjw/Code/KK-Image/functions/lib/hono/routes/manage/products/batch.js#L19) [ProductCatalogService.js](/home/bjw/Code/KK-Image/functions/services/ProductCatalogService.js#L887)
- 商品导入弹窗允许“同名多行但未提供 SPU”的文件通过映射校验，而后续分组逻辑只会按 `SPU` 合并、对空 `SPU` 行按行拆分。结果是同一商品的多规格行会被静默拆成多个单规格商品，导入成功提示与最终商品结构分叉，属于高概率数据污染入口。[src/components/product/ProductImportModal.vue](/home/bjw/Code/KK-Image/src/components/product/ProductImportModal.vue#L536) [src/components/product/ProductImportModal.vue](/home/bjw/Code/KK-Image/src/components/product/ProductImportModal.vue#L778)
- 商品公开空间页在同一 `Space.vue` 实例内切到另一条商品空间时，会复用同一个 `SpaceProductDetail` 组件，但该组件只在初始化时计算媒体索引。结果是旧空间选中的图片序号和 PDF 预览态会泄漏到新空间，公开访问链路会直接展示错媒体或保留上一个空间的内联 PDF 预览状态。[src/views/Space.vue](/home/bjw/Code/KK-Image/src/views/Space.vue#L39) [src/components/space/SpaceProductDetail.vue](/home/bjw/Code/KK-Image/src/components/space/SpaceProductDetail.vue#L380)
- 商品公开空间页父组件 `Space.vue` 在路由 token 切换时没有隔离 `loadSpace()` 请求先后。旧 token 的慢请求在后返回后仍会覆盖当前 `space/error/requiresPassword/loading`，导致公开空间页直接串到上一条商品空间的数据或错误状态。[src/views/Space.vue](/home/bjw/Code/KK-Image/src/views/Space.vue#L97)
- 密码保护的公开空间走 `POST /api/space/:token` 成功访问后，没有像 GET 一样写入 `space_access_logs` 或递增 `view_count`。结果是商品空间的访问统计在“无密码访问”和“密码访问”两条链路上长期分叉，浏览量与访问日志都少记一段真实访问。[functions/api/space/[token].js](/home/bjw/Code/KK-Image/functions/api/space/[token].js#L185)
- 商品公开空间前端把 `GET /api/space/:token` 返回的 `{ success: true, data: { requiresPassword: true } }` 误当成真实空间详情处理，而不是切换到密码门禁。结果是密码空间首屏不会进入密码校验视图，前端状态机直接跑偏到一份伪“空间数据”。[src/views/Space.vue](/home/bjw/Code/KK-Image/src/views/Space.vue#L114) [functions/api/space/[token].js](/home/bjw/Code/KK-Image/functions/api/space/[token].js#L178)
- 管理员预览未公开合集时，公开空间 API 的子空间查询仍固定附带 `s.is_public = 1`。结果是管理员虽然能通过 share token 打开私有父合集，却会错误看不到其中的私有子空间，合集预览链路不完整。[functions/api/space/[token].js](/home/bjw/Code/KK-Image/functions/api/space/[token].js)
- 商品公开空间和销售空间共用的 `useBatchDownload()` 不校验 `fetch` 的 HTTP 成功状态，也不要求至少下载成功一个文件。结果是只要所有文件都返回 404/403 或网络失败，前端仍会打包空 ZIP 并弹出“开始下载”的成功提示，形成批量下载假成功。[src/composables/useBatchDownload.js](/home/bjw/Code/KK-Image/src/composables/useBatchDownload.js)
- 管理端空间主列表和销售端空间主列表都直接消费 `findAll()/findAllForSalesperson()` 的结果，但这两条查询原先没有排除 `parent_id` 非空的子空间。结果是子空间会混入一级空间列表，被重复展示成“顶级空间”，破坏空间层级和入口语义。[functions/repositories/SpaceRepository.js](/home/bjw/Code/KK-Image/functions/repositories/SpaceRepository.js) [functions/lib/hono/routes/manage/spaces/crud.js](/home/bjw/Code/KK-Image/functions/lib/hono/routes/manage/spaces/crud.js) [functions/lib/hono/routes/sales/spaces.js](/home/bjw/Code/KK-Image/functions/lib/hono/routes/sales/spaces.js)
- 管理端 `SpaceDetailModal` 复用同一实例切换空间时，`loadSpace()` 旧请求可以在后返回后覆盖新空间详情；而合集模板下的 `SubspaceList` 也只在挂载时加载一次，切换到另一合集后不会跟随 `spaceId` 重载。结果是空间详情弹窗会显示旧标题、旧设置，合集页签还会继续保留上一条空间的子空间列表。[src/components/SpaceDetailModal.vue](/home/bjw/Code/KK-Image/src/components/SpaceDetailModal.vue) [src/components/SubspaceList.vue](/home/bjw/Code/KK-Image/src/components/SubspaceList.vue)
- 管理端 `SpaceDetailModal` 的封面设置、发布/取消发布、分享范围保存、文件增删都没有检查 `updateSpace/addFilesToSpace/removeFilesFromSpace` 的返回值。结果是底层写操作失败时，弹窗仍会继续刷新详情、弹成功提示并向父级发 `updated`，形成空间设置与文件操作的假成功。[src/components/SpaceDetailModal.vue](/home/bjw/Code/KK-Image/src/components/SpaceDetailModal.vue)
- `SpaceCreateModal.handleSubmit()` 没有在 `submitting` 期间阻断重复触发。结果是用户双击“创建”或同一轮里重复触发表单提交时，会并发调用两次 `createSpace/createSubspace`，造成重复创建空间或子空间。[src/components/SpaceCreateModal.vue](/home/bjw/Code/KK-Image/src/components/SpaceCreateModal.vue)
- 管理端空间主列表的删除确认和 `SubspaceList` 的子空间删除确认都没有检查 `deleteSpace()` 返回值。结果是删除失败时确认框仍会直接关闭，用户会误以为删除成功，形成删除链路假成功。[src/views/SpaceManager/index.vue](/home/bjw/Code/KK-Image/src/views/SpaceManager/index.vue) [src/components/SubspaceList.vue](/home/bjw/Code/KK-Image/src/components/SubspaceList.vue)
- `SpaceSettingsTab` 在点击“保存销售可见性”后，会立刻把脏检查基线重置为当前选择，即使父级保存失败或尚未回写新 props。结果是按钮会提前显示“已保存”，把失败中的配置误判成成功状态。[src/components/space/SpaceSettingsTab.vue](/home/bjw/Code/KK-Image/src/components/space/SpaceSettingsTab.vue)
- 商品公开空间页的 `submitPassword()` 没有 token/request 维度隔离。用户在密码验证请求未返回前切到另一条空间时，旧密码验证成功结果仍会回写当前页面，把新空间直接串回旧空间详情。[src/views/Space.vue](/home/bjw/Code/KK-Image/src/views/Space.vue#L153)
- 商品公开空间页在 Turnstile 开启但尚未验证时，如果路由 token 变化，`watch(token)` 会直接调用 `loadSpace()`。结果是用户无需完成人机验证，只要切一次空间 token 就能直接打空间详情接口，门禁形同虚设。[src/views/Space.vue](/home/bjw/Code/KK-Image/src/views/Space.vue#L177)
- 共享空间模板数据虽然已经 JOIN 到 `pv_sku` 和变体主图 `display_image_id`，但 `projectSpaceTemplateData()` 仍然固定投影商品 `SPU` 和商品图片。结果是绑定到具体变体的商品空间会把 `SPU` 当作 `SKU` 展示，主图也退回商品通图，销售空间和公开商品空间都会看到错规格、错主图。[functions/repositories/SpaceRepository.js](/home/bjw/Code/KK-Image/functions/repositories/SpaceRepository.js#L14) [functions/lib/hono/routes/manage/spaces/transformers.js](/home/bjw/Code/KK-Image/functions/lib/hono/routes/manage/spaces/transformers.js#L14)
- 共享空间模板数据在变体绑定场景下仍然优先显示商品级 `specifications.material`，没有使用变体 `options_values` 里的材质值。结果是绑定到具体材质变体的商品空间，会继续展示商品默认材质，销售空间和公开商品空间都可能看到错材质。[functions/repositories/SpaceRepository.js](/home/bjw/Code/KK-Image/functions/repositories/SpaceRepository.js#L14) [functions/lib/hono/routes/manage/spaces/transformers.js](/home/bjw/Code/KK-Image/functions/lib/hono/routes/manage/spaces/transformers.js#L14)
- 管理端 `SpaceProductEditor.handleProductSelect()` 在重新绑定商品变体时，仍然只从商品 `specifications.material` 回填材质，不读取所选变体的 `options_values`。结果是后台手动改绑到另一材质变体后，表单和后续保存仍会把旧的商品默认材质写回空间，和后端投影语义继续分叉。[src/components/SpaceProductEditor.vue](/home/bjw/Code/KK-Image/src/components/SpaceProductEditor.vue#L530)
- 小程序销售空间详情服务虽然能拿到商品空间的 `templateData.images`，但不会把这组图片转换进 `space.files`。结果是商品模板组件在“仅绑定商品图片、未上传空间文件”时没有任何主图轮播可看，销售空间详情链路在小程序端直接断图。[minisales/miniprogram/services/sales/spaces.ts](/home/bjw/Code/KK-Image/minisales/miniprogram/services/sales/spaces.ts#L42) [minisales/miniprogram/components/space-templates/product/index.wxml](/home/bjw/Code/KK-Image/minisales/miniprogram/components/space-templates/product/index.wxml#L6)

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

### 2026-04-10 轮次 59

- 继续复查商品导入弹窗生命周期，新增 1 个中风险问题:
  - 导入进行中关闭弹窗，旧导入请求返回后仍会回写结果并触发成功事件
- 下一步为导入请求增加生命周期隔离，并在弹窗关闭时重置导入步骤与状态。

### 2026-04-10 轮次 60

- 已完成轮次 59 新增问题修复:
  - `ProductImportModal` 现在会在关闭弹窗时废弃旧导入请求，并重置步骤、文件信息和导入状态
  - 关闭后旧导入结果不会再回写 `importResult` 或继续向父级发出 `success`
- 增量回归:
  - `src/components/product/__tests__/ProductImportModal.variant-first.test.js`
  - `src/components/product/__tests__/ProductExportModal.filters.test.js`
  - `src/components/__tests__/ProductManager.variant-hydration.test.js`
- 对应修复提交: `40d4889 fix: discard stale product import runs`

### 2026-04-10 轮次 61

- 继续复查商品导入的图片匹配步骤，新增 1 个中风险问题:
  - 图片上传进行中关闭弹窗，旧上传任务返回后仍会推进流程并回写图片结果
- 下一步为 `handleUploadImagesAndNext()` 增加生命周期隔离，并补关闭后不再推进到预览页的回归。

### 2026-04-10 轮次 62

- 已完成轮次 61 新增问题修复:
  - `ProductImportModal` 现在会为图片上传步骤分配运行序号，关闭弹窗后旧上传任务不会再回写图片结果或推进流程
  - 关闭导入弹窗会同时废弃导入主请求与图片上传请求，避免两条异步链路互相串写
- 增量回归:
  - `src/components/product/__tests__/ProductImportModal.variant-first.test.js`
  - `src/components/product/__tests__/ProductExportModal.filters.test.js`
  - `src/components/__tests__/ProductManager.variant-hydration.test.js`
  - `src/components/product/__tests__/ProductDetailModal.fetch-variants.test.js`
- 对应修复提交: `a814e4a fix: discard stale product image uploads`

### 2026-04-10 轮次 63

- 继续复查订单商品绑定链路，新增 1 个中风险问题:
  - 连续切换商品时，旧的商品详情请求会覆盖最新一次绑定目标
- 下一步给 `ProductBindingSection.handleProductSelect()` 增加请求隔离，并在解绑时废弃旧请求。

### 2026-04-10 轮次 64

- 已完成轮次 63 新增问题修复:
  - `ProductBindingSection` 现在只认最新一次商品详情加载结果，旧请求不会再覆盖当前规格集与默认选中变体
  - 解绑商品时会同步废弃旧详情请求，避免旧请求在解绑后继续回写绑定结果
- 增量回归:
  - `src/components/order/__tests__/ProductBindingSection.variant-status.test.js`
  - `src/components/product/__tests__/ProductImportModal.variant-first.test.js`
  - `src/components/product/__tests__/ProductExportModal.filters.test.js`
  - `src/components/__tests__/ProductManager.variant-hydration.test.js`
- 对应修复提交: `1a0cfd1 fix: isolate product binding detail loads`

### 2026-04-10 轮次 65

- 继续复查空间商品编辑器刷新链路，新增 1 个中风险问题:
  - `initData()` 多次并发刷新时，旧空间详情/商品详情结果会覆盖最新刷新状态
- 下一步给空间商品编辑器的初始化刷新链路增加请求序号隔离，并在卸载时废弃旧请求。

### 2026-04-10 轮次 66

- 已完成轮次 65 新增问题修复:
  - `SpaceProductEditor` 现在只认最新一次 `initData()` 结果，旧的空间详情/商品详情刷新不会再覆盖当前状态
  - 组件卸载时会同步废弃旧刷新请求，避免离场后继续回写空间编辑器状态
- 增量回归:
  - `src/components/__tests__/SpaceProductEditor.contract.test.js`
  - `src/components/order/__tests__/ProductBindingSection.variant-status.test.js`
  - `src/components/product/__tests__/ProductImportModal.variant-first.test.js`
  - `src/components/product/__tests__/ProductExportModal.filters.test.js`
  - `src/components/__tests__/ProductManager.variant-hydration.test.js`
- 对应修复提交: `2259aa6 fix: isolate space product editor refreshes`

### 2026-04-10 轮次 67

- 继续复查商品创建/编辑表单的规格归档链路，新增 1 个中风险问题:
  - 关闭弹窗或切换商品后，旧的规格归档/恢复异步请求仍会回写当前表单并重新打开旧归档向导
- 下一步把 `useProductForm` 的规格归档相关异步入口统一绑定到弹窗生命周期，并补关闭后不再回写的回归。

### 2026-04-10 轮次 68

- 已完成轮次 67 新增问题修复:
  - `ProductCreateModal` 现在把 `modelValue` 生命周期传入 `useProductForm`，规格归档相关异步动作会绑定到当前弹窗上下文
  - 关闭弹窗或切换到另一件商品时会统一废弃旧的归档预览/归档/恢复请求，并同步重置维度归档和值归档向导状态
  - 旧请求返回后不会再把已关闭或已切换上下文的商品表单重新拉起到旧归档向导
- 增量回归:
  - `src/components/product/__tests__/ProductCreateModal.dimension-archive.test.js`
  - `src/components/product/__tests__/ProductCreateModal.value-archive.test.js`
  - `src/components/__tests__/SpaceProductEditor.contract.test.js`
  - `src/components/order/__tests__/ProductBindingSection.variant-status.test.js`
- 对应修复提交: `bd4a758 fix: isolate product form async archive actions`

### 2026-04-10 轮次 69

- 继续复查商品创建/编辑表单保存链路，新增 1 个中风险问题:
  - 保存中的商品弹窗允许被关闭或切到另一件商品，旧提交返回后仍会发成功事件并把当前弹窗重新关掉
- 下一步把 `handleSubmit` 也绑定到当前弹窗生命周期，只认当前打开上下文里的最新一次保存结果。

### 2026-04-10 轮次 70

- 已完成轮次 69 新增问题修复:
  - `useProductForm.handleSubmit()` 现在会为每次保存分配独立请求序号，关闭弹窗或切换商品后旧提交结果不会再继续 toast/emit
  - 关闭弹窗时会同步废弃旧提交并重置 `submitting` 状态，避免旧请求把后续新开的商品弹窗再次关闭
  - 旧保存结果不会再向父级发 `success`，也不会再对当前商品上下文发出过期的 `update:modelValue=false`
- 增量回归:
  - `src/components/product/__tests__/ProductCreateModal.variant-first.test.js`
  - `src/components/product/__tests__/ProductCreateModal.dimension-archive.test.js`
  - `src/components/product/__tests__/ProductCreateModal.value-archive.test.js`
- 对应修复提交: `28e0735 fix: discard stale product form submit results`

### 2026-04-10 轮次 71

- 继续复查销售商品选择链路，新增 1 个中风险问题:
  - `useSalesProducts` 共享模块级查询状态，且同实例连续搜索时旧请求仍可能覆盖最新结果
- 下一步把销售商品查询状态收回实例内，并给列表查询增加“只认最新搜索”的请求隔离。

### 2026-04-10 轮次 72

- 已完成轮次 71 新增问题修复:
  - `useSalesProducts` 现在为每个调用方创建独立的 `products/loading/error/meta/lastQuery` 状态，销售商品选择器之间不再互相串结果
  - 销售商品列表查询新增请求序号，旧搜索无论成功还是失败都不会再覆盖当前最新关键字的结果
  - 商品选择器重试逻辑保持不变，但只会操作当前实例最近一次查询上下文
- 增量回归:
  - `src/composables/__tests__/useSalesProducts.test.js`
  - `src/components/product/__tests__/ProductSelect.sales-image.test.js`
  - `src/components/order/__tests__/ProductBindingSection.variant-status.test.js`
- 对应修复提交: `8dc71e6 fix: isolate sales product query state`

### 2026-04-10 轮次 73

- 继续复查商品统计弹窗与商品列表筛选联动，新增 1 个中风险问题:
  - `ProductStats` 切换筛选时缺少整轮统计请求隔离，旧筛选的慢请求会覆盖当前统计结果
- 下一步给统计全量加载过程增加轮次序号，只允许当前筛选这一轮统计提交最终结果。

### 2026-04-10 轮次 74

- 已完成轮次 73 新增问题修复:
  - `ProductStats` 现在会为每轮全量统计加载分配请求序号，旧筛选的分页统计结果不会再覆盖当前筛选值
  - 统计总数和统计明细改为在当前轮次完成后一次性提交，避免旧轮次中途回写 `statsTotal/statsProducts`
- 增量回归:
  - `src/components/product/__tests__/ProductStats.test.js`
  - `src/components/product/__tests__/ProductSelect.sales-image.test.js`
  - `src/components/order/__tests__/ProductBindingSection.variant-status.test.js`
- 对应修复提交: `2014b42 fix: isolate product stats reload cycles`

### 2026-04-10 轮次 75

- 继续复查采购商品挑选链路，新增 1 个中风险问题:
  - `ProductPickerModal` 搜索或关闭后重开时，旧的变体加载请求仍会覆盖当前列表结果
- 下一步给采购商品选择器的变体列表加载增加请求序号，并在弹窗关闭时废弃旧请求。

### 2026-04-10 轮次 76

- 已完成轮次 75 新增问题修复:
  - `ProductPickerModal` 现在会为每次变体列表加载分配请求序号，只认当前打开轮次和当前搜索关键字对应的结果
  - 关闭采购商品选择器时会同步废弃旧加载请求，重新打开后旧请求不会再覆盖当前列表
- 增量回归:
  - `src/components/purchase-order/__tests__/ProductPickerModal.lifecycle.test.js`
  - `src/views/__tests__/PurchaseOrders.detail-shell.test.js`
- 对应修复提交: `1fcdcfc fix: isolate purchase product picker loads`

### 2026-04-10 轮次 77

- 继续复查采购订单选择器的详情预览链路，新增 1 个中风险问题:
  - `OrderPickerModal` 连续切换订单或关闭后重开时，旧的订单详情请求仍会覆盖当前预览抽屉
- 下一步给订单详情预览和刷新逻辑增加请求序号，并在关闭详情抽屉时废弃旧请求。

### 2026-04-10 轮次 78

- 已完成轮次 77 新增问题修复:
  - `OrderPickerModal` 现在只认当前订单详情预览请求，连续切换订单时旧详情不会再覆盖当前抽屉
  - 关闭订单详情抽屉时会同步废弃旧请求，旧详情失败或成功都不会再回写当前状态
- 增量回归:
  - `src/components/purchase-order/__tests__/OrderPickerModal.detail-workflow.test.js`
  - `src/views/__tests__/PurchaseOrders.detail-shell.test.js`
- 对应修复提交: `7094210 fix: isolate purchase order picker detail loads`

### 2026-04-10 轮次 79

- 继续复查采购页主详情抽屉与底层 composable，新增 1 个中风险问题:
  - `usePurchaseOrders.loadDetail()` 缺少请求先后隔离，旧详情会覆盖当前采购单详情
- 下一步在采购单详情加载底层增加请求序号，避免页面层和刷新辅助函数并发时出现详情回跳。

### 2026-04-10 轮次 80

- 已完成轮次 79 新增问题修复:
  - `usePurchaseOrders.loadDetail()` 现在只认最新一次详情请求，旧采购单详情结果不会再覆盖当前 `detail/detailLoading`
  - `refreshPurchaseOrderViews()` 等复合刷新入口会自动继承这层请求隔离，避免详情抽屉在并发刷新时回跳
- 增量回归:
  - `src/composables/__tests__/usePurchaseOrders.test.js`
  - `src/views/__tests__/PurchaseOrders.detail-shell.test.js`
- 对应修复提交: `9fe0ca2 fix: isolate purchase order detail loads`

### 2026-04-10 轮次 81

- 继续复查采购建议链路，新增 1 个中风险问题:
  - `usePurchaseOrders.loadSuggestions()` 缺少请求先后隔离，旧建议结果会覆盖当前建议弹窗
- 下一步给采购建议加载增加请求序号，并让 `suggestionsLoading` 只绑定当前这一轮建议请求。

### 2026-04-10 轮次 82

- 已完成轮次 81 新增问题修复:
  - `usePurchaseOrders.loadSuggestions()` 现在只认最新一次建议请求，旧建议结果不会再覆盖当前 `suggestions`
  - `suggestionsLoading` 只会由当前建议请求收口，避免旧请求把加载态提前结束或回写旧数据
- 增量回归:
  - `src/composables/__tests__/usePurchaseOrders.test.js`
  - `src/views/__tests__/PurchaseOrders.detail-shell.test.js`
- 对应修复提交: `799d0db fix: isolate purchase suggestion loads`

### 2026-04-10 轮次 83

- 继续复查采购总览统计链路，新增 1 个中风险问题:
  - `usePurchaseOrders.loadStats()` 缺少请求先后隔离，旧统计结果会覆盖当前统计卡片
- 下一步给采购统计加载增加请求序号，让统计卡片和总览刷新只认最新一轮结果。

### 2026-04-10 轮次 84

- 已完成轮次 83 新增问题修复:
  - `usePurchaseOrders.loadStats()` 现在只认最新一次统计请求，旧统计结果不会再覆盖当前 `stats`
  - 采购总览、建议弹窗和其它复合刷新入口会自动继承这层统计请求隔离
- 增量回归:
  - `src/composables/__tests__/usePurchaseOrders.test.js`
  - `src/views/__tests__/PurchaseOrders.detail-shell.test.js`
- 对应修复提交: `38a7bb4 fix: isolate purchase stats loads`

### 2026-04-10 轮次 85

- 继续复查采购单列表链路，新增 1 个中风险问题:
  - `usePurchaseOrders.loadList()` 缺少请求先后隔离，旧筛选/分页结果会覆盖当前采购单列表
- 下一步给采购列表加载增加请求序号，确保采购页筛选、分页和总览刷新都只认最新列表结果。

### 2026-04-10 轮次 86

- 已完成轮次 85 新增问题修复:
  - `usePurchaseOrders.loadList()` 现在只认最新一次列表请求，旧筛选/分页结果不会再覆盖当前 `list/total/loading`
  - 采购页状态筛选、分页切换和总览刷新会自动继承这层列表请求隔离
- 增量回归:
  - `src/composables/__tests__/usePurchaseOrders.test.js`
  - `src/views/__tests__/PurchaseOrders.detail-shell.test.js`
- 对应修复提交: `98c04f2 fix: isolate purchase order list loads`

### 2026-04-10 轮次 87

- 继续复查采购详情写操作链路，新增 1 个中风险问题:
  - `updatePO()/allocateCosts()` 成功后的写回没有校验当前详情上下文，旧写响应会覆盖新打开的采购单详情
- 下一步给采购详情写回增加“当前详情仍然匹配该采购单”校验，阻断旧写响应跨单回写。

### 2026-04-10 轮次 88

- 已完成轮次 87 新增问题修复:
  - `usePurchaseOrders` 现在只会在当前详情仍然指向同一采购单时才把 `updatePO()/allocateCosts()` 响应写回 `detail`
  - 旧写请求完成后不会再把当前已切换的采购详情改回上一张采购单
- 增量回归:
  - `src/composables/__tests__/usePurchaseOrders.test.js`
  - `src/views/__tests__/PurchaseOrders.detail-shell.test.js`
- 对应修复提交: `df769ed fix: guard stale purchase detail writebacks`

### 2026-04-10 轮次 89

- 继续复查订单底层 composable 与销售端订单链路，新增 1 个中风险问题:
  - `useOrders` 把管理端与销售端订单列表状态共用同一份模块级 `resource`，且 `loadOrders()/loadSalesOrders()` 都缺少请求先后隔离，旧请求和跨端链路会互相覆盖 `orders/loading/pagination/error`
- 下一步把管理端和销售端列表状态拆开，并为两条列表加载链路都补上请求序号回归测试。

### 2026-04-10 轮次 90

- 已完成轮次 89 新增问题修复:
  - `useOrders.loadOrders()` 现在只认最新一次管理端列表请求，旧筛选/分页响应不会再覆盖当前订单列表
  - `useOrders` 已把销售端订单列表状态拆到独立的 `salesOrders/salesLoading/salesPagination/salesError`，销售页不再改写管理端订单列表状态
  - `useOrders.loadSalesOrders()` 现在也只认最新一次销售端列表请求，旧销售订单请求不会再覆盖当前销售端列表
- 增量回归:
  - `src/composables/__tests__/useOrders.list-isolation.test.js`
  - `src/composables/__tests__/useOrders.authz.test.js`
  - `src/composables/__tests__/useOrders.update-order.test.js`
  - `src/composables/__tests__/useOrders.change-status.test.js`
  - `src/composables/__tests__/useOrders.line-commands.test.js`
  - `src/views/sales/__tests__/sales-module-contract.test.js`
- 对应修复提交: `e8a2865 fix: isolate order list query state`

### 2026-04-10 轮次 91

- 继续复查销售端订单详情链路，新增 1 个中风险问题:
  - `SalesDetailView` 只在首次挂载时加载订单详情，路由切换到另一张销售订单时不会重载；同时旧详情请求也可能在切单后回写新页面
- 下一步给销售订单详情页补路由参数监听与请求序号隔离，覆盖通知跳转和详情页内切单场景。

### 2026-04-10 轮次 92

- 已完成轮次 91 新增问题修复:
  - `SalesDetailView` 现在会监听销售 token 与订单 ID 变化，同一详情组件实例内切换订单会自动重载正确详情
  - 销售订单详情加载已补请求序号隔离，旧详情请求不会再覆盖当前订单详情页
- 增量回归:
  - `src/views/__tests__/SalesDetailView.lifecycle.test.js`
  - `src/views/__tests__/SalesDetailView.duplicate.test.js`
  - `src/views/sales/__tests__/sales-module-contract.test.js`
  - `src/views/sales/__tests__/SalesFormView.resilience.test.js`
  - `src/components/order/__tests__/SalesNotificationList.error-state.test.js`
  - `src/components/order/__tests__/SalesStats.error-state.test.js`
- 对应修复提交: `5d6b42b fix: reload sales detail on route changes`

### 2026-04-10 轮次 93

- 继续复查订单管理页详情/编辑模态链路，新增 1 个中风险问题:
  - `useOrderModals` 对详情与编辑订单的异步水合缺少请求上下文隔离，连续切单、关闭后重开或详情中切换编辑目标时，旧 `getOrder()` 结果会回写当前模态状态
- 下一步给详情与编辑模态各自补请求序号，并在关闭模态时主动废弃旧水合请求。

### 2026-04-10 轮次 94

- 已完成轮次 93 新增问题修复:
  - `useOrderModals.openDetailModal()/refreshAfterComment()/closeEditModal()` 现在只认当前详情模态对应的最新订单请求，旧详情结果不会再覆盖当前 `viewingOrder/detailHydrating`
  - `useOrderModals.openEditModal()` 现在只认最新一次编辑水合请求，连续切换编辑目标时旧详情不会再顶掉当前 `editingOrder`
  - 关闭详情或编辑模态时会主动废弃旧水合请求，阻断关闭后回写和跨模态串单
- 增量回归:
  - `src/components/__tests__/OrderManager.network-workflow.test.js`
  - `src/components/__tests__/OrderManager.line-statuses.test.js`
  - `src/components/__tests__/OrderManager.design-system-migration.test.js`
  - `src/views/__tests__/Dashboard.order-detail-workflow.test.js`
- 对应修复提交: `6de7bab fix: isolate order modal hydration flows`

### 2026-04-10 轮次 95

- 继续复查销售统计页链路，新增 1 个中风险问题:
  - `SalesStats` 在 token 切换或重试时没有隔离统计请求先后，旧 token 的慢请求会覆盖当前统计页
- 下一步给销售统计加载加请求序号，并补 token 切换竞态回归测试。

### 2026-04-10 轮次 96

- 已完成轮次 95 新增问题修复:
  - `SalesStats.loadStats()` 现在只认当前 token 对应的最新统计请求，旧统计响应不会再覆盖当前卡片
  - 销售统计页在同一组件实例内切换 token 时，页面只会展示当前 token 的统计结果
- 增量回归:
  - `src/components/order/__tests__/SalesStats.lifecycle.test.js`
  - `src/components/order/__tests__/SalesStats.error-state.test.js`
  - `src/views/sales/__tests__/sales-module-contract.test.js`
  - `src/views/sales/__tests__/SalesFormView.resilience.test.js`
  - `src/components/order/__tests__/SalesNotificationList.error-state.test.js`
  - `src/views/__tests__/SalesDetailView.lifecycle.test.js`
- 对应修复提交: `d9ce028 fix: isolate sales stats loads`

### 2026-04-10 轮次 97

- 继续复查销售空间页链路，新增 1 个中风险问题:
  - `SalesSpacesView` 只在挂载时加载空间列表，也没有隔离 token 切换后的旧请求，导致同一组件实例内切换 token 时空间页可能不刷新或被旧结果覆盖
- 下一步给销售空间页补 token 监听和请求序号隔离，覆盖 token 切换竞态回归。

### 2026-04-10 轮次 98

- 已完成轮次 97 新增问题修复:
  - `SalesSpacesView` 现在会监听当前销售 token，组件实例复用时会自动刷新当前 token 对应的空间列表
  - 销售空间页只认最新一次空间列表请求，旧 token 的慢请求不会再覆盖当前空间列表
- 增量回归:
  - `src/views/sales/__tests__/SalesSpacesView.lifecycle.test.js`
  - `src/views/sales/__tests__/sales-module-contract.test.js`
  - `src/views/sales/__tests__/SalesFormView.resilience.test.js`
  - `src/views/__tests__/SalesDetailView.lifecycle.test.js`
  - `src/components/order/__tests__/SalesNotificationList.error-state.test.js`
  - `src/components/order/__tests__/SalesStats.lifecycle.test.js`
- 对应修复提交: `a2ae14b fix: isolate sales spaces loads`

### 2026-04-10 轮次 99

- 继续复查销售通知链路，新增 1 个中风险问题:
  - `Sales.vue` 在 route token 切换后不会重新切换通知模式，`useNotifications` 也缺少请求先后隔离，旧 token/旧模式通知请求会覆盖当前通知列表
- 下一步同时收口销售入口页的通知模式切换和通知中心底层请求隔离。

### 2026-04-10 轮次 100

- 已完成轮次 99 新增问题修复:
  - 销售入口页现在会在当前 token 认证成功后重新激活对应的通知模式，route token 切换后通知轮询不再继续打旧 token
  - `useNotifications.fetchNotifications()` 现在只认当前模式/当前 token 对应的最新请求，旧通知结果不会再覆盖当前通知列表和未读数
- 增量回归:
  - `src/composables/__tests__/useNotifications.test.js`
  - `src/views/__tests__/Sales.notification-mode.test.js`
  - `src/composables/__tests__/useNotifications.refresh-bus.test.js`
  - `src/components/order/__tests__/SalesNotificationList.error-state.test.js`
  - `src/views/sales/__tests__/SalesSpacesView.lifecycle.test.js`
  - `src/components/order/__tests__/SalesStats.lifecycle.test.js`
  - `src/views/__tests__/SalesDetailView.lifecycle.test.js`
- 对应修复提交: `c07defb fix: sync sales notification mode changes`

### 2026-04-10 轮次 101

- 继续复查销售入口页认证链路，新增 1 个中风险问题:
  - `Sales.vue` 的认证流程没有隔离 token 维度的请求先后，旧 token 的认证结果会在切 token 后回写当前销售身份
- 下一步给销售入口页认证和登录流程补请求序号，阻断旧认证结果串写当前 token 上下文。

### 2026-04-10 轮次 102

- 已完成轮次 101 新增问题修复:
  - `Sales.vue.checkAuth()/handleLogin()` 现在只认当前 token 对应的最新认证请求，旧 token 的认证结果不会再覆盖当前销售身份
  - 销售入口页在 route token 快速切换时，页面只会保留当前 token 的认证状态和销售员信息
- 增量回归:
  - `src/views/__tests__/Sales.notification-mode.test.js`
  - `src/composables/__tests__/useNotifications.test.js`
  - `src/composables/__tests__/useNotifications.refresh-bus.test.js`
  - `src/views/sales/__tests__/SalesSpacesView.lifecycle.test.js`
  - `src/components/order/__tests__/SalesStats.lifecycle.test.js`
  - `src/views/__tests__/SalesDetailView.lifecycle.test.js`
- 对应修复提交: `629bb8f fix: guard stale sales auth context`

### 2026-04-10 轮次 103

- 继续复查管理端通知回切链路，新增 1 个中风险问题:
  - 从销售端回到管理端时，`Header` 不会主动切回 admin 通知模式，`setAdminMode()` 也不清空旧销售通知状态，导致管理端首轮通知展示和轮询可能沿用旧销售 token
- 下一步给管理端 Header 显式切回 admin 模式，并补齐 `setAdminMode()` 的状态重置。

### 2026-04-10 轮次 104

- 已完成轮次 103 新增问题修复:
  - 管理端 `Header` 挂载时现在会先切回 admin 通知模式，再启动管理端通知轮询
  - `useNotifications.setAdminMode()` 现在会清空旧通知列表、未读数和初始化状态，避免销售端残留通知污染管理端首屏
- 增量回归:
  - `src/composables/__tests__/useNotifications.test.js`
  - `src/components/__tests__/Header.notification-mode.test.js`
  - `src/composables/__tests__/useNotifications.refresh-bus.test.js`
  - `src/views/__tests__/Sales.notification-mode.test.js`
  - `src/components/order/__tests__/SalesNotificationList.error-state.test.js`
- 对应修复提交: `b1f09a2 fix: reset admin notification mode`

### 2026-04-10 轮次 105

- 继续复查销售订单列表搜索链路，新增 1 个中风险问题:
  - `SalesListView` 搜索只在前端过滤当前已加载页，并在搜索时禁用后续分页，导致未加载到本地的历史订单永远搜不到
- 下一步把搜索词透传到销售订单 API，并让当前搜索结果继续支持分页加载。

### 2026-04-10 轮次 106

- 已完成轮次 105 新增问题修复:
  - 销售订单列表搜索现在会透传到 `Sales.vue -> useOrders -> sales API` 链路，搜索结果改为走服务端查询
  - 当前搜索结果仍支持后续分页加载，销售端历史订单不再因为“未先滚到那一页”而搜不到
- 增量回归:
  - `src/views/sales/__tests__/SalesListView.search-contract.test.js`
  - `src/components/order/__tests__/sales-a11y.test.js`
  - `src/views/__tests__/Sales.notification-mode.test.js`
  - `src/views/sales/__tests__/SalesSpacesView.lifecycle.test.js`
  - `src/components/order/__tests__/SalesStats.lifecycle.test.js`
  - `src/views/__tests__/SalesDetailView.lifecycle.test.js`
- 对应修复提交: `4e936a8 fix: route sales list search through api`

### 2026-04-10 轮次 107

- 继续复查 Dashboard 首页订单详情抽屉链路，新增 1 个中风险问题:
  - `Dashboard` 自己维护的订单详情水合没有请求先后隔离，连续切单或关闭抽屉后旧详情仍会回写当前抽屉状态
- 下一步给 Dashboard 订单详情加载和评论后刷新补请求序号，阻断旧请求串单。

### 2026-04-10 轮次 108

- 已完成轮次 107 新增问题修复:
  - `Dashboard.viewOrder()/refreshOrderDetail()` 现在只认当前详情抽屉对应的最新订单请求，旧详情结果不会再覆盖当前 `viewingOrder/detailHydrating`
  - 关闭 Dashboard 订单详情抽屉时会主动废弃旧详情请求，阻断关闭后回写
- 增量回归:
  - `src/views/__tests__/Dashboard.order-detail-workflow.test.js`
  - `src/components/__tests__/OrderManager.network-workflow.test.js`
  - `src/views/__tests__/SalesDetailView.lifecycle.test.js`
- 对应修复提交: `5c04f98 fix: isolate dashboard order detail loads`

### 2026-04-10 轮次 109

- 继续复查货品总览链路，新增 1 个中风险问题:
  - `useGoodsOverview` 的列表和汇总加载缺少请求先后隔离，快速切筛选或并发刷新时旧结果会覆盖当前总览
- 下一步给货品总览列表和汇总都补请求序号，并覆盖筛选切换竞态回归。

### 2026-04-10 轮次 110

- 已完成轮次 109 新增问题修复:
  - `useGoodsOverview.loadData()` 现在只认当前筛选轮次对应的最新列表请求，旧筛选列表不会再覆盖当前总览
  - `useGoodsOverview.loadSummary()` 现在只认最新一次汇总请求，旧汇总结果不会再覆盖当前统计卡片
- 增量回归:
  - `src/composables/__tests__/useGoodsOverview.test.js`
- 对应修复提交: `c1c1999 fix: isolate goods overview loads`

### 2026-04-10 轮次 111

- 继续复查销售端状态机链路，新增 1 个中风险问题:
  - `useSalesOrderStateMachine` 本身没有隔离动作请求先后，旧请求会把销售页状态机重新打回 `error/empty`
- 下一步给销售状态机补请求序号，让同一时刻只认当前动作对应的最新状态迁移结果。

### 2026-04-10 轮次 112

- 已完成轮次 111 新增问题修复:
  - `useSalesOrderStateMachine` 现在只认当前动作对应的最新请求结果，旧请求不会再覆盖当前 `state/error`
  - 销售订单列表搜索、详情页加载和统计页等依赖状态机错误态的入口会自动继承这层状态收口
- 增量回归:
  - `src/composables/__tests__/useSalesOrderStateMachine.test.js`
  - `src/views/__tests__/Sales.notification-mode.test.js`
  - `src/views/sales/__tests__/SalesListView.search-contract.test.js`
  - `src/views/__tests__/SalesDetailView.lifecycle.test.js`
  - `src/components/order/__tests__/SalesStats.lifecycle.test.js`
- 对应修复提交: `844b179 fix: isolate sales state machine transitions`

### 2026-04-10 轮次 113

- 继续复查货品总览到采购单的业务闭环，新增 1 个高风险问题:
  - 货品总览允许对 `shortage <= 0` 的条目直接生成采购单，而这类数量会被后端归一成 `1`，最终静默生成错误采购明细
- 下一步在货品总览建单入口前置校验，只允许为真实缺货条目生成采购单。

### 2026-04-10 轮次 114

- 已完成轮次 113 新增问题修复:
  - `useGoodsOverview.createPOFromSelected()` 现在会拒绝为 `shortage <= 0` 的条目生成采购单，阻断静默生成 1 件错误采购明细
  - 货品总览建采购单入口现在只允许真实存在缺口的条目进入采购链路
- 增量回归:
  - `src/composables/__tests__/useGoodsOverview.test.js`
- 对应修复提交: `b5ce2aa fix: block zero-shortage goods overview purchase orders`

### 2026-04-10 轮次 115

- 继续复查商品导入映射闭环，新增 1 个中风险问题:
  - `ProductImportModal` 允许“同名多行但未提供 SPU”的数据继续进入导入流程，后续会被静默拆成多个单规格商品，导入成功提示与最终商品结构不一致
- 下一步在映射确认阶段前置拦截这类歧义分组数据，要求补齐 SPU 后再导入。

### 2026-04-10 轮次 116

- 已完成轮次 115 新增问题修复:
  - `ProductImportModal.handleConfirmMapping()` 现在会拒绝同名多行但缺少 SPU 的数据，阻断歧义分组导入
  - 导入弹窗会给出明确错误提示，并在校验报告里标记每一行 `duplicate_name_without_spu`
- 增量回归:
  - `src/components/product/__tests__/ProductImportModal.variant-first.test.js`
- 对应修复提交: `470323b fix: block ambiguous product import grouping`

### 2026-04-10 轮次 117

- 继续复查商品空间公开页链路，新增 1 个中风险问题:
  - `SpaceProductDetail` 只在首次挂载时初始化媒体索引和 PDF 预览态，`Space.vue` 复用实例切空间后会继续沿用旧空间的媒体上下文
- 下一步给商品空间详情组件补 prop 级状态重置，确保切空间时重新对齐封面和预览状态。

### 2026-04-10 轮次 118

- 已完成轮次 117 新增问题修复:
  - `SpaceProductDetail` 现在会在空间上下文切换时重置媒体索引，并重新对齐当前空间的封面文件
  - 切换到另一条商品空间时会同步关闭旧空间残留的 PDF 内联预览状态
- 增量回归:
  - `src/components/space/__tests__/SpaceProductDetail.lifecycle.test.js`
- 对应修复提交: `fe6c80f fix: reset space product detail state on reuse`

### 2026-04-10 轮次 119

- 继续复查商品公开空间父链路，新增 1 个中风险问题:
  - `Space.vue.loadSpace()` 在 token 切换时没有请求先后隔离，旧 token 的慢响应会覆盖当前公开空间上下文
- 下一步给公开空间页的空间加载流程补 token 维度的请求序号，阻断旧请求串写。

### 2026-04-10 轮次 120

- 已完成轮次 119 新增问题修复:
  - `Space.vue.loadSpace()` 现在只认当前 token 的最新公开空间请求，旧 token 的慢响应不会再覆盖当前空间数据
  - 公开空间页在 SPA 内切换不同商品空间时，不会再回跳到上一条空间的数据或错误态
- 增量回归:
  - `src/views/__tests__/Space.lifecycle.test.js`
  - `src/components/space/__tests__/SpaceProductDetail.lifecycle.test.js`
- 对应修复提交: `bf2faf0 fix: isolate public space loads`

### 2026-04-10 轮次 121

- 继续复查公开商品空间后端访问闭环，新增 1 个中风险问题:
  - 密码保护空间在 `POST /api/space/:token` 验证成功后没有记录访问日志，也不会递增浏览量，导致空间访问统计口径缺口
- 下一步把 GET/POST 的访问计数收敛到同一条记录逻辑，补齐密码空间访问统计。

### 2026-04-10 轮次 122

- 已完成轮次 121 新增问题修复:
  - 公开空间 GET/POST 现在共用同一条访问记录逻辑，密码空间访问成功后也会写入 `space_access_logs` 并递增 `view_count`
  - 密码空间返回的 `viewCount` 与数据库递增后的浏览量保持一致，不再比真实访问少 1
- 增量回归:
  - `functions/api/space/__tests__/public-space-access.test.js`
  - `src/views/__tests__/Space.lifecycle.test.js`
  - `src/components/space/__tests__/SpaceProductDetail.lifecycle.test.js`
- 对应修复提交: `b40d979 fix: track password-protected space access`

### 2026-04-10 轮次 123

- 继续复查密码保护空间访问控制，新增 1 个高风险问题:
  - `POST /api/space/:token` 没有复用 GET 链路上的私有/过期校验，只要密码正确就能访问私有或已过期空间
- 下一步把密码访问链路的公开性和过期校验补齐到与 GET 完全一致。

### 2026-04-10 轮次 124

- 已完成轮次 123 新增问题修复:
  - 密码保护空间的 `POST /api/space/:token` 现在会和 GET 一样先校验 `is_public` 与 `expires_at`
  - 私有空间和已过期空间即使密码正确也不会再通过密码接口绕过公开访问限制
- 增量回归:
  - `functions/api/space/__tests__/public-space-access.test.js`
  - `src/views/__tests__/Space.lifecycle.test.js`
  - `src/components/space/__tests__/SpaceProductDetail.lifecycle.test.js`
- 对应修复提交: `5b80156 fix: enforce protected space access guards`

### 2026-04-10 轮次 125

- 继续复查商品空间前端消费契约，新增 1 个中风险问题:
  - `Space.vue` 没有正确识别 `data.requiresPassword` 响应，密码空间首屏不会切到密码门禁，而是把门禁响应当成空间详情处理
- 下一步把空间首屏的结果分支改成“先识别密码门禁，再决定是否拿到了真实空间详情”。

### 2026-04-10 轮次 126

- 已完成轮次 125 新增问题修复:
  - `Space.vue` 现在会优先识别密码门禁响应，密码空间首屏会正确进入密码验证视图
  - 公开空间页只会在拿到真实空间详情时才写入 `space`，不再把 `{ requiresPassword: true }` 当作空间数据
- 增量回归:
  - `functions/api/space/__tests__/public-space-access.test.js`
  - `src/views/__tests__/Space.lifecycle.test.js`
  - `src/components/space/__tests__/SpaceProductDetail.lifecycle.test.js`
- 对应修复提交: `a6cd71f fix: honor public space password gate responses`

### 2026-04-10 轮次 127

- 继续复查商品空间密码验证链路，新增 1 个中风险问题:
  - `Space.vue.submitPassword()` 没有请求先后隔离，切空间后旧密码验证结果仍会覆盖当前页面
- 下一步给密码提交流程补 token 维度的请求序号，并在 token 切换时废弃旧提交上下文。

### 2026-04-10 轮次 128

- 已完成轮次 127 新增问题修复:
  - `Space.vue.submitPassword()` 现在只认当前 token 的最新密码验证结果，旧提交不会再串写当前空间
  - 路由 token 切换时会同步清空旧密码错误和验证状态，避免上一条空间的密码流程污染当前页
- 增量回归:
  - `functions/api/space/__tests__/public-space-access.test.js`
  - `src/views/__tests__/Space.lifecycle.test.js`
  - `src/components/space/__tests__/SpaceProductDetail.lifecycle.test.js`
- 对应修复提交: `2223e18 fix: guard stale public space password submits`

### 2026-04-10 轮次 129

- 继续复查公开空间 Turnstile 门禁，新增 1 个高风险问题:
  - Turnstile 已开启但尚未验证时，`Space.vue` 在 token 变化后仍会直接加载空间详情，允许绕过人机验证门禁
- 下一步在 token 切换监听里前置 Turnstile 校验状态，未验证时只更新上下文、不发空间详情请求。

### 2026-04-10 轮次 130

- 已完成轮次 129 新增问题修复:
  - `Space.vue` 在 Turnstile 启用且未验证时切换 token，不会再直接打 `/api/space/*`，门禁状态会被保留
  - `Space.lifecycle` 测试现在会在每轮后卸载旧实例，避免跨用例 watcher 串写，公开空间生命周期回归更可靠
- 增量回归:
  - `functions/api/space/__tests__/public-space-access.test.js`
  - `src/views/__tests__/Space.lifecycle.test.js`
  - `src/components/space/__tests__/SpaceProductDetail.lifecycle.test.js`
- 对应修复提交: `5e7c3a7 fix: keep public space turnstile gate on token switches`

### 2026-04-10 轮次 131

- 继续复查商品空间模板数据投影，新增 1 个中风险问题:
  - 变体绑定空间虽然查询到了 `pv_sku` 和变体主图，但 `projectSpaceTemplateData()` 仍固定回填商品 `SPU` 和商品图，导致空间详情展示错规格、错主图
- 下一步把空间模板数据改成“变体绑定优先吃变体投影，商品绑定再回退商品投影”。

### 2026-04-10 轮次 132

- 已完成轮次 131 新增问题修复:
  - `projectSpaceTemplateData()` 现在在变体绑定场景下会优先投影变体 `SKU`
  - 变体主图会被前置到 `templateData.images`，商品空间详情不再退回商品通图
- 增量回归:
  - `functions/lib/hono/routes/manage/spaces/__tests__/transformers.test.js`
- 对应修复提交: `fc1ae7c fix: prefer variant projections in space template data`

### 2026-04-10 轮次 133

- 继续复查商品空间变体投影，新增 1 个中风险问题:
  - 变体绑定空间的 `material` 仍然沿用商品级材质，没有使用变体 `options_values` 中的材质值
- 下一步把空间模板数据的材质投影改成“变体材质优先，商品默认材质兜底”。

### 2026-04-10 轮次 134

- 已完成轮次 133 新增问题修复:
  - `SpaceRepository` 现在会把变体 `options_values` 一并投影给空间模板转换器
  - `projectSpaceTemplateData()` 现在会优先显示变体材质，只有缺失时才回退商品默认材质
- 增量回归:
  - `functions/lib/hono/routes/manage/spaces/__tests__/transformers.test.js`
- 对应修复提交: `cf6a23d fix: project variant material in space templates`

### 2026-04-10 轮次 135

- 继续复查管理端空间编辑器与后端空间投影的一致性，新增 1 个中风险问题:
  - `SpaceProductEditor.handleProductSelect()` 在重绑变体时仍使用商品默认材质，和已经修正后的后端空间模板投影语义分叉
- 下一步让空间编辑器在选择变体后优先回填变体材质，避免后台再次把错材质保存回空间。

### 2026-04-10 轮次 136

- 已完成轮次 135 新增问题修复:
  - `SpaceProductEditor` 现在会在重绑商品变体时优先回填所选变体的材质
  - 管理端空间编辑器和后端空间模板投影现在使用同一套“变体材质优先，商品默认材质兜底”的规则
- 增量回归:
  - `src/components/__tests__/SpaceProductEditor.contract.test.js`
  - `functions/lib/hono/routes/manage/spaces/__tests__/transformers.test.js`
- 对应修复提交: `8ab147f fix: sync space editor material with selected variant`

### 2026-04-10 轮次 137

- 继续复查小程序销售空间商品模板，新增 1 个中风险问题:
  - 销售空间详情服务没有把 `templateData.images` 合并进 `space.files`，商品模板组件在“只有商品图片、没有空间文件”时直接没有主图可看
- 下一步在小程序销售空间服务层把商品模板图片归一成可预览文件列表，补齐商品空间主图链路。

### 2026-04-10 轮次 138

- 已完成轮次 137 新增问题修复:
  - 小程序销售空间详情服务现在会把 `templateData.images` 归一成可预览文件，并和现有空间文件去重合并
  - 商品模板组件在没有额外挂空间文件时，仍能使用绑定商品/变体图片展示主图轮播
- 增量回归:
  - `minisales/tests/unit/services/spaces.test.ts`
  - `minisales/tests/unit/pages/spaces-controller.test.ts`
- 对应修复提交: `e86694a fix: hydrate sales space template images for minisales`

### 2026-04-10 轮次 139

- 继续复查 Web 销售空间列表消费契约，新增 1 个中风险问题:
  - `SalesSpacesView.vue` 直接消费原始 `share_token/file_count/cover_storage_key/p_images` 字段，没有归一化 `template_data.images`，导致商品型空间在“只有模板图片、没有挂空间文件”时列表无封面且文件数显示为 0
- 下一步把 Web 销售空间列表的消费口径收敛到统一 normalize 层，先补模板图片、封面和文件数回退。

### 2026-04-10 轮次 140

- 已完成轮次 139 新增问题修复:
  - Web 销售空间列表现在会先归一化销售空间数据，再消费统一的 `shareToken/fileCount/coverUrl/templateData/files` 字段
  - 商品型销售空间即使只有 `templateData.images`、没有额外挂空间文件，列表卡片仍能显示封面并给出正确文件数
- 增量回归:
  - `src/views/sales/__tests__/SalesSpacesView.lifecycle.test.js`
- 对应修复提交: `8b0ccd7 fix: align sales space web consumption`

### 2026-04-10 轮次 141

- 继续复查小程序销售空间商品模板交互，新增 1 个中风险问题:
  - 商品模板底部“查看原图”按钮没有携带 `data-url`，而 `spaces_detail/detail.ts` 又在缺失 URL 时直接返回，导致该按钮在商品空间里经常是空操作
- 下一步在详情页预览逻辑中补当前轮播图兜底，保证按钮至少能打开当前商品图。

### 2026-04-10 轮次 142

- 已完成轮次 141 新增问题修复:
  - 小程序销售空间详情页在预览事件缺失 URL 时，会自动回退到当前轮播图，再触发 `wx.previewImage`
  - 商品模板底部“查看原图”按钮不再因为缺失 `data-url` 而失效，轮播索引越界时也会安全回退到首图
- 增量回归:
  - `minisales/tests/unit/pages/spaces-detail-page.test.ts`
  - `minisales/tests/unit/services/spaces.test.ts`
  - `minisales/tests/unit/pages/spaces-controller.test.ts`
- 对应修复提交: `9794b44 fix: fallback sales space preview to current image`

### 2026-04-10 轮次 143

- 继续复查 Web 销售空间分享闭环，新增 1 个高风险问题:
  - `SalesSpacesView.vue` 一律把销售空间卡片跳到公开 `/space/:shareToken`，但销售空间列表实际会返回私有空间、密码空间和需要销售端鉴权的空间，形成“列表可见但点击不可达/重新走公开门禁”的断链
- 下一步补销售端内部空间详情页，并让 Web 销售空间卡片统一走销售端鉴权链路。

### 2026-04-10 轮次 144

- 已完成轮次 143 新增问题修复:
  - Web 销售空间卡片现在统一跳到 `/sales/:token/spaces/:id`，不再错误转向公开分享页
  - 销售端新增内部空间详情页，直接使用销售空间 API 加载详情，私有空间和带公开门禁的空间都能在销售端闭环访问
  - `Sales.vue` 现在会把销售空间详情也归到空间分区语义下，避免空间详情页误落入订单页头部/底栏状态
- 增量回归:
  - `src/views/sales/__tests__/SalesSpacesView.lifecycle.test.js`
  - `src/views/sales/__tests__/SalesSpaceDetailView.contract.test.js`
- 对应修复提交: `8b0ccd7 fix: align sales space web consumption`

### 2026-04-10 轮次 145

- 继续复查销售空间详情集合模板，新增 1 个高风险问题:
  - 销售空间详情接口没有返回销售员可见的 `subspaces`，而 `SpaceCollection.vue` 又固定把子空间跳到公开 `/space/:shareToken`。结果是销售端集合空间详情要么直接空列表，要么继续掉回公开门禁链路，子空间访问不闭环
- 下一步把销售空间详情补齐“销售员可见子空间”查询，并让集合模板支持销售端内部子空间跳转。

### 2026-04-10 轮次 146

- 已完成轮次 145 新增问题修复:
  - 销售空间详情接口现在会补齐当前销售员可见的子空间列表，集合空间在销售端不再无子项可看
  - `SpaceCollection.vue` 现在支持自定义子空间跳转地址，同时兼容 `coverImage/coverUrl` 两种封面口径
  - 销售端空间详情页现在会把子空间继续路由到 `/sales/:token/spaces/:id`，集合型销售空间形成完整闭环
- 增量回归:
  - `functions/lib/hono/routes/sales/__tests__/spaces-routes.test.js`
  - `src/components/space/__tests__/SpaceCollection.contract.test.js`
  - `src/views/sales/__tests__/SalesSpaceDetailView.contract.test.js`
  - `src/views/sales/__tests__/SalesSpacesView.lifecycle.test.js`
- 对应修复提交: `27df3ef fix: complete sales collection space subspace flow`

### 2026-04-10 轮次 147

- 继续复查销售集合空间子空间卡片封面口径，新增 1 个中风险问题:
  - 无论是 Web 的 `normalizeSalesSpace()` 还是小程序销售空间服务，对子空间卡片封面都只认显式 `cover_*` 字段，不会从子空间 `templateData.images` 回退。结果是商品型子空间只要没单独设置封面文件，在集合空间里就会一直显示空白占位
- 下一步把子空间封面归一化改成“显式封面优先，模板图片/商品图片兜底”，统一 Web 与小程序消费口径。

### 2026-04-10 轮次 148

- 已完成轮次 147 新增问题修复:
  - Web 销售空间归一化现在会在子空间缺少显式封面时，从 `templateData.images` 或商品图片中补齐子空间卡片封面
  - 小程序销售空间服务对集合子空间也补上了同样的封面回退规则，商品型子空间在合集模板中不再空白
- 增量回归:
  - `src/utils/__tests__/sales-space.test.js`
  - `src/components/space/__tests__/SpaceCollection.contract.test.js`
  - `src/views/sales/__tests__/SalesSpaceDetailView.contract.test.js`
  - `src/views/sales/__tests__/SalesSpacesView.lifecycle.test.js`
  - `functions/lib/hono/routes/sales/__tests__/spaces-routes.test.js`
  - `minisales/tests/unit/services/spaces.test.ts`
  - `minisales/tests/unit/pages/spaces-detail-page.test.ts`
  - `minisales/tests/unit/pages/spaces-controller.test.ts`
- 对应修复提交: `6d35221 fix: hydrate sales subspace covers from template data`

### 2026-04-10 轮次 149

- 继续复查销售集合空间子空间统计口径，新增 1 个中风险问题:
  - 子空间卡片的文件数仍只认显式 `file_count/fileCount`。商品型子空间如果只有模板图片、没有空间文件，会出现“有封面但文件数仍是 0”的分叉，和点进详情后的可预览内容不一致
- 下一步把子空间文件数口径改成“真实文件数优先，真实文件数为 0 时回退模板图片数量”，统一 Web 与小程序展示。

### 2026-04-10 轮次 150

- 已完成轮次 149 新增问题修复:
  - Web 销售空间归一化现在会在子空间没有真实文件时，用模板图片数量补齐子空间卡片文件数
  - 小程序销售空间服务也同步采用同一规则，合集模板中的商品型子空间不会再显示“0 个文件”假状态
- 增量回归:
  - `src/utils/__tests__/sales-space.test.js`
  - `src/components/space/__tests__/SpaceCollection.contract.test.js`
  - `src/views/sales/__tests__/SalesSpaceDetailView.contract.test.js`
  - `src/views/sales/__tests__/SalesSpacesView.lifecycle.test.js`
  - `functions/lib/hono/routes/sales/__tests__/spaces-routes.test.js`
  - `minisales/tests/unit/services/spaces.test.ts`
  - `minisales/tests/unit/pages/spaces-detail-page.test.ts`
  - `minisales/tests/unit/pages/spaces-controller.test.ts`
- 对应修复提交: `1239940 fix: align sales subspace file counts`

### 2026-04-10 轮次 151

- 继续复查商品空间详情媒体合同，新增 1 个中风险问题:
  - `SpaceProductDetail.vue` 会把 `templateData.images` 一律拼成 ``/file/${img}``，并在服务层已经把模板图片合并进 `space.files` 时再次追加同图。结果是已解析的 `/file/...` 或完整 CDN URL 会被拼坏，商品空间首图/缩略图还可能重复展示同一张图
- 下一步把商品空间详情媒体归一化收敛到组件内统一 URL 解析，并按 URL 去重合并模板图片与文件列表。

### 2026-04-10 轮次 152

- 已完成轮次 151 新增问题修复:
  - `SpaceProductDetail.vue` 现在会保留已解析的 `/file/...`、完整 `https://...`、`data:`、`blob:` 图片地址，不再重复拼接 `/file/`
  - 商品空间详情在模板图片已被服务层合并进 `space.files` 时，会按 URL 去重，不再重复展示同一张图
  - 组件同时补上了缺失的 `isDesktop` 响应式状态，移除了渲染期未定义告警
- 增量回归:
  - `src/components/space/__tests__/SpaceProductDetail.lifecycle.test.js`
  - `src/views/__tests__/Space.lifecycle.test.js`
- 对应修复提交: `84b350f fix: normalize product space media urls`

### 2026-04-10 轮次 153

- 继续复查公开合集空间子空间跳转，新增 1 个中风险问题:
  - `SpaceCollection.vue` 默认子空间链接仍只认 `shareToken`，但公开空间接口对子空间返回的是 `shareUrl`。结果是公开合集页点击子空间会直接跳到 `/space/undefined`
- 下一步把默认子空间跳转改成 `shareUrl` 优先、`shareToken` 兜底，补齐公开合集子空间访问闭环。

### 2026-04-10 轮次 154

- 已完成轮次 153 新增问题修复:
  - `SpaceCollection.vue` 默认子空间跳转现在会优先使用公开接口返回的 `shareUrl`
  - 当只有 `shareToken` 时仍会继续回退到 `/space/:token`，而完全缺失时会安全退到 `#`，不再生成脏链接
- 增量回归:
  - `src/components/space/__tests__/SpaceCollection.contract.test.js`
  - `src/views/__tests__/Space.lifecycle.test.js`
- 对应修复提交: `d149055 fix: honor public collection subspace links`

### 2026-04-10 轮次 155

- 继续复查公开合集空间子空间卡片投影，新增 1 个中风险问题:
  - 公开空间接口对子空间仍只认显式 `cover_storage_key` 和 `space_files`。商品型子空间只要没有单独设置封面文件，就会继续返回 `coverImage: null`、`fileCount: 0`，在公开合集页显示成空白占位和假零文件
- 下一步把公开合集子空间的封面和文件数口径也对齐到“显式封面/真实文件优先，模板图片兜底”。

### 2026-04-10 轮次 156

- 已完成轮次 155 新增问题修复:
  - 公开空间接口现在会为商品型子空间补齐模板图片 URL 归一化，不再把原始存储键直接透给前端
  - 公开合集空间中的商品型子空间在没有显式封面和空间文件时，也会从模板图片中补齐 `coverImage` 和 `fileCount`
- 增量回归:
  - `functions/api/space/__tests__/public-space-access.test.js`
  - `src/components/space/__tests__/SpaceCollection.contract.test.js`
  - `src/views/__tests__/Space.lifecycle.test.js`
- 对应修复提交: `93bdca2 fix: hydrate public collection subspace media`

### 2026-04-10 轮次 157

- 继续复查公开商品空间变体投影，新增 1 个高风险问题:
  - 公开空间 API 的主空间查询和子空间查询都没有 JOIN `product_variants`。结果是变体绑定的公开商品空间、公开合集子空间仍会退回商品级 `SPU/材质/主图`，与管理端/销售端已经修正后的变体投影语义分叉
- 下一步把公开空间查询对齐到变体投影口径，补齐 `pv_sku/pv_options_values/display_image_id`。

### 2026-04-10 轮次 158

- 已完成轮次 157 新增问题修复:
  - 公开空间 API 的主空间查询现在会补齐 `product_variants` 和变体主图投影，变体绑定的公开商品空间会正确显示变体 `SKU/材质/主图`
  - 公开合集空间对子空间的查询也已对齐到同一投影口径，变体绑定子空间不再退回商品级投影
- 增量回归:
  - `functions/api/space/__tests__/public-space-access.test.js`
  - `src/components/space/__tests__/SpaceCollection.contract.test.js`
  - `src/views/__tests__/Space.lifecycle.test.js`
- 对应修复提交: `270ba26 fix: project public space variant fields`

### 2026-04-10 轮次 159

- 继续复查公开商品空间媒体统计口径，新增 1 个高风险问题:
  - 公开空间 API 虽然已经把变体主图投到 `templateData.images`，但 `files/coverImage/fileCount` 仍只按原始 `p_images` 和 `space_files` 组装。结果是变体绑定的公开商品空间会出现“详情展示是变体主图，但封面/文件数/下载列表还是商品图口径”的分叉
- 下一步把公开商品空间媒体注入统一改为基于 `projectSpaceTemplateData(space).images`，并按 URL 去重收口。

### 2026-04-10 轮次 160

- 已完成轮次 159 新增问题修复:
  - 公开商品空间 `files`、`coverImage`、`fileCount` 现在都和 `templateData.images` 使用同一套投影口径，变体主图会真正进入公开空间媒体列表
  - 模板图片与空间文件在公开空间 API 中会按 URL 去重，避免同一张图在 `files` 中重复出现
- 增量回归:
  - `functions/api/space/__tests__/public-space-access.test.js`
  - `src/views/__tests__/Space.lifecycle.test.js`
  - `src/components/space/__tests__/SpaceCollection.contract.test.js`
  - `src/components/space/__tests__/SpaceProductDetail.lifecycle.test.js`
- 对应修复提交: `fc05168 fix: align public product space media counts`

### 2026-04-10 轮次 161

- 继续复查公开合集空间管理员预览边界，新增 1 个中风险问题:
  - 管理员预览未公开合集时，公开空间 API 的子空间查询仍固定过滤 `s.is_public = 1`，导致私有父合集里的私有子空间被错误隐藏
- 下一步把子空间可见性改成跟随预览上下文收口，仅在管理员预览未公开父合集时放开私有子空间过滤。

### 2026-04-10 轮次 162

- 已完成轮次 161 新增问题修复:
  - 公开空间 API 的 `getSpaceData()` 现在支持按预览上下文切换子空间可见性；管理员预览未公开父合集时，会返回其私有子空间
  - 公开父合集和普通访客链路仍保持 `is_public = 1` 过滤，不会把私有子空间暴露到公开访问面
  - 新增管理员预览私有合集的回归测试，并在 Node 测试环境补齐 Worker `timingSafeEqual` 能力，避免 JWT 预览场景被测试环境误伤
- 增量回归:
  - `functions/api/space/__tests__/public-space-access.test.js`
  - `src/views/__tests__/Space.lifecycle.test.js`
  - `src/components/space/__tests__/SpaceCollection.contract.test.js`
  - `src/components/space/__tests__/SpaceProductDetail.lifecycle.test.js`
- 对应修复提交: `861a651 fix: include private subspaces in admin previews`

### 2026-04-10 轮次 163

- 继续复查公开商品空间和销售空间的下载边界，新增 1 个中风险问题:
  - `useBatchDownload()` 不校验 `fetch` 是否返回成功响应，也不要求至少有一个文件真实下载成功；全量失败时仍会生成空 ZIP 并弹成功提示
- 下一步把批量下载成功条件收紧为“至少 1 个文件下载成功”，并补充全失败/部分失败的行为回归。

### 2026-04-10 轮次 164

- 已完成轮次 163 新增问题修复:
  - `useBatchDownload()` 现在会校验每个文件的 HTTP 成功状态，失败响应不再被塞进 ZIP
  - 当本轮批量下载没有任何文件成功获取时，流程会直接走失败提示，不再生成空 ZIP 或弹出成功 toast
  - 已补齐 composable 回归，覆盖“全失败报错”和“部分失败仍保留成功文件”两条边界
- 增量回归:
  - `src/composables/__tests__/useBatchDownload.test.js`
  - `src/components/space/__tests__/SpaceProductDetail.lifecycle.test.js`
  - `src/views/__tests__/Space.lifecycle.test.js`
  - `src/components/space/__tests__/SpaceCollection.contract.test.js`
  - `functions/api/space/__tests__/public-space-access.test.js`
- 对应修复提交: `ec1675a fix: avoid false success on empty batch downloads`

### 2026-04-10 轮次 165

- 继续复查空间主入口列表层级，新增 1 个中风险问题:
  - 管理端和销售端的空间主列表查询都没有排除 `parent_id` 非空的子空间，导致子空间会被混进一级空间列表，和合集内子空间入口重复展示
- 下一步把顶级空间列表口径统一收紧到 `parent_id IS NULL`，并补管理端/销售端列表契约回归。

### 2026-04-10 轮次 166

- 已完成轮次 165 新增问题修复:
  - `SpaceRepository.findAll()` 与 `findAllForSalesperson()` 现在都会只返回顶级空间，子空间不再泄漏进一级列表
  - 管理端和销售端的空间列表路由同时加了一层 `parent_id` 防御过滤，避免上游仓储契约回退时再次把子空间暴露到主入口
  - 已补齐管理端与销售端列表回归，并联跑 Web/小程序空间消费相关回归，确认合集详情的子空间入口不受影响
- 增量回归:
  - `functions/lib/hono/routes/manage/__tests__/spaces-crud-validation.test.js`
  - `functions/lib/hono/routes/sales/__tests__/spaces-routes.test.js`
  - `src/views/sales/__tests__/SalesSpacesView.lifecycle.test.js`
  - `src/views/sales/__tests__/SalesSpaceDetailView.contract.test.js`
  - `src/utils/__tests__/sales-space.test.js`
  - `minisales/tests/unit/services/spaces.test.ts`
- 对应修复提交: `c5d8961 fix: exclude subspaces from top-level space lists`

### 2026-04-10 轮次 167

- 继续复查管理端空间详情弹窗生命周期，新增 1 个中风险问题:
  - `SpaceDetailModal` 切换空间时没有隔离旧详情请求，`SubspaceList` 也不会跟随 `spaceId` 变化重载，导致空间详情和子空间列表都可能停留在上一条空间
- 下一步给详情弹窗和子空间列表都补请求序号与 `spaceId` 监听，只认当前上下文。

### 2026-04-10 轮次 168

- 已完成轮次 167 新增问题修复:
  - `SpaceDetailModal` 现在会为每轮详情加载分配请求序号，切换空间或关闭弹窗后旧详情不会再覆盖当前空间标题和设置
  - `SubspaceList` 现在会跟随 `spaceId` 变化重载子空间，并阻断旧列表结果回写新合集上下文
  - 已补齐两个生命周期回归，并联跑空间管理链路相关测试，确认空间编辑与子空间 CRUD 不受影响
- 增量回归:
  - `src/components/__tests__/SpaceDetailModal.lifecycle.test.js`
  - `src/components/__tests__/SubspaceList.lifecycle.test.js`
  - `src/components/__tests__/SpaceProductEditor.contract.test.js`
  - `functions/lib/hono/routes/manage/__tests__/spaces-crud-validation.test.js`
  - `functions/lib/hono/routes/manage/spaces/__tests__/subspaces-routes.test.js`
- 对应修复提交: `4262e29 fix: isolate space detail modal lifecycle`

### 2026-04-10 轮次 169

- 继续复查管理端空间详情写操作闭环，新增 1 个中风险问题:
  - `SpaceDetailModal` 的封面设置、发布、分享设置和文件增删不检查底层写操作返回值，失败时仍会刷新、弹成功提示并向父级发 `updated`
- 下一步把详情弹窗写操作统一改成“仅在成功后才回写 UI”，补失败态回归。

### 2026-04-10 轮次 170

- 已完成轮次 169 新增问题修复:
  - `SpaceDetailModal` 现在只会在 `updateSpace/addFilesToSpace/removeFilesFromSpace` 成功时才刷新详情、弹成功提示并向父级发 `updated`
  - 发布/取消发布/分享设置保存的 `publishing` 状态已改成 `try/finally` 收口，失败时不会卡住加载态
  - 已补齐“分享设置保存失败不再假成功”的回归，并联跑空间管理详情链路相关测试
- 增量回归:
  - `src/components/__tests__/SpaceDetailModal.lifecycle.test.js`
  - `src/components/__tests__/SubspaceList.lifecycle.test.js`
  - `src/components/__tests__/SpaceProductEditor.contract.test.js`
  - `functions/lib/hono/routes/manage/__tests__/spaces-crud-validation.test.js`
  - `functions/lib/hono/routes/manage/spaces/__tests__/subspaces-routes.test.js`
- 对应修复提交: `0ec730d fix: avoid false success in space detail actions`

### 2026-04-10 轮次 171

- 继续复查空间创建弹窗提交流程，新增 1 个中风险问题:
  - `SpaceCreateModal.handleSubmit()` 没有在 `submitting` 期间阻断重复触发，双击或同轮重复提交会并发创建两次空间
- 下一步给创建提交补同步提交锁，并让 `submitting` 用 `try/finally` 收口。

### 2026-04-10 轮次 172

- 已完成轮次 171 新增问题修复:
  - `SpaceCreateModal.handleSubmit()` 现在会在 `submitting` 为真时直接拒绝重复提交，双击不会再创建两次空间
  - 创建顶级空间和创建子空间的提交态都改成 `try/finally` 收口，异常时不会把弹窗永久卡在 loading
  - 已补齐重复提交回归，并联跑空间创建/详情/子空间 CRUD 相关回归
- 增量回归:
  - `src/components/__tests__/SpaceCreateModal.unbind.test.js`
  - `functions/lib/hono/routes/manage/__tests__/spaces-crud-validation.test.js`
  - `functions/lib/hono/routes/manage/spaces/__tests__/subspaces-routes.test.js`
  - `src/components/__tests__/SpaceDetailModal.lifecycle.test.js`
- 对应修复提交: `753b08c fix: prevent duplicate space create submits`

### 2026-04-10 轮次 173

- 继续复查空间删除链路的失败收口，新增 1 个中风险问题:
  - `SpaceManager` 和 `SubspaceList` 的删除确认都不检查 `deleteSpace()` 返回值，删除失败时仍会直接关闭确认框
- 下一步把删除确认统一改成只在删除成功后才关闭，并补主列表/子空间删除失败回归。

### 2026-04-10 轮次 174

- 已完成轮次 173 新增问题修复:
  - 管理端空间主列表和子空间列表的删除确认现在都会在 `deleteSpace()` 成功后才关闭，失败时保持当前确认上下文
  - 子空间删除成功后仍会继续刷新列表并向父级发 `updated`，失败时不会再误收口为成功态
  - 已补齐管理端主列表删除失败和子空间删除失败两条回归，并联跑空间创建/详情/子空间管理链路相关回归
- 增量回归:
  - `src/views/__tests__/SpaceManager.permission-alignment.test.js`
  - `src/components/__tests__/SubspaceList.lifecycle.test.js`
  - `src/components/__tests__/SpaceDetailModal.lifecycle.test.js`
  - `src/components/__tests__/SpaceCreateModal.unbind.test.js`
  - `functions/lib/hono/routes/manage/__tests__/spaces-crud-validation.test.js`
  - `functions/lib/hono/routes/manage/spaces/__tests__/subspaces-routes.test.js`
- 对应修复提交: `031178e fix: keep space delete dialogs open on failure`

### 2026-04-10 轮次 175

- 继续复查空间设置页保存反馈，新增 1 个中风险问题:
  - `SpaceSettingsTab` 点击保存后会立刻把脏检查基线重置为当前选择，父级还没确认保存成功时按钮就会提前显示“已保存”
- 下一步把脏检查基线收敛为只跟随父级 props 更新，不在子组件点击时提前清脏。

### 2026-04-10 轮次 176

- 已完成轮次 175 新增问题修复:
  - `SpaceSettingsTab` 现在不会在点击保存时提前重置基线，只有父级 props 真正更新后才会把配置视为已保存
  - 失败中的销售可见性保存会继续保持 `hasChanges=true`，按钮和文案不再伪装成“已保存”
  - 已补齐设置页契约回归，并联跑空间详情/子空间/创建链路相关回归
- 增量回归:
  - `src/components/space/__tests__/SpaceSettingsTab.contract.test.js`
  - `src/components/__tests__/SpaceDetailModal.lifecycle.test.js`
  - `src/components/__tests__/SubspaceList.lifecycle.test.js`
  - `src/views/__tests__/SpaceManager.permission-alignment.test.js`
  - `src/components/__tests__/SpaceCreateModal.unbind.test.js`
- 对应修复提交: `ab321f7 fix: keep space settings dirty until save confirms`

### 2026-04-10 轮次 177

- 继续复查商品详情关联空间复制链路，新增 1 个中风险问题:
  - `ProductDetail` 复制关联空间链接时直接拼接 `window.location.origin + /space/:token` 并调用 `navigator.clipboard.writeText`，没有复用项目统一的 `useClipboard().copyShareLink()`。当后端已经返回规范化 `shareUrl`、或者运行环境需要走降级复制方案时，商品详情会复制错误链接或与其他空间入口产生不一致行为。
- 下一步把商品详情复制动作统一收口到共享剪贴板 helper，优先使用 `shareUrl`，缺失时再回退 `shareToken/share_token`。

### 2026-04-10 轮次 178

- 已完成轮次 177 新增问题修复:
  - `ProductDetail` 关联空间复制动作现在统一委托 `useClipboard().copyShareLink()`，优先复制后端返回的 `shareUrl`，只有缺失时才回退 `/space/:shareToken`
  - 复制成功提示复用共享 helper 的契约，商品详情与 Dashboard/子空间列表的复制反馈保持一致，同时兼容 helper 内部的安全上下文降级逻辑
  - 已补齐“复制动作走共享 clipboard helper”与“优先使用 shareUrl”两条回归，并联跑商品详情关联空间/变体拉取/库存投影消费侧回归
- 增量回归:
  - `src/components/product/__tests__/ProductDetail.associated-spaces.test.js`
  - `src/components/product/__tests__/ProductDetailModal.fetch-variants.test.js`
  - `src/components/product/__tests__/product-inventory-projection-consumers.test.js`
- 对应修复提交: `746e756 fix: route product detail share copy through clipboard helper`

### 2026-04-10 轮次 179

- 继续复查空间商品编辑器媒体操作闭环，新增 1 个中风险问题:
  - `SpaceProductEditor` 的加文件和删文件流程都没有检查 `addFilesToSpace()/removeFilesFromSpace()` 返回值，导致底层写操作失败时组件仍会刷新空间详情、向父级发 `updated`，删除确认框还会直接关闭，形成明显假成功。
- 下一步把空间商品编辑器的媒体写操作统一收口为“仅成功才刷新/emit/关闭确认框”，并补失败态回归。

### 2026-04-10 轮次 180

- 已完成轮次 179 新增问题修复:
  - `SpaceProductEditor.addFiles()` 现在只有在 `addFilesToSpace()` 成功时才会重载空间详情并向父级发 `updated`
  - 文件删除确认现在只有在 `removeFilesFromSpace()` 成功时才会刷新详情、发 `updated` 并关闭确认框，失败时会保留当前确认上下文
  - 已补齐“加文件失败不再假刷新”和“删文件失败保留确认框”两条回归，并联跑空间编辑器/详情弹窗/子空间/后端管理路由回归
- 增量回归:
  - `src/components/__tests__/SpaceProductEditor.contract.test.js`
  - `src/components/__tests__/SpaceDetailModal.lifecycle.test.js`
  - `src/components/__tests__/SubspaceList.lifecycle.test.js`
  - `functions/lib/hono/routes/manage/__tests__/spaces-crud-validation.test.js`
  - `functions/lib/hono/routes/manage/spaces/__tests__/subspaces-routes.test.js`
- 对应修复提交: `34be40a fix: avoid false success in space product editor media actions`

### 2026-04-10 轮次 181

- 继续复查空间商品编辑器媒体刷新链路，新增 1 个中风险问题:
  - `SpaceProductEditor` 在加文件成功、删文件成功、上传队列回刷、拖拽排序失败回滚时都直接复用 `initData()`，导致右侧媒体区一刷新就把左侧未保存的名称、描述、分享设置和绑定态草稿整体覆盖成服务端旧值，存在明显的数据丢失风险。
- 下一步把“全量初始化”和“媒体区刷新”拆开，媒体相关回刷只同步 `files/coverFileId`，不再改写正在编辑的表单草稿。

### 2026-04-10 轮次 182

- 已完成轮次 181 新增问题修复:
  - `SpaceProductEditor` 新增独立的媒体刷新路径，媒体添加、媒体删除、上传队列回刷和排序失败回滚现在只同步 `files/coverFileId`
  - 左侧名称、描述、分享设置、商品绑定等未保存草稿在媒体区回刷后会被完整保留，不再被后台旧值覆盖
  - 已补齐“加文件成功后保留草稿”和“上传回刷后保留草稿”两条回归，并联跑空间编辑器/详情弹窗/子空间/后端管理路由回归
- 增量回归:
  - `src/components/__tests__/SpaceProductEditor.contract.test.js`
  - `src/components/__tests__/SpaceDetailModal.lifecycle.test.js`
  - `src/components/__tests__/SubspaceList.lifecycle.test.js`
  - `functions/lib/hono/routes/manage/__tests__/spaces-crud-validation.test.js`
  - `functions/lib/hono/routes/manage/spaces/__tests__/subspaces-routes.test.js`
- 对应修复提交: `6b0f0e7 fix: preserve space editor drafts during media refresh`

### 2026-04-10 轮次 183

- 继续复查空间详情弹窗失败态切换，新增 1 个中风险问题:
  - `SpaceDetailModal.loadData()` 在切到新的 `space.id` 后，如果 `loadSpace()` 返回 `null`，不会清空上一条 `spaceData`。结果是新空间加载失败时，弹窗仍会展示旧空间标题、公开状态和设置，形成明显错上下文。
- 下一步让详情弹窗在切到不同空间时先清旧状态，并在当前请求失败时显式写回 `null`。

### 2026-04-10 轮次 184

- 已完成轮次 183 新增问题修复:
  - `SpaceDetailModal` 切换到不同 `space.id` 时会先清掉旧 `spaceData`，新空间失败态不再继续展示上一条空间
  - 当前详情请求返回 `null` 时会显式收口为 `spaceData=null`，避免旧标题、旧文件统计和旧分享设置残留
  - 已补齐“切到加载失败的新空间时清理旧详情”回归，并联跑空间详情/子空间/编辑器/创建/主列表/后端管理路由回归
- 增量回归:
  - `src/components/__tests__/SpaceDetailModal.lifecycle.test.js`
  - `src/components/__tests__/SubspaceList.lifecycle.test.js`
  - `src/components/__tests__/SpaceProductEditor.contract.test.js`
  - `src/views/__tests__/SpaceManager.permission-alignment.test.js`
  - `src/components/__tests__/SpaceCreateModal.unbind.test.js`
  - `functions/lib/hono/routes/manage/__tests__/spaces-crud-validation.test.js`
  - `functions/lib/hono/routes/manage/spaces/__tests__/subspaces-routes.test.js`
- 对应修复提交: `f80e5c5 fix: clear stale space detail after load failures`

### 2026-04-10 轮次 185

- 继续复查商品导入预览的冲突处理边界，新增 1 个低风险问题:
  - `ImportPreviewStep` 的“复制当前结果”直接自写 `navigator.clipboard.writeText/execCommand`，没有复用项目统一的 `useClipboard()`。结果是导入预览和其它商品/空间复制入口的降级策略、成功/失败提示完全分叉，错误边界不一致。
- 下一步把导入预览冲突复制动作统一切回共享剪贴板 helper，并补回归。

### 2026-04-10 轮次 186

- 已完成轮次 185 新增问题修复:
  - `ImportPreviewStep` 的冲突复制现在统一委托 `useClipboard().copy()`，复制降级与成功/失败提示都和项目其它入口保持一致
  - 复制按钮补充稳定测试锚点，避免导入预览里多个同类按钮造成回归误测
  - 已补齐“复制当前冲突结果走共享 clipboard helper”回归，并联跑商品导入预览/商品导入主流程回归
- 增量回归:
  - `src/components/product/import/__tests__/ImportPreviewStep.test.js`
  - `src/components/product/__tests__/ProductImportModal.variant-first.test.js`
- 对应修复提交: `f00d15f fix: align import preview conflict copy with clipboard helper`

### 2026-04-10 轮次 187

- 继续复查商品选择器错误边界，新增 1 个中风险问题:
  - `ProductSelect` 的管理端分支没有消费 `useProducts().error`，失败时下拉框只会静默空白，也没有重试当前搜索的入口；而销售端分支已有本地错误态和重试按钮，两个模式的失败语义不一致。
- 下一步把管理端商品选择器的本地错误态、`load-error` 事件和重试动作补齐到和销售端一致。

### 2026-04-10 轮次 188

- 已完成轮次 187 新增问题修复:
  - `ProductSelect` 现在会在管理端消费 `useProducts().error`，加载失败时会展示本地错误面板并继续向外抛出 `load-error`
  - 重试按钮统一改为“重试当前搜索”，管理端会重新请求当前关键字，销售端保持原有重试逻辑
  - 已补齐“管理端错误本地展示 + 重试当前搜索”回归，并联跑订单商品绑定消费链路回归
- 增量回归:
  - `src/components/product/__tests__/ProductSelect.sales-image.test.js`
  - `src/components/order/__tests__/ProductBindingSection.variant-status.test.js`
- 对应修复提交: `fe79d15 fix: surface admin product picker load errors`

### 2026-04-10 轮次 189

- 继续复查商品导入图片上传收口，新增 1 个中风险问题:
  - `ProductImportModal.handleUploadImagesAndNext()` 只要上传循环没有抛异常，就会直接弹“上传成功”并切到预览步骤。若所有图片上传接口都返回 `success:false`，`uploadedCount=0` 也会被当成成功收口，形成明显假成功。
- 下一步把图片上传步骤改成“至少上传成功 1 张图片才允许进入预览”，全失败时停留当前步骤并提示错误。

### 2026-04-10 轮次 190

- 已完成轮次 189 新增问题修复:
  - `ProductImportModal` 现在只有在至少成功上传 1 张匹配图片时才会弹成功提示并进入预览
  - 如果本轮匹配图片全部上传失败，会保留在图片匹配步骤并提示错误，不再伪装成上传完成
  - 已补齐“图片上传全失败时保留当前步骤”回归，并联跑商品导入主流程/导入预览回归
- 增量回归:
  - `src/components/product/__tests__/ProductImportModal.variant-first.test.js`
  - `src/components/product/import/__tests__/ImportPreviewStep.test.js`
- 对应修复提交: `07a9a1c fix: tighten product import and picker error states`

### 2026-04-10 轮次 191

- 继续复查商品导入图片字段闭环，新增 1 个中风险问题:
  - `ProductImportModal.handleImport()` 在构造变体 payload 时会把未解析的本地 `image_url` 原样带进 `variants[]`。这些值只是 Excel 里的本地文件名，不是后端商品契约字段，也不会被服务端转成图片资源，属于脏数据残留。
- 下一步在导入 payload 构造阶段剔除非 http 的本地 `image_url`，只保留已上传后的 `images` 结果。

### 2026-04-10 轮次 192

- 已完成轮次 191 新增问题修复:
  - `ProductImportModal` 现在会在构造变体 payload 时剔除未解析的本地 `image_url`，避免把 Excel 文件名直接带进批量导入请求
  - 已上传成功的图片仍然走 `images` 字段进入导入，不影响已有的图片匹配上传路径
  - 已补齐“未解析本地图片文件名不进入变体 payload”回归，并联跑商品导入主流程/导入预览回归
- 增量回归:
  - `src/components/product/__tests__/ProductImportModal.variant-first.test.js`
  - `src/components/product/import/__tests__/ImportPreviewStep.test.js`
- 对应修复提交: `845c9dd fix: strip unresolved local image names from imports`

### 2026-04-10 轮次 193

- 继续复查商品工作流弹窗生命周期，新增 1 个中风险问题:
  - `ProductWorkflowModal` 在一个商品的编辑预加载失败后，如果父级直接切到另一个商品，`editHydrationError` 不会重置，旧错误条会直接挂到新商品详情上，形成错上下文残留。
- 下一步在商品切换监听里清掉旧编辑错误，只保留当前商品自己的失败态。

### 2026-04-10 轮次 194

- 已完成轮次 193 新增问题修复:
  - `ProductWorkflowModal` 现在会在切换商品上下文时清理 `editHydrationError`，旧商品的编辑失败提示不再泄漏到新商品
  - 已补齐“编辑预加载失败后切商品时清空旧错误”回归，并联跑商品工作流/商品详情关联回归
- 增量回归:
  - `src/components/product/__tests__/ProductWorkflowModal.test.js`
  - `src/components/product/__tests__/ProductDetailModal.fetch-variants.test.js`
  - `src/components/product/__tests__/ProductDetail.associated-spaces.test.js`
- 对应修复提交: `c5bb847 fix: clear stale workflow errors on product switch`

### 2026-04-10 轮次 195

- 继续复查商品导入图片上传语义，新增 1 个中风险问题:
  - `ProductImportModal.handleUploadImagesAndNext()` 在“部分图片上传成功、部分失败”时仍然统一弹 `success` 提示，只告诉用户成功数量，不暴露失败数量。剩余失败图片会被静默跳过，成功提示具有误导性。
- 下一步把图片上传提示改成区分“全成功”和“部分成功”，部分成功时改为 `warning` 并显式提示失败数量。

### 2026-04-10 轮次 196

- 已完成轮次 195 新增问题修复:
  - `ProductImportModal` 现在会在图片上传部分成功时改为 `warning` 提示，并明确告知成功/失败数量
  - 只有全部匹配图片都上传成功时才会继续弹纯成功提示，上传语义和最终导入结果保持一致
  - 已补齐“部分图片上传成功时改为 warning”回归，并联跑商品导入主流程/导入预览回归
- 增量回归:
  - `src/components/product/__tests__/ProductImportModal.variant-first.test.js`
  - `src/components/product/import/__tests__/ImportPreviewStep.test.js`
- 对应修复提交: `6fa20b0 fix: warn on partial import image upload success`

### 2026-04-10 轮次 197

- 继续复查商品详情弹窗背景补全链路，新增 1 个中风险问题:
  - `ProductDetailModal` 在拿着 `initialData` 做后台补全时，如果 `loadProduct()` 失败，会把当前轻量商品快照直接清空成错误页。用户明明已经看到商品基础信息，却会因为“补充详情失败”失去整个详情视图。
- 下一步把背景补全失败改成保留当前快照，只在没有任何可展示数据时才落错误页。

### 2026-04-10 轮次 198

- 已完成轮次 197 新增问题修复:
  - `ProductDetailModal` 现在会在背景补全失败时保留当前 `initialData` 快照，不再把已有详情打成错误页
  - 只有当前没有任何可展示商品数据时，详情弹窗才会真正收口为错误态
  - 已补齐“背景补全失败时保留当前快照”回归，并联跑商品详情/工作流/关联空间回归
- 增量回归:
  - `src/components/product/__tests__/ProductDetailModal.fetch-variants.test.js`
  - `src/components/product/__tests__/ProductWorkflowModal.test.js`
  - `src/components/product/__tests__/ProductDetail.associated-spaces.test.js`
- 对应修复提交: `0346601 fix: preserve product detail snapshot on hydrate failure`

### 2026-04-10 轮次 199

- 继续复查商品导出闭环，新增 1 个中风险问题:
  - `ProductExportModal` 在补全商品详情时，如果 `loadProduct()` 返回 `null`，会直接回退到列表页的 lite 数据继续导出。这样生成的文件会静默缺少完整变体明细，却仍然走成功收口，属于业务未闭环。
- 下一步把导出流程收紧为“任一商品详情补全失败就中止导出并提示错误”，避免产出不完整文件。

### 2026-04-10 轮次 200

- 已完成轮次 199 新增问题修复:
  - `ProductExportModal` 现在在任一商品详情补全失败时会直接中止导出并提示错误，不再偷用 lite 列表数据生成不完整文件
  - 已补齐“商品详情补全失败时导出应失败”回归，并联跑商品导出/详情/工作流回归
- 增量回归:
  - `src/components/product/__tests__/ProductExportModal.filters.test.js`
  - `src/components/product/__tests__/ProductDetailModal.fetch-variants.test.js`
  - `src/components/product/__tests__/ProductWorkflowModal.test.js`
- 对应修复提交: `cb8fbc4 fix: fail product export when detail hydration is incomplete`

### 2026-04-10 轮次 201

- 继续复查商品创建/编辑表单提交链路，新增 1 个中风险问题:
  - `useProductForm.handleSubmit()` 只对 `normalizeMutationResult(response)` 的返回值型失败做了 toast 收口；当 `createProductWithMeta/updateProductWithMeta` 或旧版 `createProduct/updateProduct` 直接 reject 时，异常会穿透到组件外层，界面既没有错误提示，也没有明确失败语义，属于错误边界缺口。
- 下一步在提交逻辑补 `catch`，只对当前仍然有效的提交流程弹错误 toast，并保持 `submitting` 在 `finally` 中稳定回落。

### 2026-04-10 轮次 202

- 已完成轮次 201 新增问题修复:
  - `useProductForm.handleSubmit()` 现在会在底层保存请求直接抛异常时拦截错误，并在当前提交上下文仍有效时弹出 `error` toast
  - 失败时不再错误触发 `success` 事件或关闭商品弹窗，`submitting` 也会继续通过既有 `finally` 收口为 `false`
  - 已补齐“保存请求 reject 时保留弹窗并提示错误”回归，并联跑商品创建/编辑与工作流关联回归
- 增量回归:
  - `src/components/product/__tests__/ProductCreateModal.variant-first.test.js`
  - `src/components/product/__tests__/ProductCreateModal.edit-variant-preservation.test.js`
  - `src/components/product/__tests__/ProductCreateModal.external-codes.test.js`
  - `src/components/product/__tests__/ProductWorkflowModal.test.js`
- 对应修复提交: `8433820 fix: handle product form submit exceptions`

### 2026-04-10 轮次 203

- 继续沿商品创建/编辑、导入、详情加载与统计链路复查，新增 9 个中风险问题:
  - `useProducts.loadProduct()` 在接口返回 `success:false` 时直接吞成 `null`，上层无法区分“加载失败”和“没有详情”，会把 `ProductBindingSection`、`ProductWorkflowModal`、`ProductDetailModal`、`ProductExportModal` 的失败语义带歪。
  - `ProductImportModal.resetFile()` 没有清空 `imageUploadFiles/imageMatches`，关闭弹窗后再打开会沿用上一次导入会话的本地图片匹配状态。
  - `useProductForm.removeOption()` 在编辑态请求规格影响预览时没有 `catch`，请求 reject 会直接冒泡，既不提示用户，也不做错误收口。
  - `useProductForm.addOptionValue()` 在编辑态是“先本地加值再请求持久化”；如果 `addDimensionValue()` reject，会留下未持久化的本地规格值，形成脏状态。
  - `useProductForm.removeOptionValue()` 在编辑态请求值影响预览时没有 `catch`，reject 后会直接中断交互。
  - `useProductForm.restoreOptionValue()` 在恢复归档值时没有 `catch`，reject 会直接中断恢复流程且没有错误提示。
  - `useProductForm.confirmDimensionArchive()` 归档规格只处理返回值失败，不处理 reject；网络异常时会留下可重试弹窗但没有任何错误反馈。
  - `useProductForm.confirmValueArchive()` 归档规格值也只处理返回值失败，不处理 reject；异常会直接外抛。
  - `ProductStats` 的低库存统计仍按 `stock_quantity` 聚合，没有优先消费 `available_quantity`，与商品列表/详情展示口径不一致。
- 下一步把这 9 条按三批修复: 先收口 `loadProduct` 与导入残留，再统一补 `useProductForm` 的异步动作错误边界，最后修正商品统计库存口径。

### 2026-04-10 轮次 204

- 已完成轮次 203 新增问题修复:
  - `useProducts.loadProduct()` 现在会在接口失败时抛出明确错误，商品绑定、工作流编辑、详情补全、导出补全都会进入正确失败分支，不再把错误伪装成空数据。
  - `ProductImportModal.resetFile()` 现在会同步清空 `imageUploadFiles/imageMatches`，导入弹窗关闭后不会残留上一轮图片匹配状态。
  - `useProductForm.removeOption()/removeOptionValue()/restoreOptionValue()/confirmDimensionArchive()/confirmValueArchive()` 现在都补齐了 reject 收口，只在当前上下文仍有效时弹错误 toast，并保持本地状态/向导 loading 稳定。
  - `useProductForm.addOptionValue()` 现在改成编辑态“服务端写入成功后再落本地值”，reject 时不会留下未持久化规格值或脏变体状态。
  - `ProductStats` 的低库存统计现在优先消费 `available_quantity`，与商品列表和详情页的库存展示口径一致。
  - 本轮累计 10 个新增问题已完成修复并形成一组批次总结，其中第 1 条问题已在轮次 201/202 单独修复，其余 9 条由本轮统一收口。
- 增量回归:
  - `src/composables/__tests__/useProducts.cache.test.js`
  - `src/components/product/__tests__/ProductImportModal.variant-first.test.js`
  - `src/components/product/__tests__/ProductCreateModal.dimension-archive.test.js`
  - `src/components/product/__tests__/ProductCreateModal.value-archive.test.js`
  - `src/components/product/__tests__/ProductCreateModal.variant-first.test.js`
  - `src/components/product/__tests__/ProductCreateModal.edit-variant-preservation.test.js`
  - `src/components/product/__tests__/ProductCreateModal.external-codes.test.js`
  - `src/components/product/__tests__/ProductCreateModal.inventory-ownership.test.js`
  - `src/components/product/__tests__/ProductWorkflowModal.test.js`
  - `src/components/product/__tests__/ProductDetailModal.fetch-variants.test.js`
  - `src/components/product/__tests__/ProductExportModal.filters.test.js`
  - `src/components/order/__tests__/ProductBindingSection.variant-status.test.js`
  - `src/components/product/__tests__/ProductStats.test.js`
  - `src/components/product/__tests__/ProductGrid.available-stock.test.js`
  - `src/components/product/__tests__/product-inventory-projection-consumers.test.js`
- 对应修复提交: `94f4e3b fix: harden product module async boundaries`

### 2026-04-10 轮次 205

- 继续复查商品详情关联空间链路，新增 1 个中风险问题:
  - `useSpaces.loadProductSpaces()` 在接口失败时直接吞成空数组，`ProductDetail` 又把空数组渲染成“没有关联空间”。这样商品详情里的关联空间区块会把真实加载失败伪装成业务空态，用户既看不到错误，也无法重试。
- 下一步把 `loadProductSpaces()` 的失败语义恢复为抛错，并在商品详情内提供本地错误态和重试入口，不再把失败混同为空数据。

### 2026-04-10 轮次 206

- 已完成轮次 205 新增问题修复:
  - `useSpaces.loadProductSpaces()` 现在会在接口失败时抛出明确错误，调用方可以区分“加载失败”和“没有关联空间”
  - `ProductDetail` 现在会在关联空间加载失败时展示本地错误态和重试按钮，不再把失败伪装成空列表
  - 已补齐关联空间失败语义与商品详情详情链路回归
- 增量回归:
  - `src/composables/__tests__/useSpaces.test.js`
  - `src/components/product/__tests__/ProductDetail.associated-spaces.test.js`
  - `src/components/product/__tests__/ProductDetailModal.fetch-variants.test.js`
- 对应修复提交: `0434fb8 fix: surface associated space load failures`

### 2026-04-10 轮次 207

- 继续复查商品导入工作流回退链路，新增 1 个中风险问题:
  - `ProductImportModal.handleBack()` 在图片匹配步骤或预览步骤点击返回时，会直接清空 `parsedItems/preprocessStats`，并且从预览页永远退回映射步骤。用户如果只是想回上一层修图片匹配或调整导入前检查，会丢失整轮预处理结果，导入工作流没有真正闭环。
- 下一步把返回逻辑改成保留当前导入会话数据: 图片匹配返回映射时不清空预处理结果，预览页在存在图片匹配会话时优先回到图片匹配步骤。

### 2026-04-10 轮次 208

- 已完成轮次 207 新增问题修复:
  - `ProductImportModal` 现在在图片匹配步骤返回映射时会保留 `parsedItems/preprocessStats`
  - 从预览页返回时，如果当前导入会话存在图片匹配状态，会优先回到图片匹配步骤，不再强制退回映射并清空进度
  - 已补齐商品导入回退链路、预览链路、图片匹配链路回归
- 增量回归:
  - `src/components/product/__tests__/ProductImportModal.variant-first.test.js`
  - `src/components/product/import/__tests__/ImportPreviewStep.test.js`
  - `src/components/product/import/__tests__/ImportImageMatchStep.test.js`
- 对应修复提交: `f174c5e fix: preserve import progress when stepping back`

### 2026-04-11 轮次 209

- 继续复查商品绑定到订单创建链路，新增 2 个中风险问题:
  - `OrderCreateModal` 在关闭后重新打开时只重置了 `boundProduct/formData`，没有清空 `boundProductVariant`。如果上一轮已绑定商品，下一次新建订单会继续显示旧规格快照，形成跨会话脏状态。
  - `useOrderForm.fillForm()` 处理 `prefill` 时只覆盖传入字段；当父层传入空对象 `{}` 或部分预填充数据时，旧的商品名、品牌、图片等字段会残留。`OrderCreateModal` 正是用 `{}` 尝试重置表单，因此关闭后再打开会把上一单的商品信息和图片带进来，业务没有真正闭环。
- 已完成本轮修复:
  - `OrderCreateModal` 现在在每次打开创建弹窗时同步清空 `boundProductVariant`，不会把旧绑定规格带入下一次开单。
  - `useOrderForm.fillForm()` 现在会先完整重置表单和图片，再应用新的 `prefill` 数据；空对象和部分对象都不会残留旧值。
- 增量回归:
  - `src/components/order/__tests__/OrderCreateModal.variant-policy.test.js`
  - `src/components/order/__tests__/OrderForm.prefill-reset.test.js`
  - `src/components/order/__tests__/OrderEditModal.variant-lock.test.js`
  - `src/components/order/__tests__/ProductBindingSection.variant-status.test.js`
- 对应修复提交: `df8a421 fix: reset bound order product state on reopen`

### 2026-04-11 轮次 210

- 继续复查商品绑定组件在“已有绑定单据/空间进入编辑”链路，新增 1 个中风险问题:
  - `ProductBindingSection` 只会在内部 `ProductSelect` 选中时加载完整商品详情；当父层直接传入 `boundProduct`（例如编辑已有订单、已有空间绑定商品）时，组件不会自动 hydrate 变体和维度，也不会按 `variantId/sku` 恢复当前绑定规格。结果是绑定卡片只剩商品头信息，规格选择、库存和补货信息链路断开，编辑态业务未闭环。
- 已完成本轮修复:
  - `ProductBindingSection` 现在会在接收到已有 `boundProduct` 时静默加载完整商品详情，并优先按 `variantId`、其次按 `sku` 恢复当前绑定的变体。
  - 该静默 hydrate 只恢复本地规格/库存视图，不会在初始化阶段自动回发 `select`，避免把已有订单/空间错误重选成其他变体。
- 增量回归:
  - `src/components/order/__tests__/ProductBindingSection.variant-status.test.js`
  - `src/components/order/__tests__/OrderCreateModal.variant-policy.test.js`
  - `src/components/order/__tests__/OrderForm.prefill-reset.test.js`
  - `src/components/order/__tests__/OrderEditModal.variant-lock.test.js`
- 对应修复提交: `0119e1a fix: hydrate existing bound product variants`

### 2026-04-11 轮次 211

- 继续复查商品关联的空间编辑链路，新增 1 个中风险问题:
  - `SpaceProductEditor` 只在 `onMounted` 时执行 `initData()` 并注册上传刷新回调。如果父层复用同一个编辑器实例切换到另一个 space，它不会重新加载新的空间详情，也不会把上传刷新回调从旧 `space_<id>` 迁到新空间。结果是编辑器会继续显示旧空间的商品绑定、媒体和模板数据，上传回调也落到错误空间上下文。
- 已完成本轮修复:
  - `SpaceProductEditor` 现在会监听 `props.space.id`，在空间切换时重新跑初始化流程。
  - 上传刷新回调现在会随 `space.id` 切换自动解绑旧 key 并绑定新 key，不再把媒体刷新挂在过期空间上。
- 增量回归:
  - `src/components/__tests__/SpaceProductEditor.contract.test.js`
- 对应修复提交: `f1851d3 fix: reload space editor state on space switch`

### 2026-04-11 轮次 212

- 继续复查商品管理入口的编辑/分享补全链路，新增 2 个中风险问题:
  - `ProductManager.handleShare()` 直接 await `hydrateProductWithVariants()`，接口 reject 时会抛成未处理异常，既没有错误提示，也没有保证分享弹窗保持关闭，属于失败冒泡成全局错误。
  - `ProductManager.handleEditWithHydration()` 同样没有失败收口；hydrate reject 时错误会直接外抛，并留下 `isEditMode` 等本地状态未回滚，后续创建/编辑入口可能带着脏上下文继续运行。
- 已完成本轮修复:
  - `handleShare()` 现在会在当前请求仍有效时收口错误，弹出 toast，并确保分享弹窗不会进入假成功态。
  - `handleEditWithHydration()` 现在会在当前请求仍有效时回滚 `isEditMode/editingProduct/showCreateModal`，并提示明确错误。
- 增量回归:
  - `src/components/__tests__/ProductManager.variant-hydration.test.js`
- 对应修复提交: `922ee6b fix: handle product manager hydration failures`

### 2026-04-11 轮次 213

- 继续复查商品关联的空间编辑权限链路，新增 1 个中风险问题:
  - `SpaceProductEditor` 在没有 `products:manage` 权限时不会 hydrate `boundProduct`，但 `form.productId` 仍保留已有绑定。模板里品牌/系列/价格/材质/SKU 的禁用条件却只看 `!!boundProduct`，导致“已绑定商品的空间”在低权限场景下被伪装成可编辑普通空间，用户能错误修改本应由商品绑定接管的核心参数。
- 已完成本轮修复:
  - `SpaceProductEditor` 现在以实际绑定态 `form.productId` 作为核心参数只读条件，而不是依赖 `boundProduct` hydrate 结果。
  - 即使当前用户没有商品管理权限，只要该空间仍绑定商品，核心参数字段也会保持只读，不再出现权限降级后错误解锁。
- 增量回归:
  - `src/components/__tests__/SpaceProductEditor.contract.test.js`
- 对应修复提交: `e3c5843 fix: lock bound space fields without product access`

### 2026-04-11 轮次 214

- 继续复查商品分享创建链路，新增 1 个中风险问题:
  - `SpaceCreateModal` 初始化时会直接把 `props.initialProduct.id` 写进 `form.productId`，但只有在 `selectedVariant` 存在时才会补齐 `variantId`。一旦调用方传入的是 lite product 或 hydrate 未完成的商品对象，前端就会留下“有 `productId`、无 `variantId`”的半绑定态；提交时请求被后端拒绝，用户前端却没有任何前置阻断，形成可复现的创建失败和假上下文。[src/components/SpaceCreateModal.vue](/home/bjw/Code/KK-Image/src/components/SpaceCreateModal.vue)
- 已完成本轮修复:
  - `SpaceCreateModal` 不再在初始化阶段提前写入 `productId`，只有拿到有效 `selectedVariant` 时才正式落绑定。
  - 创建前现在会拦截半绑定 payload，并弹出错误 toast，避免把无效请求打到后端。
  - 快捷分享场景只有在初始商品成功完成变体绑定后才会自动生成默认空间名，不再把无效初始商品伪装成已绑定上下文。
- 增量回归:
  - `src/components/__tests__/SpaceCreateModal.unbind.test.js`
- 对应修复提交: `a79d90c fix: harden space product binding boundaries`

### 2026-04-11 轮次 215

- 继续复查商品绑定到空间的前后端契约，新增 1 个中风险问题:
  - `SpaceCreateModal` 和 `SpaceProductEditor` 前端都把规格选择策略固定成 `in_stock_only`，但 `POST /api/manage/spaces`、`POST /api/manage/spaces/:id/subspaces` 以及空间更新路由调用 `validateProductVariantBinding()` 时没有传这个策略。结果是 UI 虽然禁止绑定缺货规格，接口层仍然接受绕过前端的缺货变体绑定，形成“前端一套、后端一套”的业务分叉；同时空间更新如果未来直接强收紧校验，又会误伤已有历史绑定，因此需要按“仅新绑定收紧、旧绑定保留”处理。[functions/lib/hono/routes/manage/spaces/crud.js](/home/bjw/Code/KK-Image/functions/lib/hono/routes/manage/spaces/crud.js) [functions/lib/hono/routes/manage/spaces/subspaces.js](/home/bjw/Code/KK-Image/functions/lib/hono/routes/manage/spaces/subspaces.js)
- 已完成本轮修复:
  - 顶级空间创建、子空间创建现在都会以 `in_stock_only` 策略校验商品变体绑定，缺货规格无法再通过接口绕过前端约束。
  - 空间更新路由现在只在绑定发生变化时启用 `in_stock_only` 校验；对未改动绑定的历史空间仍保留宽松校验，避免编辑其他字段时误伤既有数据。
  - 已补齐空间创建、子空间创建、空间 rebinding 的后端回归测试。
- 增量回归:
  - `functions/lib/hono/routes/manage/__tests__/spaces-crud-validation.test.js`
  - `functions/lib/hono/routes/manage/spaces/__tests__/subspaces-routes.test.js`
- 对应修复提交: `a79d90c fix: harden space product binding boundaries`

### 2026-04-11 轮次 216

- 继续向商品详情查看链路审查，已复核以下关联代码，当前未发现新的已坐实问题:
  - `src/components/product/ProductDetail.vue`
  - `src/components/product/ProductDetailModal.vue`
  - `src/components/product/__tests__/ProductDetail.associated-spaces.test.js`
  - `src/components/product/__tests__/ProductDetailModal.fetch-variants.test.js`
  - `src/views/PurchaseOrders.vue` 中 `ProductDetailModal` 挂载链路
- 本轮结论:
  - 商品详情里的关联空间加载已有 requestId 收口，失败态与重试入口测试仍有效。
  - 商品详情弹窗对“切换商品时旧请求回写新详情”和“lite product 背景 hydrate 失败时保留快照”已有测试覆盖，当前未看到新的假空态或脏回写实锤。
  - 下一步继续沿商品空间详情页、空间详情弹窗和剩余商品入口往下扫，优先查“打开/关闭/切换对象”场景里的旧状态残留。

### 2026-04-11 轮次 217

- 继续复查商品关联的空间详情弹窗切换链路，新增 1 个中风险问题:
  - `SpaceDetailModal` 复用实例切换 `space.id` 时只重新拉详情，不会清理内部 `activeTab/showFileSelector`。结果是用户从空间 A 切到空间 B 时，会把旧空间的“分析/设置”标签页甚至打开中的文件选择器一起带进新上下文，形成跨空间残留状态；文件选择器还会让后续选文件操作落到错误的空间语境里，属于可复现的业务未闭环。[src/components/SpaceDetailModal.vue](/home/bjw/Code/KK-Image/src/components/SpaceDetailModal.vue)
- 已完成本轮修复:
  - `SpaceDetailModal` 现在在 `props.space.id` 变化时会先重置到 `files` 标签并关闭文件选择器，再加载新空间详情。
  - 已补齐跨空间切换时的标签页重置和文件选择器收口测试。
- 增量回归:
  - `src/components/__tests__/SpaceDetailModal.lifecycle.test.js`
  - `src/components/__tests__/SubspaceList.lifecycle.test.js`
  - `src/views/__tests__/SpaceManager.permission-alignment.test.js`

### 2026-04-11 轮次 218

- 继续复查商品详情工作流弹窗切换链路，新增 1 个中风险问题:
  - `ProductWorkflowModal` 在 `edit` 模式下接收到新的 `product` 时，不会退出旧编辑态，也不会清空旧 `editDraft`。如果父层复用同一个工作流弹窗切换到另一件商品，界面会继续显示上一件商品的编辑表单，形成跨商品脏草稿和错误上下文。[src/components/product/ProductWorkflowModal.vue](/home/bjw/Code/KK-Image/src/components/product/ProductWorkflowModal.vue)
- 已完成本轮修复:
  - `ProductWorkflowModal` 现在在商品对象切换时会主动退出旧编辑态，清空旧编辑草稿和嵌入式关闭标记，再回到新商品的详情态。
  - 已补齐“编辑中切换商品”场景的工作流回归测试。
- 增量回归:
  - `src/components/product/__tests__/ProductWorkflowModal.test.js`
  - `src/components/product/__tests__/ProductDetailModal.fetch-variants.test.js`
  - `src/components/__tests__/ProductManager.variant-hydration.test.js`

### 2026-04-11 轮次 219

- 继续复查商品编辑入口的初始化失败边界，新增 1 个中风险问题:
  - `ProductCreateModal` 在父层传入 `initializationError` 时只显示错误提示，但 `handleSubmit()` 和主提交按钮都没有阻断。这样编辑初始化失败后，用户仍可继续提交，前端会拿着不完整甚至空壳的 `initialData` 往 `updateProduct*` 发请求，形成“加载失败但仍可误保存”的假可操作态。[src/components/product/ProductCreateModal.vue](/home/bjw/Code/KK-Image/src/components/product/ProductCreateModal.vue)
- 已完成本轮修复:
  - `ProductCreateModal` 现在在存在 `initializationError` 时会统一阻断表单提交。
  - 创建/编辑主按钮的禁用条件也同步纳入 `initializationError`，不再把失败初始化后的编辑器伪装成可继续保存。
  - 已补齐“初始化失败时禁止提交”的回归测试，并复核普通创建、库存所有权和工作流编辑链路未受回归影响。
- 增量回归:
  - `src/components/product/__tests__/ProductCreateModal.variant-first.test.js`
  - `src/components/product/__tests__/ProductCreateModal.inventory-ownership.test.js`
  - `src/components/product/__tests__/ProductWorkflowModal.test.js`

### 2026-04-11 轮次 220

- 继续复查商品导入关闭/重开链路，新增 1 个中风险问题:
  - `ProductImportModal.processFile()` 缺少独立的异步会话失效保护。文件解析如果在弹窗关闭后才返回，旧解析结果仍会把 `fileHeaders/rawFileRows/currentStep` 写回已重置的导入会话，导致弹窗下次打开时被旧文件强行推进到映射步骤，形成典型的“关闭后旧请求回写新上下文”。[src/components/product/ProductImportModal.vue](/home/bjw/Code/KK-Image/src/components/product/ProductImportModal.vue)
- 已完成本轮修复:
  - `ProductImportModal` 现在为文件解析单独维护 `fileParseRequestId`；弹窗关闭或新文件开始解析时，旧解析结果会失效，不再回写已重置的导入流程。
  - 已补齐“关闭后丢弃旧文件解析结果”的回归测试，并复核导入预览/图片匹配链路未受回归影响。
- 增量回归:
  - `src/components/product/__tests__/ProductImportModal.variant-first.test.js`
  - `src/components/product/import/__tests__/ImportPreviewStep.test.js`
  - `src/components/product/import/__tests__/ImportImageMatchStep.test.js`

### 2026-04-11 轮次 221

- 继续复查商品导出弹窗关闭/重开链路，新增 1 个中风险问题:
  - `ProductExportModal` 关闭时只清理生成进度和下载状态，没有恢复 `form.format/form.scope` 默认值。结果是用户上一轮若选择了 `csv + 当前筛选结果`，下次重新打开弹窗时会静默继承旧导出参数，形成跨会话脏状态和误导性导出上下文。[src/components/product/ProductExportModal.vue](/home/bjw/Code/KK-Image/src/components/product/ProductExportModal.vue)
- 已完成本轮修复:
  - `ProductExportModal.resetState()` 现在会同时恢复 `format='excel'` 与 `scope='all'`，关闭后重新打开总是回到干净默认会话。
  - 已补齐“关闭后导出参数重置”的回归测试，阻断再次回归为跨会话残留。
- 增量回归:
  - `src/components/product/__tests__/ProductExportModal.filters.test.js`
- 对应修复提交: `cc418b0 fix: reset product export and select session state`

### 2026-04-11 轮次 222

- 继续复查商品选择器在销售/管理上下文切换时的缓存边界，新增 1 个中风险问题:
  - `ProductSelect` 打开下拉时只判断“当前是否已有候选项”，不会识别这些候选项属于哪个 `mode/token/statusFilter` 上下文。结果是在销售 token 切换、管理端状态筛选切换后，只要内存里还留着旧列表，下拉就会继续展示上一上下文的商品候选，直到用户手动搜索才会刷新，属于典型的旧数据污染新上下文。[src/components/product/ProductSelect.vue](/home/bjw/Code/KK-Image/src/components/product/ProductSelect.vue)
- 已完成本轮修复:
  - `ProductSelect` 现在按 `mode/token/statusFilter` 维护 `currentContextKey`，上下文变化时会失效旧列表标记。
  - 如果选择器此时正处于打开状态，会立即按新上下文重拉候选，不再把旧 token 或旧筛选下的商品暴露给当前用户。
  - 已补齐“销售 token 切换后即使旧缓存仍在也必须重拉”的回归测试。
- 增量回归:
  - `src/components/product/__tests__/ProductSelect.sales-image.test.js`
- 对应修复提交: `cc418b0 fix: reset product export and select session state`

### 2026-04-11 轮次 223

- 继续复查商品导出链路的“展示条件 vs 实际下载内容”一致性，新增 2 个中风险问题:
  - `ProductExportModal` 在文件生成完成后，如果用户改了 `format` 或 `scope`，旧的 `generatedBlob` 仍保持可下载。界面展示的是新导出条件，但点击下载拿到的仍是旧文件，形成“界面条件已变、下载结果未变”的错配。[src/components/product/ProductExportModal.vue](/home/bjw/Code/KK-Image/src/components/product/ProductExportModal.vue)
  - `ProductExportModal` 在 `scope='filtered'` 场景下，如果父层 `filters` 发生变化，旧导出文件同样不会失效。结果是列表筛选已经切到另一组商品，弹窗里旧下载按钮却还能继续导出上一组筛选结果，业务上属于明显未闭环。[src/components/product/ProductExportModal.vue](/home/bjw/Code/KK-Image/src/components/product/ProductExportModal.vue)
- 已完成本轮修复:
  - 新增 `invalidateReadyDownload()`，在生成结束后只要 `format/scope` 或归一化后的筛选条件发生变化，就立即失效旧下载结果，强制用户基于当前条件重新生成文件。
  - 已补齐“切换格式后旧下载失效”和“filtered 筛选条件变更后旧下载失效”的回归测试，确保导出参数、筛选上下文和实际文件内容保持一致。
- 增量回归:
  - `src/components/product/__tests__/ProductExportModal.filters.test.js`
- 对应修复提交: `cc418b0 fix: reset product export and select session state`

### 2026-04-11 本批次 10 个问题总结

- 本批次从轮次 214 到轮次 223，共新增并闭环 10 个商品及关联链路问题，主题集中在三类:
  - 关闭/切换对象后的旧状态残留: `SpaceCreateModal` 半绑定、`SpaceDetailModal` 跨空间 UI 状态、`ProductWorkflowModal` 跨商品草稿、`ProductExportModal` 导出参数残留。
  - 新上下文被旧异步或旧缓存污染: `ProductImportModal` 旧文件解析回写、`ProductSelect` 复用旧 token/筛选候选、`ProductExportModal` 继续持有与当前条件不一致的旧下载。
  - 失败边界和前后端契约未闭环: 空间绑定缺货策略分叉、`ProductCreateModal` 初始化失败后仍可提交。
- 这 10 个问题均已完成代码修复并补上针对性回归测试，代码提交对应:
  - `a79d90c`
  - `651f5bc`
  - `443c472`
  - `1f05164`
  - `4a1c908`
  - `cc418b0`
- 当前这一批次的审查结论:
  - 商品模块剩余高频风险仍集中在“筛选器/统计组件口径一致性”“导出导入与列表筛选的契约收口”“关联后端路由的错误语义是否与前端一致”。
  - 下一轮继续优先复查 `ProductFilters.vue`、`ProductStats.vue`、`functions/lib/hono/routes/manage/products/export.js` 及其相邻链路。

### 2026-04-11 轮次 224

- 继续复查商品统计弹窗在筛选切换与失败重试时的状态闭环，新增 1 个中风险问题:
  - `ProductStats` 在已有统计结果的情况下发起新一轮刷新，如果最新请求失败，组件会直接 `return`，但不会清空 `statsProducts/statsTotal`。结果是弹窗会继续展示上一轮筛选的总数、预警数和库存总值，形成“刷新失败但界面仍像成功”的旧数据残留。[src/components/product/ProductStats.vue](/home/bjw/Code/KK-Image/src/components/product/ProductStats.vue)
- 已完成本轮修复:
  - `ProductStats` 现在在当前轮次刷新失败时会主动清空统计状态，不再把旧筛选结果伪装成最新统计。
  - 已补齐“最新一次刷新失败后清理旧统计”的回归测试，并回归导出弹窗/商品选择器相关测试，确认本轮改动未带出新的商品上下文问题。
- 增量回归:
  - `src/components/product/__tests__/ProductStats.test.js`
  - `src/components/product/__tests__/ProductExportModal.filters.test.js`
  - `src/components/product/__tests__/ProductSelect.sales-image.test.js`
- 对应修复提交: `dd323d5 fix: clear stale product stats after refresh failure`

### 2026-04-11 轮次 225

- 继续复查商品 PATCH/PUT 服务层契约，新增 1 个中风险问题:
  - `ProductCatalogService.patchProduct()` 只有在 `body.variants` 存在时才会执行 `syncDimensionsFromPayload()`。结果是 `PATCH /api/manage/products/:id` 或 `PUT /api/manage/products/:id` 如果只提交 `dimensions` 而不带 `variants`，后端会直接返回成功，但规格维度根本不会落库，形成典型的假成功契约分叉。[functions/services/ProductCatalogService.js](/home/bjw/Code/KK-Image/functions/services/ProductCatalogService.js)
- 已完成本轮修复:
  - 服务层现在会在收到 `dimensions` 时独立执行规格同步，即使本次 payload 没有 `variants` 也不会再静默丢弃维度变更。
  - 维度独立变更现在也会纳入缓存失效与回滚保护，避免“规格已改但列表/详情仍读旧缓存”或“后续步骤失败后规格半更新”。
  - 已补齐“仅提交 dimensions 也必须真正同步”的服务层回归测试，并回归 import mode 与商品更新审计元数据测试，确认本轮修复没有冲击既有更新链路。
- 增量回归:
  - `functions/services/__tests__/ProductCatalogService.put-boundaries.test.js`
  - `functions/services/__tests__/ProductCatalogService.import-mode.test.js`
  - `functions/lib/hono/routes/manage/products/__tests__/product-update-audit-metadata.test.js`
- 对应修复提交: `7c79bb4 fix: sync product dimensions without variant payload`

### 2026-04-11 轮次 226

- 继续复查商品导入汇总与冲突展示链路，新增 1 个中风险问题:
  - `ProductImportModal.handleImport()` 只在 `result.success === true` 时才合并 `summary/conflicts`。如果后端在 `safe_merge` 场景下返回“整批均为冲突跳过，因此 `success: false`，但同时带有 `summary.conflicts/conflicts`”，前端会把整批直接记成 `chunk.length` 条失败，并丢掉冲突详情，最终把“已识别并安全跳过的冲突”伪装成“导入失败”。[src/components/product/ProductImportModal.vue](/home/bjw/Code/KK-Image/src/components/product/ProductImportModal.vue)
- 已完成本轮修复:
  - 导入汇总现在会先统一吸收后端返回的 `summary/errors/conflicts`，即使该批 `success: false` 也不会丢掉结构化结果。
  - 对“冲突后全部跳过”的批次，前端不再误记为失败，也不再追加 `Unknown error`；冲突计数和冲突详情会正常进入最终结果与 warning toast。
  - 已补齐“整批仅冲突时保留冲突结果”的回归测试，并回归导入预览冲突展示测试，确认该修复没有破坏既有冲突 UI。
- 增量回归:
  - `src/components/product/__tests__/ProductImportModal.variant-first.test.js`
  - `src/components/product/import/__tests__/ImportPreviewStep.test.js`
- 对应修复提交: `c5e9811 fix: preserve conflict-only product import results`

### 2026-04-11 轮次 227

- 继续复查商品库存预警阈值在写入与展示链路中的口径一致性，新增 1 个高风险问题:
  - 商品链路多处把 `alert_threshold` 用 `|| 10` 兜底，包括 `ProductVariantRepository.createBatch()/syncVariants()`、`ProductCatalogService` 回滚载荷，以及 `ProductStats/ProductTable/ProductGrid/ProductDetail/GoodsOverviewRepository`。结果是后端会把合法的 `alert_threshold=0` 写成 `10`，前端和货品总览也会把已持久化的 `0` 误显示成 `10`，导致“关闭库存预警”这一合法业务配置无法真正生效，形成从仓储到展示的系统性契约分叉。[functions/repositories/ProductVariantRepository.js](/home/bjw/Code/KK-Image/functions/repositories/ProductVariantRepository.js) [functions/services/ProductCatalogService.js](/home/bjw/Code/KK-Image/functions/services/ProductCatalogService.js) [src/components/product/ProductStats.vue](/home/bjw/Code/KK-Image/src/components/product/ProductStats.vue) [src/components/product/ProductTable.vue](/home/bjw/Code/KK-Image/src/components/product/ProductTable.vue) [src/components/product/ProductGrid.vue](/home/bjw/Code/KK-Image/src/components/product/ProductGrid.vue) [src/components/product/ProductDetail.vue](/home/bjw/Code/KK-Image/src/components/product/ProductDetail.vue) [functions/repositories/GoodsOverviewRepository.js](/home/bjw/Code/KK-Image/functions/repositories/GoodsOverviewRepository.js)
- 已完成本轮修复:
  - 仓储和服务层现在会保留 `alert_threshold=0`，不再把合法的零阈值静默改写成默认值 `10`。
  - 商品统计、列表、卡片、详情、货品总览和批量建规格默认值处理已改为保留显式 `0`，显示口径与持久化语义重新对齐。
  - 已补齐仓储层和前端回归测试，并回归商品详情、批量建规格、货品总览相关测试，确认零阈值修复没有引入新的库存展示回归。
- 增量回归:
  - `functions/repositories/__tests__/product-variant-upsert-stock.test.js`
  - `functions/repositories/__tests__/GoodsOverviewRepository.variant-level.test.js`
  - `src/components/product/__tests__/ProductGrid.available-stock.test.js`
  - `src/components/product/__tests__/ProductStats.test.js`
  - `src/components/product/__tests__/ProductDetail.associated-spaces.test.js`
  - `src/components/product/__tests__/VariantBatchBuilderModal.test.js`
- 对应修复提交: `ee0f12c fix: preserve zero alert thresholds across product flows`

### 2026-04-11 轮次 228

- 继续复查货品总览视图与仓储层的库存状态口径，新增 1 个中风险问题:
  - [src/views/GoodsOverview.vue](/home/bjw/Code/KK-Image/src/views/GoodsOverview.vue) 的状态徽标在 `shortage = 0` 时，仍用 `stockQuantity < alertThreshold` 判定预警；但仓储层 [functions/repositories/GoodsOverviewRepository.js](/home/bjw/Code/KK-Image/functions/repositories/GoodsOverviewRepository.js) 的缺口 `shortage` 与 `availableQuantity` 都基于可用库存 `available`。结果是当 `on_hand` 充足、但 `available` 因预留占用跌破预警线时，货品总览会把“可用库存告警”错误显示成“库存充足”，形成同一页面内“缺口/可用库存/状态徽标”三套口径不一致。
- 已完成本轮修复:
  - `GoodsOverview` 的 warning 徽标现在改为优先基于 `availableQuantity` 判定，在缺口为 0 但可用库存已低于预警阈值时，会正确展示 `warning`，并在缺少 `availableQuantity` 时回退到 `stockQuantity`。
  - 已补齐视图级回归测试，覆盖“在手库存充足但可用库存不足”必须显示 warning 的场景，阻断再次回归为 success。
- 增量回归:
  - `src/views/__tests__/GoodsOverview.status-semantics.test.js`
  - `src/views/__tests__/GoodsOverview.design-system-migration.test.js`
  - `src/composables/__tests__/useGoodsOverview.test.js`
- 对应修复提交: `7a24da3 fix: align goods overview warning with available stock`

### 2026-04-11 轮次 229

- 继续复查 `GoodsOverview -> PurchaseOrders` 创建链路，新增 1 个高风险问题:
  - [src/views/PurchaseOrders.vue](/home/bjw/Code/KK-Image/src/views/PurchaseOrders.vue) 的 `executeCreate()` 先 `createPO()` 再 `addItems()`，但第二步失败时仍按全成功路径直接关闭弹窗、清空草稿并刷新列表。结果是前端会制造“采购单创建成功”的假闭环，用户丢失已选商品草稿，却不知道后端其实已经留下一个空采购单，属于典型的半成功未收口。
- 已完成本轮修复:
  - 创建空采购单后若初始明细插入失败，页面不再伪装成完整成功；现在会关闭创建弹窗、直接打开新建出的采购单详情，并给出 warning，提示用户继续检查和补齐明细。
  - 新建采购单草稿重置提炼为独立 helper，成功与半成功分支共用，避免后续再出现“某一条分支忘记清理/重复清理”的状态分叉。
- 增量回归:
  - `src/views/__tests__/PurchaseOrders.detail-shell.test.js`
  - `src/views/__tests__/PurchaseOrders.design-system-migration.test.js`
  - `src/composables/__tests__/usePurchaseOrders.test.js`
- 对应修复提交: `d8dfc9f fix: close purchase-order creation gaps`

### 2026-04-11 轮次 230

- 继续复查采购单商品选择器跨搜索确认链路，新增 1 个中风险问题:
  - [src/components/purchase-order/ProductPickerModal.vue](/home/bjw/Code/KK-Image/src/components/purchase-order/ProductPickerModal.vue) 确认时虽然会回传完整 `selectedVariantIds`，但 `selectedVariants` 只从“当前搜索结果列表”里回填。结果是用户先在搜索 A 里勾选一个新变体，再切到搜索 B 勾选另一个变体后确认，前一轮搜索里选中的新变体会因为不在当前列表中而从 `selectedVariants` 静默丢失，导致采购单新增明细少行。[src/views/PurchaseOrders.vue](/home/bjw/Code/KK-Image/src/views/PurchaseOrders.vue) [src/utils/purchase-order-variant-selection.js](/home/bjw/Code/KK-Image/src/utils/purchase-order-variant-selection.js)
- 已完成本轮修复:
  - `ProductPickerModal` 现在会为已选变体维护跨搜索会话快照；确认时会优先用快照回填 `selectedVariants`，从而保证跨搜索新增的变体不会再被静默丢掉。
  - 已补齐“跨搜索选中多个变体后确认仍保留完整 payload”的回归测试，并回归采购单选择器设计契约与变体选择协调逻辑。
- 增量回归:
  - `src/components/purchase-order/__tests__/ProductPickerModal.lifecycle.test.js`
  - `src/components/purchase-order/__tests__/PickerModals.design-system.test.js`
  - `src/utils/__tests__/purchase-order-variant-selection.test.js`
- 对应修复提交: `d8dfc9f fix: close purchase-order creation gaps`

### 2026-04-11 轮次 231

- 继续复查采购单订单选择器跨搜索多批次勾选链路，新增 1 个中风险问题:
  - [src/components/purchase-order/OrderPickerModal.vue](/home/bjw/Code/KK-Image/src/components/purchase-order/OrderPickerModal.vue) 的“全选当前结果”逻辑只比较 `selected.length` 和 `filteredOrders.length`，并在选中时直接用 `filteredOrders` 覆盖整个 `selected`。结果是在用户先选了一批订单、再切换搜索词选择另一批订单时，只要“已选总数”恰好等于“当前过滤结果数”，全选会误判成“当前结果已全选”并直接清空；即使不触发清空，也会把当前搜索之外的已选订单静默覆盖掉，形成跨搜索选中集丢失。
- 已完成本轮修复:
  - `OrderPickerModal` 现在按“当前过滤结果中已选数量”计算全选/半选状态，不再用全局已选数误判当前搜索页状态。
  - 全选当前结果时会与既有选中集做并集，取消全选时只移除当前过滤结果里的订单，不再误伤其它搜索批次已选订单。
  - 已补齐“缩小搜索范围后全选仍保留先前已选订单”的回归测试。
- 增量回归:
  - `src/components/purchase-order/__tests__/OrderPickerModal.detail-workflow.test.js`
- 对应修复提交: `ad7c26f fix: preserve purchase-order selection sessions`

### 2026-04-11 轮次 232

- 继续复查采购建议弹窗的会话边界，新增 1 个中风险问题:
  - [src/views/PurchaseOrders.vue](/home/bjw/Code/KK-Image/src/views/PurchaseOrders.vue) 打开 `showSuggestions` 时只刷新建议数据，不重置 `selectedSuggestions`。结果是用户上一轮在建议弹窗里勾选过若干补货建议后，即使关闭弹窗、等待建议集变化再重开，旧勾选仍会残留在新会话里；如果直接点“添加选中”，页面会继续拿上一轮的旧对象建单，形成典型的跨会话脏状态。
- 已完成本轮修复:
  - 建议弹窗现在在打开和关闭时都会重置 `selectedSuggestions`，确保每次进入都是一轮干净会话，不再把旧勾选带入新建议列表。
  - 已补齐“重开建议弹窗时清空旧勾选”的回归测试，并回归采购单详情壳、组合式和双选择器测试，确认本轮改动未带出新的采购流回归。
- 增量回归:
  - `src/views/__tests__/PurchaseOrders.detail-shell.test.js`
  - `src/views/__tests__/PurchaseOrders.design-system-migration.test.js`
  - `src/composables/__tests__/usePurchaseOrders.test.js`
  - `src/components/purchase-order/__tests__/OrderPickerModal.detail-workflow.test.js`
  - `src/components/purchase-order/__tests__/ProductPickerModal.lifecycle.test.js`
  - `src/components/purchase-order/__tests__/PickerModals.design-system.test.js`
  - `src/utils/__tests__/purchase-order-variant-selection.test.js`
- 对应修复提交: `ad7c26f fix: preserve purchase-order selection sessions`

### 2026-04-11 轮次 233

- 继续复查采购建议刷新失败边界，新增 1 个中风险问题:
  - [src/composables/usePurchaseOrders.js](/home/bjw/Code/KK-Image/src/composables/usePurchaseOrders.js) 的 `loadSuggestions()` 在上一轮成功、下一轮刷新失败时不会清空 `suggestions`。结果是建议弹窗会继续展示上一轮旧补货建议，看起来像本轮刷新成功，属于典型的“失败后旧数据残留”。
- 已完成本轮修复:
  - `loadSuggestions()` 现在在当前轮次请求失败或返回 `success=false` 时会清空旧建议，确保建议弹窗不会再把上一轮结果伪装成最新数据。
  - 已补齐“最新一次建议刷新失败后清理旧建议”的组合式回归测试，并回归采购单详情壳、设计契约与双选择器测试，确认本轮修复没有破坏采购链路的其它会话边界。
- 增量回归:
  - `src/composables/__tests__/usePurchaseOrders.test.js`
  - `src/views/__tests__/PurchaseOrders.detail-shell.test.js`
  - `src/views/__tests__/PurchaseOrders.design-system-migration.test.js`
  - `src/components/purchase-order/__tests__/OrderPickerModal.detail-workflow.test.js`
  - `src/components/purchase-order/__tests__/ProductPickerModal.lifecycle.test.js`
  - `src/components/purchase-order/__tests__/PickerModals.design-system.test.js`
  - `src/utils/__tests__/purchase-order-variant-selection.test.js`
- 对应修复提交: `94d9fd5 fix: clear stale purchase suggestions after refresh failure`

### 2026-04-11 轮次 234

- 继续复查采购建议建单后端闭环，新增 1 个高风险问题:
  - [functions/services/PurchaseOrderService.js](/home/bjw/Code/KK-Image/functions/services/PurchaseOrderService.js) 的 `createFromOrders()` 先 `repo.create()` 再 `repo.addItems()`，但第二步失败时没有任何补偿清理。结果是 `/api/manage/purchase-orders/from-orders` 在明细插入失败时会留下一个空的草稿采购单，形成服务层级别的半成功脏数据。
- 已完成本轮修复:
  - `createFromOrders()` 现在在明细插入失败时会调用仓储层的“仅删除空草稿采购单”补偿逻辑，避免把半成品采购单遗留在系统里。
  - 已为仓储层新增 `deleteIfEmptyDraft()` 安全删除 helper，只会删除“仍为空且状态还是 draft”的采购单，避免误删已被后续流程接管的记录。
- 增量回归:
  - `functions/services/__tests__/PurchaseOrderService.variant-dimension.test.js`
  - `functions/repositories/__tests__/purchase-order-repository-safety.test.js`
- 对应修复提交: `a18801b fix: clean up empty purchase-order drafts on write failure`

### 2026-04-11 轮次 235

- 继续复查管理端手工建采购单入口，新增 1 个高风险问题:
  - [functions/lib/hono/routes/manage/purchase-orders.js](/home/bjw/Code/KK-Image/functions/lib/hono/routes/manage/purchase-orders.js) 的 `POST /api/manage/purchase-orders` 同样先创建主表再插入明细；如果 `repo.addItems()` 抛错，路由会直接返回 500，但已创建的空采购单不会清理，和服务层问题一样会把半成功结果落库。
- 已完成本轮修复:
  - 路由层现在在手工建单的明细插入失败时，同样调用“仅删除空草稿采购单”的补偿逻辑，再把错误向上抛出；因此不会再在报错后遗留空采购单。
  - 已补齐路由回归测试，覆盖“建单失败时必须清理已创建草稿且不得发布创建事件”的场景。
- 增量回归:
  - `functions/lib/hono/routes/manage/__tests__/purchase-orders-routes.test.js`
  - `functions/services/__tests__/PurchaseOrderService.variant-dimension.test.js`
  - `functions/repositories/__tests__/purchase-order-repository-safety.test.js`
- 对应修复提交: `a18801b fix: clean up empty purchase-order drafts on write failure`

### 2026-04-11 轮次 236

- 继续复查采购建议建单输入去重边界，新增 1 个中风险问题:
  - [functions/services/PurchaseOrderService.js](/home/bjw/Code/KK-Image/functions/services/PurchaseOrderService.js) 的 `createFromOrders()` 会原样吃入 `orderIds`。当前端从多个建议项 `flatMap(order_ids)` 时，同一订单可能重复出现在 payload 中；服务层未去重，跨 chunk 查询时会把同一订单查回多次，并重复生成采购单明细，形成重复采购。
- 已完成本轮修复:
  - `createFromOrders()` 现在会先对输入 `orderIds` 做去重，再进入分 chunk 查询和建单流程，阻断重复订单被重复落单。
  - 已补齐“重复 `order_id` 只允许生成一条采购单明细”的服务层回归测试。
- 增量回归:
  - `functions/services/__tests__/PurchaseOrderService.variant-dimension.test.js`
- 对应修复提交: `fa3f939 fix: tighten purchase-order from-orders input contract`

### 2026-04-11 轮次 237

- 继续复查采购建议建单完整性校验，新增 1 个高风险问题:
  - [functions/services/PurchaseOrderService.js](/home/bjw/Code/KK-Image/functions/services/PurchaseOrderService.js) 目前只要查回了“部分”可采购订单，就会继续创建采购单；如果用户选中的某些订单在点击建单前已变成非 `confirmed`、失去绑定或变体失效，服务层会静默跳过这些订单并按剩余子集建单，形成危险的部分成功。
- 已完成本轮修复:
  - `createFromOrders()` 现在要求“可采购命中集”和请求集完全一致”；若有任一订单已不存在或已不再可采购，会直接拒绝整次建单，并明确返回缺失订单 ID 列表。
  - 已补齐“部分订单失效时必须整体拒绝”的服务层回归测试，并回归仓储安全删除和采购单路由测试，确认本轮输入契约收紧没有破坏既有创建闭环。
- 增量回归:
  - `functions/services/__tests__/PurchaseOrderService.variant-dimension.test.js`
  - `functions/repositories/__tests__/purchase-order-repository-safety.test.js`
  - `functions/lib/hono/routes/manage/__tests__/purchase-orders-routes.test.js`
- 对应修复提交: `fa3f939 fix: tighten purchase-order from-orders input contract`

### 2026-04-11 轮次 238

- 继续复查 `from-orders` 前端请求口径，新增 1 个中风险问题:
  - [src/composables/usePurchaseOrders.js](/home/bjw/Code/KK-Image/src/composables/usePurchaseOrders.js) 的 `createFromOrders()` 会把传入的 `orderIds` 原样发给 `/api/manage/purchase-orders/from-orders`。即使服务层已做去重，前端请求体、路由 outbox payload 和审计 metadata 仍会保留重复 `order_id`，导致“实际只建一单，但日志/事件里重复记多次同一订单”的口径分叉。
- 已完成本轮修复:
  - `usePurchaseOrders.createFromOrders()` 现在会在发请求前先去重 `orderIds`，让前端请求体和后端实际建单口径保持一致，也减少重复 payload 噪音。
  - 已补齐“create-from-orders 请求必须先去重重复订单 ID”的组合式回归测试，并回归 `from-orders` 服务/仓储/路由相关测试。
- 增量回归:
  - `src/composables/__tests__/usePurchaseOrders.test.js`
  - `functions/services/__tests__/PurchaseOrderService.variant-dimension.test.js`
  - `functions/repositories/__tests__/purchase-order-repository-safety.test.js`
  - `functions/lib/hono/routes/manage/__tests__/purchase-orders-routes.test.js`
- 对应修复提交: `a70131e fix: dedupe purchase-order from-orders requests`

### 2026-04-11 轮次 239

- 继续复查采购建议来源和建议建单入口的字段契约，新增 1 个高风险问题:
  - [functions/services/DemandService.js](/home/bjw/Code/KK-Image/functions/services/DemandService.js) 的 `getDemandSummaryByVariant()` 会把 `confirmed`、`production`、`shipping`、`arrived` 全部活跃订单都聚合进 `order_count` 和 `order_ids`。但 [functions/services/PurchaseOrderService.js](/home/bjw/Code/KK-Image/functions/services/PurchaseOrderService.js) 的 `createFromOrders()` 只接受 `confirmed` 订单，因此采购建议列表会把已进入生产/发货/到货阶段的订单也暴露给“按建议建单”，用户点击后会天然撞上后端拒绝，形成“建议来源口径”和“可建单口径”分叉。
- 已完成本轮修复:
  - `DemandService.getDemandSummaryByVariant()` 现在保持 `total_demand` 继续基于全部活跃状态计算真实需求缺口，但 `order_count` 和 `order_ids` 改为仅统计 `confirmed` 订单，让采购建议里携带的订单集合与 `createFromOrders()` 的输入契约重新对齐。
  - 已补齐需求聚合回归测试，明确锁定 SQL 必须使用 `CASE WHEN o.status = 'confirmed' THEN o.id END` 来隔离建议建单入口可消费的订单集合。
- 增量回归:
  - `functions/services/__tests__/DemandService.test.js`
  - `functions/services/__tests__/purchase-suggestions-inventory-semantics.test.js`
  - `functions/services/__tests__/PurchaseOrderService.variant-dimension.test.js`
  - `functions/lib/hono/routes/manage/__tests__/purchase-orders-routes.test.js`
  - `src/composables/__tests__/usePurchaseOrders.test.js`
- 对应修复提交: `c02b978 fix: align purchase suggestion order ids with confirmed demand`

### 2026-04-11 轮次 240

- 继续复查 `from-orders` 路由层的出站口径，新增 1 个中风险问题:
  - [functions/lib/hono/routes/manage/purchase-orders.js](/home/bjw/Code/KK-Image/functions/lib/hono/routes/manage/purchase-orders.js) 虽然调用的 [functions/services/PurchaseOrderService.js](/home/bjw/Code/KK-Image/functions/services/PurchaseOrderService.js) 已在服务层去重 `orderIds`，但路由本身仍原样把 `body.order_ids` 传给服务、outbox payload 和审计 metadata。结果是外部直接调用 API 时，即使实际只会按去重后的订单建单，事件和审计仍可能记录重复/空值订单 ID，形成“实际行为”和“出站日志”继续分叉。
- 已完成本轮修复:
  - `/api/manage/purchase-orders/from-orders` 现在会在入口就统一过滤空值并去重 `order_ids`，随后服务调用、outbox payload 和审计 metadata 全部复用这一份标准化结果。
  - 已补齐路由回归测试，锁定“重复或空订单 ID 不得流入服务层、事件 payload 或审计 metadata”的契约。
- 增量回归:
  - `functions/lib/hono/routes/manage/__tests__/purchase-orders-routes.test.js`
  - `functions/services/__tests__/PurchaseOrderService.variant-dimension.test.js`
  - `src/composables/__tests__/usePurchaseOrders.test.js`
- 对应修复提交: `d553077 fix: normalize create-from-orders route payloads`

### 2026-04-11 轮次 241

- 继续复查采购建议弹窗的操作闭环，新增 1 个中风险问题:
  - [src/views/PurchaseOrders.vue](/home/bjw/Code/KK-Image/src/views/PurchaseOrders.vue) 在采购建议继续展示“有缺口但没有任何 `confirmed` 订单可绑定”的建议项后，`handleCreateFromSuggestions()` 仍只会把所有 `order_ids` 平铺后直接提交；当用户选中的建议全都没有可绑定订单时，方法会静默 `return`，页面没有任何反馈，形成“可点击但无结果”的假操作面。
- 已完成本轮修复:
  - 建议弹窗现在按“可绑定订单数”而不是“勾选行数”决定提交按钮是否可用，并把无可绑定订单的建议项直接标记为不可选，避免用户选中无法建单的建议。
  - `handleCreateFromSuggestions()` 额外补了 warning 兜底；即使脏状态绕过 UI 限制，点击后也会明确提示“所选建议暂无可绑定订单”，不再静默吞掉操作。
  - 已补齐详情壳回归测试，锁定“无可绑定订单时必须提示而不是无声返回”的行为。
- 增量回归:
  - `src/views/__tests__/PurchaseOrders.detail-shell.test.js`
  - `functions/services/__tests__/DemandService.test.js`
  - `functions/services/__tests__/purchase-suggestions-inventory-semantics.test.js`
  - `functions/services/__tests__/PurchaseOrderService.variant-dimension.test.js`
  - `functions/lib/hono/routes/manage/__tests__/purchase-orders-routes.test.js`
  - `src/composables/__tests__/usePurchaseOrders.test.js`
- 对应修复提交: `e04f9d7 fix: close empty purchase-suggestion selection no-op`

### 2026-04-11 轮次 242

- 继续复查 AI 建单入口与采购单主链路的一致性，新增 1 个高风险问题:
  - [functions/ai/action-submitters.js](/home/bjw/Code/KK-Image/functions/ai/action-submitters.js) 的 `create_purchase_order()` 在 `manual` 模式下虽然允许适配器传入 `items`，但实际只调用了 [functions/repositories/PurchaseOrderRepository.js](/home/bjw/Code/KK-Image/functions/repositories/PurchaseOrderRepository.js) 的 `create()` 建空主表，既不会插入采购单明细，也没有在后续失败时清理空草稿。结果是 AI 会返回“创建成功”，但实际只留下一个没有明细的 draft 采购单，属于 AI 入口独有的假成功。
- 已完成本轮修复:
  - AI `manual` 建单现在会在创建主表后继续调用 `addItems()` 落明细，确保 AI 手工建单和管理端手工建单具备同样的业务闭环。
  - 如果 AI 明细插入失败，submitter 会补偿调用 `deleteIfEmptyDraft()` 清理仍为空的 draft，避免 AI 链路遗留半成品采购单。
  - 已补齐 AI submitter 回归测试，覆盖“手工建单必须写入明细”和“明细失败必须清理空草稿”的场景。
- 增量回归:
  - `functions/ai/__tests__/action-submitters.test.js`
  - `functions/ai/__tests__/action-orchestrator.test.js`
  - `functions/lib/hono/routes/manage/__tests__/ai-routes.test.js`
- 对应修复提交: `423b073 fix: close ai manual purchase-order creation gaps`

### 2026-04-11 轮次 243

- 继续复查商品-库存-采购端到端回归的有效性，新增 1 个中风险问题:
  - [functions/services/__tests__/InventoryBusinessWorkflow.test.js](/home/bjw/Code/KK-Image/functions/services/__tests__/InventoryBusinessWorkflow.test.js) 的内置 `WorkflowDb` 仍在按旧 SQL 片段匹配 `DemandService` 和 `GoodsOverviewRepository` 查询。随着需求聚合改为 `order_lines` 粒度、且 `order_ids/order_count` 改为仅统计 `confirmed` 订单，这个大测已经实际跑不到采购建议和商品总览分支，形成“测试文件仍在，但关键 stub 已失效”的假覆盖。
- 已完成本轮修复:
  - `WorkflowDb` 现在按当前真实 SQL 契约匹配 `DemandService` 与 `GoodsOverviewRepository` 的查询分支，并让 `total_demand` 继续覆盖全部 active 状态、`order_count/order_ids` 只覆盖 `confirmed` 状态，和线上实现重新对齐。
  - 已重新跑通库存-需求-采购业务流大测，恢复这条商品核心链路的端到端保护。
- 增量回归:
  - `functions/services/__tests__/InventoryBusinessWorkflow.test.js`
  - `functions/services/__tests__/DemandService.test.js`
  - `functions/services/__tests__/purchase-suggestions-inventory-semantics.test.js`
  - `functions/services/__tests__/PurchaseOrderService.variant-dimension.test.js`
  - `functions/lib/hono/routes/manage/__tests__/purchase-orders-routes.test.js`
  - `src/composables/__tests__/usePurchaseOrders.test.js`
  - `src/views/__tests__/PurchaseOrders.detail-shell.test.js`
  - `functions/ai/__tests__/action-submitters.test.js`
  - `functions/ai/__tests__/action-orchestrator.test.js`
  - `functions/lib/hono/routes/manage/__tests__/ai-routes.test.js`
- 对应修复提交: `66b6d48 test: realign inventory workflow demand projections`

### 2026-04-11 轮次 244

- 继续复查 AI 商品/采购语义识别入口，新增 1 个高风险问题:
  - [functions/ai/canonicalization.js](/home/bjw/Code/KK-Image/functions/ai/canonicalization.js) 的 `detectCreateIntent()` 按 `ENTITY_CREATE_MAP` 顺序做首次命中，`order` 比 `purchase_order` 更早出现；而“采购单/备货单/补货单”本身又包含“订单”字样。结果是用户说“创建采购单”时，AI 很可能先命中 `create_order`，把采购单意图误路由成预订单创建，属于上游入口级别的实体识别错误。
- 已完成本轮修复:
  - `detectCreateIntent()` 现在会在所有命中的创建实体别名里优先选择“更长、更具体”的别名，不再因为先扫到“订单”而吞掉“采购单”意图。
  - 已补齐规范化回归测试，明确锁定“创建采购单”必须映射到 `create_purchase_order`。
- 增量回归:
  - `functions/ai/__tests__/canonicalization.test.js`
  - `functions/ai/__tests__/action-orchestrator.test.js`
  - `functions/ai/__tests__/action-submitters.test.js`
  - `functions/lib/hono/routes/manage/__tests__/ai-routes.test.js`
- 对应修复提交: `63fbaa0 fix: prefer purchase-order ai intents over generic orders`

### 2026-04-11 轮次 245

- 继续复查 AI 采购单动作的输入契约，新增 1 个高风险问题:
  - [functions/ai/adapters/purchase-order.js](/home/bjw/Code/KK-Image/functions/ai/adapters/purchase-order.js) 和 [functions/ai/action-orchestrator.js](/home/bjw/Code/KK-Image/functions/ai/action-orchestrator.js) 之前只把 `mode` 当成采购单动作的静态必填字段，导致 `manual` 模式没有 `items`、`from_orders` 模式没有 `order_ids` 时也能直接进入预览甚至提交；再叠加 [functions/ai/action-submitters.js](/home/bjw/Code/KK-Image/functions/ai/action-submitters.js) 缺少空输入兜底，就会形成 AI 空采购单或提交时报错的弱边界。
- 已完成本轮修复:
  - 采购单适配器现在会按 `mode` 动态声明必填槽位：`manual` 必须有 `items`，`from_orders` 必须有 `order_ids`；编排器也已改为按适配器动态计算缺失字段，保证预览前就把缺失输入拦住。
  - `action-submitters` 额外补了提交层兜底：`manual` 没有明细、`from_orders` 没有订单 ID 时会直接拒绝，而不是继续创建或依赖下游报错。
  - 已补齐 AI 编排器和 submitter 回归测试，覆盖“采购单模式化必填字段必须在预览前收齐”和“提交层也要拒绝空输入”的场景。
- 增量回归:
  - `functions/ai/__tests__/action-orchestrator.test.js`
  - `functions/ai/__tests__/action-submitters.test.js`
  - `functions/ai/__tests__/canonicalization.test.js`
  - `functions/lib/hono/routes/manage/__tests__/ai-routes.test.js`
  - `functions/services/__tests__/InventoryBusinessWorkflow.test.js`
- 对应修复提交: `05e61b5 fix: enforce ai purchase-order action requirements`

### 2026-04-11 轮次 246

- 继续复查 AI 手工采购项解析闭环，新增 1 个高风险问题:
  - [functions/ai/slot-resolvers.js](/home/bjw/Code/KK-Image/functions/ai/slot-resolvers.js) 的 `resolvePurchaseOrderItemsSlot()` 在变体搜索未唯一命中时会把原始 `variant_query` 条目原样返回；而此前 [functions/ai/adapters/purchase-order.js](/home/bjw/Code/KK-Image/functions/ai/adapters/purchase-order.js)、[functions/ai/action-orchestrator.js](/home/bjw/Code/KK-Image/functions/ai/action-orchestrator.js) 与 [functions/ai/action-submitters.js](/home/bjw/Code/KK-Image/functions/ai/action-submitters.js) 又没有校验这些条目是否真的已经解析出 `product_id/variant_id`。结果是 AI 可以对“未解析完成的采购明细”直接进入预览甚至提交，最后在仓储层因为 `variant_id is required` 才爆炸，形成延迟失败。
- 已完成本轮修复:
  - 采购单适配器现在会把“手工采购项是否都已解析到具体 `product_id/variant_id`”纳入缺失槽位判断；只要还有未解析条目，就继续停留在收集态，不再提前进入预览。
  - `action-submitters` 也补了提交层兜底：只要任一手工采购项还没有解析出 `product_id/variant_id`，就会直接拒绝提交，不再等到仓储层抛底层字段错误。
  - 已补齐 AI 编排器和 submitter 回归测试，锁定“未解析采购明细不得预览，也不得提交”的行为。
- 增量回归:
  - `functions/ai/__tests__/action-orchestrator.test.js`
  - `functions/ai/__tests__/action-submitters.test.js`
  - `functions/ai/__tests__/canonicalization.test.js`
  - `functions/lib/hono/routes/manage/__tests__/ai-routes.test.js`
  - `functions/services/__tests__/InventoryBusinessWorkflow.test.js`
  - `functions/services/__tests__/DemandService.test.js`
  - `functions/services/__tests__/purchase-suggestions-inventory-semantics.test.js`
- 对应修复提交: `fbdfdd8 fix: require resolved ai purchase-order items`

### 2026-04-11 轮次 247

- 继续复查 AI 采购单收集态的跟进回复链路，新增 1 个中风险问题:
  - [functions/ai/slot-extraction.js](/home/bjw/Code/KK-Image/functions/ai/slot-extraction.js) 之前只有在文本里显式出现“采购单/备货单/补货单”时才会进入 `manual` 明细解析。结果是 AI 会话已经进入“继续补充采购明细”的收集态后，如果用户只回复“跑鞋 黑色 42 补货 20件 单价60”这类纯明细文本，系统既提不出 `items`，又会把整段文本错误地塞回 `items` 原始值路径，导致会话卡死在收集态。
- 已完成本轮修复:
  - `extractPurchaseOrderSlots()` 现在只要检测到手工采购项样式的文本，就会自动推断成 `manual` 模式并抽取 `items`，即使用户没有重复输入“采购单”也能继续推进会话。
  - 已补齐 slot extraction 与 orchestrator 回归测试，锁定“采购单收集态下的纯明细跟进回复必须能直接进入预览”的行为。
- 增量回归:
  - `functions/ai/__tests__/slot-extraction.test.js`
  - `functions/ai/__tests__/action-orchestrator.test.js`
  - `functions/ai/__tests__/canonicalization.test.js`
  - `functions/ai/__tests__/action-submitters.test.js`
  - `functions/lib/hono/routes/manage/__tests__/ai-routes.test.js`
- 对应修复提交: `0655c13 fix: infer ai purchase-order items from follow-up text`

### 2026-04-11 轮次 248

- 继续复查 AI 采购单多条明细的跟进合并逻辑，新增 1 个高风险问题:
  - [functions/ai/action-orchestrator.js](/home/bjw/Code/KK-Image/functions/ai/action-orchestrator.js) 在 `collecting` 阶段用浅合并把新提取的 `items` 直接覆盖旧 `items`。结果是当 AI 已经解析出一条手工采购明细、用户再补充第二条明细时，后续回复会把前面已解析成功的行整体覆盖掉，形成典型的“补一条丢一条”。
- 已完成本轮修复:
  - 采购单 `collecting` 合并逻辑现在会保留已有的已解析明细，再拼接本轮新提取的手工采购项，不再因为后续补充而把前面已经解析成功的行覆盖掉。
  - 已补齐编排器回归测试，锁定“补充第二条采购项时必须保留第一条已解析明细”的行为。
- 增量回归:
  - `functions/ai/__tests__/action-orchestrator.test.js`
  - `functions/ai/__tests__/slot-extraction.test.js`
  - `functions/ai/__tests__/canonicalization.test.js`
  - `functions/ai/__tests__/action-submitters.test.js`
  - `functions/lib/hono/routes/manage/__tests__/ai-routes.test.js`
- 对应修复提交: `e438a44 fix: preserve resolved ai purchase-order items during follow-up`

### 2026-04-11 轮次 249

- 继续复查 AI 手工采购项的歧义消解链路，新增 1 个高风险问题:
  - [functions/ai/slot-resolvers.js](/home/bjw/Code/KK-Image/functions/ai/slot-resolvers.js) 之前在单条手工采购项命中多个变体时只会把原始 `variant_query` 原样返回，既不产出候选，也无法让用户通过数字选择继续；会话只能反复停留在“还缺采购明细”的收集态，形成不可解的歧义死循环。
- 已完成本轮修复:
  - `resolvePurchaseOrderItemsSlot()` 现在对“单条手工采购项命中多个候选变体”的场景直接返回候选列表，每个候选都携带完整的已解析采购项 payload，便于后续一次性选中继续。
  - 编排器链路已补齐回归测试，确认 AI 会对这类歧义采购项返回候选，并允许用户用数字选择具体变体后直接进入预览。
- 增量回归:
  - `functions/ai/__tests__/slot-resolvers.test.js`
  - `functions/ai/__tests__/action-orchestrator.test.js`
  - `functions/ai/__tests__/slot-extraction.test.js`
  - `functions/ai/__tests__/canonicalization.test.js`
  - `functions/ai/__tests__/action-submitters.test.js`
  - `functions/lib/hono/routes/manage/__tests__/ai-routes.test.js`
- 对应修复提交: `bcc99dc fix: support ai purchase-order item disambiguation`

### 2026-04-12 轮次 250

- 继续复查 AI 多条手工采购项的混合歧义场景，新增 1 个高风险问题:
  - [functions/ai/slot-resolvers.js](/home/bjw/Code/KK-Image/functions/ai/slot-resolvers.js) 在“多条采购明细里只有其中一条命中多个候选变体”的场景下，之前只会解析前面唯一命中的行，然后把歧义行原样保留；既不会产出候选，也不会把已解析行一起带入后续选择，导致多条明细场景再次退化成无候选的卡死态。
- 已完成本轮修复:
  - `resolvePurchaseOrderItemsSlot()` 现在在遇到第一条歧义采购项时，会基于“前面已解析行 + 当前歧义行的每个候选 + 后续未处理行”生成候选 value，保证混合场景下也能继续通过候选选择推进。
  - 已补齐 resolver 与 orchestrator 回归测试，锁定“多条明细里单条歧义时，候选必须保留已解析行并允许继续选择”的行为。
- 增量回归:
  - `functions/ai/__tests__/slot-resolvers.test.js`
  - `functions/ai/__tests__/action-orchestrator.test.js`
  - `functions/ai/__tests__/slot-extraction.test.js`
  - `functions/ai/__tests__/canonicalization.test.js`
  - `functions/ai/__tests__/action-submitters.test.js`
  - `functions/lib/hono/routes/manage/__tests__/ai-routes.test.js`
- 对应修复提交: `cb00689 fix: support mixed ai purchase-order item candidates`

### 2026-04-12 轮次 251

- 继续复查 AI 多条手工采购项的连续歧义恢复链路，新增 1 个高风险问题:
  - [functions/ai/action-orchestrator.js](/home/bjw/Code/KK-Image/functions/ai/action-orchestrator.js) 在 `collecting` 阶段会先用 `#applyCandidateChoiceFromText()` 把用户输入的数字候选选择写回 `items`，但如果后面仍有未解歧义项，紧接着又会把原始文本 `"2"` 再次当成 `items` 原始值喂给 `#resolveSlotValue()`。结果是第一条已经选中的候选 value 会被数字文本覆盖掉，第二条歧义项的候选链路随即丢失，连续选择场景无法闭环。
- 已完成本轮修复:
  - `#resumeSession()` 现在只会在目标槽位仍然为空时，才把当前回复文本当作 fallback 原始值继续解析；如果候选数字已经成功写入 `items`，就直接进入后续 resolver 流程，不再二次覆盖。
  - 已补齐编排器回归测试，锁定“多条歧义采购项中先选择第一条候选后，系统仍要继续给出后续歧义项候选”的行为。
- 增量回归:
  - `functions/ai/__tests__/action-orchestrator.test.js`
  - `functions/ai/__tests__/slot-resolvers.test.js`
  - `functions/ai/__tests__/slot-extraction.test.js`
  - `functions/ai/__tests__/canonicalization.test.js`
  - `functions/ai/__tests__/action-submitters.test.js`
  - `functions/lib/hono/routes/manage/__tests__/ai-routes.test.js`
- 对应修复提交: `c20161c fix: preserve chained ai purchase-order candidates`

### 2026-04-12 轮次 252

- 继续复查 AI 手工采购单提交闭环，新增 1 个高风险问题:
  - [functions/ai/action-submitters.js](/home/bjw/Code/KK-Image/functions/ai/action-submitters.js) 之前在 `manual` 模式下直接调用 `purchaseOrderRepo.create/addItems`，只检查 `product_id/variant_id` 是否存在，却绕过了管理端 [functions/lib/hono/routes/manage/purchase-orders.js](/home/bjw/Code/KK-Image/functions/lib/hono/routes/manage/purchase-orders.js) 上的 `validateVariantItems` / `validatePreOrderBinding`。结果是 AI 链路可能写入 `variant_id` 与 `product_id` 不匹配、数量不满足 MOQ/步长/箱规、甚至 `pre_order_id` 非法绑定的脏采购明细，和人工入口的业务边界不一致。
- 已完成本轮修复:
  - `PurchaseOrderService` 新增 `createManual()`，把手工采购单创建统一收口到服务层，并在建单前复用共享的采购明细校验。
  - 新增共享校验模块 `purchase-order-item-validation.js`，把“变体归属/状态/数量约束”和“预订单绑定合法性”抽成可复用 helper，AI submitter 与采购单路由现在都走同一套规则，不再分叉。
  - `action-submitters` 现在在可用时优先调用 `purchaseOrderService.createManual()`，AI 手工采购单不再绕过服务层校验；并补齐 submitter 与 service 红绿测试，锁定这条边界。
- 增量回归:
  - `functions/ai/__tests__/action-submitters.test.js`
  - `functions/ai/__tests__/action-orchestrator.test.js`
  - `functions/lib/hono/routes/manage/__tests__/ai-routes.test.js`
  - `functions/lib/hono/routes/manage/__tests__/purchase-orders-routes.test.js`
  - `functions/services/__tests__/PurchaseOrderService.variant-dimension.test.js`
- 对应修复提交: `36a54e8 fix: validate ai manual purchase-order items`

### 2026-04-12 轮次 253

- 继续复查采购单成本链路的输入边界，新增 1 个高风险问题:
  - [functions/services/purchase-order-item-validation.js](/home/bjw/Code/KK-Image/functions/services/purchase-order-item-validation.js) 修复前并没有约束采购明细 `unit_cost`；[functions/lib/hono/routes/manage/purchase-orders.js](/home/bjw/Code/KK-Image/functions/lib/hono/routes/manage/purchase-orders.js) 的建单、加明细、改明细入口也都允许负单价穿透。结果是负 `unit_cost` 可以直接写入采购单，后续在 [functions/services/PurchaseOrderService.js](/home/bjw/Code/KK-Image/functions/services/PurchaseOrderService.js) 做 landed cost 分摊和移动平均成本更新时会把成本口径拉成负值，属于典型的财务语义脏数据入口。
- 已完成本轮修复:
  - 共享采购明细校验模块现在新增 `unit_cost` 非负校验，手工建采购单、采购单加明细、AI 手工采购单入口会统一拒绝负单价。
  - 采购单明细 `PATCH` 路由也补了同样的非负校验，避免先合法建单、后通过更新把负单价写回去。
  - 已补齐服务层与路由层回归测试，锁定“负采购单价不得创建，也不得更新”的行为。
- 增量回归:
  - `functions/ai/__tests__/action-submitters.test.js`
  - `functions/lib/hono/routes/manage/__tests__/ai-routes.test.js`
  - `functions/lib/hono/routes/manage/__tests__/purchase-orders-routes.test.js`
  - `functions/services/__tests__/PurchaseOrderService.variant-dimension.test.js`
- 对应修复提交: `879e2a6 fix: reject negative purchase-order unit costs`

### 2026-04-12 轮次 254

- 继续复查预订单绑定采购链路，新增 1 个高风险问题:
  - [functions/services/purchase-order-item-validation.js](/home/bjw/Code/KK-Image/functions/services/purchase-order-item-validation.js) 修复前对 `pre_order_id` 只校验“订单存在、状态 confirmed、商品/变体一致”，却没有校验采购明细数量是否与被绑定订单一致。结果是人工加明细或 AI 手工建采购单时，可以把只需 `1` 件的预订单绑成 `10` 件采购；而 [functions/lib/hono/routes/manage/purchase-orders.js](/home/bjw/Code/KK-Image/functions/lib/hono/routes/manage/purchase-orders.js) 的明细 `PATCH quantity` 也能把已绑定数量继续改坏，直接破坏 `pre_order_id` 的一一对应语义。
- 已完成本轮修复:
  - 共享 `pre_order` 绑定校验现在会强制比较订单数量与采购明细数量，创建阶段不再允许“绑定同一订单但采购数量不同”的脏数据进入采购单。
  - 采购单明细 `PATCH quantity` 路由也补了同样的数量一致性校验；只有在绑定订单仍然有效且商品/变体未漂移时才强制锁定数量，已经失效的历史绑定仍允许人工修正，避免把旧草稿彻底锁死。
  - 已补齐服务层与路由层回归测试，锁定“预订单绑定数量不得在创建或更新时漂移”的行为。
- 增量回归:
  - `functions/ai/__tests__/action-submitters.test.js`
  - `functions/lib/hono/routes/manage/__tests__/ai-routes.test.js`
  - `functions/lib/hono/routes/manage/__tests__/purchase-orders-routes.test.js`
  - `functions/services/__tests__/PurchaseOrderService.variant-dimension.test.js`
- 对应修复提交: `e0c7018 fix: preserve preorder quantity bindings`
