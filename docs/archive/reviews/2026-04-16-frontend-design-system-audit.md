# 2026-04-16 前端设计规范审查

## 当前分支执行结果（2026-04-16 收口更新）

说明：

- 本文档下方的大段问题清单保留为**审计基线**，记录的是启动整改前识别出的风险面。
- 本节补充的是当前分支 `frontend-design-system-remediation` 在本次开发收口后的执行结果，便于区分“已修复”与“仍待治理”。

### 已完成整改的波次

- 共享设计契约、shared token / tone / icon / typography contract 已补齐并入库。
- 共享 overlay / surface primitives 已补齐，`Modal` / `ActionBar` / `StatePanel` 等组合层已作为业务壳层标准入口。
- 视图层已完成第一轮迁移：
  - `Dashboard.vue`
  - `Stats.vue`
  - `GoodsOverview.vue`
  - `SpaceManager/index.vue`
  - `Login.vue`
  - `src/views/stats/*`
- 采购高频 overlay 已完成第一轮迁移：
  - `ProductPickerModal.vue`
  - `OrderPickerModal.vue`
  - `PurchaseOrderCreateDrawer.vue`
  - `PurchaseOrderDetailDrawer.vue`
- customer / common / settings 第二轮高频组件已完成迁移：
  - `SpaceProductEditor.vue`
  - `AIChatWidget.vue`
  - `AIChart.vue`
  - `SalespersonSelectModal.vue`
  - `AISettings.vue`
  - `DestructiveConfirmModal.vue`
  - `CustomerDetailPanel.vue`
  - `CustomerDetailContent.vue`
- 商品 / 订单第二轮高频组件已完成迁移：
  - `ProductCreateModal.vue`
  - `ProductVariantTable.vue`
  - `ProductTable.vue`
  - `ProductDetail.vue`
  - `OrderStatusChanger.vue`
  - 并清除了相关高可见 `font-[Outfit]` 残留
- 采购 / space / 文件选择第三轮收口已完成：
  - `PurchaseOrderCostModal.vue`
  - `PurchaseOrderReceiptModal.vue`
  - `PurchaseOrderShortageModal.vue`
  - `PurchaseOrderReceiptReversalModal.vue`
  - `PurchaseOrderSuggestionsDrawer.vue`
  - `PurchaseOrderSupportOverlays.vue`
  - `SpaceProductDetail.vue`
  - `SpaceMasonry.vue`
  - `FileSelector.vue`
- 页面 / 表单 / token / minisales 第四轮收口已完成：
  - `PermissionDeniedState.vue`
  - `Dashboard.vue`
  - `SpaceManager/index.vue`
  - `Stats.vue`
  - `AIChart.vue`
  - `VariantBatchBuilderModal.vue`
  - `OrderForm.vue`
  - `minisales/miniprogram/pages/stats/stats.scss`
- 文件管理 / 消息气泡 / 采购状态 / 辅助工具第五轮收口已完成：
  - `TrashModal.vue`
  - `FileManagerToolbar.vue`
  - `MoveItemModal.vue`
  - `SubspaceList.vue`
  - `SpaceProductDetail.vue`
  - `OrderProcurementBadge.vue`
  - `ChatMessage.vue`
  - `SalespersonCards.vue`
  - `ReloadPrompt.vue`
  - `src/utils/highlight.js`
- minisales 已完成状态 / shell / surface 第一轮收敛，去掉了核心链路中的 `style="{{...}}"` 状态注入和 controller 拼色字符串。

### 新增治理护栏

- `scripts/qa/check-ui-token-integrity.mjs`
  - 拦截 `material-symbols-outlined`
  - 拦截 `font-[Outfit]`
  - 拦截已明确废弃的主色 fallback hex
  - 拦截 `Stats.vue` / `AIChart.vue` 回流旧 chart fallback 调色板
