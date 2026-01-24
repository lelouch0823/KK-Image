<template>
  <div>
    <h4
      class="text-primary mb-4 border-b border-[var(--border-color)] pb-2 text-sm font-medium"
    >
      {{ t('order.detail.currentInfo') }}
    </h4>

    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <!-- 状态修改 (已移移动到 Modal 顶部) -->

      <!-- 商品名称 (全宽) -->
      <div class="md:col-span-2">
        <label class="text-secondary mb-1 block text-xs font-medium">{{
          t('order.form.productName')
        }}</label>
        <input :value="modelValue.name" class="input" @input="updateField('name', $event.target.value)" />
      </div>

      <!-- 品牌 -->
      <div>
        <label class="text-secondary mb-1 block text-xs font-medium">{{
          t('order.form.brand')
        }}</label>
        <input :value="modelValue.brand" class="input" @input="updateField('brand', $event.target.value)" />
      </div>

      <!-- 系列 -->
      <div>
        <label class="text-secondary mb-1 block text-xs font-medium">{{
          t('order.form.series')
        }}</label>
        <input :value="modelValue.series" class="input" @input="updateField('series', $event.target.value)" />
      </div>

      <!-- 款号 (SKU) -->
      <div>
        <label class="text-secondary mb-1 block text-xs font-medium">{{ t('order.form.sku') }}</label>
        <input :value="modelValue.sku" class="input" @input="updateField('sku', $event.target.value)" />
      </div>

      <!-- 规格尺寸 -->
      <div>
        <label class="text-secondary mb-1 block text-xs font-medium">{{
          t('order.form.size')
        }}</label>
        <input :value="modelValue.size" class="input" @input="updateField('size', $event.target.value)" />
      </div>

      <!-- 颜色 -->
      <div>
        <label class="text-secondary mb-1 block text-xs font-medium">{{
          t('order.form.color')
        }}</label>
        <input :value="modelValue.color" class="input" @input="updateField('color', $event.target.value)" />
      </div>

      <!-- 材质 -->
      <div>
        <label class="text-secondary mb-1 block text-xs font-medium">{{
          t('order.form.material')
        }}</label>
        <input :value="modelValue.material" class="input" @input="updateField('material', $event.target.value)" />
      </div>

      <!-- 期望到货时间 -->
      <div>
        <label class="text-secondary mb-1 block text-xs font-medium">{{
          t('order.form.expectedArrival')
        }}</label>
        <input
          :value="modelValue.deadline"
          type="date"
          :min="minDate"
          class="input appearance-none"
          :class="{ 'text-muted': !modelValue.deadline }"
          @input="updateField('deadline', $event.target.value)"
        />
      </div>

      <!-- 状态 (仅管理员可见) -->
      <div v-if="showStatus">
        <label class="text-secondary mb-1 block text-xs font-medium">{{ t('order.status') }}</label>
        <StatusSelector
          :model-value="modelValue.status"
          :options="statuses"
          class="w-full"
          @update:model-value="updateField('status', $event)"
        />
      </div>

      <!-- 备注 (全宽) -->
      <div class="md:col-span-2">
        <label class="text-secondary mb-1 block text-xs font-medium">{{
          t('order.form.remark')
        }}</label>
        <textarea
          :value="modelValue.remark"
          rows="3"
          class="input h-auto resize-none py-2"
          @input="updateField('remark', $event.target.value)"
        ></textarea>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { getTodayISOString } from '@/utils/common';
import StatusSelector from '@/components/ui/StatusSelector.vue';

const props = defineProps({
  modelValue: {
    type: Object,
    required: true,
  },
  showStatus: {
    type: Boolean,
    default: false,
  },
  statuses: {
    type: Array,
    default: () => ['pending', 'confirmed', 'production', 'shipping', 'completed', 'rejected', 'void'],
  },
});

const emit = defineEmits(['update:modelValue']);

const { t } = useI18n();
const minDate = computed(() => getTodayISOString());

const updateField = (field, value) => {
  emit('update:modelValue', { ...props.modelValue, [field]: value });
};
</script>
