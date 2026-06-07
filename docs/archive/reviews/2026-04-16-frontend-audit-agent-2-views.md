# 前端设计规范审查 Agent 2（Views）

审查范围：

- `src/views/**`
- 已排除 `src/components/**` 与 `minisales/**`

基线文档：

- `docs/design-system/MASTER.md`
- `docs/design-system/foundations.md`
- `docs/design-system/patterns.md`
- `docs/design-system/typography.md`
- `docs/design-system/iconography.md`

以下仅记录确认存在的真实问题。

---

## `src/views/Space.vue`

- 文件路径：`src/views/Space.vue`
- 问题类型：未使用合适 shell；公共查看页自建页面骨架
- 证据：
  - 第 2 行到第 53 行整页直接用 `div` 自建 `min-h-screen` 容器、加载态、错误态和 footer。
  - 全文件没有引入或使用 `PublicViewerShell`。
- 为什么算违规：
  - `patterns.md` 明确把 `PublicViewerShell` 定义为 gallery / public space / viewer-style 页面模式。
  - 当前公共空间页属于典型 public viewer 场景，但页面骨架和 footer 由视图自己实现，导致公共查看类页面无法收敛到统一 shell。
- 建议修复方向：
  - 迁移到 `PublicViewerShell`。
  - 将加载态、错误态、主体内容、footer 分别塞进 shell 的 slot，保留模板差异仅在 `spaceComponent`。

## `src/views/Settings.vue`

- 文件路径：`src/views/Settings.vue`
- 问题类型：未使用共享 shell，页面级布局绕过 pattern 层
- 证据：
  - 第 2 行到第 24 行直接使用 `SettingsLayout` + `SettingsSidebar` 组织完整页面。
  - 第 31 行到第 35 行从组件层直接引入页面布局部件，而不是引入 `patterns.md` 中列出的 shell。
- 为什么算违规：
  - 这是典型“左侧导航 + 右侧内容”的页面级结构，属于 shell 应负责的层级。
  - `MASTER.md` 要求页面优先消费 pattern 层，而不是在 view 中直接拼装新的页面骨架。
- 建议修复方向：
  - 收敛到 `WorkflowDetailShell` 或 `ManagementListShell`。
  - 将设置侧栏作为 shell slot 内容，不再让 `src/views/Settings.vue` 直接持有自定义页面框架。

## `src/views/Dashboard.vue`

- 文件路径：`src/views/Dashboard.vue`
- 问题类型：在 `DashboardShell` 之外继续自建页面级视觉原语；直接写颜色/阴影
- 证据：
  - 第 2 行到第 9 行自建背景 blob，直接使用 `bg-purple-500/5`。
  - 第 65 行到第 98 行自建玻璃卡片、红色状态点、红色阴影与深色 hex，如 `bg-white/70`、`bg-red-500`、`shadow-[0_0_8px_rgba(239,68,68,0.5)]`、`dark:bg-[#0f1219]/50`。
  - 第 125 行到第 215 行共享链接/最近文件两个区域重复同一套自定义卡片视觉，而不是复用 `AppCard` 等现有封装。
  - 第 642 行到第 645 行在图表初始化中写死 `rgba(59, 130, 246, 1)`、`rgba(248, 113, 113, 1)`、`rgba(16, 185, 129, 1)`、`rgba(168, 85, 247, 1)`。
- 为什么算违规：
  - `MASTER.md` 要求页面不得定义自己的视觉原语。
  - 该页虽然挂了 `DashboardShell`，但实际又在 shell 里面实现了一套 page-local glass card、状态点、图表配色体系，脱离 foundation/composed 层。
- 建议修复方向：
  - 把这类卡片容器收敛为 `AppCard`/composed 模式，必要时先补系统能力。
  - 图表颜色改为从语义 token 或统一图表主题映射读取，不在页面里写死 RGBA/hex。

## `src/views/Stats.vue`

- 文件路径：`src/views/Stats.vue`
- 问题类型：页面直接写颜色、渐变和局部视觉体系
- 证据：
  - 第 4 行到第 19 行背景层使用 `bg-purple-500/20` 和内联 `linear-gradient(rgba(...))`。
  - 第 179 行到第 240 行排名徽标和状态卡直接写 `from-yellow-400 to-orange-500`、`border-yellow-500/20`、`text-amber-600`、`text-amber-400`。
  - 第 313 行到第 470 行 Chart.js 配置中写死 `#94a3b8`、`#64748b`、`#60a5fa`、`#2563eb`、`#fff` 以及多组 `rgba(...)`。
- 为什么算违规：
  - `MASTER.md` 明确要求使用语义 token 而不是 ad hoc color。
  - 当前统计页把品牌化视觉、图表调色板、暗色 tooltip 颜色都留在视图层，页面一旦复制，很容易继续分叉。
- 建议修复方向：
  - 将图表颜色和背景效果抽到共享图表主题或 token 映射。
  - 页面只消费 `DashboardShell`、`AppCard` 和 chart theme，不再直接持有具体色值。

## `src/views/stats/StatsCard.vue`

