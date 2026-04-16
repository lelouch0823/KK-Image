# 2026-04-16 Frontend Audit Agent 1 Shared System Audit

## 审查范围

- `src/styles/**`
- `src/components/ui/**`
- `src/design-system/**`
- `src/components/layout/**`

## 对照基线

- `docs/design-system/MASTER.md`
- `docs/design-system/foundations.md`
- `docs/design-system/patterns.md`
- `docs/design-system/typography.md`
- `docs/design-system/iconography.md`

## 发现的问题

### 高严重度

#### 1. 共享层仍保留绕过 `AppIcon` 的全局 Material Symbols 入口

- 文件路径: `src/styles/main.css`
- 证据:

```css
.material-symbols-outlined {
  font-family: 'Material Symbols Outlined';
}
```

- 违规类型: Iconography / 多图标系统并存
- 说明: `MASTER.md` 与 `iconography.md` 都要求 `AppIcon` 成为唯一图标入口；全局保留 `.material-symbols-outlined` 会继续为共享层和页面层提供绕过通道。
- 修复建议: 删除该全局类；需要新增图标时统一补到 `src/components/ui/AppIcon.vue`。

#### 2. `ProductSpecCard` 在 foundation 层重新发明了一套卡片/按钮/图标视觉原语

- 文件路径:
  - `src/components/ui/ProductSpecCard.vue`
  - `src/components/ui/ProductSpecCardDemo.vue`
- 证据:

```vue
<div class="rounded-xl border border-neutral-200 bg-white ...">
...
:class="[isFavorite ? 'scale-110 text-red-500' : 'text-neutral-400 ...']"
...
<svg ...>
...
default: 'text-white bg-neutral-900 hover:bg-neutral-800 ...'
```

- 违规类型: 语义 token 违规 / 未使用 `AppIcon` / 绕过封装组件
- 说明: 组件本体直接使用 `neutral/red/white/black` 工具类和本地 `svg`，并通过 `actionButtonClass` 暴露整段 ad hoc 视觉实现；Demo 文件继续用本地 `svg`、hex 颜色和 ad hoc button class 放大了这种偏离。
- 修复建议: 该组件应改为消费 `AppCard`、`AppButton`、`AppIcon` 与语义 token；若只是展示组件能力，Demo 层也应避免在共享 UI 目录里固化另一套视觉规范。

#### 3. 共享状态/色彩原语存在未定义 token 和大量 ad hoc 色阶映射

- 文件路径:
  - `src/components/ui/StatusSelector.vue`
  - `src/components/ui/AppCard.vue`
  - `src/components/ui/AppStatCard.vue`
  - `src/components/ui/StatusBadge.vue`
  - `src/design-system/composed/MetricTile.vue`
- 证据:

```js
production: 'bg-(--color-orange)',
arrived: 'bg-(--color-cyan)',
return map[status] || 'bg-gray-400';
```

```js
blue: 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]'
purple: 'border-purple-500/20 bg-purple-500/5 ...'
cyan: 'bg-cyan-500/10 text-cyan-500'
```

- 违规类型: 语义 token 违规 / 无效 alias / foundation 色彩原语漂移
- 说明: `StatusSelector` 使用了未在 token 层定义的 `--color-orange`，并回退到 `bg-gray-400`；`AppCard`、`AppStatCard`、`StatusBadge`、`MetricTile` 混用 `blue-500`、`purple-500`、`cyan-500` 和自写 RGBA glow，已经脱离共享 token 体系。
- 修复建议: 先在 token 层定义明确的 tone contract，再让这些组件只消费语义 tone；`StatusSelector` 应复用 `StatusBadge`/`AppTableStatusPill` 的状态视觉契约，而不是单独维护颜色映射。

#### 4. `PermissionDeniedState` 用 ad hoc 琥珀色方案和本地按钮样式绕过 foundation 契约

- 文件路径: `src/components/ui/PermissionDeniedState.vue`
- 证据:

