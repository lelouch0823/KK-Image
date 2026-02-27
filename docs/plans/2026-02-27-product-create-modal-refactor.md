# ProductCreateModal.vue 重构实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将 1101 行的 `ProductCreateModal.vue` 拆分为 1 个 composable + 4 个子组件，目标瘦身至 ~250 行

**Architecture:** 采用 Vue 3 Composition API 的 composable 提取模式 + 子组件拆分。composable 管理所有表单状态与纯逻辑，子组件各自负责独立的 UI 区块。主组件仅负责组装和编排。

**Tech Stack:** Vue 3 (`<script setup>`)、Tailwind CSS v4、Vitest + @vue/test-utils

---

## 文件拆分总览

| 原始区域 | 提取目标 | 预估行数 |
|---------|---------|---------|
| 表单状态 + CRUD + 货币 + 提交 | `useProductForm.js` | ~280 |
| 基础信息表单 (name/desc/brand...) | `ProductBasicInfoSection.vue` | ~90 |
| 选项维度构建器 (Options Builder) | `ProductOptionsBuilder.vue` | ~180 |
| 维度归档两步向导 | `DimensionArchiveModal.vue` | ~160 |
| 值归档确认弹窗 | `ValueArchiveModal.vue` | ~90 |
| 剩余（框架+组装） | `ProductCreateModal.vue` | ~250 |

---

## Proposed Changes

### Composable 层

#### [NEW] [useProductForm.js](file:///o:/Code/KK-Image/src/composables/useProductForm.js)

提取以下逻辑（从 `ProductCreateModal.vue` L534-L1099）：

**常量：**
- `CURRENCY_OPTIONS` / `CURRENCY_SYMBOLS` / `CURRENCY_CODE_SET` / `normalizeCurrencyCode()`

**响应式状态：**
- `form` reactive（name, description, brand, series, category, currency, spu, slug, images, options, variants）
- `imageObjects` ref
- `submitting` ref
- `showVariantImageManager` / `showVariantBatchBuilder` ref
- `dimensionArchiveWizard` reactive
- `valueArchiveWizard` reactive
- `variantLocalKeySeed` ref

**方法：**
- `resetForm()` / `fillFormFromData(data)`
- `parseJson()` / `toOptionModel()` / `buildOptionsFromDimensions()`
- `nextVariantLocalKey()` / `ensureVariantLocalKey()`
- `addOption()` / `removeOption(idx)` — 含 dimension archive 触发
- `addOptionValue(opt)` / `removeOptionValue(opt, vIdx)` / `restoreOptionValue(opt, archived, aIdx)`
- `closeDimensionArchiveWizard()` / `confirmDimensionArchive()`
- `closeValueArchiveWizard()` / `confirmValueArchive()`
- `generateVariants()` / `formatVariantSample(sample)`
- `handleUpdateVariantImages()` / `handleBatchBuilderApply()`
- `handleSubmit()` — 接受 `{ editMode, initialData, emit }` 参数
- `variantOptionsKey()`

**接口设计：**
```js
export function useProductForm({ editMode, initialData, emit }) {
  // ... 所有状态和方法
  return {
    // 状态
    form, imageObjects, submitting,
    showVariantImageManager, showVariantBatchBuilder,
    dimensionArchiveWizard, valueArchiveWizard,
    CURRENCY_OPTIONS, CURRENCY_SYMBOLS,
    // 方法
    resetForm, fillFormFromData, addOption, removeOption,
    addOptionValue, removeOptionValue, restoreOptionValue,
    closeDimensionArchiveWizard, confirmDimensionArchive,
    closeValueArchiveWizard, confirmValueArchive,
    generateVariants, formatVariantSample,
    handleUpdateVariantImages, handleBatchBuilderApply,
    handleSubmit,
  }
}
```

> [!IMPORTANT]
> composable 接收 `editMode`（computed/ref）、`initialData`（computed/ref）和 `emit` 函数作为参数，从而与父组件解耦。内部 watch 监听 `isOpen`（由父组件通过调用 `fillFormFromData`/`resetForm` 触发）。

---

### UI 组件层

#### [NEW] [ProductBasicInfoSection.vue](file:///o:/Code/KK-Image/src/components/product/ProductBasicInfoSection.vue)

从 `ProductCreateModal.vue` L49-L111 提取。

**Props:**
```js
defineProps({
  form: { type: Object, required: true },       // reactive form 对象
  currencyOptions: { type: Array, required: true },
})
```

**模板内容：**
- 名称 + 描述 (AppInput)
- 品牌 + 系列 + 货币选择器 (3列网格)
- 分类 + SPU + Slug (3列网格)

> [!NOTE]
> 该组件直接修改 `form` 属性（通过 reactive 引用传递），无需 emit 事件。这是 Vue 3 模式中常见的"共享 reactive 对象"方式，与 useProductForm composable 完美配合。

---

#### [NEW] [ProductOptionsBuilder.vue](file:///o:/Code/KK-Image/src/components/product/ProductOptionsBuilder.vue)

从 `ProductCreateModal.vue` L113-L241 提取。

**Props:**
```js
defineProps({
  options: { type: Array, required: true },       // form.options
})
```

**Events:**
```js
defineEmits([
  'add-option',          // 请求添加新选项
  'remove-option',       // (idx) 请求删除选项
  'add-value',           // (opt) 添加选项值
  'remove-value',        // (opt, vIdx) 删除选项值
  'restore-value',       // (opt, archived, aIdx) 恢复归档值
  'batch-build',         // 打开批量构建器
  'generate-variants',   // 通知 variants 需要重新生成
])
```

