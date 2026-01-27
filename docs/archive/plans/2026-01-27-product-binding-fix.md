# 按钮及 UI 元素对比度修复计划

针对用户反馈的按钮文字在深色模式下（主要背景色变为浅色时）看不清的问题，我们将对所有使用 `bg-primary` 且硬编码 `text-white` 的组件进行修正。

## 变更范围

我们将使用项目定义的 CSS 变量 `text-[var(--text-inverse)]` 替换这些组件中的 `text-white`。该变量在浅色模式下为白色，在深色模式下会自动切换为深灰色，从而保证在任何背景下都有良好的对比度。

## 拟更改的组件

---

### 1. 登录与权限 (Auth & Access)
- [MODIFY] [OrderLogin.vue](file:///Users/kayla/Downloads/Code/KK-Image/src/components/order/OrderLogin.vue)
- [MODIFY] [PasswordGate.vue](file:///Users/kayla/Downloads/Code/KK-Image/src/components/common/PasswordGate.vue)
- [MODIFY] [SpacePassword.vue](file:///Users/kayla/Downloads/Code/KK-Image/src/components/space/SpacePassword.vue)

### 2. 共享空间 (Shared Spaces)
- [MODIFY] [SpaceFilesTab.vue](file:///Users/kayla/Downloads/Code/KK-Image/src/components/space/SpaceFilesTab.vue)
- [MODIFY] [SpaceMediaGrid.vue](file:///Users/kayla/Downloads/Code/KK-Image/src/components/space/SpaceMediaGrid.vue)
- [MODIFY] [FileSelector.vue](file:///Users/kayla/Downloads/Code/KK-Image/src/components/FileSelector.vue)

### 3. 系统与组件 (System Icons & Widgets)
- [MODIFY] [ReloadPrompt.vue](file:///Users/kayla/Downloads/Code/KK-Image/src/components/ReloadPrompt.vue)
- [MODIFY] [AIChatWidget.vue](file:///Users/kayla/Downloads/Code/KK-Image/src/components/common/AIChatWidget.vue)
- [MODIFY] [OrderStatusChanger.vue](file:///Users/kayla/Downloads/Code/KK-Image/src/components/OrderStatusChanger.vue) (二次检查确认所有按钮)

### 4. 商品详情 (Product Detail)
- [MODIFY] [status.js](file:///Users/kayla/Downloads/Code/KK-Image/src/utils/status.js): 添加 `getProductStatusVariant` 辅助函数。
- [MODIFY] [ProductDetail.vue](file:///Users/kayla/Downloads/Code/KK-Image/src/components/product/ProductDetail.vue): 修正 `StatusBadge` 的 prop 使用，确保正确显示状态标签和颜色。
- [MODIFY] [zh-CN.js](file:///Users/kayla/Downloads/Code/KK-Image/src/locales/zh-CN.js): 确保翻译键值一致。

### 5. Fix Product Binding Lock Logic
- [DEBUG] [OrderEditModal.vue](file:///Users/kayla/Downloads/Code/KK-Image/src/components/OrderEditModal.vue): Verify initialization logic.
- [VERIFY] [queries.js](file:///Users/kayla/Downloads/Code/KK-Image/functions/repositories/order/queries.js): Verify query includes `product_id`.
- [VERIFY] [helpers.js](file:///Users/kayla/Downloads/Code/KK-Image/functions/repositories/order/helpers.js): Verify mapper handles `product_id`.
- [VERIFY] [OrderRepository.js](file:///Users/kayla/Downloads/Code/KK-Image/functions/repositories/OrderRepository.js): Verify `findById` usage.


## 验证计划

1. **外观检查**: 打开商品详情弹窗，确认右上角的状态标签显示正确（如“上架”且有颜色）。
2. **构建验证**: 运行 `pnpm build` 确保没有引入语法错误。
