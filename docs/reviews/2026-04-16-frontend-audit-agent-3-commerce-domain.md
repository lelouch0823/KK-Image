# Frontend Audit Agent 3 - Commerce Domain

审查日期：2026-04-16

审查范围：

- `src/components/product/**`
- `src/components/order/**`
- `src/components/purchase-order/**`
- `src/components/ProductManager.vue`
- `src/components/OrderManager.vue`
- `src/components/OrderCreateModal.vue`
- `src/components/OrderEditModal.vue`
- `src/components/OrderStatusChanger.vue`

设计规范基线：

- `docs/design-system/MASTER.md`
- `docs/design-system/foundations.md`
- `docs/design-system/patterns.md`
- `docs/design-system/typography.md`
- `docs/design-system/iconography.md`

判定口径：

- 高：绕过 foundation/composed/patterns，重造 modal/table/card/toolbar 等共享视觉原语，或在高频入口大量直接使用原生控件。
- 中：在已有 Modal/AppTable/AppInput 语境下继续混用原生 button/input/select/textarea，或存在明显 token/字体/颜色漂移。
- 低：小范围视觉覆写、局部 badge/chip/table cell 自定义，短期不一定致命，但会持续拉高收敛成本。

## 高严重度问题汇总

1. 采购域形成了完整的“页面内本地 modal/drawer 系统”，至少覆盖 `ProductPickerModal`、`OrderPickerModal`、`PurchaseOrderCreateDrawer`、`PurchaseOrderDetailDrawer`、`PurchaseOrderCostModal`、`PurchaseOrderReceiptModal`、`PurchaseOrderShortageModal`、`PurchaseOrderReceiptReversalModal`、`PurchaseOrderSuggestionsDrawer`、`PurchaseOrderSupportOverlays`。这直接违背 `MASTER.md` 的“pages must consume the system in that order and must not define their own visual primitives”。
2. 商品/订单域仍有多处高频编辑组件直接使用原生表单控件，尤其是 `OrderForm`、`OrderStatusChanger`、`ProductVariantTable`、`VariantBatchBuilderModal`、`ProductBasicInfoSection`、`OrderTable`、`OrderReturnDialog`。这让交互状态、焦点、禁用态、暗色适配无法由 foundation 层统一托管。
3. `ProductCreateModal` 仍保留独立 modal 实现和本地 SVG 图标，不仅绕过 `Modal`/`AppIcon`，还把加载态与告警态视觉契约重新定义了一遍。

## 反复出现的模式性问题

- 直接写原生 `button`/`input`/`select`/`textarea`，并靠 `class="input"` 或长串 utility 类伪装成基础组件。
- 在业务组件里直接重写 modal shell：`fixed inset-0`、遮罩、圆角、阴影、头部渐变、底部 action bar 全部本地定义。
- 用业务组件自制 card/chip/tag/summary box/table，而不是上浮到 `src/components/ui/*` 或 `src/design-system/composed/*`。
- 使用模块内视觉语言漂移：`slate/emerald/amber/sky/violet`、`shadow-[...]`、`rounded-[...]`、`bg-[radial-gradient(...)]`、`font-[Outfit]`。
- 通过 `:style` 直接注入状态色或渐变，而不是走 token 或 `StatusBadge`/`AppIcon`/共享状态映射。

## 逐文件问题

### `src/components/purchase-order/ProductPickerModal.vue`

- 严重度：高
- 违规类型：重复造 modal；直接使用原生 button/input；硬编码视觉语言；模块内字体偏离
- 证据：第 4-15 行和第 134-149 行自建遮罩、modal shell、footer action bar；第 21 行、第 60 行、第 137-145 行使用原生 `button`；第 94-99 行使用原生 checkbox；第 11、14-15 行写死 `rounded-[2rem]`、`shadow-[0_32px_90px_-45px_rgba(...)]`、`bg-linear-to-r`、`radial-gradient(...)`；第 37-40 行使用 `sky`/`violet` 本地色；第 110 行使用 `font-[Outfit]`
- 修复建议：收敛到 `Modal` + `AppButton` + `AppCheckbox`/`AppInput`；把 picker 头部、统计 chip、底部 action 区抽成 composed picker shell；移除 `Outfit` 和本地渐变，改走 token 与 `StatusBadge`

