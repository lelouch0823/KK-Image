# 2026-04-16 Frontend Audit Agent 4 Audit

## 范围与基线

- 审查范围：`src/components/space/**`、`src/components/customer/**`、`src/components/settings/**`、`src/components/salesperson/**`、`src/components/common/**`、`src/components/outbox/**` 以及用户点名的 `SpaceAnalytics.vue`、`SubspaceList.vue`、`SpaceProductEditor.vue`、`SpaceCreateModal.vue`、`SpaceDetailModal.vue`、`FileSelector.vue`、`Share*.vue`、`MoveItemModal.vue`、`TagModal.vue`、`ReloadPrompt.vue`。
- 设计基线：`docs/design-system/MASTER.md`、`foundations.md`、`patterns.md`、`typography.md`、`iconography.md`。
- 只记录有问题的文件；未列出文件视为本轮未发现明确设计规范违规。

## 高风险文件

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

## 逐文件问题

### `src/components/SpaceProductEditor.vue` — High

- 基础层绕过严重：整个编辑器自己实现了遮罩、抽屉/弹窗壳、页签、表单、底部操作栏，未复用 `Modal`、`AppInput`、`AppButton`。证据：`src/components/SpaceProductEditor.vue:2-9`、`109-184`、`213-239`、`345-351`。
- 图标系统绕过：关闭、提示、警告、预览、加号等都直接写内联 `svg`。证据：`35-42`、`88-100`、`217-230`、`283-290`、`297-304`、`318-325`。
- token 漂移明显：直接写 `bg-black/50`、`bg-white`、`dark:bg-gray-900`、`border-blue-500/20`、`bg-blue-50/50`、`bg-amber-50/80`、`text-white`。证据：`3`、`8`、`87-99`、`246`、`259-270`。
- 原语重复：媒体管理、上传触发、分享设置、编辑布局已形成独立视觉系统，和 `SpaceFilesTab`、`SpaceMediaGrid`、`FileSelector`、`Modal` 分叉。
- 修复建议：收敛成 `Modal` 驱动的 `SpaceEditorShell`；文本字段改用 `AppInput`；CTA 和 icon-only 操作改用 `AppButton`；全部图标切到 `AppIcon`；媒体区复用现有 uploader/lightbox primitives，而不是再造一套。

### `src/components/space/SpaceProductDetail.vue` — High

- public viewer 结构未收敛到 `PublicViewerShell`，自己实现了页面容器、媒体区、信息栏、移动端 sticky CTA。证据：`src/components/space/SpaceProductDetail.vue:2-4`、`187-329`；基线见 `src/design-system/patterns/PublicViewerShell.vue:1-11`。
- viewer 原语重复：文件预览、PDF 预览、缩略图导航、移动端底栏、下载 CTA 都是本地实现；同仓库已有 `Lightbox` 和公共 gate/pattern。证据：`68-84`、`123-183`、`255-327`。
- 视觉 token 违规较多：`text-red-500`、`bg-black/50`、`bg-white`、`ring-[var(--color-primary-light,rgba(...))]`、`border-[var(...)]`、`shadow-[...]`、`bg-[var(...)]`。证据：`26`、`79`、`116`、`147-160`、`209-210`、`260`、`292`、`309`、`318`。
- 基础控件绕过：多处原生 `button`/`a` 承担主次操作，没有经过 `AppButton`。证据：`37-64`、`78-83`、`100-108`、`123-135`、`154-163`、`266-279`、`315-326`。
- 修复建议：外层换到 `PublicViewerShell`，图片查看切到 `Lightbox`，下载与切换动作改用 `AppButton`，把 sticky action bar、thumbnail rail、PDF card 抽成 viewer 级 composed primitives。

### `src/components/space/SpaceMasonry.vue` — High

- public gallery 自建页面骨架，没有用 `PublicViewerShell`。证据：`src/components/space/SpaceMasonry.vue:2-3`。
- lightbox 直接本地实现，仓库已有 `src/components/ui/Lightbox.vue`。证据：`77-97`。
- 视觉 token 直接写死：`from-black/60`、`bg-black/95`、`bg-white/10`、`bg-white/20`、`text-white`。证据：`65-67`、`80-92`。
- 主操作按钮未用 `AppButton`。证据：`15-28`、`91-96`。
- 修复建议：以 `PublicViewerShell + Lightbox + AppButton` 收敛；把下载按钮和卡片 overlay 提成公共 viewer action primitive。