- 文件路径：`src/views/stats/StatsCard.vue`
- 问题类型：视图层自建卡片原语；本地颜色系统
- 证据：
  - 第 2 行到第 8 行定义了自己的卡片壳，直接使用 `border-white/10`、`bg-white/5`、`hover:shadow-[0_0_30px_rgba(...)]`。
  - 第 49 行到第 79 行本地维护 `colors` 映射，写死 `59,130,246`、`139,92,246`、`236,72,153` 等颜色值，并直接使用 `bg-purple-500/20`、`text-purple-500`。
- 为什么算违规：
  - `foundations.md` 已有 `AppCard`，`MASTER.md` 要求页面不能再定义自己的视觉 primitive。
  - 该文件位于 `src/views/stats/**`，但实际上承担了 page-level primitive 职责。
- 建议修复方向：
  - 删除本地卡片原语，改为 `AppCard`/`AppStatCard`。
  - 若统计卡片确有独特变体，应该先提升到 `src/design-system/composed/*`。

## `src/views/stats/StatsChartWrapper.vue`

- 文件路径：`src/views/stats/StatsChartWrapper.vue`
- 问题类型：视图层自建图表容器；本地颜色系统
- 证据：
  - 第 2 行到第 7 行直接定义容器视觉，使用 `border-gray-200`、`bg-white/80`、`shadow-sm`、`shadow-[0_0_8px_rgba(...)]`。
  - 第 25 行到第 30 行本地 `colors` 映射含 `245,158,11`、`bg-purple-500`、`var(--color-purple)`。
- 为什么算违规：
  - 这属于典型页面级视觉包装层，应该来自 foundation/composed，而不是 `src/views/stats/**` 本地生成。
  - 同时又引入了直接色值和局部 token。
- 建议修复方向：
  - 改用 `AppCard` 或新增共享 `ChartPanel` 组件。
  - 颜色全部收敛到设计系统语义 token。

## `src/views/GoodsOverview.vue`

- 文件路径：`src/views/GoodsOverview.vue`
- 问题类型：排版绕过设计系统；原生按钮；自定义渐变
- 证据：
  - 第 276 行到第 290 行多处使用 `font-[Outfit]`。
  - 第 325 行到第 339 行浮动操作栏直接写原生 `<button>`。
  - 第 501 行到第 505 行在 shimmer 样式里写死 `rgba(255, 255, 255, 0.06)` 和 `rgba(0, 0, 0, 0.04)` 渐变。
- 为什么算违规：
  - `typography.md` 明确禁止重新引入 `Outfit` 这类模块级字体实验。
  - `foundations.md` 已有 `AppButton`，浮动操作栏仍在视图层自定义按钮交互。
  - 骨架高光直接写渐变色，也违反了“页面不定义视觉 primitive”的基线。
- 建议修复方向：
  - 数值列改用共享 mono family，不再使用 `font-[Outfit]`。
  - 浮动操作栏按钮替换为 `AppButton`。
  - shimmer 效果迁到共享 Skeleton/placeholder 能力，或改为 token 驱动。

## `src/views/SpaceManager/index.vue`

- 文件路径：`src/views/SpaceManager/index.vue`
- 问题类型：本地 svg/icon 系统；原生按钮；直接颜色
- 证据：
  - 第 6 行到第 18 行页头新增按钮直接使用原生 `<button>` + 内联 `<svg>`。
  - 第 81 行到第 167 行卡片区域多处内联 `<svg>` 作为缺省图、共享状态、统计图标。
  - 第 120 行到第 126 行直接写 `bg-amber-500/90`、`text-white`。
  - 第 182 行到第 224 行在 `AppButton` 插槽中仍塞入本地 `<svg>`，未走 `AppIcon`。
- 为什么算违规：
  - `iconography.md` 明确要求 `AppIcon` 是唯一 icon 入口。
  - 页面既绕过了 `AppIcon`，又用原生按钮和页面级 badge 色值实现完整卡片系统。
- 建议修复方向：
  - 把缺失图标补进 `AppIcon`，所有本地 svg 全量替换。
  - icon-only 操作按钮统一为 `AppButton`/共享 IconButton 变体。
  - 共享/快照状态改用语义 badge/status 组件。

## `src/views/sales/SalesSpacesView.vue`

- 文件路径：`src/views/sales/SalesSpacesView.vue`
- 问题类型：本地 svg/icon；直接颜色；与空间管理页重复造布局
- 证据：
  - 第 24 行到第 26 行、第 50 行到第 52 行、第 74 行到第 76 行多处使用内联 `<svg>`。
  - 第 55 行到第 57 行模板标签直接写 `bg-black/50`、`text-white`。
  - 第 33 行到第 79 行的卡片结构，与 `src/views/SpaceManager/index.vue` 第 62 行到第 170 行高度相似，都是“封面图 + 模板 badge + 标题描述 + 底部辅助信息”的空间卡片。
- 为什么算违规：
  - `iconography.md` 禁止页面本地 icon 系统。
  - `patterns.md` 规定高层结构相近页面应收敛，而不是各自复制一套空间卡片实现。
