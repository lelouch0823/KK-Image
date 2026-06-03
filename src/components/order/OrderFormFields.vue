<template>
  <div>
    <h4
      class="mb-4 border-b border-(--border-color) pb-2 text-sm font-medium text-(--text-main)"
    >
      {{ t('order.detail.currentInfo') }}
    </h4>

    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <template v-if="!lineMode">
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

        <!-- 数量 -->
        <AppInput
          :model-value="modelValue.quantity"
          type="number"
          :label="t('order.form.quantity')"
          min="1"
          @update:model-value="updateField('quantity', parseInt($event) || 1)"
        />

        <!-- 如果已绑定商品，显示只读的规格属性列表，否则显示原有的输入框 -->
        <template v-if="boundProductVariant">
          <div class="border-primary/20 bg-primary/5 mt-4 space-y-3 rounded-lg border p-4 md:col-span-2">
            <h5 class="text-primary text-sm font-medium">{{ t('product.variant.title') || '商品规格' }}</h5>
            <div class="grid [grid-template-columns:repeat(auto-fit,minmax(9.5rem,1fr))] gap-3">
              <div v-for="(value, key) in boundProductVariant" :key="key" class="min-w-0 rounded-md bg-(--bg-card)/70 p-2">
                <span class="block truncate text-xs text-(--text-secondary)" :title="String(key)">
                  {{ key }}
                </span>
                <span
                  class="mt-1 block text-sm font-medium break-all text-(--text-main)"
                  :title="String(value ?? '')"
                >
                  {{ value }}
                </span>
              </div>
              <div v-if="!hasEntries(boundProductVariant)" class="[grid-column:1/-1] text-sm text-(--text-muted)">
                {{ t('product.variant.noSpecs') || '无规格信息' }}
              </div>
            </div>
          </div>
        </template>

        <template v-else>
          <AppInput
            :model-value="modelValue.size"
            :label="t('order.form.size')"
            @update:model-value="updateField('size', $event)"
          />
          <AppInput
            :model-value="modelValue.color"
            :label="t('order.form.color')"
            @update:model-value="updateField('color', $event)"
          />
          <AppInput
            :model-value="modelValue.material"
            :label="t('order.form.material')"
            @update:model-value="updateField('material', $event)"
          />
        </template>
      </template>

      <!-- 期望到货时间 -->
      <AppInput
        :model-value="modelValue.deadline"
        type="date"
        :label="t('order.form.expectedArrival')"
        :min="minDate"
        @update:model-value="updateField('deadline', $event)"
      />

      <!-- 销售员 (仅管理员可见) -->
      <div v-if="showStatus">
        <label class="mb-1 block text-xs font-medium text-(--text-secondary)">{{ t('common.salesperson') }}</label>
        <Select
          :model-value="modelValue.salespersonId"
          :options="salespersonOptions"
          :placeholder="t('salesperson.selectPlaceholder')"
          class="w-full"
          @update:model-value="updateField('salespersonId', $event)"
        />
      </div>

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
import { hasEntries } from '@/utils/object-utils';
import { getTodayISOString } from '@/utils/common';
import StatusSelector from '@/components/ui/StatusSelector.vue';
import AppInput from '@/components/ui/AppInput.vue';
import Select from '@/components/ui/Select.vue';

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
    default: () => ['pending', 'confirmed', 'production', 'shipping', 'arrived', 'fulfilled', 'rejected', 'void'],
  },
  salespersons: {
    type: Array,
    default: () => [],
  },
  disabledFields: {
    type: Array,
    default: () => [],
  },
  boundProductVariant: {
    type: Object,
    default: null,
  },
  lineMode: {
    type: Boolean,
    default: false,
  }
});

const emit = defineEmits(['update:modelValue']);

const { t } = useI18n();
const minDate = computed(() => getTodayISOString());

const salespersonOptions = computed(() =>
  props.salespersons.map((sp) => ({
    label: `${sp.name}${sp.store ? ` (${sp.store})` : ''}`,
    value: sp.id,
  }))
);

const updateField = (field, value) => {
  if (props.disabledFields.includes(field)) return; // Prevent updates on disabled fields
  emit('update:modelValue', { ...props.modelValue, [field]: value });
};
</script>
