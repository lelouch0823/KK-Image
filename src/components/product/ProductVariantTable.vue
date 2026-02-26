<template>
  <!-- 外层容器：相对定位用于滚动阴影 -->
  <div
    ref="scrollContainerRef"
    class="relative overflow-x-auto rounded-lg border border-(--border-color)/60 bg-(--bg-card)"
    @scroll="onScroll"
  >
    <!-- 右侧渐变阴影提示：可横向滚动 -->
    <div
      v-if="canScrollRight"
      class="pointer-events-none absolute top-0 right-0 bottom-0 z-20 w-6"
      style="background: linear-gradient(to right, transparent, var(--bg-card))"
    />

    <table class="w-full min-w-[1120px] text-left text-sm whitespace-nowrap">
      <thead class="bg-(--bg-muted)/80 text-[11px] font-semibold tracking-wider text-(--text-secondary) uppercase">
        <tr>
          <th class="sticky left-0 z-10 min-w-[120px] bg-(--bg-muted) px-4 py-3">{{ t('product.table.variant.variant_name', 'Variant') }}</th>
          <th class="min-w-[160px] px-4 py-3">{{ t('product.table.variant.sku', 'SKU') }}</th>
          <th class="min-w-[160px] px-4 py-3">{{ t('product.table.variant.barcode', 'Barcode') }}</th>
          <th class="min-w-[160px] px-4 py-3">{{ t('product.table.variant.supplier_sku', 'Supplier SKU') }}</th>
          <th class="min-w-[110px] px-4 py-3">{{ t('product.table.variant.price', 'Price') }}</th>
          <th class="min-w-[110px] px-4 py-3">{{ t('product.table.variant.cost', 'Cost') }}</th>
          <th class="min-w-[80px] px-4 py-3">{{ t('product.table.variant.stock', 'Stock') }}</th>
          <th class="min-w-[80px] px-4 py-3">{{ t('product.table.variant.alert', 'Alert') }}</th>
          <th class="min-w-[100px] px-4 py-3">{{ t('product.table.variant.status', 'Status') }}</th>
          <th class="min-w-[80px] px-4 py-3">{{ t('product.table.variant.images', 'Images') }}</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-(--border-color)/40">
        <tr
          v-for="(variant, idx) in getVariants()"
          :key="variant.id || variant._clientKey || idx"
          class="group transition-colors hover:bg-(--bg-muted)/30"
        >
          <!-- 规格名 — sticky 首列 -->
          <td class="sticky left-0 z-10 bg-(--bg-card) px-4 py-2 font-medium text-(--text-main) transition-colors group-hover:bg-(--bg-muted)/30">
            <div class="flex items-center gap-2">
              <span class="inline-flex h-6 items-center rounded-md bg-(--bg-muted) px-2 text-xs font-semibold text-(--text-secondary)">
                {{ formatVariantName(variant.options_values) }}
              </span>
            </div>
          </td>
          <!-- SKU -->
          <td class="px-2 py-2">
            <input
              :value="variant.sku || ''"
              @input="(e) => updateVariantField(idx, 'sku', e.target.value)"
              type="text"
              class="variant-input"
              placeholder="SKU"
            >
          </td>
          <!-- 条码 -->
          <td class="px-2 py-2">
            <input
              :value="variant.barcode || ''"
              @input="(e) => updateVariantField(idx, 'barcode', e.target.value)"
              type="text"
              class="variant-input"
              placeholder="Barcode"
            >
          </td>
          <!-- 供应商 SKU -->
          <td class="px-2 py-2">
            <input
              :value="variant.supplier_sku || ''"
              @input="(e) => updateVariantField(idx, 'supplier_sku', e.target.value)"
              type="text"
              class="variant-input"
              placeholder="Supplier SKU"
            >
          </td>
          <!-- 价格 -->
          <td class="px-2 py-2">
            <div class="relative">
              <span class="absolute top-1/2 left-2 -translate-y-1/2 text-xs text-(--text-muted)">{{ currencySymbol }}</span>
              <input
                :value="variant.price ?? ''"
                @input="(e) => updateVariantField(idx, 'price', parseNumberInput(e.target.value))"
                type="number"
                step="0.01"
                class="variant-input pl-6!"
                placeholder="0.00"
              >
            </div>
          </td>
          <!-- 成本 -->
          <td class="px-2 py-2">
            <div class="relative">
              <span class="absolute top-1/2 left-2 -translate-y-1/2 text-xs text-(--text-muted)">{{ currencySymbol }}</span>
              <input
                :value="variant.cost_price ?? ''"
                @input="(e) => updateVariantField(idx, 'cost_price', parseNumberInput(e.target.value))"
                type="number"
                step="0.01"
                class="variant-input pl-6!"
                placeholder="0.00"
              >
            </div>
          </td>
          <!-- 库存 -->
          <td class="px-2 py-2">
            <input
              :value="variant.stock_quantity ?? ''"
              @input="(e) => updateVariantField(idx, 'stock_quantity', parseNumberInput(e.target.value))"
              type="number"
              class="variant-input"
              placeholder="0"
            >
          </td>
          <!-- 预警 -->
          <td class="px-2 py-2">
            <input
              :value="variant.alert_threshold ?? ''"
              @input="(e) => updateVariantField(idx, 'alert_threshold', parseNumberInput(e.target.value))"
              type="number"
              class="variant-input"
              placeholder="10"
            >
          </td>
          <!-- 状态 -->
          <td class="px-2 py-2">
            <select
              :value="variant.status || 'active'"
              @change="(e) => updateVariantField(idx, 'status', e.target.value)"
              class="variant-input cursor-pointer"
            >
              <option value="active">{{ t('common.active', 'Active') }}</option>
              <option value="archived">{{ t('common.archived', 'Archived') }}</option>
            </select>
          </td>
          <!-- 图片数量 -->
          <td class="px-4 py-2 text-xs text-(--text-secondary)">
            {{ variant.images?.length || 0 }} {{ t('common.images_count', 'image(s)') }}
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup>
import { nextTick, onMounted, onBeforeUnmount, ref, watch } from 'vue';
import { useI18n } from '@/composables/useI18n';

