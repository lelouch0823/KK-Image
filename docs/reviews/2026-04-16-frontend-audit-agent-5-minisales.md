# Minisales 小程序前端设计规范审查

审查范围：`minisales/miniprogram/**`

基线：
- `minisales/miniprogram/styles/variables.scss`
- `minisales/miniprogram/styles/mixins.scss`
- `minisales/miniprogram/components/sales/app-shell/**`
- `docs/design-system/MASTER.md`

## 结论

当前小程序端已经有 `variables.scss`、`mixins.scss` 和 `app.scss` 的基础层，但执行上存在明显绕过：

- 高优先级问题不是“个别 hardcode”，而是“状态色和状态样式体系已经分叉成多套”，并且通过 `style="{{...}}"` 字符串直接落到模板，设计系统无法集中治理。
- `sales/app-shell`、`sales/state-panel`、`sales/notification-drawer` 这些本该成为共享壳层/共享原语的组件，自己维护一套蓝灰视觉、badge、pill、drawer 样式，没有沉到底层 token 或共享 primitive。
- 多个页面重复定义 card/tag/chip/hero/guide/modal 视觉，虽然局部看起来接近，但 spacing、radius、shadow、颜色值并不统一，已经偏离 `MASTER.md` 的“先 token / 再 foundation component / 再 page shell”顺序。

## 逐文件问题

### `minisales/miniprogram/components/sales/app-shell/index.scss`

- 严重度：高
- 证据：`index.scss:1-90` 没有引入 `variables.scss` / `mixins.scss`；直接硬编码 `#ffffff`、`#f8fafc`、`#0f172a`、`#64748b`、`#eef2ff`、`#ef4444`、`#2563eb`；同时本地定义 `18rpx`、`20rpx`、`24rpx`、`32rpx`、`68rpx` 等 spacing/radius/size。
- 影响：`app-shell` 本应是共享壳层，但它自身脱离 token 层，后续任何品牌色、状态色、header 节奏调整都要改组件内部硬编码。
- 建议修复方向：为 `app-shell` 建立壳层语义 token，例如 `shell-surface-bg`、`shell-action-bg`、`shell-tab-bg`、`shell-tab-active-bg`、`shell-badge-danger-bg`、`shell-title-color`，并强制通过共享 token 引用。

### `minisales/miniprogram/components/sales/app-shell/index.wxml`

- 严重度：中
- 证据：`index.wxml:1` 使用 `style="padding-top: {{safeTop}}px;"`；`index.wxml:13` 直接渲染 badge 文本，但颜色完全由组件私有样式控制。
- 影响：安全区高度这种布局变量可接受，但 `app-shell` 当前既承载布局又承载私有视觉，导致页面只能被动继承这一套未 token 化的 header 视觉。
- 建议修复方向：保留安全区动态值，视觉部分改成由共享 shell token 和共享子原语控制。

### `minisales/miniprogram/components/sales/state-panel/index.scss`

- 严重度：高
- 证据：`index.scss:1-28` 没有引入 `variables.scss`；直接硬编码 `#ffffff`、`#64748b`、`#dc2626`、`#fee2e2`、`#b91c1c`，并本地定义 retry pill 的 `padding`、`radius`、字号。
- 影响：loading / error / empty 是全局状态原语，但这里又单独造了一套状态卡和错误按钮样式，状态色和交互按钮样式无法与其他模块统一。
- 建议修复方向：把 state panel 收敛成共享 foundation component，至少统一 `state-surface`、`state-text-muted`、`state-danger-text`、`state-danger-bg`、`state-chip-radius`。

### `minisales/miniprogram/components/sales/notification-drawer/index.scss`

- 严重度：高
- 证据：`index.scss:13-25`、`35-41`、`52`、`62`、`81`、`94-108`、`123-130` 使用大量 raw color 和阴影值，如 `rgba(15, 23, 42, 0.28)`、`#ffffff`、`#f8fafc`、`#2563eb`、`#fee2e2`、`#eff6ff`、`#94a3b8`、`0 20rpx 48rpx rgba(15, 23, 42, 0.18)`。
- 影响：drawer/mask/error retry/unread highlight 都是典型共享模式，但目前完全私有实现，已经形成第二套 modal/drawer 视觉语言。
- 建议修复方向：抽出共享 overlay token、panel token、unread highlight token、error action token；如果后续还有 picker/modal/drawer，统一复用这一层。

### `minisales/miniprogram/components/sales/notification-drawer/index.wxml`

- 严重度：中
- 证据：`index.wxml:12` 直接给 `t-icon` 传 `color="#475569"`。
- 影响：图标语义色没有进入样式层，后续主题切换或暗色适配时需要逐模板清理。
- 建议修复方向：使用 class 驱动图标色，或通过共享 icon tone 常量映射。

