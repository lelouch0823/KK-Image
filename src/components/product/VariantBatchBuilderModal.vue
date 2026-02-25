<template>
  <Teleport to="body">
    <div v-if="modelValue" class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-[var(--color-overlay-dim)] backdrop-blur-sm" @click="$emit('update:modelValue', false)"></div>
      <div class="relative w-full max-w-2xl rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] p-5 shadow-2xl">
        <div class="mb-4 flex items-center justify-between">
          <h3 class="font-[Outfit] text-lg font-bold text-[var(--text-main)]">Batch Variant Builder</h3>
          <button type="button" class="text-[var(--text-muted)]" @click="$emit('update:modelValue', false)">×</button>
        </div>

        <div class="space-y-3">
          <label class="block text-xs text-[var(--text-secondary)]">颜色 (comma-separated)</label>
          <input data-testid="input-colors" v-model="colorsInput" class="input w-full p-2 text-sm" type="text" placeholder="黄,蓝">

          <label class="block text-xs text-[var(--text-secondary)]">材质 (optional)</label>
          <input data-testid="input-materials" v-model="materialsInput" class="input w-full p-2 text-sm" type="text" placeholder="棉,涤纶">

          <label class="block text-xs text-[var(--text-secondary)]">尺码 (optional)</label>
          <input data-testid="input-sizes" v-model="sizesInput" class="input w-full p-2 text-sm" type="text" placeholder="S,M,L">
        </div>

        <div class="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <input data-testid="default-price" v-model.number="defaults.price" class="input p-2 text-sm" type="number" placeholder="Price">
          <input data-testid="default-cost" v-model.number="defaults.cost_price" class="input p-2 text-sm" type="number" placeholder="Cost">
          <input data-testid="default-stock" v-model.number="defaults.stock_quantity" class="input p-2 text-sm" type="number" placeholder="Stock">
          <select data-testid="default-status" v-model="defaults.status" class="input p-2 text-sm">
            <option value="active">active</option>
            <option value="archived">archived</option>
          </select>
        </div>

        <div class="mt-5 flex justify-end gap-2">
          <button type="button" class="rounded-lg border border-[var(--border-color)] px-3 py-2 text-sm" @click="$emit('update:modelValue', false)">
            Cancel
          </button>
          <button data-testid="apply-btn" type="button" class="rounded-lg bg-[var(--color-primary)] px-3 py-2 text-sm text-[var(--text-inverse)]" @click="handleApply">
            Apply
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { reactive, ref } from 'vue';

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

const parseValues = (raw) => {
  const parts = String(raw || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  return [...new Set(parts)];
};

const variantKey = (optionsValues = {}) =>
  JSON.stringify(Object.keys(optionsValues).sort().reduce((acc, key) => {
    acc[key] = optionsValues[key];
    return acc;
  }, {}));

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

  const existingKeys = new Set((props.existingVariants || []).map((variant) => variantKey(variant.options_values || {})));
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
      alert_threshold: Number(defaults.alert_threshold) || 10,
      status: defaults.status || 'active',
    }));

  emit('apply', { options: dimensions, variants });
  emit('update:modelValue', false);
}
</script>
