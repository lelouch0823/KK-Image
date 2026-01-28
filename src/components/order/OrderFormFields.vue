<template>
  <div>
    <h4
      class="mb-4 border-b border-(--border-color) pb-2 text-sm font-medium text-(--text-main)"
    >
      {{ t('order.detail.currentInfo') }}
    </h4>

    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <!-- 商品名称 (全宽) -->
      <div class="md:col-span-2">
        <AppInput
          :model-value="modelValue.name"
          :label="t('order.form.productName')"
          :disabled="disabledFields.includes('name')"
          @update:model-value="updateField('name', $event)"
        />
      </div>

      <!-- 品牌 -->
      <AppInput
        :model-value="modelValue.brand"
        :label="t('order.form.brand')"
        :disabled="disabledFields.includes('brand')"
        @update:model-value="updateField('brand', $event)"
      />

      <!-- 系列 -->
      <AppInput
        :model-value="modelValue.series"
        :label="t('order.form.series')"
        :disabled="disabledFields.includes('series')"
        @update:model-value="updateField('series', $event)"
      />

      <!-- 款号 (SKU) -->
      <AppInput
        :model-value="modelValue.sku"
        :label="t('order.form.sku')"
        :disabled="disabledFields.includes('sku')"
        @update:model-value="updateField('sku', $event)"
      />

      <!-- 规格尺寸 -->
      <AppInput
        :model-value="modelValue.size"
        :label="t('order.form.size')"
        @update:model-value="updateField('size', $event)"
      />

      <!-- 数量 -->
      <AppInput
        :model-value="modelValue.quantity"
        type="number"
        :label="t('order.form.quantity')"
        min="1"
        @update:model-value="updateField('quantity', parseInt($event) || 1)"
      />

      <!-- 颜色 -->
      <AppInput
        :model-value="modelValue.color"
        :label="t('order.form.color')"
        @update:model-value="updateField('color', $event)"
      />

      <!-- 材质 -->
      <AppInput
        :model-value="modelValue.material"
        :label="t('order.form.material')"
        @update:model-value="updateField('material', $event)"
      />

      <!-- 期望到货时间 -->
      <AppInput
        :model-value="modelValue.deadline"
        type="date"
        :label="t('order.form.expectedArrival')"
        :min="minDate"
        @update:model-value="updateField('deadline', $event)"
      />

      <!-- 状态 (仅管理员可见) -->
      <div v-if="showStatus">
        <label class="mb-1 block text-xs font-medium text-(--text-secondary)">{{ t('order.status') }}</label>
        <StatusSelector
          :model-value="modelValue.status"
          :options="statuses"
          class="w-full"
          @update:model-value="updateField('status', $event)"
        />
      </div>

      <!-- 备注 (全宽) -->
      <div class="md:col-span-2">
        <AppInput
          :model-value="modelValue.remark"
          :label="t('order.form.remark')"
          textarea
          :rows="3"
          @update:model-value="updateField('remark', $event)"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { getTodayISOString } from '@/utils/common';
import StatusSelector from '@/components/ui/StatusSelector.vue';
import AppInput from '@/components/ui/AppInput.vue';

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
  disabledFields: {
    type: Array,
    default: () => [],
  },
});

const emit = defineEmits(['update:modelValue']);

const { t } = useI18n();
const minDate = computed(() => getTodayISOString());

const updateField = (field, value) => {
  if (props.disabledFields.includes(field)) return; // Prevent updates on disabled fields
  emit('update:modelValue', { ...props.modelValue, [field]: value });
};
</script>