### `minisales/miniprogram/utils/constants.ts`

- 严重度：高
- 证据：`constants.ts:61-69` 定义了一套 `STATUS_CONFIG`，直接硬编码状态文字色与背景色。
- 影响：这是状态体系的“公共入口”，但它仍返回 raw hex，而不是状态语义 key；结果页面和组件继续复制颜色或在别处再定义一套更深/更浅的变体。
- 建议修复方向：把状态配置改为语义结构，例如 `{ label, tone: 'warning' | 'info' | 'success' | 'danger' | 'neutral' }`，颜色交给共享 status-chip/status-badge 组件或 CSS class。

### `minisales/miniprogram/components/sales/order-card/index.ts`

- 严重度：高
- 证据：`index.ts:12-23` 再次定义 `STATUS_META`，与 `utils/constants.ts` 重复；`index.ts:30-34` 又定义默认色；`index.ts:93` 拼接 `statusStyle: \`color:${meta.color};background:${meta.background};\``。
- 影响：订单列表状态色已经与全局状态配置分叉，且通过 style 字符串直接落模板，设计系统无法集中治理。
- 建议修复方向：删除本地颜色表，只保留状态 key；组件只消费共享状态配置并渲染统一的 status-chip。

### `minisales/miniprogram/components/sales/order-card/index.wxml`

- 严重度：高
- 证据：`index.wxml:20` 使用 `style="{{statusStyle}}"`。
- 影响：颜色和背景进入模板字符串，无法通过样式表、token lint 或主题切换统一控制。
- 建议修复方向：改为 `class="order-card__status order-card__status--{{statusTone}}"`，或直接替换为共享状态组件。

### `minisales/miniprogram/pages/detail/controller.ts`

- 严重度：高
- 证据：`controller.ts:108-118` 第三次定义 `STATUS_META`；`controller.ts:162-166` 定义默认色；`controller.ts:169-170` 再次拼 `color/background` style 字符串。
- 影响：订单详情链路完全绕开 `utils/constants.ts`，并复制了与 `order-card` 不同深浅的颜色值，状态色治理已经失控。
- 建议修复方向：详情页、列表页、摘要卡、行项目全部回到同一份状态配置，只传状态 key / tone，不传具体色值。

### `minisales/miniprogram/components/sales/order-summary/index.wxml`

- 严重度：高
- 证据：`index.wxml:21` 使用 `style="{{summary && summary.statusStyle}}"`。
- 影响：摘要卡仍在吃 controller 生成的内联颜色，和列表卡重复同类问题。
- 建议修复方向：替换为共享状态 pill 组件。

### `minisales/miniprogram/components/sales/order-lines/index.wxml`

- 严重度：高
- 证据：`index.wxml:22` 使用 `style="{{line.statusStyle}}"`。
- 影响：行项目状态又是一套内联样式入口，和订单卡、摘要卡一起形成多点失控。
- 建议修复方向：统一改为 `tone -> class` 或共享状态组件。

### `minisales/miniprogram/pages/stats/controller.ts`

- 严重度：高
- 证据：`controller.ts:35-50` 定义 `METRIC_TONES`，直接拼 `background/border/color` style 字符串。
- 影响：统计卡视觉完全由 JS 控制，脱离 SCSS token；这与 `MASTER.md` 明确禁止页面定义自己的视觉 primitive 相违背。
- 建议修复方向：把 metric tone 改为语义 key，例如 `metric--primary|success|accent`，样式进入共享组件层。

### `minisales/miniprogram/components/sales/stats-metric/index.wxml`

- 严重度：高
- 证据：`index.wxml:1-3` 连续三处使用 `style="{{...}}"` 渲染 card、label、value 颜色。
- 影响：统计卡已经不是“共享组件”，而是“共享结构 + 每页注入样式字符串”。
- 建议修复方向：让 `sales-stats-metric` 接收 `tone` 或 `variant`，禁止接收颜色 style 字符串。

### `minisales/miniprogram/pages/stats/stats.scss`

- 严重度：中
- 证据：`stats.scss:23-25`、`31`、`114-118` 继续使用 header gradient、边框蓝色和图表渐变 raw hex。
- 影响：即便后续把 `stats/controller.ts` 去 style string，这个页面仍然维护自己的 header-card 和图表品牌色。
- 建议修复方向：把统计卡 header、bar chart active/default 颜色纳入共享数据可视化 token。

### `minisales/miniprogram/pages/spaces/spaces.scss`

- 严重度：中
- 证据：`spaces.scss:25-30` 自定义 hero-card；`64` 定义占位背景；`103-110` 定义 tag pill，使用 `#eff6ff` / `#2563eb`。
- 影响：资源页自己造 hero-card 和 tag，而全局 `app.scss:62-68`、`273-279` 已有 `.card` / `.section` 基础样式，页面没有复用共享 primitive。
- 建议修复方向：把 hero/tag 收敛到共享 page-section / info-chip 组件或全局 class。