- `scripts/qa/check-ui-foundation-usage.mjs`
  - 对已整改的高风险 Web 文件拦截 raw `button` / `input` / `textarea` / `select` / `svg` 回流
- `scripts/qa/check-minisales-ui-contract.mjs`
  - 拦截 minisales 关键链路重新引入 `statusStyle`、inline template style 和 controller 直接拼 hex 样式
  - 拦截 `pages/stats/stats.scss` 回流硬编码 surface / gradient 色值
- `package.json`
  - 新增 `qa:check-design-system` 聚合命令

### 当前验证结果

- 本轮收口相关 Vitest：10 文件 17 测试通过
- `pnpm qa:check-design-system`：通过
- `eslint --max-warnings 0`：已对本轮整改涉及文件通过
- `prettier --check` 等价校验：本轮改动文件已通过 `prettier --write` 重写并保持无 diff 异常
- `git diff --check`：当前工作区通过

### 仍待后续波次处理的 backlog

- 本轮已清空此前挂在当前分支收口清单里的采购 overlay、space 详情组件、`FileSelector`，以及本轮新增的页面 / 表单 / chart token / minisales stats 收口项。
- 审计基线下方记录的其余历史问题仍作为后续波次 backlog 保留，但不再包含上述已整改文件。
- 两个明确保留的原生能力例外：
  - `src/components/SpaceProductEditor.vue` 中隐藏的 `type="file"` 输入，用于原生文件选择能力
  - `src/components/product/ProductDetail.vue` 中用于缩略图切换的图片按钮
- 这些例外已从 guardrail 中显式排除，不应再扩散到新的业务文件。
- 本轮复核后新增确认的“功能性颜色 / 打印态”例外：
  - `src/components/order/OrderPrintView.vue`：打印黑白输出，保留 `text-black` / `border-black` / `bg-white`
  - `src/components/ui/AppColorInput.vue`：颜色输入默认值 `#ffffff`
  - `src/components/settings/tabs/WatermarkSettings.vue`
  - `src/composables/useWatermarkSettings.js`
  - `src/components/order/ProductBindingSection.vue`：颜色名称到色值映射与 fallback
  - `src/components/product/ProductOptionsBuilder.vue`：待选颜色值状态
  - `src/components/TagModal.vue`：标签色 fallback

## 审查目标

- 检查前端代码是否脱离项目设计系统和页面模式规范。
- 重点关注：
  - 未使用封装组件
  - 未使用封装颜色 / token / 语义色
  - 页面或业务组件直接定义边距、圆角、阴影、渐变等视觉原语
  - 未使用统一 shell / pattern
  - 使用本地 SVG / 图标系统而非 `AppIcon`

## 设计规范基线

- `docs/design-system/MASTER.md`
- `docs/design-system/foundations.md`
- `docs/design-system/patterns.md`
- `docs/design-system/typography.md`
- `docs/design-system/iconography.md`

## 审查范围

- 主站 Web：`src/views/**`、`src/components/**`、`src/components/ui/**`、`src/design-system/**`、`src/styles/**`
- 小程序：`minisales/miniprogram/**`

## 审查方法

1. 读取设计系统和页面模式文档，确定违规标准。
2. 按模块拆分给多个子代理并行审查。
3. 本地补充自动扫描：
   - 原生控件使用
   - 本地 SVG / Material Symbols
   - 硬编码颜色 / 渐变 / 阴影
   - inline style
4. 对高命中文件人工复核，过滤误报。

## 横向统计