```vue
class="... border-amber-200/70 bg-gradient-to-br from-amber-50 ... to-orange-50 ..."
...
class="... bg-amber-600 ... text-white ..."
class="... border-amber-300 bg-white ... text-amber-800 ..."
```

- 违规类型: foundation 层白灰/状态色直写 / 绕过 `AppButton`
- 说明: 这是 foundation 组件，但整套容器、文本、按钮、hover、focus 都直接写成 amber/orange/white 组合，没有经过语义 token，也没有复用 `AppButton`。
- 修复建议: 抽成共享 `warning`/`locked` 状态 token 组合，并把操作区迁回 `AppButton` 变体。

### 中低严重度

#### 5. `AppImage` 在共享层硬编码 radius/badge 视觉，并用 emoji 充当状态图标

- 文件路径: `src/components/ui/AppImage.vue`
- 证据:

```vue
<span v-if="status === 'blocked'" class="app-image__badge-blocked">🚫</span>
<span v-else-if="status === 'liked'" class="app-image__badge-liked">❤️</span>
```

```css
.app-image--rounded-sm { border-radius: 0.125rem; }
.app-image--rounded-full { border-radius: 9999px; }
.app-image__badge-blocked { background-color: rgba(239, 68, 68, 0.9); }
.app-image__badge-liked { background-color: rgba(236, 72, 153, 0.9); }
```

- 违规类型: spacing/radius/token 规范偏离 / 本地图标化实现
- 说明: 圆角刻度没有复用 radius token；badge 颜色直接写 `rgba(...)`；`blocked/liked` 用 emoji 而不是 `AppIcon`，会让共享图片原语继续扩散非统一图标语言。
- 修复建议: 圆角映射改为消费 `--radius-*`；badge 颜色改为语义 token；状态角标统一改走 `AppIcon` 或共享 badge contract。

#### 6. 布局层仍残留白/黑/琥珀色直写状态

- 文件路径:
  - `src/components/layout/Header.vue`
  - `src/components/layout/Sidebar.vue`
- 证据:

```vue
class="... bg-danger ... border border-white"
class="... border-amber-300 bg-amber-50 text-amber-700"
class="fixed inset-0 z-40 bg-black/50 ..."
class="... bg-gradient-to-br from-gray-800 to-black ... text-white"
```

- 违规类型: 语义 token 违规 / foundation 白灰 utility 直写
- 说明: Header 的通知状态和权限受限状态仍依赖 `white/amber` 直写；Sidebar 的遮罩与 logo 角标也直接写黑灰渐变，未经过共享 token。
- 修复建议: 通知/受限状态改为语义 token；遮罩优先复用 overlay token；若 logo 角标确属品牌特例，应在设计规范里显式声明例外范围。

#### 7. `AppTable` 仍使用自定义 arbitrary shadow，而不是共享阴影契约

- 文件路径: `src/components/ui/AppTable.vue`
- 证据:

```vue
'app-table--card rounded-2xl border border-(--border-color)/70 bg-(--bg-card) shadow-[0_10px_30px_rgba(15,23,42,0.05)]'
```

- 违规类型: shadow/token 规范偏离
- 说明: 表格卡片容器直接写了 RGBA 阴影值，而 token 层已经提供 `--shadow-sm/md/lg`。
- 修复建议: 将表格卡片阴影收敛到共享 shadow token 或统一的 Tailwind token utility。

## 未见明显问题

- `src/design-system/patterns/*` 这组页面 shell 基本遵循了 `patterns.md` 的共享壳层思路，未见重新造页面骨架的问题。
- `src/design-system/composed/ActionBar.vue`、`SummaryStrip.vue`、`PageHeader.vue`、`StatePanel.vue` 整体仍在 token/共享容器约束内。
- `src/components/ui/AppButton.vue`、`SearchInput.vue`、`ConfirmDialog.vue`、`Select.vue`、`ToastContainer.vue` 未见本轮重点关注项里的明显脱轨点。