### `minisales/miniprogram/pages/spaces_detail/detail.scss`

- 严重度：中
- 证据：`detail.scss:21-27` 自定义 summary-card/section/template-shell；`55-62`、`71-76` 又定义一套 tag/meta pill，颜色是 `#eff6ff`、`#2563eb`、`#f8fafc`。
- 影响：资源详情页和资源列表页视觉接近但没有共享实现，后续微调会继续分叉。
- 建议修复方向：把 summary-card / meta-pill / template-shell 合并进共享 resource detail primitives。

### `minisales/miniprogram/pages/login/login.scss`

- 严重度：中
- 证据：`login.scss:7-10`、`22-23`、`39-40`、`70-76`、`84-85` 使用整页 radial gradient、卡片阴影、品牌渐变、tab 激活色、错误底色等 raw values。
- 影响：登录页完全游离于当前小程序 token 和 `app-shell` 视觉之外，单页拥有独立品牌表现，和订单/资源/统计页不是同一套产品。
- 建议修复方向：保留登录页差异化布局，但颜色、阴影、tabs、error chip 仍应走共享 token 和共享 auth-shell/component 体系。

### `minisales/miniprogram/pages/index/index.scss`

- 严重度：中
- 证据：`index.scss:22-29` 自定义搜索容器边框、背景、阴影，使用 `#dbe5f0`、`#ffffff`、`rgba(15, 23, 42, 0.06)`。
- 影响：搜索框卡片视觉未复用全局 `.card` / input 容器 token，页面局部样式与其他卡片体系并行。
- 建议修复方向：定义共享 search-anchor / toolbar-surface primitive，避免每页单独包壳。

### `minisales/miniprogram/pages/index/index.wxml`

- 严重度：中
- 证据：`index.wxml:2`、`34` 用内联 style 控制 header/spacer 高度；`81` 直接给 `t-fab` 写 `bottom/right/z-index`。
- 影响：高度类内联主要是布局问题，但 `fab` 位置也直接散落在模板，后续若统一浮动按钮规范，需要逐页回收。
- 建议修复方向：保留动态高度，`fab` 位置类应改成共享浮动操作布局 class。

### `minisales/miniprogram/pages/form/form.scss`

- 严重度：中
- 证据：`form.scss:17-28` 定义 guide-card 蓝底提示；`53-56` 自定义 bottom-bar 半透明背景和阴影。
- 影响：引导卡、底部提交栏是典型可复用模式，但当前仍是页面局部实现。
- 建议修复方向：抽出 `guide-banner`、`sticky-action-bar` 共享组件或全局样式。

### `minisales/miniprogram/components/sales/product-binding/index.scss`

- 严重度：中
- 证据：`index.scss:34-44` 定义动作 pill；`103-119` 定义自有 picker mask/panel；`182-185` 激活态蓝底；`223-228` variant 卡片边框底色均为 raw value。
- 影响：商品绑定组件内部又造了一套 modal/picker/card/select-item 体系，和通知 drawer、状态面板、表单底栏都没有共享约束。
- 建议修复方向：收敛为共享 `selection-sheet` / `choice-card` / `action-chip` 样式层。

### `minisales/miniprogram/components/sales/order-summary/index.scss`

- 严重度：中
- 证据：`index.scss:67-78` 状态 pill 与数量 pill 共享结构，但 `quantity` 仍写死 `#0f172a` / `#e2e8f0`；`4-9` 再造一套 card 样式。
- 影响：摘要卡没有复用 `app.scss` 中的 `.card/.section`，pill 也没和状态、meta、tag 体系合并。
- 建议修复方向：把 summary card 并入共享 card primitive，数量 pill 纳入统一 neutral chip token。

### `minisales/miniprogram/components/sales/order-lines/index.scss`

- 严重度：中
- 证据：`index.scss:75-80` 定义状态 pill 壳；`90-94` 定义指标小卡 `#f8fafc`；`4-8` 再定义 card 容器。
- 影响：行项目卡在共享 card 内部继续嵌套本地 metric card，spacing/radius 规则逐层漂移。
- 建议修复方向：建立统一 `metric-tile` / `chip` token，减少详情页私有布局原语。

### `minisales/miniprogram/components/sales/timeline-card/index.scss`

- 严重度：中
- 证据：`index.scss:53-60`、`70-71` 使用 `#e2e8f0` 和 `rgba(59, 130, 246, 0.12)` 定义时间线连接线和外发光。
- 影响：时间线强调色没有通过 token 表达，后续品牌色调整会漏掉这里。
- 建议修复方向：补齐 timeline-specific semantic token，如 `timeline-line-color`、`timeline-dot-ring-color`。