### `src/components/purchase-order/OrderPickerModal.vue`

- 严重度：高
- 违规类型：重复造 modal；直接使用原生 button/input；硬编码视觉语言；模块内字体偏离
- 证据：第 5-18 行和第 127-148 行完整重写 modal 与 footer；第 24-29 行、第 133-144 行使用原生 `button`；第 79-85 行和第 101-105 行使用原生 checkbox；第 13、17-18 行写死阴影和渐变；第 42-46 行使用 `sky`/`emerald` 本地色；第 87、111 行使用 `font-[Outfit]`
- 修复建议：与 `ProductPickerModal` 合并成共享 picker shell；选中态和 chip 改用 foundation/composed；数量/统计文本回到共享 UI sans 与 token

### `src/components/purchase-order/PurchaseOrderCreateDrawer.vue`

- 严重度：高
- 违规类型：重复造 modal/drawer；重复造 table/card/badge；直接使用原生 button；硬编码视觉语言
- 证据：第 5-16 行和第 296-325 行完整本地实现 drawer shell、header、footer；第 160-176 行、第 280-284 行、第 309-320 行使用原生 `button`；第 41、141、182、297 行大量使用 `rounded-[1.6rem]`、`bg-linear-to-br`、`bg-linear-to-r`；第 192-290 行直接写 `<table>`/`<thead>`/`<tbody>`；第 266-273 行继续本地实现 source badge
- 修复建议：以 `Modal` 或共享 drawer primitive 承载外壳；商品列表迁移到 `AppTable` 或采购域专用 composed table；头部 summary card 与 footer action bar 上浮到 composed 层

### `src/components/purchase-order/PurchaseOrderDetailDrawer.vue`

- 严重度：高
- 违规类型：重复造 modal/drawer；直接使用原生 button；局部视觉原语分散
- 证据：第 5-10 行自建详情工作区外壳；第 20-24 行、第 53-57 行、第 135-148 行使用原生 `button`；第 9 行使用 `shadow-[0_30px_80px_-35px_rgba(...)]`；第 115-154 行本地实现 detail footer action bar
- 修复建议：详情工作区应建立共享 `WorkflowDetailShell`/drawer primitive； footer action 区沉到 composed；内部 summary/progress/cost/items/receipts 继续向共享视觉原语收敛

### `src/components/purchase-order/PurchaseOrderCostModal.vue`

- 严重度：高
- 违规类型：重复造 modal；直接使用原生 button；硬编码渐变/阴影
- 证据：第 5-17 行和第 136-177 行完全本地实现 modal shell；第 34-38 行、第 148-167 行使用原生 `button`；第 9、13、16 行写死圆角、阴影和 radial gradient
- 修复建议：外壳替换为 `Modal`；动作区使用 `AppButton`；卡片式字段容器可以沉淀为 shared form section primitive

### `src/components/purchase-order/PurchaseOrderReceiptModal.vue`

- 严重度：高
- 违规类型：重复造 modal；直接使用原生 button；硬编码渐变/阴影
- 证据：第 5-16 行和第 120-158 行自建 modal 与 footer；第 29-33 行、第 139-149 行使用原生 `button`；第 9、13、16、43 行写死阴影、渐变、圆角
- 修复建议：使用 `Modal` + `AppButton`；把收货行卡片抽成 composed row editor，避免每个采购 overlay 自写一套头部和尾部

### `src/components/purchase-order/PurchaseOrderShortageModal.vue`

- 严重度：高
- 违规类型：重复造 modal；直接使用原生 button；硬编码渐变/阴影
- 证据：第 5-16 行和第 114-152 行重写 modal；第 34-38 行、第 133-143 行使用原生 `button`；第 9、13、16、48 行使用本地阴影/渐变/色板
- 修复建议：和 `PurchaseOrderReceiptModal`、`PurchaseOrderReceiptReversalModal` 共享采购 overlay primitive；统一头部/底部/行编辑布局