### `src/components/FileSelector.vue` — High

- 在 `Modal` 里仍大量使用原生按钮与定制 footer，绕过 `AppButton`。证据：`src/components/FileSelector.vue:25-41`、`147-164`。
- 文件夹/文件卡片自建视觉原语，与 `SpaceFilesTab`、`SpaceMediaGrid`、`ImageUploader` 的卡片系统重复。证据：`53-91`、`94-131`。
- token 漂移：`bg-(--color-info-bg)`、`ring-(--color-primary-light)`、`bg-surface`、`shadow-lg` 等在一个选择器里混用。证据：`56-60`、`70-75`、`155`。
- 修复建议：保留业务逻辑，替换为 `AppButton` footer；把 folder/file tile 抽成共享 chooser tile primitive；复用 `EmptyState` 处理空态。

### `src/components/customer/CustomerDetailPanel.vue` — High

- 直接自建 slide-over，对 `Modal` 基础层形成分叉。证据：`src/components/customer/CustomerDetailPanel.vue:2-29`。
- 遮罩与容器直接写灰色和阴影：`bg-gray-500`、`bg-opacity-75`、`shadow-xl`。证据：`12`、`19`。
- 修复建议：扩展 `Modal` 支持 slide-over variant，或新增 shared `Drawer/SlideOver` foundation；不要在域组件里继续维护弹层栈、遮罩和动画。

### `src/components/common/DestructiveConfirmModal.vue` — High

- 完整自建确认弹窗，绕过 `Modal`、`AppInput`、`AppButton`、`AppIcon`，与现有 `ConfirmDialog` 能力重叠。证据：`src/components/common/DestructiveConfirmModal.vue:2-67`。
- 本地 SVG 多处重复：危险图标、loading spinner。证据：`16-18`、`60-63`。
- 视觉 token 直接定制：`shadow-xl`、`text-white`、`hover:bg-(--color-danger-text)` 等在域组件里定义按钮视觉。证据：`13`、`56-57`。
- 修复建议：把“输入确认型 destructive dialog”能力补到 `ConfirmDialog`/`Modal` 基础层；当前组件逻辑只保留文案与校验条件。

### `src/components/common/AIChatWidget.vue` — High

- 自建浮动窗口壳体，未复用任何 shared shell/panel primitive。证据：`src/components/common/AIChatWidget.vue:3-27`、`150-159`。
- 表单层绕过明显：附件按钮、文本输入、发送按钮、关闭按钮、清空按钮全是原生按钮/输入。证据：`44-58`、`101-145`。
- 图标与 token 违规：局部 `bg-red-500`、`hover:bg-red-600`、`bg-white/20`、`hover:bg-white/10`、自定义 resize `svg`。证据：`35`、`47`、`54`、`103`、`156-158`。
- 该文件还把卡片、上传预览、输入区、header controls 组合出一整套 AI widget 视觉语言，和 `ActionPreviewCard` / `ActionResultCard` / `ChatMessage` 一起形成孤岛。
- 修复建议：抽 `AssistantPanel` composed primitive，内部只允许 `AppButton`/`AppInput`/`AppIcon`；附件预览和窗口控制改成共享 action chips；resize handle 图标并入 `AppIcon`。

### `src/components/common/ai/AIChart.vue` — High

- 直接写十余个 hex fallback，违反 `MASTER.md` “Use semantic tokens, not ad hoc colors / direct brand hex literals” 规则。证据：`src/components/common/ai/AIChart.vue:89-101`、`133`、`145`、`148`。
- typography 明确违规：图例字体强行回退到 `'Outfit', 'Inter', sans-serif`，违反 `typography.md`。证据：`192`。
- 卡片壳自己写：`bg-card/50 border-border ... backdrop-blur-sm`，没有复用 `AppCard` 或 chart container primitive。证据：`2-5`。
- 修复建议：颜色 fallback 只读 design token；字体回到 shared sans；把图表容器收敛成 shared chart/card primitive。