| 模块                                                                                        | 文件数 |  原生控件命中 | 本地 SVG/图标命中 | 硬编码颜色命中 | inline style 命中 |
| ------------------------------------------------------------------------------------------- | -----: | ------------: | ----------------: | -------------: | ----------------: |
| shared (`src/styles` / `src/components/ui` / `src/design-system` / `src/components/layout`) |     52 |  46 / 17 文件 |        4 / 4 文件 |  104 / 10 文件 |      28 / 15 文件 |
| views (`src/views`)                                                                         |     36 |   21 / 7 文件 |       13 / 2 文件 |    70 / 8 文件 |        8 / 4 文件 |
| commerce (`product` / `order` / `purchase-order`)                                           |     80 | 193 / 51 文件 |        4 / 1 文件 |   66 / 14 文件 |      21 / 18 文件 |
| space / customer / settings / common                                                        |     56 | 133 / 40 文件 |      27 / 10 文件 |    31 / 7 文件 |        3 / 3 文件 |
| minisales                                                                                   |    121 |    1 / 1 文件 |        0 / 0 文件 |  226 / 32 文件 |       14 / 9 文件 |

说明：

- 统计用于定位风险热点，不等于全部都是违规。
- `src/components/ui/**` 和 token 文件中出现部分颜色/样式定义是合理的，但仍需检查是否符合当前设计基线。

## 初步结论

- 当前前端并未完全收敛到文档定义的设计系统层级。
- 主站的主要问题不是“完全没有 token”，而是业务组件和页面层仍大量自建视觉原语，尤其是：
  - 自定义 modal / drawer / card / tab / toolbar 外壳
  - 直接使用原生 `button` / `input` / `select` / `textarea`
  - 使用本地 SVG 而非 `AppIcon`
  - 使用 `font-[Outfit]` 等页面级字体特例
- 小程序侧问题更集中，主要是：
  - 状态色、卡片色、边框色在多个文件重复硬编码
  - 通过 controller / component TS 直接拼接 style 字符串
  - 大量局部 SCSS 直接写 hex / rgba / 渐变，未统一走变量层

## 高优先级共性问题

### 1. 页面层和业务组件层仍在重复造视觉原语

- 已确认存在大体量页面/组件直接定义卡片、面板、抽屉、状态块、标签、底栏和渐变背景，而不是收敛到 `src/components/ui/*` 或 `src/design-system/composed/*`。
- 典型例子：
  - `src/views/Dashboard.vue`
  - `src/components/SpaceProductEditor.vue`
  - 多个 `src/components/purchase-order/*.vue`

### 2. 原生控件使用量高，foundation 组件约束未真正落地

- commerce 域和 space/common 域大量直接使用原生 `button` / `input` / `select` / `textarea`。
- 这会直接绕过 `AppButton`、`AppInput`、`Modal`、`StatusBadge` 等基础契约，导致交互态、视觉态和可维护性不一致。

### 3. 图标系统没有完全收口到 `AppIcon`

- 文档明确要求 `AppIcon` 为唯一图标入口，但多个业务组件和页面仍直接写本地 `<svg>`。
- 这会导致线条粗细、尺寸体系、hover/disabled 状态和主题切换行为不统一。

### 4. 字体规范仍有高可见残留

- 发现多个高可见文件使用 `font-[Outfit]`，与 `docs/design-system/typography.md` 的禁令冲突。
- 典型位置：
  - `src/components/product/VariantBatchBuilderModal.vue`
  - `src/components/product/ProductTable.vue`
  - `src/components/product/ProductCreateModal.vue`
  - `src/components/product/ProductDetail.vue`
  - `src/components/purchase-order/ProductPickerModal.vue`
  - `src/components/purchase-order/OrderPickerModal.vue`
  - `src/views/GoodsOverview.vue`
  - `src/components/common/ai/AIChart.vue`

### 5. 小程序状态色 / 统计卡色配置分散且重复

- 小程序中同一组状态色在多个位置重复定义：
  - `minisales/miniprogram/utils/constants.ts`
  - `minisales/miniprogram/components/sales/order-card/index.ts`
  - `minisales/miniprogram/pages/detail/controller.ts`
- 统计卡颜色也在 controller 和 SCSS 中重复散落：
  - `minisales/miniprogram/pages/stats/controller.ts`
  - `minisales/miniprogram/pages/stats/stats.scss`

