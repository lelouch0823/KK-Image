<template>
  <Teleport to="body">
    <div v-if="modelValue" class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        class="absolute inset-0 bg-(--color-overlay-dim) backdrop-blur-sm"
        @click="$emit('update:modelValue', false)"
      ></div>
      <div
        class="relative w-full max-w-2xl rounded-2xl border border-(--border-color) bg-(--bg-card) p-5 shadow-2xl"
      >
        <div class="mb-4 flex items-center justify-between">
          <h3 class="text-lg font-semibold text-(--text-main)">Batch Variant Builder</h3>
          <button
            type="button"
            class="cursor-pointer text-(--text-muted)"
            aria-label="Close"
            @click="$emit('update:modelValue', false)"
          >
            <AppIcon name="x-mark" class="size-5" />
          </button>
        </div>

        <div class="space-y-3">
          <label class="block text-xs text-(--text-secondary)">颜色 (comma-separated)</label>
          <input
            v-model="colorsInput"
            data-testid="input-colors"
            class="input w-full p-2 text-sm"
            type="text"
            placeholder="黄,蓝"
          />

          <label class="block text-xs text-(--text-secondary)">材质 (optional)</label>
          <input
            v-model="materialsInput"
            data-testid="input-materials"
            class="input w-full p-2 text-sm"
            type="text"
            placeholder="棉,涤纶"
          />

          <label class="block text-xs text-(--text-secondary)">尺码 (optional)</label>
          <input
            v-model="sizesInput"
            data-testid="input-sizes"
            class="input w-full p-2 text-sm"
            type="text"
            placeholder="S,M,L"
          />
        </div>

        <div class="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <input
            v-model.number="defaults.price"
            data-testid="default-price"
            class="input p-2 text-sm"
            type="number"
            placeholder="Price"
          />
          <input
            v-model.number="defaults.cost_price"
            data-testid="default-cost"
            class="input p-2 text-sm"
            type="number"
            placeholder="Cost"
          />
          <input
            v-model.number="defaults.stock_quantity"
            data-testid="default-stock"
            class="input p-2 text-sm"
            type="number"
            placeholder="Stock"
          />
          <select
            v-model="defaults.status"
            data-testid="default-status-select"
            class="input h-9 rounded-lg p-2 text-sm"
          >
            <option v-for="option in statusOptions" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </select>
        </div>

        <div class="mt-5 flex justify-end gap-2">
          <button
            type="button"
            class="cursor-pointer rounded-lg border border-(--border-color) px-3 py-2 text-sm"
            @click="$emit('update:modelValue', false)"
          >
            Cancel
          </button>
          <button
            data-testid="apply-btn"
            type="button"
            class="bg-primary cursor-pointer rounded-lg px-4 py-2 text-sm font-bold text-(--text-inverse)"
            @click="handleApply"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { reactive, ref } from 'vue';
import AppIcon from '@/components/ui/AppIcon.vue';

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
