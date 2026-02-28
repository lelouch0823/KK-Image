<!-- eslint-disable vue/no-mutating-props -->
<template>
  <!-- 基础信息区域：名称、描述、品牌、系列、货币、分类、SPU、Slug -->
  <div class="space-y-6">
    <!-- 名称 + 描述 -->
    <div class="space-y-4">
      <AppInput
        v-model="form.name"
        :label="t('product.form.name')"
        :placeholder="t('product.form.name_placeholder')"
        required
      />
      <AppInput
        v-model="form.description"
        :label="t('product.form.description')"
        :placeholder="t('product.form.description_placeholder')"
        textarea
        :rows="3"
      />
    </div>

    <!-- 品牌 + 系列 + 货币 -->
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <AppInput
        v-model="form.brand"
        :label="t('order.form.brand')"
        :placeholder="t('order.form.brandPlaceholder')"
      />
      <AppInput
        v-model="form.series"
        :label="t('order.form.series')"
        :placeholder="t('order.form.seriesPlaceholder')"
      />
      <!-- 货币选择器 -->
      <div>
        <label class="mb-1.5 block text-sm font-medium text-(--text-main)">{{
          t('product.form.currency', 'Currency')
        }}</label>
        <select
          v-model="form.currency"
          class="focus:border-primary focus:ring-primary focus:ring-1 focus:outline-none w-full rounded-lg border border-(--border-color) bg-(--bg-card) px-3 py-2 text-sm text-(--text-main) transition-colors"
        >
          <option v-for="c in currencyOptions" :key="c.code" :value="c.code">
            {{ c.symbol }} {{ c.code }} — {{ c.label }}
          </option>
        </select>
      </div>
    </div>

    <!-- 分类 + SPU + Slug -->
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <AppInput
        v-model="form.category"
        :label="t('product.form.category')"
        :placeholder="t('product.form.category_placeholder')"
      />
      <AppInput
        v-model="form.spu"
        :label="t('product.form.spu')"
        placeholder="e.g. SPU-0001"
        class="font-mono uppercase"
      />
      <AppInput
        v-model="form.slug"
        :label="t('product.form.slug_seo')"
        :placeholder="t('product.form.slug_placeholder')"
      />
    </div>
  </div>
</template>

<script setup>
import { useI18n } from '@/composables/useI18n';
import AppInput from '@/components/ui/AppInput.vue';

// 使用组件内部的 i18n，不从父组件透传
const { t } = useI18n();

defineProps({
  // 共享的 reactive form 对象，直接修改无需 emit
  form: { type: Object, required: true },
  // 货币选项列表（从 useProductForm 传入）
  currencyOptions: { type: Array, required: true },
});
</script>
