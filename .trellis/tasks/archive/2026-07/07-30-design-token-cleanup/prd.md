# 前端设计 Token 统一化收尾

## Goal

消除前端所有残留的硬编码值（inline style、硬编码色值、任意字号、不一致圆角），确保每个组件严格使用设计 Token 体系。

## Requirements

1. CommandPalette.vue — 27 个 inline `:style` 改为 Tailwind utility class
2. PrintTemplate.vue — `@media print` 中硬编码 hex 色值改为 CSS 变量
3. AIChatWidget.vue — markdown-body 硬编码 font-size 改为 Tailwind type scale
4. ProductBindingSection.vue — `text-[13px]` 改为标准字号，`#94a3b8` 改为 token
5. PrintTemplateSettings.vue — `style="font-size: 12px"` 改为 Tailwind class
6. 视图层 card 容器圆角统一为 `rounded-2xl`（Gallery、Stats、FolderGrid 等）

## Acceptance Criteria

- [ ] CommandPalette 零 inline `:style` 绑定
- [ ] PrintTemplate 零硬编码 hex 色值
- [ ] AIChatWidget markdown-body 零硬编码 font-size
- [ ] ProductBindingSection 零任意值 class
- [ ] PrintTemplateSettings 零 inline style
- [ ] 视图层 card 容器统一 `rounded-2xl`
- [ ] `pnpm lint` 通过
- [ ] `pnpm qa:check-design-system` 通过

## Technical Notes

- Token 分层：primitive.css → semantic.css → themes.css
- Tailwind v4 @theme 注册在 main.css
- 打印模板用 `color: black` / `background: white` 是合理的（打印介质）
- COLOR_VALUE_MAP 中的 hex 是用户自定义商品颜色数据，非设计系统色值，保留