### `src/components/purchase-order/PurchaseOrderReceiptReversalModal.vue`

- 严重度：高
- 违规类型：重复造 modal；直接使用原生 button；硬编码颜色/阴影
- 证据：第 5-12 行自建 modal shell；第 67-78 行使用原生 `button`；第 9-11 行写死 `amber-300/50` 与 `shadow-[...]`
- 修复建议：改为 `Modal` + `AppButton`；危险操作配色交给 foundation variant，不在业务组件直接写 `amber`

### `src/components/purchase-order/PurchaseOrderSuggestionsDrawer.vue`

- 严重度：高
- 违规类型：重复造 modal；直接使用原生 button；重复造 spinner/card；硬编码渐变/阴影
- 证据：第 5-13 行自建 overlay 与 shell；第 26-29 行和第 120-124 行使用原生 `button`；第 50-52 行用本地 `div` spinner，不走 `AppIcon`/`Skeleton`；第 9、12、38、63 行写死阴影、radial gradient、圆角
- 修复建议：收敛到 shared overlay primitive；加载态使用 foundation `Skeleton`/`AppIcon`；summary cards 若为通用模式应沉淀到 composed 层

### `src/components/purchase-order/PurchaseOrderSupportOverlays.vue`

- 严重度：高
- 违规类型：重复造 modal；直接使用原生 button；硬编码警告视觉
- 证据：第 12-20 行自建 shortage confirm overlay；第 55-65 行使用原生 `button`；第 17、20、23、39 行使用本地 warning 阴影/渐变/配色
- 修复建议：改用 `ConfirmDialog` 或危险确认 composed primitive；不要在 overlay 聚合组件里继续长出独立 visual system

### `src/components/OrderStatusChanger.vue`

- 严重度：高
- 违规类型：重复造 modal；直接使用原生 button/input；硬编码视觉语言；状态色脱离 token
- 证据：第 4-16 行自建 trigger button 而非 `AppButton`；第 23-45 行自建状态弹窗头部与装饰；第 77-89 行、第 183-201 行大量原生 `button`；第 129-137 行原生 `input`，第 153-158 行原生 checkbox；第 32-42 行使用本地渐变和装饰圆；第 253 行 fallback 为 `bg-gray-400`
- 修复建议：trigger/action 全部改成 `AppButton`；弹窗外壳迁移到 `Modal`；备注和确认框使用 `AppInput`/`AppCheckbox`；状态 tag/dot 交回共享状态组件

### `src/components/product/ProductCreateModal.vue`

- 严重度：高
- 违规类型：重复造 modal；本地 SVG/icon 系统；模块内字体偏离；直接使用原生 button
- 证据：第 100-118 行自建 modal shell；第 38-40、130-137、176-178、248-251 行直接写本地 `svg`；第 122 行使用 `font-[Outfit]`；第 125-128 行和第 185-188 行使用原生 `button`
- 修复建议：全面切回 `Modal`；所有本地 `svg` 改为 `AppIcon`；标题和数值字体改回 shared sans/mono；“管理变体图片”一类动作改用 `AppButton`

### `src/components/product/ProductVariantTable.vue`

- 严重度：高
- 违规类型：重复造 table；直接使用原生 input/button；内联视觉实现；直接写颜色
- 证据：第 15-188 行完整自建变体表格；第 68-149 行多处原生 `input`；第 160-181 行原生 `button`；第 12 行内联 `linear-gradient(...)`；第 156-168 行本地 pending badge 与 `text-emerald-500`
- 修复建议：把可编辑变体表上浮为共享 editable table primitive；表单单元格使用 `AppInput`/`Select`/`AppCheckbox`；滚动提示和状态切换交给 foundation/composed 组件

### `src/components/order/OrderForm.vue`

- 严重度：高
- 违规类型：直接使用原生 input/textarea/button；表单契约绕过 foundation
- 证据：第 87-93、124-131、143-148、154-160、225-231 行使用原生 `input`；第 201-206 行使用原生 `textarea`；第 247-257 行原生 footer `button`
- 修复建议：统一改为 `AppInput`、`Select`、`AppButton`；日期、数量、SKU、备注都应由 foundation 控制焦点/错误/禁用态