### `src/components/salesperson/SalespersonSelectModal.vue` — High

- 在 `Modal` 内绕过 `AppInput`/`AppButton`：搜索框、取消/确定按钮全是原生实现。证据：`src/components/salesperson/SalespersonSelectModal.vue:18-21`、`100-110`。
- 自建 checkbox/radio/头像视觉 family，包含渐变、阴影、白色 dot。证据：`52-74`。
- token 漂移：`text-white`、`bg-gradient-to-br`、`shadow-primary/30`、`dark:*` 状态全在域组件里定义。证据：`56-57`、`64`、`72-73`、`107`。
- 修复建议：搜索改为 `AppInput` 或 `SearchInput`，操作按钮改为 `AppButton`，选择器补 shared `AppCheckbox/AppRadioChip/AppAvatar` primitive，别再让选择行自己决定视觉系统。

### `src/components/settings/tabs/AISettings.vue` — High

- 基础层绕过大面积存在：密码显示 toggle、dynamic fallback switch、health window number input、fetch/test/add/set-primary/refresh/save 等操作都没有用 `AppButton`/`AppInput`/foundation switch。证据：`src/components/settings/tabs/AISettings.vue:32-39`、`53-71`、`131-145`、`155-175`、`192-226`、`253-262`、`286-294`。
- 该页自己造了多种 chip/card/status block：selected model card、vision badge、connection result、health stats card。证据：`84-151`、`178-281`。
- 修复建议：补齐 shared `AppSwitch`/numeric input pattern；所有 CTA 统一回 `AppButton`；把 model chip、health stat tile、connection state block 抽到 composed 层。

### `src/components/SubspaceList.vue` — High

- 大量本地 SVG，违反 `AppIcon` 单入口。证据：`src/components/SubspaceList.vue:13-20`、`40-47`、`57-60`、`86-98`、`118-137`、`152-174`。
- 空态、卡片、状态 pill、hover action 都是本地重做，没有收敛到 `EmptyState`、`AppCard`、`StatusBadge`。证据：`35-61`、`66-179`。
- 删除按钮直接写 `hover:bg-red-100`，属于域内直写颜色。证据：`164-165`。
- 修复建议：空态切回 `EmptyState`，状态切到 `StatusBadge`，卡片外壳尽量用 `AppCard`；所有 icon-left 插槽都传 `AppIcon`，不要再嵌内联 `svg`。

### `src/components/space/SpaceFilesTab.vue` — High

- 顶部两个主要操作按钮都是手写视觉，而不是 `AppButton`。证据：`src/components/space/SpaceFilesTab.vue:10-27`。
- 文件卡片 overlay 与 `SpaceMediaGrid`、`UploadPreviewItem` 高度重复。证据：`54-105`。
- token 漂移：`bg-black/40`、`hover:bg-red-600`。证据：`85`、`99`。
- 修复建议：提炼 shared media tile action primitive，toolbar 全部换到 `AppButton`。

### `src/components/space/SpaceMediaGrid.vue` — High

- 媒体 tile、overlay actions、cover badge 与 `SpaceFilesTab`/`UploadPreviewItem` 重复造轮子。证据：`src/components/space/SpaceMediaGrid.vue:27-83`。
- 直接写颜色：`bg-blue-500/90`、`bg-white/90`、`hover:bg-white`。证据：`21`、`61-68`。
- 主动作按钮未走 `AppButton`。证据：`59-70`、`89-94`。
- 修复建议：抽统一 media tile / media overlay action 组件；商品图 badge 也应走语义 badge，而不是蓝色硬编码。

### `src/components/space/SpaceShareCard.vue` — Medium

- 分享开关、密码锁开关、复制按钮、密码输入都是原生控件，没有使用 shared foundation。证据：`src/components/space/SpaceShareCard.vue:32-42`、`55-61`、`72-91`。
- 本地 switch 视觉与 `AISettings`、`WatermarkSettings` 各写一套。证据：`39-41`、`79-81`。
- 修复建议：新增 shared `AppSwitch` 后统一替换；复制按钮用 `AppButton`；密码输入改 `AppInput`。

### `src/components/space/SpacePassword.vue` — Medium