## 已人工复核的代表性问题

### `src/views/Dashboard.vue`

- 问题：
  - 页面虽然使用了 `DashboardShell`，但内容区继续大规模自建卡片、装饰 blob、状态点、列表项、空态占位和渐变背景。
  - 出现 `bg-purple-500/5`、`bg-cyan-500/5`、`bg-red-500/80`、`shadow-[0_0_8px_rgba(...)]`、`dark:bg-[#0f1219]/50` 等页面级颜色和阴影实现。
- 判断：
  - 属于“使用了 shell，但视觉原语没有收敛到 design-system / ui 层”的典型案例。

### `src/components/SpaceProductEditor.vue`

- 问题：
  - 直接使用大量原生 `button` / `input` / `textarea`。
  - 使用多个本地 SVG。
  - 直接书写 `bg-white`、`dark:bg-gray-900`、`border-blue-500/20`、`bg-blue-50/50`、`bg-amber-50/80` 等颜色。
  - 自建标签页、抽屉/弹窗外壳、提示块和操作栏。
- 判断：
  - 该文件明显越过 foundation 和 composed 层，属于高优先级治理对象。

### `src/components/common/ai/AIChart.vue`

- 问题：
  - 使用 `"'Outfit', 'Inter', sans-serif"` 作为图表字体。
  - 在 JS 中写 fallback 颜色 `#3B82F6`、`#8B5CF6`、`#10B981` 等。
- 判断：
  - 与 typography 规则冲突，也削弱了 token 的唯一来源。

### `minisales/miniprogram/pages/stats/controller.ts`

- 问题：
  - 直接拼装 `background:#eff6ff;border:1rpx solid #bfdbfe;` 等 style 字符串。
  - 三组统计卡色完全写死在 controller 中。
- 判断：
  - 这是小程序侧最典型的“UI token 不可治理”问题之一，应优先收敛到共享常量或样式层。

### `minisales/miniprogram/components/sales/order-card/index.ts`

- 问题：
  - 订单状态色与背景色通过 `STATUS_META` 直接写死。
  - 最终拼成 `statusStyle` inline style 下发到模板。
- 判断：
  - 与 `utils/constants.ts`、`pages/detail/controller.ts` 形成重复定义，属于应集中治理的共享配置问题。

## 分模块问题汇总

### 子代理 1：共享设计系统层

- 子报告：`docs/reviews/2026-04-16-frontend-audit-agent-1-shared-system.md`
- 高严重度问题：
  - `src/styles/main.css` 仍保留 `.material-symbols-outlined`，说明共享层没有真正把图标入口收口到 `AppIcon`。
  - `src/components/ui/ProductSpecCard.vue` 与 `src/components/ui/ProductSpecCardDemo.vue` 在 foundation 层重新造了一套卡片/按钮/图标/颜色体系，包含本地 `svg`、`neutral/red/white/black` 和 hex。
  - `src/components/ui/StatusSelector.vue`、`src/components/ui/AppCard.vue`、`src/components/ui/AppStatCard.vue`、`src/components/ui/StatusBadge.vue`、`src/design-system/composed/MetricTile.vue` 混用了未定义 token、`blue-500/purple-500/cyan-500` 和自写 RGBA glow。
  - `src/components/ui/PermissionDeniedState.vue` 直接写 amber/orange/white 方案，且按钮没有统一走 `AppButton`。
- 中低严重度问题：
  - `src/components/ui/AppImage.vue` 仍硬编码 radius / badge 颜色，并混入 emoji 状态表达。
  - `src/components/layout/Header.vue`、`src/components/layout/Sidebar.vue` 仍存在 `white/amber/black` 直写状态色。
  - `src/components/ui/AppTable.vue` 使用 arbitrary RGBA shadow，未收敛到共享 shadow token。
