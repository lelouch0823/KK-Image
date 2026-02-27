<!-- eslint-disable vue/no-mutating-props -->
<template>
  <!-- 选项维度构建器 -->
  <div class="space-y-4 rounded-2xl border border-(--border-color) bg-linear-to-br from-(--bg-muted) to-(--bg-card) p-4">
    <!-- 标题 + 操作按钮 -->
    <div class="flex items-center justify-between">
      <div>
        <h4 class="font-bold text-(--text-main)">
          {{ t('product.form.options_title', 'Product Options') }}
        </h4>
        <p class="text-xs text-(--text-secondary)">
          {{ t('product.form.options_hint', '最多 3 个维度，支持归档与恢复') }}
        </p>
      </div>
      <div class="flex items-center gap-2">
        <button
          type="button"
          class="cursor-pointer rounded-lg border border-(--border-color) px-2 py-1 text-xs font-medium text-(--text-secondary) transition-colors hover:bg-(--bg-page)"
          @click="$emit('batch-build')"
        >
          {{ t('product.form.batch_build_variants', 'Batch Build') }}
        </button>
        <button
          type="button"
          class="flex cursor-pointer items-center gap-1 rounded-lg bg-primary/10 px-2 py-1 text-sm font-medium text-primary transition-colors hover:bg-primary/20 hover:text-primary-hover"
          @click="$emit('add-option')"
        >
          <svg class="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          {{ t('product.form.add_option', 'Add Option') }}
        </button>
      </div>
    </div>

    <!-- 选项列表 -->
    <div class="space-y-4">
      <div
        v-for="(opt, idx) in options"
        :key="idx"
        class="relative rounded-xl border border-(--border-color)/70 bg-(--bg-card) p-3 shadow-sm transition-shadow hover:shadow-md"
      >
        <!-- 删除按钮 -->
        <button
          type="button"
          class="absolute top-2 right-2 cursor-pointer text-(--text-muted) transition-colors hover:text-danger"
          @click="$emit('remove-option', idx)"
        >
          <svg class="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <!-- 维度标签 + 值计数 -->
        <div class="mb-2 flex items-center gap-2">
          <span class="rounded-full bg-(--bg-muted) px-2 py-0.5 text-[10px] font-semibold text-(--text-secondary)">
            {{ t('product.form.dimension_label', '维度') }} {{ idx + 1 }}
          </span>
          <span class="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
            {{ opt.values.length }} {{ t('product.form.values_count', '值') }}
          </span>
        </div>

        <!-- 维度名称输入 -->
        <div class="mb-2 w-2/3 pr-6">
          <AppInput
            v-model="opt.name"
            :placeholder="t('product.form.option_name', 'Option Name (e.g., Color)')"
            size="sm"
            @input="$emit('generate-variants')"
          />
        </div>

        <!-- 值输入 + tag chips -->
        <div>
          <AppInput
            v-model="opt.inputValue"
            :placeholder="t('product.form.option_values', 'Enter values separated by comma')"
            size="sm"
            @keydown.enter.prevent="$emit('add-value', opt)"
            @blur="$emit('add-value', opt)"
          />
          <!-- 活跃值 tags -->
          <div class="mt-2 flex flex-wrap gap-2">
            <span
              v-for="(val, vIdx) in opt.values"
              :key="vIdx"
              class="inline-flex items-center gap-1 rounded-full border border-(--border-color) bg-(--bg-muted) px-2.5 py-0.5 text-xs font-medium text-(--text-main)"
            >
              {{ val }}
              <button
                type="button"
                class="text-(--text-muted) hover:text-danger"
                @click="$emit('remove-value', opt, vIdx)"
              >
                &times;
              </button>
            </span>
          </div>
          <!-- 归档值恢复区 -->
          <div
            v-if="Array.isArray(opt.archivedValues) && opt.archivedValues.length > 0"
            class="mt-2 flex flex-wrap items-center gap-2"
          >
            <span class="text-[10px] text-(--text-secondary)">{{ t('product.form.archived_values', 'Archived') }}:</span>
            <span
              v-for="(archived, aIdx) in opt.archivedValues"
              :key="`${archived.id || archived.value}-${aIdx}`"
              class="inline-flex items-center gap-1 rounded-full border border-(--border-color)/60 bg-(--bg-page) px-2 py-0.5 text-xs text-(--text-secondary)"
            >
              {{ archived.value }}
              <!-- 保留 data-testid 供现有测试使用 -->
              <button
                type="button"
                :data-testid="`restore-value-${idx}-${aIdx}`"
                class="text-primary"
                @click="$emit('restore-value', opt, archived, aIdx)"
              >
                {{ t('common.restore', 'Restore') }}
              </button>
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useI18n } from '@/composables/useI18n';
import AppInput from '@/components/ui/AppInput.vue';

const { t } = useI18n();

defineProps({
  // form.options 数组（reactive 引用，直接修改）
  options: { type: Array, required: true },
});

defineEmits([
  'add-option',        // 请求添加新维度
  'remove-option',     // (idx) 请求删除维度
  'add-value',         // (opt) 添加维度值
  'remove-value',      // (opt, vIdx) 删除维度值
  'restore-value',     // (opt, archived, aIdx) 恢复归档值
  'batch-build',       // 打开批量构建器
  'generate-variants', // 通知重新生成变体
]);
</script>