- 与 `src/components/common/PasswordGate.vue` 语义重复，却又单独实现了一套输入卡。证据：`src/components/space/SpacePassword.vue:2-30`。
- 仍使用原生 input/button。证据：`16-25`。
- 修复建议：删除该特化实现，直接收敛到 `PasswordGate`；如果 `PasswordGate` 不够，再先补 shared 能力。

### `src/components/customer/CustomerDetailContent.vue` — Medium

- 头部关闭、tab、编辑/删除操作都绕过 `AppButton`。证据：`src/components/customer/CustomerDetailContent.vue:10-16`、`36-48`、`58-71`。
- 订单空态与订单卡片是手写视觉，没有用 `EmptyState` / `AppCard`。证据：`142-178`。
- 修复建议：抽 shared tab trigger/button variant；历史订单列表收敛到 `AppCard` 或表格卡片原语。

### `src/components/SpaceAnalytics.vue` — Medium

- loading/error/empty state 均为本地实现，没有用 `Skeleton`、`EmptyState`、`AsyncStatePanel`。证据：`src/components/SpaceAnalytics.vue:4-33`、`88-123`。
- 空态图标仍是内联 `svg`。证据：`108-120`。
- chart tooltip 使用硬编码 `rgba(0, 0, 0, 0.8)`。证据：`208`。
- 修复建议：状态区用 shared async-state primitive；range toggle 补 shared segmented control；tooltip 配色只从 semantic token 读取。

### `src/components/SpaceCreateModal.vue` — Medium

- 同一个 `Modal` 里混用了 `AppInput` 和原生 `input/textarea/button`，foundation contract 不一致。证据：`src/components/SpaceCreateModal.vue:15-32`、`41-46`、`86-92`、`109-121`。
- 模板 tile 与 footer CTA 自己定义视觉，和 `AppButton` variant 分叉。证据：`15-24`、`117-118`。
- 修复建议：文本域与名称输入全部回到 `AppInput`；footer 统一 `AppButton`；模板选择如需保留卡片式交互，应抽成共享 selector tile。

### `src/components/SpaceDetailModal.vue` — Medium

- tab triggers 和 footer actions 都是原生按钮。证据：`src/components/SpaceDetailModal.vue:36-69`、`117-128`。
- `SpaceDetailModal`、`CustomerDetailContent`、`SpaceProductEditor` 都在手写同类 tab/header/footer 模式，说明应补 shared modal-tab shell。
- 修复建议：至少把 footer 收敛到 `AppButton`；中期抽 `ModalTabs` 或 `DetailModalShell`。

### `src/components/MoveItemModal.vue` — Medium

- 仍有本地 SVG icon。证据：`src/components/MoveItemModal.vue:25-38`、`56-58`。
- loading 与 empty 仍是手写 spinner / text block，没有走 `EmptyState`。证据：`11-13`、`62-67`。
- 修复建议：图标改 `AppIcon`，空态改 `EmptyState` 或更轻量 shared state block。

### `src/components/TagModal.vue` — Medium

- tag chip 用原生 button 自建视觉，没有共享 tag/badge primitive。证据：`src/components/TagModal.vue:33-44`。
- 直接写颜色值：fallback `#94a3b8` 与运行时 `hsl(...)` 生成。证据：`41`、`93-95`。
- 修复建议：如果标签颜色是业务需求，应把颜色约束迁到 shared `TagChip`/palette utility，使用受控语义色板而非任意 HSL。

### `src/components/ReloadPrompt.vue` — Medium

- 本地 SVG icon，未用 `AppIcon`。证据：`src/components/ReloadPrompt.vue:9-36`。
- 两个 CTA 直接写原生按钮。证据：`46-58`。
- 直接写 `text-green-500` 和 `z-[100]`。证据：`4`、`11`。
- 修复建议：优先复用 toast/notification pattern；至少把按钮和 icon 收回 foundation。

### `src/components/settings/tabs/WatermarkSettings.vue` — Medium