- 结论：
  - 共享层本身已经出现“第二套视觉系统”，这比单一页面违规更危险，因为它会继续向业务层扩散。

### 子代理 2：主站页面 / 视图层

- 子报告：`docs/reviews/2026-04-16-frontend-audit-agent-2-views.md`
- 页面层整体遵循度：中。
- 主要问题：
  - `src/views/Dashboard.vue` 与 `src/views/Stats.vue` 虽然已挂 `DashboardShell`，但页面内部仍自建玻璃卡片、背景 blob、图表配色和大量硬编码颜色。
  - shell 只解决了页面外框，没有限制住页面内部的视觉语言，导致 view 层继续分叉。
  - `src/views/stats/**` 存在页面级视觉原语，说明页面层仍在承担 design-system 职责。
- 结论：
  - 当前 view 层不是“没接设计系统”，而是“接了一半”：壳子统一了，内部视觉实现没有真正统一。

### 子代理 3：商品 / 订单 / 采购域

- 子报告：`docs/reviews/2026-04-16-frontend-audit-agent-3-commerce-domain.md`
- 高严重度问题：
  - 采购域形成了一整套本地 modal / drawer 视觉系统，绕过 `Modal` 和 design-system 原语。核心文件包括：
    - `src/components/purchase-order/ProductPickerModal.vue`
    - `src/components/purchase-order/OrderPickerModal.vue`
    - `src/components/purchase-order/PurchaseOrderCreateDrawer.vue`
    - `src/components/purchase-order/PurchaseOrderDetailDrawer.vue`
    - `src/components/purchase-order/PurchaseOrderCostModal.vue`
    - `src/components/purchase-order/PurchaseOrderReceiptModal.vue`
    - `src/components/purchase-order/PurchaseOrderShortageModal.vue`
    - `src/components/purchase-order/PurchaseOrderReceiptReversalModal.vue`
    - `src/components/purchase-order/PurchaseOrderSuggestionsDrawer.vue`
    - `src/components/purchase-order/PurchaseOrderSupportOverlays.vue`
  - 商品/订单编辑链路大量直接使用原生表单控件，绕过 foundation。核心文件：
    - `src/components/order/OrderForm.vue`
    - `src/components/OrderStatusChanger.vue`
    - `src/components/product/ProductVariantTable.vue`
    - `src/components/product/VariantBatchBuilderModal.vue`
  - `src/components/product/ProductCreateModal.vue` 仍保留本地 modal 实现和本地 `svg` 图标系统，直接违反 `Modal` / `AppIcon` 基线。
- 反复出现的模式：
  - 原生控件 + utility class 冒充基础组件。
  - 业务组件本地自建 overlay shell、header 渐变、footer action bar。
  - 自制 card/chip/tag/table/stepper，没有上浮到 `ui` 或 `design-system/composed`。
  - `slate/emerald/amber/sky/violet`、`shadow-[...]`、`rounded-[...]`、`radial-gradient(...)`、`font-[Outfit]` 等 ad hoc 视觉写法。
  - 通过 `:style` 或局部 class 直接注入状态色，而不是统一给 `StatusBadge` 或共享状态映射。

### 子代理 4：空间 / 客户 / 设置 / 通用组件域

- 子报告：`docs/reviews/2026-04-16-frontend-audit-agent-4-space-customer-common.md`
- 高风险文件：
  - `src/components/SpaceProductEditor.vue`
  - `src/components/space/SpaceProductDetail.vue`
  - `src/components/space/SpaceMasonry.vue`
  - `src/components/customer/CustomerDetailPanel.vue`
  - `src/components/common/DestructiveConfirmModal.vue`
  - `src/components/common/AIChatWidget.vue`
  - `src/components/common/ai/AIChart.vue`
  - `src/components/salesperson/SalespersonSelectModal.vue`
  - `src/components/FileSelector.vue`
  - `src/components/settings/tabs/AISettings.vue`
