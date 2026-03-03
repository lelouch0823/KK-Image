<!-- eslint-disable vue/no-mutating-props -->
<template>
  <!-- 选项维度构建器 -->
  <div class="space-y-6 rounded-2xl border border-(--border-color) bg-linear-to-br from-(--bg-muted) to-(--bg-card) p-4 sm:p-6">
    <!-- 标题 + 操作按钮 -->
    <div class="flex flex-col justify-between gap-4 md:flex-row md:items-center">
      <div>
        <h4 class="text-lg font-black tracking-tight text-(--text-main)">
          {{ t('product.form.options_title', 'Product Options') }}
        </h4>
        <p class="mt-1 text-xs text-(--text-secondary)">
          {{ t('product.form.options_hint', '最多 3 个维度，支持归档与恢复') }}
        </p>
      </div>
      <div class="flex items-center gap-3">
        <button
          type="button"
          class="flex items-center gap-2 rounded-lg border border-(--border-color) bg-(--bg-card) px-4 py-2 text-sm font-medium text-(--text-secondary) shadow-sm transition-colors hover:bg-(--bg-page) hover:text-(--text-main)"
          @click="$emit('batch-build')"
        >
          <span class="material-symbols-outlined text-[18px]">auto_awesome</span>
          {{ t('product.form.batch_build_variants', 'Batch Build') }}
        </button>
        <button
          type="button"
          class="bg-primary shadow-primary/20 flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold text-(--text-inverse) shadow-md transition-all hover:bg-primary-hover active:scale-95"
          @click="$emit('add-option')"
        >
          <span class="material-symbols-outlined text-[18px]">add</span>
          {{ t('product.form.add_option', 'Add Option') }}
        </button>
      </div>
    </div>

  <!-- 选项列表 -->
    <div class="flex flex-col gap-6">
      <div
        v-for="(opt, idx) in options"
        :key="idx"
        class="group relative overflow-hidden rounded-xl border border-(--border-color) bg-(--bg-card) shadow-sm transition-all"
      >
        <div class="flex items-start p-5 sm:p-6">
          <!-- 拖拽把手图标 Placeholder -->
          <div class="mt-2 mr-3 flex shrink-0 cursor-grab text-(--text-muted) transition-colors hover:text-(--text-secondary) active:cursor-grabbing sm:mr-4">
            <span class="material-symbols-outlined text-xl">drag_indicator</span>
          </div>

          <div class="flex-1 space-y-6">
            <!-- 上半部：规格名称行 -->
            <div class="flex flex-col justify-between gap-4 md:flex-row md:items-center">
              <div class="max-w-sm flex-1">
                <label class="mb-1.5 flex items-center gap-2 text-xs font-bold tracking-wider text-(--text-secondary) uppercase">
                  {{ t('product.form.dimension_label', 'Specification Name') }}
                  <span class="rounded-full bg-(--bg-muted) px-2 py-0.5 text-[10px] font-semibold tracking-normal text-(--text-secondary) normal-case">
                    {{ t('product.form.dimension_label_short', '维度') }} {{ idx + 1 }}
                  </span>
                </label>
                <AppInput
                  v-model="opt.name"
                  :placeholder="t('product.form.option_name', '例如: 颜色、尺寸 (Color, Size)')"
                  size="sm"
                  class="font-medium"
                  @input="$emit('generate-variants')"
                />
              </div>
              <button
                type="button"
                class="hover:text-danger self-end p-2 text-(--text-muted) transition-colors md:self-auto"
                :title="t('common.delete', 'Delete')"
                @click="$emit('remove-option', idx)"
              >
                <span class="material-symbols-outlined text-[20px]">delete</span>
              </button>
            </div>

            <!-- 下半部：规格值及输入区 -->
            <div>
              <label class="mb-2 flex items-center gap-2 text-xs font-bold tracking-wider text-(--text-secondary) uppercase">
                {{ t('product.form.option_values_label', 'Options / Values') }}
                <StatusBadge variant="primary" class="rounded-full! px-2! py-0.5! text-[10px] tracking-normal normal-case">
                  {{ opt.values.length }} {{ t('product.form.values_count', '值') }}
                </StatusBadge>
              </label>

              <!-- 已添加的活跃值 -->
              <div class="mb-4 flex flex-wrap gap-2">
                <div
                  v-for="(val, vIdx) in opt.values"
                  :key="vIdx"
                  class="border-primary/20 bg-primary/10 text-primary flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition-all hover:bg-primary/20"
                >
                  <!-- 动态交互设色圆点 -->
                  <label 
                    v-if="opt.metaMap && opt.metaMap[val] && opt.metaMap[val].color" 
                    class="relative size-3 shrink-0 cursor-pointer rounded-full shadow-inner ring-1 ring-black/10 transition-transform ring-inset hover:scale-110"
                    :style="{ backgroundColor: opt.metaMap[val].color }"
                    :title="t('product.form.edit_color', '点击修改颜色')"
                  >
                      <input 
                          v-model="opt.metaMap[val].color" 
                          type="color" 
                          class="absolute size-0 opacity-0" 
                      />
                  </label>
                  <span>{{ val }}</span>
                  <button
                    type="button"
                    class="text-primary/70 flex items-center justify-center transition-colors hover:text-primary"
                    @click="$emit('remove-value', opt, vIdx)"
                  >
                    <span class="material-symbols-outlined text-[16px]">close</span>
                  </button>
                </div>

                <!-- 归档历史值 -->
                <template v-if="Array.isArray(opt.archivedValues) && opt.archivedValues.length > 0">
                  <div
                    v-for="(archived, aIdx) in opt.archivedValues"
                    :key="`${archived.id || archived.value}-${aIdx}`"
                    class="flex items-center gap-2 rounded-full border border-dashed border-(--border-strong) bg-(--bg-muted)/60 px-3 py-1.5 text-sm font-medium text-(--text-muted) transition-colors hover:border-(--border-color) hover:text-(--text-secondary)"
                  >
                    <span class="text-[10px]">[{{ t('product.form.archived_values', '已归档') }}]</span>
                    <span>{{ archived.value }}</span>
                    <button
                      type="button"
                      :data-testid="`restore-value-${idx}-${aIdx}`"
                      class="text-primary ml-1 flex items-center font-bold hover:text-primary-hover"
                      :title="t('common.restore', 'Restore')"
                      @click="$emit('restore-value', opt, archived, aIdx)"
                    >
                      <span class="material-symbols-outlined text-[16px]">restore</span>
                    </button>
                  </div>
                </template>
              </div>

              <!-- 添加值操作区 -->
              <div class="flex max-w-sm items-center gap-3">
                <div class="relative flex-1">
                  <!-- AppInput自带圆角，我们加上 !bg-transparent 等覆盖 -->
                  <AppInput
                    v-model="opt.inputValue"
                    :placeholder="isColorDimension(opt.name) ? t('product.form.option_color_placeholder', '添加颜色 (如: 红色)') : t('product.form.option_values_placeholder', '添加规格 (如: XL, M...)')"
                    size="sm"
                    class="!border-dashed !border-(--border-strong) !bg-transparent"
                    @keydown.enter.prevent="isColorDimension(opt.name) ? $emit('add-value', opt, { color: pendingColorSelection }) : $emit('add-value', opt)"
                  >
                    <template #append>
                      <button
                        type="button"
                        :disabled="!opt.inputValue"
                        class="text-primary flex items-center justify-center transition-colors hover:text-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
                        @click="isColorDimension(opt.name) ? $emit('add-value', opt, { color: pendingColorSelection }) : $emit('add-value', opt)"
                      >
                        <span class="material-symbols-outlined">add_circle</span>
                      </button>
                    </template>
                  </AppInput>
                </div>

                <!-- 颜色提示按钮器 -->
                <div v-if="isColorDimension(opt.name)" class="hover:border-primary relative flex size-10  shrink-0 items-center justify-center overflow-hidden rounded-lg border border-(--border-color) bg-(--bg-card) shadow-sm transition-colors" :title="t('product.form.select_color', '选择颜色')">
                  <!-- Background hint div -->
                  <div class="pointer-events-none absolute inset-1 rounded-md shadow-inner" :style="{ backgroundColor: pendingColorSelection }"></div>
                  <!-- The invisible input covering it all -->
                  <input 
                      v-model="pendingColorSelection" 
                      type="color"
                      class="absolute -inset-2 size-16 cursor-pointer opacity-0"
                      @input="handleColorSelect($event, opt)"
                      @change="handleColorSelect($event, opt)"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useI18n } from '@/composables/useI18n';
import AppInput from '@/components/ui/AppInput.vue';
import StatusBadge from '@/components/ui/StatusBadge.vue';

const { t } = useI18n();

const isColorDimension = (name) => {
    if (!name) return false;
    const lower = name.toLowerCase();
    return lower.includes('color') || lower.includes('颜色') || lower.includes('色');
};
const pendingColorSelection = ref('#000000');

const handleColorSelect = (_event, _opt) => {
  // We no longer auto-fill the input with the hex color.
  // The selected color is kept in pendingColorSelection and will be attached
  // to the metaMap when the "Add" button is clicked.
};

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
