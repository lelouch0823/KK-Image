<template>
  <div class="overflow-x-auto rounded-lg border border-[var(--border-color)]/60 bg-[var(--bg-card)]">
      <table class="w-full text-left text-sm whitespace-nowrap">
          <thead class="bg-[var(--bg-muted)]/80 text-[11px] font-semibold tracking-wider text-[var(--text-secondary)] uppercase">
              <tr>
                  <th class="px-4 py-3">{{ t('product.table.variant.variant_name', 'Variant') }}</th>
                  <th class="w-32 px-4 py-3">{{ t('product.table.variant.sku', 'SKU') }}</th>
                  <th class="w-32 px-4 py-3">{{ t('product.table.variant.barcode', 'Barcode') }}</th>
                  <th class="w-36 px-4 py-3">{{ t('product.table.variant.supplier_sku', 'Supplier SKU') }}</th>
                  <th class="w-24 px-4 py-3">{{ t('product.table.variant.price', 'Price') }}</th>
                  <th class="w-24 px-4 py-3">{{ t('product.table.variant.cost', 'Cost') }}</th>
                  <th class="w-20 px-4 py-3">{{ t('product.table.variant.stock', 'Stock') }}</th>
                  <th class="w-20 px-4 py-3">{{ t('product.table.variant.alert', 'Alert') }}</th>
                  <th class="w-28 px-4 py-3">{{ t('product.table.variant.status', 'Status') }}</th>
                  <th class="px-4 py-3">{{ t('product.table.variant.images', 'Images') }}</th>
              </tr>
          </thead>
          <tbody class="divide-y divide-[var(--border-color)]/40">
              <tr v-for="(variant, idx) in variants" :key="variant.id || variant._clientKey || idx" class="group transition-colors hover:bg-[var(--bg-muted)]/30">
                  <td class="px-4 py-2 font-medium text-[var(--text-main)]">
                      <div class="flex items-center gap-2">
                          <span class="inline-flex h-6 items-center rounded-md bg-[var(--bg-muted)] px-2 text-xs font-semibold text-[var(--text-secondary)]">
                              {{ formatVariantName(variant.options_values) }}
                          </span>
                      </div>
                  </td>
                  <td class="px-2 py-2">
                      <input v-model="variant.sku" type="text" class="w-full rounded-md border border-transparent bg-transparent px-2 py-1.5 text-[13px] font-mono transition-colors hover:border-[var(--border-color)] focus:border-[var(--color-primary)] focus:bg-[var(--bg-card)] focus:ring-1 focus:ring-[var(--color-primary)] focus:outline-none" placeholder="SKU">
                  </td>
                  <td class="px-2 py-2">
                      <input v-model="variant.barcode" type="text" class="w-full rounded-md border border-transparent bg-transparent px-2 py-1.5 text-[13px] font-mono transition-colors hover:border-[var(--border-color)] focus:border-[var(--color-primary)] focus:bg-[var(--bg-card)] focus:ring-1 focus:ring-[var(--color-primary)] focus:outline-none" placeholder="Barcode">
                  </td>
                  <td class="px-2 py-2">
                      <input v-model="variant.supplier_sku" type="text" class="w-full rounded-md border border-transparent bg-transparent px-2 py-1.5 text-[13px] font-mono transition-colors hover:border-[var(--border-color)] focus:border-[var(--color-primary)] focus:bg-[var(--bg-card)] focus:ring-1 focus:ring-[var(--color-primary)] focus:outline-none" placeholder="Supplier SKU">
                  </td>
                  <td class="px-2 py-2">
                      <div class="relative">
                          <span class="absolute left-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">$</span>
                          <input v-model.number="variant.price" type="number" step="0.01" class="w-full rounded-md border border-transparent bg-transparent py-1.5 pl-6 pr-2 text-[13px] transition-colors hover:border-[var(--border-color)] focus:border-[var(--color-primary)] focus:bg-[var(--bg-card)] focus:ring-1 focus:ring-[var(--color-primary)] focus:outline-none" placeholder="0.00">
                      </div>
                  </td>
                  <td class="px-2 py-2">
                      <div class="relative">
                          <span class="absolute left-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">$</span>
                          <input v-model.number="variant.cost_price" type="number" step="0.01" class="w-full rounded-md border border-transparent bg-transparent py-1.5 pl-6 pr-2 text-[13px] transition-colors hover:border-[var(--border-color)] focus:border-[var(--color-primary)] focus:bg-[var(--bg-card)] focus:ring-1 focus:ring-[var(--color-primary)] focus:outline-none" placeholder="0.00">
                      </div>
                  </td>
                  <td class="px-2 py-2">
                      <input v-model.number="variant.stock_quantity" type="number" class="w-full rounded-md border border-transparent bg-transparent px-2 py-1.5 text-[13px] transition-colors hover:border-[var(--border-color)] focus:border-[var(--color-primary)] focus:bg-[var(--bg-card)] focus:ring-1 focus:ring-[var(--color-primary)] focus:outline-none" placeholder="0">
                  </td>
                  <td class="px-2 py-2">
                      <input v-model.number="variant.alert_threshold" type="number" class="w-full rounded-md border border-transparent bg-transparent px-2 py-1.5 text-[13px] transition-colors hover:border-[var(--border-color)] focus:border-[var(--color-primary)] focus:bg-[var(--bg-card)] focus:ring-1 focus:ring-[var(--color-primary)] focus:outline-none" placeholder="10">
                  </td>
                  <td class="px-2 py-2">
                      <select v-model="variant.status" class="w-full cursor-pointer rounded-md border border-transparent bg-transparent px-2 py-1.5 text-[13px] transition-colors hover:border-[var(--border-color)] focus:border-[var(--color-primary)] focus:bg-[var(--bg-card)] focus:ring-1 focus:ring-[var(--color-primary)] focus:outline-none">
                          <option value="active">{{ t('common.active', 'Active') }}</option>
                          <option value="archived">{{ t('common.archived', 'Archived') }}</option>
                      </select>
                  </td>
                  <td class="px-4 py-2 text-[12px] text-[var(--text-secondary)]">
                      {{ variant.images?.length || 0 }} {{ t('common.images_count', 'image(s)') }}
                  </td>
              </tr>
          </tbody>
      </table>
  </div>