- 最常见的违规模式：
  - 大量直接写 `button`、`input`、`textarea`、自建 dialog/switch，未收敛到 `AppButton`、`AppInput`、`Modal`、`EmptyState`、`StatusBadge`。
  - 本地 `svg` / 局部图标实现较多，没有统一走 `AppIcon`。
  - 白黑灰、红蓝品牌色、hex、`rgba(...)`、渐变、阴影、半透明遮罩、任意 `z-index` 在域组件中散落。
  - media/upload tile、detail modal shell、selection card、AI status/result card、share link field 等视觉原语重复实现。
  - `space/public viewer` 相关结构未充分收敛到 `PublicViewerShell`、`Lightbox`、`PasswordGate` 等已有 pattern。

### 子代理 5：小程序域

- 子报告：`docs/reviews/2026-04-16-frontend-audit-agent-5-minisales.md`
- 最高优先级问题：
  - 状态色和状态样式已经分叉成多套，并通过 `style="{{...}}"` 字符串直接注入模板。
  - 典型文件：
    - `minisales/miniprogram/utils/constants.ts`
    - `minisales/miniprogram/components/sales/order-card/index.ts`
    - `minisales/miniprogram/pages/detail/controller.ts`
    - `minisales/miniprogram/pages/stats/controller.ts`
- 建议优先统一的 3 个动作：
  - 统一状态配置：只保留 `statusKey/tone`，禁止继续返回 hex 和 `color/background` style 字符串。
  - 落共享原语：优先收敛 `StatusChip`、`SurfaceCard/SectionCard`、`OverlayPanel`。
  - 补语义 token：补齐 `surface-*`、`text-*`、`border-*`、`overlay-mask`、`shadow-overlay`、`chip-radius`，让 `app-shell`、`state-panel`、`custom-tab-bar` 全部改走该层。

## 优先治理顺序

### P0：先修共享层 contract

- 清除 `src/styles/main.css` 中遗留的 `.material-symbols-outlined` 支撑路径。
- 收敛 `StatusBadge` / `StatusSelector` / `MetricTile` / `AppCard` / `AppStatCard` 的 tone/status token contract。
- 处理 `PermissionDeniedState`、`ProductSpecCard`、`ProductSpecCardDemo` 这类共享层“第二视觉系统”。
- 清理高可见 `font-[Outfit]` 残留和 `AIChart` 字体特例。

### P1：收掉高扩散业务原语

- 采购域 modal / drawer / overlay 套系统一回收。
- 空间/公共组件域的 detail shell、AI 卡片、share field、upload/media tile 统一回收。
- 统一页面级 dashboard / stats 卡片和装饰模式，避免 view 层继续分叉。

### P2：统一状态与表单契约

- Web 端减少原生 `button/input/select/textarea`，高频表单链路强制走 foundation。
- 小程序端统一状态映射来源，禁止继续扩散 style 字符串。
- 对 Web + 小程序统一建立“状态 -> tone -> 组件表现”的映射关系。

### P3：补治理护栏

- 扩展现有 `scripts/qa/check-ui-token-integrity.mjs`：
  - 检查本地 `svg`
  - 检查 `font-[Outfit]`
  - 检查业务层原生控件
  - 检查未定义 token / ad hoc palette
- 为高风险共享组件补设计契约测试。

## 审查输出清单

- 总报告：
  - `docs/reviews/2026-04-16-frontend-design-system-audit.md`
- 子报告：
  - `docs/reviews/2026-04-16-frontend-audit-agent-1-shared-system.md`
  - `docs/reviews/2026-04-16-frontend-audit-agent-2-views.md`
  - `docs/reviews/2026-04-16-frontend-audit-agent-3-commerce-domain.md`
  - `docs/reviews/2026-04-16-frontend-audit-agent-4-space-customer-common.md`
  - `docs/reviews/2026-04-16-frontend-audit-agent-5-minisales.md`
