<!-- eslint-disable vue/no-mutating-props -->
<template>
  <!-- 选项维度构建器 -->
  <div
    class="space-y-6 rounded-2xl border border-(--border-color) bg-linear-to-br from-(--bg-muted) to-(--bg-card) p-4 sm:p-6"
  >
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
        <AppButton variant="white" @click="$emit('batch-build')">
          <template #icon-left>
            <AppIcon name="sparkles" class="size-4.5" />
          </template>
          {{ t('product.form.batch_build_variants', 'Batch Build') }}
        </AppButton>
        <AppButton
          data-testid="product-option-add"
          class="shadow-primary/20 shadow-md"
          @click="$emit('add-option')"
        >
          <template #icon-left>
            <AppIcon name="plus" class="size-4.5" />
          </template>
          {{ t('product.form.add_option', 'Add Option') }}
        </AppButton>
      </div>
    </div>

    <!-- 选项列表 -->
    <div class="flex flex-col gap-6">
      <div
        v-for="(opt, idx) in options"
        :key="idx"
        class="group relative overflow-hidden rounded-2xl border border-(--border-color) bg-(--bg-card) shadow-card transition-all"
      >
        <div class="flex items-start p-5 sm:p-6">
          <!-- 拖拽把手图标 Placeholder -->
          <div
            class="mt-2 mr-3 flex shrink-0 cursor-grab text-(--text-muted) transition-colors hover:text-(--text-secondary) active:cursor-grabbing sm:mr-4"
          >
            <AppIcon name="bars-3" class="size-5" />
          </div>

          <div class="flex-1 space-y-6">
            <!-- 上半部：规格名称行 -->
            <div class="flex flex-col justify-between gap-4 md:flex-row md:items-center">
              <div class="max-w-sm flex-1">
                <label
                  class="mb-1.5 flex items-center gap-2 text-xs font-bold tracking-wider text-(--text-secondary) uppercase"
                >
                  {{ t('product.form.dimension_label', 'Specification Name') }}
                  <span
                    class="rounded-full bg-(--bg-muted) px-2 py-0.5 text-xs font-semibold tracking-normal text-(--text-secondary) normal-case"
                  >
                    {{ t('product.form.dimension_label_short', '维度') }} {{ idx + 1 }}
                  </span>
                </label>
                <AppInput
                  v-model="opt.name"
                  :data-testid="`product-option-name-${idx}`"
                  :placeholder="t('product.form.option_name', '例如: 颜色、尺寸 (Color, Size)')"
                  size="sm"
                  class="font-medium"
                  @update:model-value="$emit('generate-variants')"
                />
              </div>
              <AppButton
                variant="ghost"
                size="sm"
                class="self-end text-(--text-muted) hover:text-danger !h-9 !w-9 !gap-0 !px-0 [&_span]:hidden md:self-auto"
                :title="t('common.delete', 'Delete')"
                @click="$emit('remove-option', idx)"
              >
                <template #icon-left>
                  <AppIcon name="trash" class="size-5" />
                </template>
              </AppButton>
            </div>

            <!-- 下半部：规格值及输入区 -->
            <div>
              <label
                class="mb-2 flex items-center gap-2 text-xs font-bold tracking-wider text-(--text-secondary) uppercase"
              >
                {{ t('product.form.option_values_label', 'Options / Values') }}
                <StatusBadge
                  variant="primary"
                  class="rounded-full! px-2! py-0.5! text-xs tracking-normal normal-case"
                >
                  {{ opt.values.length }} {{ t('product.form.values_count', '值') }}
                </StatusBadge>
              </label>

              <!-- 已添加的活跃值 -->
              <div class="mb-4 flex flex-wrap gap-2">
                <div
                  v-for="(val, vIdx) in opt.values"
                  :key="vIdx"
                  class="border-primary/20 bg-primary/10 text-primary flex max-w-full min-w-0 items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition-all hover:bg-primary/20"
                >
                  <!-- 动态交互设色圆点 -->
                  <label
                    v-if="opt.metaMap && opt.metaMap[val] && opt.metaMap[val].color"
                    class="relative size-3 shrink-0 cursor-pointer rounded-full shadow-inner ring-1 ring-(--border-color)/50 transition-transform ring-inset hover:scale-110"
                    :style="{ backgroundColor: opt.metaMap[val].color }"
                    :title="t('product.form.edit_color', '点击修改颜色')"
                  >
                    <AppInput
                      v-model="opt.metaMap[val].color"
                      type="color"
                      class="absolute inset-0 opacity-0 [&_input]:cursor-pointer [&_input]:border-0 [&_input]:bg-transparent [&_input]:p-0"
                    />
                  </label>
                  <span class="max-w-[12rem] truncate" :title="val">{{ val }}</span>
                  <AppButton
                    variant="ghost"
                    size="sm"
                    :data-testid="`remove-value-${idx}-${vIdx}`"
                    class="text-primary/70 hover:text-primary !h-6 !w-6 !gap-0 !px-0 [&_span]:hidden"
                    @click="$emit('remove-value', opt, vIdx)"
                  >
                    <template #icon-left>
                      <AppIcon name="x-mark" class="size-4" />
                    </template>
                  </AppButton>
                </div>

                <!-- 归档历史值 -->
                <template v-if="Array.isArray(opt.archivedValues) && opt.archivedValues.length > 0">
                  <div
                    v-for="(archived, aIdx) in opt.archivedValues"
                    :key="`${archived.id || archived.value}-${aIdx}`"
                    class="flex max-w-full min-w-0 items-center gap-2 rounded-full border border-dashed border-(--border-strong) bg-(--bg-muted)/60 px-3 py-1.5 text-sm font-medium text-(--text-muted) transition-colors hover:border-(--border-color) hover:text-(--text-secondary)"
                  >
                    <span class="text-xs">[{{ t('product.form.archived_values', '已归档') }}]</span>
                    <span class="max-w-[10rem] truncate" :title="archived.value">{{
                      archived.value
                    }}</span>
                    <AppButton
                      variant="link"
                      size="sm"
                      :data-testid="`restore-value-${idx}-${aIdx}`"
                      class="text-primary ml-1"
                      :title="t('common.restore', 'Restore')"
                      @click="$emit('restore-value', opt, archived, aIdx)"
                    >
                      <template #icon-left>
                        <AppIcon name="arrow-path" class="size-4" />
                      </template>
                    </AppButton>
                  </div>
                </template>
              </div>

              <!-- 添加值操作区 -->
              <div class="flex max-w-sm items-center gap-3">
                <div class="relative flex-1">
                  <!-- AppInput自带圆角，我们加上 !bg-transparent 等覆盖 -->
                  <AppInput
                    v-model="opt.inputValue"
                    :data-testid="`product-option-value-${idx}`"
                    :placeholder="
                      isColorDimension(opt.name)
                        ? t('product.form.option_color_placeholder', '添加颜色 (如: 红色)')
                        : t('product.form.option_values_placeholder', '添加规格 (如: XL, M...)')
                    "
                    size="sm"
                    class="!border-dashed !border-(--border-strong) !bg-transparent"
                    @keydown.enter.prevent="
                      isColorDimension(opt.name)
                        ? $emit('add-value', opt, { color: pendingColorSelection })
                        : $emit('add-value', opt)
                    "
                  >
                    <template #append>
                      <AppButton
                        variant="ghost"
                        size="sm"
                        :disabled="!opt.inputValue"
                        class="text-primary hover:text-primary-hover !h-8 !w-8 !gap-0 !px-0 [&_span]:hidden"
                        @click="
                          isColorDimension(opt.name)
                            ? $emit('add-value', opt, { color: pendingColorSelection })
                            : $emit('add-value', opt)
                        "
                      >
                        <template #icon-left>
                          <AppIcon name="plus" class="size-5" />
                        </template>
                      </AppButton>
                    </template>
                  </AppInput>
                </div>

                <!-- 颜色提示按钮器 -->
                <div
                  v-if="isColorDimension(opt.name)"
                  class="hover:border-primary relative flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-(--border-color) bg-(--bg-card) shadow-sm transition-colors"
                  :title="t('product.form.select_color', '选择颜色')"
                >
                  <!-- Background hint div -->
                  <div
                    class="pointer-events-none absolute inset-1 rounded-md shadow-inner"
                    :style="{ backgroundColor: pendingColorSelection }"
                  ></div>
                  <!-- The invisible input covering it all -->
                  <AppInput
                    v-model="pendingColorSelection"
                    type="color"
                    class="absolute inset-0 opacity-0 [&_input]:h-full [&_input]:cursor-pointer [&_input]:border-0 [&_input]:bg-transparent [&_input]:p-0"
                    @update:model-value="handleColorSelect($event, opt)"
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
import AppButton from '@/components/ui/AppButton.vue';
import AppIcon from '@/components/ui/AppIcon.vue';
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
  'add-option', // 请求添加新维度
  'remove-option', // (idx) 请求删除维度
  'add-value', // (opt) 添加维度值
  'remove-value', // (opt, vIdx) 删除维度值
  'restore-value', // (opt, archived, aIdx) 恢复归档值
  'batch-build', // 打开批量构建器
  'generate-variants', // 通知重新生成变体
]);
</script>