### `src/components/product/VariantBatchBuilderModal.vue`

- 严重度：高
- 违规类型：重复造 modal；直接使用原生 input/select/button；模块内字体偏离
- 证据：第 3-5 行自建 modal shell；第 7 行使用 `font-[Outfit]`；第 15-31 行多处原生 `input`/`select`；第 44-47 行原生 `button`
- 修复建议：用 `Modal` + `AppInput` + `Select` + `AppButton` 重新承载；这个组件本质上是共享批量构建器，不应自带独立视觉层

### `src/components/product/ProductBasicInfoSection.vue`

- 严重度：中
- 违规类型：直接使用原生 select；本地表单 label/input 样式
- 证据：第 37-53 行手写 label 与原生 `select`
- 修复建议：改为 foundation `Select`；label/spacing 交给 foundation field 容器

### `src/components/product/ProductOptionsBuilder.vue`

- 严重度：中
- 违规类型：直接使用原生 button/input；直接写颜色值；重复造 chip
- 证据：第 16-28、68-72、108-112、127-132、153-158 行使用原生 `button`；第 101-105 行和第 170-176 行原生 `input type="color"`；第 92-99 行和第 123-135 行自制 value chip/archive chip；第 201 行默认 `#000000`
- 修复建议：把 option action 与 value chip 上浮到 shared builder primitive；颜色选择器至少通过 foundation field 包装并移除默认硬编码

### `src/components/product/ValueArchiveModal.vue`

- 严重度：中
- 违规类型：在 `Modal` 内继续使用原生 button；重复造 pill/chip
- 证据：第 42-59 行原生 footer `button`；第 31-37 行手写 sample chip
- 修复建议：footer 改为 `AppButton`；样本标签若多处存在，抽共享 code/pill primitive

### `src/components/product/DimensionArchiveModal.vue`

- 严重度：中
- 违规类型：在 `Modal` 内继续使用原生 button/input；本地 radio card
- 证据：第 48-71 行原生 radio；第 85-122 行原生 `button`
- 修复建议：策略选择改为 `Select` 或共享 radio-card primitive；footer 改用 `AppButton`

### `src/components/product/ProductExportModal.vue`

- 严重度：中
- 违规类型：在 `Modal` 内继续使用原生 button/input；重复造 option card
- 证据：第 12-32 行原生 option `button`；第 48-54 行原生 radio；第 77-85 行继续使用 `.btn` 而非 `AppButton`
- 修复建议：格式/范围选择沉淀为 foundation choice card；footer 统一到 `AppButton`

### `src/components/product/ProductTable.vue`

- 严重度：中
- 违规类型：在 `AppTable` 内继续使用原生 button；模块内字体偏离；本地 badge
- 证据：第 46 行使用 `font-[Outfit]`；第 72-76 行自制 category badge；第 125-143 行 action icon 使用原生 `button`
- 修复建议：标题恢复 shared sans；分类标签改为 `StatusBadge` 或统一 tag primitive；action icon button 用 `AppButton`/icon-button primitive

### `src/components/product/ProductDetail.vue`

- 严重度：中
- 违规类型：直接使用原生 button；模块内字体偏离；重复造 detail card/badge；本地状态色
- 证据：第 77-84 行、第 106-120 行使用原生 `button`/link-style action；第 150、173 行使用 `font-[Outfit]`；第 176 行通过 `StatusBadge` 强覆写 `rounded-full! px-2! py-0.5!`；第 193 行直接写 `text-danger`/`text-success`
- 修复建议：数值字体回归 mono；action 区和 stock badge 交给 shared primitives；减少 `!` 覆写 shared component

### `src/components/order/OrderTable.vue`

- 严重度：中
- 违规类型：在 `AppTable` 内继续使用原生 input/button；重复造 selection/action controls
- 证据：第 22-28 行和第 35-39 行使用原生 checkbox；第 118-136 行使用原生 action `button`
- 修复建议：选择列改用 `AppCheckbox`；表格动作使用 icon-button primitive，避免每个业务表单独定义 hover/focus