- 开关是本地实现，和 `AISettings`/`SpaceShareCard` 再次分叉。证据：`src/components/settings/tabs/WatermarkSettings.vue:16-29`。
- 范围输入与颜色输入没有 shared foundation 承接。证据：`60-97`。
- 默认颜色直接写 `#ffffff`。证据：`141`。
- 保存按钮仍是原生按钮。证据：`103-111`。
- 修复建议：补 `AppSwitch`、`AppRange`、`AppColorInput`；保存操作切回 `AppButton`。

### `src/components/settings/tabs/BackupSettings.vue` — Medium

- header action 和 table row action 都是手写按钮，绕过 `AppButton`。证据：`src/components/settings/tabs/BackupSettings.vue:9-17`、`44-50`。
- 既然已使用 `AppTable`，行级操作更应保持 `AppButton` 一致性。
- 修复建议：统一改为 `AppButton`，不要在 `SettingsSection` 中继续散落原生 CTA。

### `src/components/salesperson/SalespersonDetailModal.vue` — Medium

- footer CTA 和复制按钮是原生按钮。证据：`src/components/salesperson/SalespersonDetailModal.vue:76-82`、`90-104`。
- avatar 直接写渐变、阴影、白字视觉。证据：`20-21`。
- 修复建议：CTA 切到 `AppButton`；头像样式抽成 shared avatar badge primitive。

### `src/components/salesperson/SalespersonCards.vue` — Medium

- 卡片头 avatar 直接写 gradient/shadow family。证据：`src/components/salesperson/SalespersonCards.vue:37-38`。
- action bar 中复制/编辑/删除都是原生 icon button。证据：`69-94`。
- 卡片本身与 `CustomerCards`/`SubspaceList` 一样在各自发明 hover card primitive。
- 修复建议：复用 `AppCard` + shared icon-button variant；avatar 抽到 shared `InitialAvatar`。

### `src/components/ShareFileModal.vue` — Medium

- 只读链接字段仍用原生 `input` + legacy `input` class，而不是 `AppInput` 或专用 share link field。证据：`src/components/ShareFileModal.vue:44-50`。
- 修复建议：做一个 shared `ShareLinkField` composed primitive，处理只读、复制、选中反馈。

### `src/components/ShareFolderModal.vue` — Medium

- 现有分享链接和生成后链接都用原生 `input`。证据：`src/components/ShareFolderModal.vue:39-45`、`98-104`。
- 信息提示块也是本地 info banner 视觉。证据：`27-37`、`63-73`。
- 修复建议：链接字段抽共享组件；banner 若会复用，应抽 shared `InfoNotice`/`StatePanel`。

### `src/components/ShareManagementModal.vue` — Medium

- code cell 的复制按钮仍是原生按钮。证据：`src/components/ShareManagementModal.vue:33-39`。
- footer 分页还在使用 legacy `btn btn-secondary` class，明显绕过 design system。证据：`86-99`。
- 修复建议：分页切换到 shared `Pagination` 或 `AppButton`；copy icon button 用 `AppButton` ghost/sm。

### `src/components/common/NotificationList.vue` — Medium

- 直接写 `text-gray-400`、`text-gray-200`、`hover:bg-black/5` 等颜色。证据：`src/components/common/NotificationList.vue:23`、`34`、`80`。
- “全部已读”和单条“标记已读”都是原生按钮。证据：`11-17`、`78-85`。
- 空态是手写，没有复用 `EmptyState`。证据：`30-36`。
- 修复建议：色值回到 semantic token；按钮与空态都走 shared foundation。

### `src/components/common/uploader/UploadPreviewItem.vue` — Medium

- 替换与删除操作使用内联 SVG，未接入 `AppIcon`。证据：`src/components/common/uploader/UploadPreviewItem.vue:33-45`、`53-60`。
- overlay 颜色直接写 `bg-black/40`、`bg-white/90`、`bg-black/50`、`text-white`。证据：`21-25`、`67-75`。
- 该 tile 与 `SpaceMediaGrid`/`SpaceFilesTab` 高度重复，应成为共享 media/upload tile。
- 修复建议：抽 shared `MediaTile`/`UploadTile`，统一 overlay action 与 cover badge。

### `src/components/common/uploader/UploadButton.vue` — Medium