const { t } = useI18n();

const props = defineProps({
    modelValue: {
        type: Array,
        default: () => []
    },
    /** 货币符号，默认 ¥ */
    currencySymbol: {
        type: String,
        default: '¥'
    }
});

const emit = defineEmits(['update:modelValue']);

// 横向滚动阴影状态
const scrollContainerRef = ref(null);
const canScrollRight = ref(false);

const checkScroll = () => {
    const el = scrollContainerRef.value;
    if (!el) return;
    canScrollRight.value = el.scrollLeft + el.clientWidth < el.scrollWidth - 2;
};

const onScroll = () => checkScroll();

let resizeObserver = null;
onMounted(() => {
    checkScroll();
    if (scrollContainerRef.value && typeof ResizeObserver !== 'undefined') {
        resizeObserver = new ResizeObserver(checkScroll);
        resizeObserver.observe(scrollContainerRef.value);
    }
});
onBeforeUnmount(() => {
    resizeObserver?.disconnect();
});

watch(() => props.modelValue, () => {
    nextTick(() => {
        checkScroll();
    });
}, { immediate: true });

const getVariants = () => (Array.isArray(props.modelValue) ? props.modelValue : []);

const emitNextVariants = (updater) => {
    const current = getVariants();
    const next = updater(current.map((variant) => ({ ...variant })));
    emit('update:modelValue', next);
};

const updateVariantField = (index, field, value) => {
    emitNextVariants((list) => {
        if (!list[index]) return list;
        list[index][field] = value;
        return list;
    });
};

const parseNumberInput = (rawValue) => {
    if (rawValue === '') return '';
    const numberValue = Number(rawValue);
    return Number.isFinite(numberValue) ? numberValue : rawValue;
};


// ─── UTILS ────────────────────────────────────

const formatVariantName = (optionsValues) => {
    if (!optionsValues || Object.keys(optionsValues).length === 0) return 'Default';
    const keys = Object.keys(optionsValues).sort();
    return keys.map((key) => optionsValues[key]).join(' · ');
};
</script>

<style scoped>
/* 统一输入框样式 */
.variant-input {
    width: 100%;
    border-radius: 0.375rem;          /* rounded-md */
    border: 1px solid transparent;
    background-color: transparent;
    padding: 0.375rem 0.5rem;         /* py-1.5 px-2 */
    font-size: 13px;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    transition: border-color 0.15s, background-color 0.15s;
}
.variant-input:hover {
    border-color: var(--border-color);
}
.variant-input:focus {
    border-color: var(--color-primary);
    background-color: var(--bg-card);
    box-shadow: 0 0 0 1px var(--color-primary);
    outline: none;
}

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