### `src/components/order/OrderReturnDialog.vue`

- 严重度：中
- 违规类型：在 `Modal` 内继续使用原生 select；直接写 emerald 视觉
- 证据：第 11-12 行使用 `emerald-500` 相关背景与文字；第 24-38 行使用原生 `select`
- 修复建议：原因选择改为 foundation `Select`；摘要块使用 token 驱动的 shared notice primitive

### `src/components/order/OrderLineCommandPanel.vue`

- 严重度：中
- 违规类型：直接使用原生 input/button；硬编码多套状态色；重复造 action toolbar
- 证据：第 23-45、55-78 行本地实现多种 emerald/orange/sky/slate pill；第 86-91 行使用原生数量输入；第 96-137 行五个原生 action `button`
- 修复建议：把 line action toolbar 上浮到 composed；数量输入改 `AppInput`；状态 pill 改统一 badge/token map

### `src/components/order/OrderStatusHeader.vue`

- 严重度：中
- 违规类型：直接使用原生 button；硬编码 emerald 视觉；重复造 stepper
- 证据：第 26-31 行和第 67-72 行使用 `emerald-500/15`、`emerald-700`；第 63-69 行原生 `button`；第 82-114 行本地实现状态 stepper
- 修复建议：交付确认块改为 shared notice + `AppButton`；stepper 抽为 design-system/composed 工作流进度组件

### `src/components/order/OrderCommentInput.vue`

- 严重度：中
- 违规类型：直接使用原生 input/button；重复造输入条
- 证据：第 11-16 行原生 `input`；第 18-24 行和第 28-32 行原生 `button`
- 修复建议：抽象为 shared comment composer/input bar primitive，统一输入与发送按钮状态

### `src/components/order/OrderBatchActions.vue`

- 严重度：中
- 违规类型：直接使用原生 button；重复造 floating action buttons
- 证据：第 7-9 行、第 15-35 行全部使用原生 `button`
- 修复建议：`FloatingSelectionBar` 内动作统一改 `AppButton`，避免每个批量条重复定义按钮视觉

### `src/components/order/OrderFilters.vue`

- 严重度：中
- 违规类型：直接使用原生 button；重复造 toolbar actions
- 证据：第 6-29 行和第 93-118 行多处原生 `button`
- 修复建议：`AppFilterBar` 应补齐 action slot 的标准 icon-button/button primitive；过滤器自身不应继续定义按钮视觉

### `src/components/ProductManager.vue`

- 严重度：中
- 违规类型：直接使用原生 button；管理页 action 视觉未收口
- 证据：第 5-38 行和第 54-86 行管理器 action 全部原生 `button`；第 182-195 行在 `EmptyState` action slot 中继续使用 `.btn`
- 修复建议：管理页顶部 action 全改为 `AppButton` 或 shared icon-button；空状态 action slot 也应消费 foundation

### `src/components/OrderEditModal.vue`

- 严重度：中
- 违规类型：在 `Modal` 内继续使用原生 button；本地 badge
- 证据：第 17-23 行手写状态 badge；第 84-88 行危险区按钮、第 94-106 行 footer 按钮全部为原生 `button`
- 修复建议：状态展示改 `StatusBadge`；footer 和 danger zone 使用 `AppButton`

### `src/components/order/ProductBindingSection.vue`

- 严重度：中
- 违规类型：直接使用原生 button/input；重复造 radio-card 与 availability badge
- 证据：第 86-92 行使用原生 `button`；第 136-143 行和第 176-183 行使用原生 radio；第 43-62 行和第 185-188 行本地实现 badge/card 状态
- 修复建议：绑定规格选择上浮为共享 variant selector；删除按钮与 radio-card 统一到 foundation/composed

### `src/components/product/ProductSelect.vue`

- 严重度：中
- 违规类型：直接使用原生 input/button；重复造搜索下拉
- 证据：第 10-17 行原生搜索 `input`；第 40-45 行 error retry 使用原生 `button`
- 修复建议：优先复用 `SearchInput`/`AutocompleteInput` 能力，或把该组件本身沉到 UI 层作为统一 searchable select