</template>

<script setup>
import { nextTick, ref, watch } from 'vue';
import { useI18n } from '@/composables/useI18n';

const { t } = useI18n();

const props = defineProps({
    modelValue: {
        type: Array,
        default: () => []
    }
});

const emit = defineEmits(['update:modelValue']);

const variants = ref([]);
const syncingFromParent = ref(false);

watch(() => props.modelValue, (newVal) => {
    syncingFromParent.value = true;
    variants.value = Array.isArray(newVal)
        ? newVal.map((variant) => ({ ...variant }))
        : [];
    nextTick(() => {
        syncingFromParent.value = false;
    });
}, { deep: true });

watch(variants, (newVal) => {
    if (syncingFromParent.value) return;
    emit('update:modelValue', newVal);
}, { deep: true });


// ─── UTILS & API METHODS ────────────────────────────────────

const formatVariantName = (optionsValues) => {
    if (!optionsValues || Object.keys(optionsValues).length === 0) return 'Default';
    const keys = Object.keys(optionsValues).sort();
    return keys.map((key) => optionsValues[key]).join(' · ');
};
</script>

<style scoped>
/* 移除数字输入框的上下增减箭头 */
input[type="number"]::-webkit-outer-spin-button,
input[type="number"]::-webkit-inner-spin-button {
    -webkit-appearance: none;
    appearance: none;
    margin: 0;
}
input[type="number"] {
    -moz-appearance: textfield;
    appearance: textfield;
}
</style>