### `minisales/miniprogram/pages/detail/detail.wxml`

- 严重度：低
- 证据：`detail.wxml:45` 给文件占位图标直接传 `color="#64748b"`。
- 影响：模板层继续持有颜色值。
- 建议修复方向：改为 class 或共享 icon tone。

### `minisales/miniprogram/components/space-templates/gallery/index.wxml`

- 严重度：低
- 证据：`index.wxml:7`、`10` 给 `t-icon` 直接传 `color="#9ca3af"`。
- 影响：模板展示层携带颜色值，不利于统一治理。
- 建议修复方向：统一改为 class 或共享 icon tone。

### `minisales/miniprogram/components/space-templates/collection/index.wxml`

- 严重度：低
- 证据：`index.wxml:5`、`22`、`28` 分别写死 `#3b82f6`、`#9ca3af`、`#d1d5db`。
- 影响：合集模板的图标色与页面层 token 脱节。
- 建议修复方向：把模板图标色纳入共享 icon/color tone。

### `minisales/miniprogram/app.json`

- 严重度：中
- 证据：`app.json:31-32`、`61-63` 写死导航栏和 tabbar 颜色；`75-76` “资源” tab 仍复用 `orders` 图标资产。
- 影响：`app.json` 的颜色和 `custom-tab-bar` / 页面实际视觉未通过统一 token 管理；同时 tabbar 资源页图标语义不一致，视觉规范已经分叉。
- 建议修复方向：建立 tabbar token/配置层，统一 app.json、custom-tab-bar、图标资源和实际页面选中态。

### `minisales/miniprogram/custom-tab-bar/index.scss`

- 严重度：中
- 证据：`index.scss:5-6` 直接覆盖 `--td-tab-bar-border-color: #e2e8f0;`。
- 影响：tabbar 边框色仍是局部硬编码，无法和全局 surface/border token 同步。
- 建议修复方向：通过共享 token 注入 TDesign 变量，不要在单文件覆写 raw hex。

### `minisales/miniprogram/custom-tab-bar/index.wxml`

- 严重度：中
- 证据：`index.wxml:1-7` 使用 TDesign `icon="app"`、`icon="folder"`；而 `app.json:66-77` 又配置了 png 图标，并且资源页 png 还是订单图标。
- 影响：同一 tabbar 在配置层和组件层维护两套图标语义，规范不一致。
- 建议修复方向：明确单一图标来源，统一成同一套 token 和资产。

### `minisales/miniprogram/app.scss`

- 严重度：中
- 证据：`app.scss:62-68` 已有 `.card`；`71-108` 已有 `.btn`；`131-171` 已有 `.text-*`；`273-307` 已有 `.section`、`.empty-state`。
- 影响：基础层已经存在，但订单、资源、登录、表单、详情组件仍反复自定义 card/section/chip/state 容器，说明共享层没有真正成为页面唯一入口。
- 建议修复方向：不是继续新增散装 class，而是把现有 `.card/.section/.empty-state` 升级成明确的 foundation contract，并让业务页面强制消费。

## 最应该先收敛的共享 token / 共享组件 / 状态配置

### 1. 先收敛共享状态配置

- 最高优先级。
- 当前分散点：`utils/constants.ts`、`components/sales/order-card/index.ts`、`pages/detail/controller.ts`、`pages/stats/controller.ts`。
- 建议收敛结果：统一返回 `statusKey` / `tone` / `emphasis`，禁止返回颜色字符串；所有状态 badge/chip/metric tone 只认语义，不认 hex。

### 2. 先补齐共享 token

- 建议优先新增而不是继续直接复用原始颜色 token：
- `surface-subtle`
- `surface-elevated`
- `surface-info`
- `surface-danger`
- `border-subtle`
- `border-info`
- `text-primary`
- `text-secondary`
- `text-tertiary`
- `text-info`
- `text-danger`
- `overlay-mask`
- `shadow-overlay`
- `chip-radius`
- `card-radius-sm/md/lg`
- `space-card-padding-sm/md/lg`

### 3. 先收敛共享组件 / 原语

- `StatusChip`：订单状态、数量 pill、资源 tag、错误 retry pill 不应再各写一套。
- `SurfaceCard` / `SectionCard`：订单卡、摘要卡、详情 section、资源卡、hero-card、guide-card 应收敛到同一套 card primitive。
- `OverlayPanel`：通知 drawer、商品 picker、底部 sticky action bar 至少需要统一 mask、panel、header、action 区域样式契约。

## 建议的落地顺序

1. 先清理所有 `style="{{...}}"` 中的颜色/背景字符串，尤其是状态和统计卡。
2. 再把状态色、chip、card、overlay 提升为共享 token 和共享组件。
3. 最后统一 tabbar / app-shell / login / spaces 的页面壳层视觉，避免继续生长新的局部原语。