### `src/components/purchase-order/PurchaseOrderReceiptsPanel.vue`

- 严重度：中
- 违规类型：直接使用原生 button；硬编码 slate/amber 颜色；重复造 receipt card/chip
- 证据：第 34-49 行和第 146-151 行使用原生 `button`；第 48、150 行直接写 `slate`/`amber` 色系；第 58-157 行自制 receipt 卡片、variant chip、meta 面板
- 修复建议：操作按钮使用 `AppButton`；收货记录卡片可上浮为 composed ledger card；颜色切回 token 语义 variant

### `src/components/purchase-order/PurchaseOrderItemsPanel.vue`

- 严重度：中
- 违规类型：直接使用原生 button；硬编码 warning/info 视觉；重复造 item card
- 证据：第 16-29 行和第 75-80 行使用原生 `button`；第 97-105 行本地实现 source badge；第 36-245 行自制 item card 与侧栏摘要
- 修复建议：item card 和 source badge 上浮到 composed；添加/删除动作与 source tag 交给 foundation/composed

### `src/components/purchase-order/PurchaseOrderDetailSummary.vue`

- 严重度：中
- 违规类型：直接用内联 style 渲染状态色；重复造 hero summary card
- 证据：第 17-21 行通过 `:style` 直接写 `color` 和 `backgroundColor`；第 52-64 行自制 summary card
- 修复建议：状态显示改 `StatusBadge`；summary cards 若跨详情页复用，应收敛到 composed stat-card primitive

### `src/components/purchase-order/PurchaseOrderDetailProgress.vue`

- 严重度：中
- 违规类型：重复造 stepper/summary badge；视觉原语未上浮
- 证据：第 17-18 行手写状态 pill；第 40-79 行自制 stepper、轨道、节点状态
- 修复建议：把采购进度条上浮为共享 workflow stepper，避免订单/采购各自维护一套

### `src/components/purchase-order/PurchaseOrderDetailCost.vue`

- 严重度：低
- 违规类型：直接使用原生 button；重复造 summary card
- 证据：第 16-33 行自制 currency/allocation chip 与原生 `button`；第 41-74 行本地四宫格 summary card
- 修复建议：编辑动作换 `AppButton`；成本摘要块考虑提炼为 composed summary section

### `src/components/purchase-order/PurchaseOrderListTable.vue`

- 严重度：低
- 违规类型：在 `AppTable` 之上继续手写 badge/code chip 视觉
- 证据：第 35-36 行自制 PO 编号 chip；第 47 行给 `StatusBadge` 叠加 `ring-1 ring-black/5`
- 修复建议：PO 编号可复用 `AppTableCodeChip`；减少对 `StatusBadge` 的局部视觉覆写

## 建议优先治理的文件 Top 10

1. `src/components/purchase-order/ProductPickerModal.vue`
2. `src/components/purchase-order/OrderPickerModal.vue`
3. `src/components/purchase-order/PurchaseOrderCreateDrawer.vue`
4. `src/components/purchase-order/PurchaseOrderDetailDrawer.vue`
5. `src/components/OrderStatusChanger.vue`
6. `src/components/product/ProductCreateModal.vue`
7. `src/components/product/ProductVariantTable.vue`
8. `src/components/order/OrderForm.vue`
9. `src/components/purchase-order/PurchaseOrderCostModal.vue`
10. `src/components/purchase-order/PurchaseOrderReceiptModal.vue`

## 治理顺序建议

1. 先在 `ui`/`design-system/composed` 补齐共享原语：picker shell、workflow stepper、icon-button、editable table cell、form choice card。
2. 再统一替换采购域本地 overlay 系统，因为这里重复度最高、收益最大。
3. 然后处理商品/订单域高频编辑表单，优先清掉 `OrderForm`、`ProductVariantTable`、`VariantBatchBuilderModal` 的原生控件。
4. 最后清理 `font-[Outfit]`、`slate/emerald/amber` 等局部视觉漂移，并把剩余 card/badge/table 子样式往 composed 层上浮。
