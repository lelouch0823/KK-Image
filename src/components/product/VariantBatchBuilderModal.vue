<template>
  <Modal
    :model-value="modelValue"
    size="2xl"
    :closable="false"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <template #header>
      <div class="flex items-center justify-between gap-3">
        <h3 class="text-lg font-semibold text-(--text-main)">Batch Variant Builder</h3>
        <AppButton
          variant="ghost"
          size="sm"
          class="h-9 w-9 px-0"
          aria-label="Close"
          @click="$emit('update:modelValue', false)"
        >
          <AppIcon name="x-mark" class="size-5" />
        </AppButton>
      </div>
    </template>

    <div class="space-y-5">
      <div class="space-y-3">
        <AppInput
          v-model="colorsInput"
          data-testid="input-colors"
          label="颜色 (comma-separated)"
          type="text"
          placeholder="黄,蓝"
        />

        <AppInput
          v-model="materialsInput"
          data-testid="input-materials"
          label="材质 (optional)"
          type="text"
          placeholder="棉,涤纶"
        />

        <AppInput
          v-model="sizesInput"
          data-testid="input-sizes"
          label="尺码 (optional)"
          type="text"
          placeholder="S,M,L"
        />
      </div>

      <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <AppInput
          v-model="defaults.price"
          data-testid="default-price"
          label="Price"
          type="number"
          placeholder="Price"
        />
        <AppInput
          v-model="defaults.cost_price"
          data-testid="default-cost"
          label="Cost"
          type="number"
          placeholder="Cost"
        />
        <AppInput
          v-model="defaults.stock_quantity"
          data-testid="default-stock"
          label="Stock"
          type="number"
          placeholder="Stock"
        />
        <div class="flex flex-col gap-1 text-sm font-medium text-(--text-secondary)">
          <span>Status</span>
          <Select
            :model-value="defaults.status"
            :options="statusOptions"
            placeholder="Status"
            data-testid="default-status-select"
            @update:model-value="defaults.status = $event"
          />
        </div>
      </div>
    </div>

    <template #footer>
      <AppButton variant="secondary" @click="$emit('update:modelValue', false)">Cancel</AppButton>
      <AppButton data-testid="apply-btn" @click="handleApply">Apply</AppButton>
    </template>
  </Modal>
</template>

<script setup>
import { reactive, ref } from 'vue';
import AppButton from '@/components/ui/AppButton.vue';
import AppIcon from '@/components/ui/AppIcon.vue';
import AppInput from '@/components/ui/AppInput.vue';
import Modal from '@/components/ui/Modal.vue';
import Select from '@/components/ui/Select.vue';

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  existingVariants: { type: Array, default: () => [] },
});
const emit = defineEmits(['update:modelValue', 'apply']);

const colorsInput = ref('');
const materialsInput = ref('');
const sizesInput = ref('');
const defaults = reactive({
  price: 0,
  cost_price: 0,
  stock_quantity: 0,
  alert_threshold: 10,
  status: 'active',
});

const statusOptions = [
  { value: 'active', label: 'active' },
  { value: 'archived', label: 'archived' },
];

const parseValues = (raw) => {
  const parts = String(raw || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  return [...new Set(parts)];
};

const variantKey = (optionsValues = {}) =>
  JSON.stringify(
    Object.keys(optionsValues)
      .sort()
      .reduce((acc, key) => {
        acc[key] = optionsValues[key];
        return acc;
      }, {})
  );

function handleApply() {
  const colors = parseValues(colorsInput.value);
  const materials = parseValues(materialsInput.value);
  const sizes = parseValues(sizesInput.value);
  if (colors.length === 0) return;

  const dimensions = [
    { name: '颜色', values: colors },
    ...(materials.length > 0 ? [{ name: '材质', values: materials }] : []),
    ...(sizes.length > 0 ? [{ name: '尺码', values: sizes }] : []),
  ];

  let matrix = [{}];
  for (const dimension of dimensions) {
    matrix = matrix.flatMap((entry) =>
      dimension.values.map((value) => ({ ...entry, [dimension.name]: value }))
    );
  }

  const existingKeys = new Set(
    (props.existingVariants || []).map((variant) => variantKey(variant.options_values || {}))
  );
  const variants = matrix
    .filter((optionsValues) => !existingKeys.has(variantKey(optionsValues)))
    .map((optionsValues) => ({
      sku: '',
      barcode: '',
      supplier_sku: '',
      options_values: optionsValues,
      price: Number(defaults.price) || 0,
      cost_price: Number(defaults.cost_price) || 0,
      stock_quantity: Number(defaults.stock_quantity) || 0,
      alert_threshold: Number.isFinite(Number(defaults.alert_threshold))
        ? Number(defaults.alert_threshold)
        : 10,
      status: defaults.status || 'active',
    }));

  emit('apply', { options: dimensions, variants });
  emit('update:modelValue', false);
}
</script>