**模板内容：**
- Options 区域标题 + 批量构建/添加选项按钮
- v-for 遍历 options，每个 option card:
  - 删除按钮、维度标签、值计数
  - 名称 AppInput
  - 值输入 (enter/blur to add) + tag chips + 归档值恢复

---

#### [NEW] [DimensionArchiveModal.vue](file:///o:/Code/KK-Image/src/components/product/DimensionArchiveModal.vue)

从 `ProductCreateModal.vue` L316-L459 提取。

**Props:**
```js
defineProps({
  wizard: { type: Object, required: true },  // dimensionArchiveWizard reactive
})
```

**Events:**
```js
defineEmits(['close', 'confirm'])
```

**模板内容：**
- Step 1: 影响预览（受影响变体数 + 样本）
- Step 2: 策略选择（archive_variants / merge_keep）
- Footer: Cancel / Back / Next / Confirm 按钮

---

#### [NEW] [ValueArchiveModal.vue](file:///o:/Code/KK-Image/src/components/product/ValueArchiveModal.vue)

从 `ProductCreateModal.vue` L460-L530 提取。

**Props:**
```js
defineProps({
  wizard: { type: Object, required: true },  // valueArchiveWizard reactive
})
```

**Events:**
```js
defineEmits(['close', 'confirm'])
```

**模板内容：**
- 影响描述 + 受影响变体数
- 样本变体展示
- Footer: Cancel / Confirm 按钮

---

### 主组件重构

#### [MODIFY] [ProductCreateModal.vue](file:///o:/Code/KK-Image/src/components/product/ProductCreateModal.vue)

重构后的结构：

```vue
<template>
  <Teleport to="body">
    <div v-if="modelValue" ...>
      <!-- Backdrop -->
      <!-- Modal Container -->
        <!-- Header (保留) -->
        <!-- Content -->
          <form @submit.prevent="handleSubmit">
            <ProductBasicInfoSection :form="form" :currency-options="CURRENCY_OPTIONS" />
            <ProductOptionsBuilder
              :options="form.options"
              @add-option="addOption"
              @remove-option="removeOption"
              @add-value="addOptionValue"
              @remove-value="removeOptionValue"
              @restore-value="restoreOptionValue"
              @batch-build="showVariantBatchBuilder = true"
              @generate-variants="generateVariants"
            />
            <!-- Variants Matrix (保留，~20行) -->
            <!-- Images Uploader (保留，~10行) -->
          </form>
        <!-- Footer (保留) -->
      <!-- 子模态框 -->
      <VariantImageManagerModal ... />
      <VariantBatchBuilderModal ... />
      <DimensionArchiveModal
        :wizard="dimensionArchiveWizard"
        @close="closeDimensionArchiveWizard"
        @confirm="confirmDimensionArchive"
      />
      <ValueArchiveModal
        :wizard="valueArchiveWizard"
        @close="closeValueArchiveWizard"
        @confirm="confirmValueArchive"
      />
    </div>
  </Teleport>
</template>

<script setup>
import { computed, watch, toRef } from 'vue'
import { useProductForm } from '@/composables/useProductForm'
// ... 子组件 imports

const props = defineProps({ ... })
const emit = defineEmits([...])

const {
  form, imageObjects, submitting,
  showVariantImageManager, showVariantBatchBuilder,
  dimensionArchiveWizard, valueArchiveWizard,
  CURRENCY_OPTIONS, CURRENCY_SYMBOLS,
  resetForm, fillFormFromData,
  addOption, removeOption,
  addOptionValue, removeOptionValue, restoreOptionValue,
  closeDimensionArchiveWizard, confirmDimensionArchive,
  closeValueArchiveWizard, confirmValueArchive,
  generateVariants, handleUpdateVariantImages,
  handleBatchBuilderApply, handleSubmit,
} = useProductForm({
  editMode: toRef(props, 'editMode'),
  initialData: toRef(props, 'initialData'),
  emit,
})

// watch isOpen
watch(() => props.modelValue, (isOpen) => {
  if (isOpen) {
    props.editMode && props.initialData
      ? fillFormFromData(props.initialData)
      : resetForm()
  }
}, { immediate: true })
</script>
```

---

### 测试更新

#### [MODIFY] 5 个测试文件

现有 `__tests__/ProductCreateModal.*.test.js` 通过 `wrapper.vm.form`、`wrapper.vm.removeOption()` 等访问组件内部状态。由于 composable 的返回值在组件 `<script setup>` 中自动暴露到 `wrapper.vm`，**多数测试无需修改**。

需要确认/调整的点：
- mock 路径从 `@/composables/useProducts` 可能需要额外 mock `@/composables/useProductForm`（如果 composable 内部直接调用 useProducts）
- 子组件 stub 列表可能需要新增 `ProductBasicInfoSection`, `ProductOptionsBuilder`, `DimensionArchiveModal`, `ValueArchiveModal`

---

## Verification Plan

### Automated Tests

**运行所有现有测试：**

```bash
pnpm test -- --run src/components/product/__tests__/
```

预期：全部通过（5 个 ProductCreateModal 相关测试 + 其他组件测试）

**Build 验证：**

```bash
pnpm run build
```

预期：无错误

### Manual Verification

> [!TIP]
> 请在完成重构后，在运行的 dev 环境中手动测试以下流程：

1. 打开**创建产品**弹窗 → 填写基础信息 → 添加 2 个选项维度 → 确认变体自动生成 → 提交
2. 打开**编辑产品**弹窗 → 删除一个维度 → 确认归档向导正常弹出（2步） → 完成归档
3. 编辑模式下 → 删除某个选项值 → 确认值归档向导正常弹出 → 完成归档
4. 批量构建按钮功能正常
5. 变体图片管理弹窗正常