- 本地 `svg` 加号图标，未用 `AppIcon`。证据：`src/components/common/uploader/UploadButton.vue:6-18`。
- 上传按钮自己定义 dashed tile 视觉，和 `FileSelector`/`SpaceFilesTab` 的 add-tile 分叉。
- 修复建议：图标切到 `AppIcon`，按钮外壳收敛到共享 upload trigger primitive。

### `src/components/common/uploader/UploadProcessingIndicator.vue` — Medium

- loading spinner 仍是本地 `svg`。证据：`src/components/common/uploader/UploadProcessingIndicator.vue:5-23`。
- 处理状态 tile 也是独立视觉原语，应该并到共享 uploader primitive。
- 修复建议：用 `AppIcon` spinner 或 shared processing tile。

### `src/components/common/ai/ActionPreviewCard.vue` — Medium

- 预览卡、section card、cell chip、确认按钮全部是 ad hoc 视觉，没有复用 `AppCard`/`AppButton`。证据：`src/components/common/ai/ActionPreviewCard.vue:2-26`、`29-57`。
- 修复建议：把 AI preview 卡片体系抽到 composed 层，不要在业务组件里继续定义圆角、阴影、chip 样式。

### `src/components/common/ai/ActionResultCard.vue` — Medium

- 结果卡直接写带 fallback 的绿色边框/背景：`#bbf7d0`、`#f0fdf4`。证据：`src/components/common/ai/ActionResultCard.vue:2`。
- 与 `ActionPreviewCard`、`SlotQuestionCard` 一样在本地定义卡片语言。
- 修复建议：共享 AI result/success card primitive，颜色只读 token，不带 hex fallback。

### `src/components/common/ai/ChatMessage.vue` — Medium

- report CTA 使用自定义渐变按钮 `from-info to-purple`，违反 shared button contract。证据：`src/components/common/ai/ChatMessage.vue:65-71`。
- 用户图片边框使用 `border-white/30`，thinking dots 也在本地定义动画视觉。证据：`29`、`47-50`。
- 修复建议：report CTA 改为 `AppButton`；把 AI message bubble/secondary chips 抽成 shared assistant primitives。

### `src/components/common/ai/SlotQuestionCard.vue` — Medium

- 本地自建 chips、候选按钮、已选块。证据：`src/components/common/ai/SlotQuestionCard.vue:2-79`。
- 多处 `button` 负责核心交互，但没有使用 `AppButton`。证据：`34-44`、`64-69`。
- 修复建议：抽 shared choice chip / choice list primitive，减少 AI 子组件重复定义。

### `src/components/common/ai/AISuggestions.vue` — Medium

- 建议项 chips 全部是本地按钮视觉。证据：`src/components/common/ai/AISuggestions.vue:2-8`。
- 修复建议：收敛为 shared `SuggestionChip` 或 `AppButton` ghost/link 变体。

### `src/components/common/PasswordGate.vue` — Medium

- 虽然已用 `AppInput`，但提交按钮仍是原生按钮。证据：`src/components/common/PasswordGate.vue:24-31`。
- 它已经接近可复用公共 gate；和 `SpacePassword.vue` 的分叉说明这里应继续完成 foundation 化。
- 修复建议：把 submit 收敛到 `AppButton`，再让 public password flows 全部复用这一份。

## 横向模式结论

- Foundation bypass 是本轮最普遍问题：大量域组件在已有 `Modal`、`AppButton`、`AppInput`、`StatusBadge`、`EmptyState` 旁边继续手写按钮、输入框、对话框和空态。
- AppIcon 单入口还未真正落实：`SpaceProductEditor`、`SubspaceList`、`ReloadPrompt`、`MoveItemModal`、uploader primitives 等仍保留大量内联 `svg`。
- 视觉 token 治理不稳定：白/黑/灰、红/蓝品牌色、渐变、阴影、`rgba(...)`、hex fallback 在多个模块重复出现，尤其集中在 public viewer、AI、salesperson。
- 组件原语重复集中在 4 类：media/upload tile、modal/detail shell、selection chips/cards、AI status/result cards。
- public viewer 相关还未收敛：`SpaceMasonry.vue`、`SpaceProductDetail.vue`、`SpacePassword.vue` 各自维护页面壳、lightbox/gate/CTA，建议统一朝 `PublicViewerShell`、`Lightbox`、`PasswordGate` 收口。