- 建议修复方向：
  - 抽出共享 `SpaceCard`/`SpaceGrid` 到 composed 或 domain shared 层。
  - 模板标签和箭头图标改用 `AppIcon` 与语义 token。

## `src/views/sales/SalesFormView.vue`

- 文件路径：`src/views/sales/SalesFormView.vue`
- 问题类型：绕过 `AppButton`
- 证据：
  - 第 27 行到第 34 行错误提示里的重试操作直接使用原生 `<button>`。
- 为什么算违规：
  - 页面其余区域已经建立在设计系统之上，这里单独回退到原生按钮，会绕开共享的 hover/focus/disabled 契约。
- 建议修复方向：
  - 替换为 `AppButton` 小尺寸变体；如 Alert 区域需要特殊样式，优先补充共享 alert-action 模式。

## `src/views/FileManager/FileManagerToolbar.vue`

- 文件路径：`src/views/FileManager/FileManagerToolbar.vue`
- 问题类型：原生控件与按钮混用；直接颜色
- 证据：
  - 第 10 行到第 26 行 breadcrumb 导航直接使用原生 `<button>`。
  - 第 32 行到第 39 行、第 134 行到第 142 行上传入口通过原生 `<input type="file">` + 原生 `<button>` 自行实现。
  - 第 125 行到第 163 行分享、新建、回收站等操作按钮都直接使用原生 `<button>`。
  - 第 159 行直接使用 `hover:border-red-200 hover:bg-red-50`。
- 为什么算违规：
  - `foundations.md` 已经定义 `AppButton`/`AppInput` 的交互责任，但同一工具栏里同时出现封装按钮和原生按钮，导致状态、尺寸、焦点、hover 规则分裂。
  - 页面还直接写了红色 utility 值。
- 建议修复方向：
  - 工具栏所有可视按钮统一成 `AppButton` 或共享 icon-button 变体。
  - 如果文件选择能力缺失，先补一个共享 file-picker/button 封装，再替换页面内的原生实现。
  - 红色 hover 改成语义 danger token。

## `src/views/FileManager/TrashModal.vue`

- 文件路径：`src/views/FileManager/TrashModal.vue`
- 问题类型：原生按钮；自定义空态与渐变；局部 loading 原语
- 证据：
  - 第 27 行到第 58 行批量恢复、永久删除、清空回收站全部使用原生 `<button>`。
  - 第 66 行到第 68 行 loading 使用自绘 spinner `div`。
  - 第 78 行到第 79 行空态背景直接写 `bg-gradient-to-tr from-green-100 to-blue-50`。
  - 第 162 行到第 175 行行内操作再次使用原生 `<button>`。
- 为什么算违规：
  - 该弹窗已经使用 `Modal`、`AppTable`、`ConfirmDialog`，但关键操作层仍然绕过 foundation。
  - 空态和 loading 也没有复用共享状态组件，而是在视图层自定义视觉。
- 建议修复方向：
  - 全部操作按钮替换为 `AppButton`/共享 icon-button。
  - loading/empty 优先复用 `Skeleton`、`EmptyState` 或补系统级 modal-state 方案。
  - 渐变色改成设计系统 token，或直接删除多余装饰。

## `src/views/PurchaseOrders.vue`

- 文件路径：`src/views/PurchaseOrders.vue`
- 问题类型：列表页分页控件绕过 `AppButton`
- 证据：
  - 第 77 行到第 90 行上一页/下一页直接用原生 `<button>` 实现。
- 为什么算违规：
  - 该页已经是标准 `ManagementListShell` 列表页，分页动作仍直接写原生按钮，会让列表页底部交互和其他页的按钮契约不一致。
- 建议修复方向：
  - 改为 `AppButton` 小尺寸 outline/secondary 组合，或补统一 pagination pattern。

## `src/views/NotFound.vue`

- 文件路径：`src/views/NotFound.vue`
- 问题类型：原生按钮式链接；与 FileNotFound 重复布局
- 证据：
  - 第 9 行到第 14 行用 `router-link` 直接承载按钮样式。
  - 该块与 `src/views/FileNotFound.vue` 第 9 行到第 14 行完全同构。
- 为什么算违规：
  - 动作入口没有走 `AppButton`。
  - 两个结构几乎相同的错误页没有收敛成共享 pattern。
- 建议修复方向：
  - 抽出共享 `NotFoundState`/`ResourceMissingState` 视图模式。
  - 操作入口改为 `AppButton` + router-link 封装。

## `src/views/FileNotFound.vue`

- 文件路径：`src/views/FileNotFound.vue`
- 问题类型：原生按钮式链接；与 NotFound 重复布局
- 证据：
  - 第 9 行到第 14 行用 `router-link` 直接承载按钮样式。
  - 该块与 `src/views/NotFound.vue` 第 9 行到第 14 行完全同构。
- 为什么算违规：
  - 这是同一类缺失资源页面，但复用了 `EmptyState` 却没有复用统一 action/pattern。
- 建议修复方向：
  - 与 `NotFound.vue` 合并到共享错误页模式。
  - 动作入口统一改为 `AppButton`。
