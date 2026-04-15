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
          <th class="min-w-[80px] px-4 py-3">{{ t('common.actions', 'Actions') }}</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-(--border-color)/40">
        <tr
          v-for="(variant, idx) in getVariants()"
          :key="variant.id || variant._clientKey || idx"
          :data-testid="`variant-row-${idx}`"
          :data-variant-state="variant.status || 'active'"
          :class="[
            'group transition-colors',
            variant.status === 'pending_incomplete'
              ? 'bg-warning-bg/60 hover:bg-warning-bg/70'
              : 'hover:bg-(--bg-muted)/30',
          ]"
        >
          <!-- 规格名 — sticky 首列 -->
          <td class="sticky left-0 z-10 bg-(--bg-card) px-4 py-2 font-medium text-(--text-main) transition-colors group-hover:bg-(--bg-muted)/30">
            <div class="flex items-center gap-2">
              <span
                class="inline-flex h-6 max-w-[18rem] items-center truncate rounded-md bg-(--bg-muted) px-2 text-xs font-semibold text-(--text-secondary)"
                :title="formatVariantName(variant.options_values)"
              >
                {{ formatVariantName(variant.options_values) }}
              </span>
              <AppIcon
                v-if="variant.status === 'pending_incomplete'"
                name="exclamation-triangle"
                class="text-warning size-4"
              />
            </div>
            <p
              v-if="variant.status === 'pending_incomplete'"
              class="text-warning-text mt-1 text-xs"
            >
              {{ t('product.form.incomplete_variant_hint', 'This legacy variant no longer matches the current spec structure.') }}
            </p>
          </td>
          <!-- SKU -->
          <td class="p-2 ">
            <input
              :data-testid="`variant-sku-${idx}`"
              :value="variant.sku || ''"
              type="text"
              class="variant-input"
              placeholder="SKU"
              @input="(e) => updateVariantField(idx, 'sku', e.target.value)"
            >
          </td>
          <!-- 条码 -->
          <td class="p-2 ">
            <input
              :data-testid="`variant-barcode-${idx}`"
              :value="variant.barcode || ''"
              type="text"
              class="variant-input"
              placeholder="Barcode"
              @input="(e) => updateVariantField(idx, 'barcode', e.target.value)"
            >
          </td>
          <!-- 供应商 SKU -->
          <td class="p-2 ">
            <input
              :data-testid="`variant-supplier-sku-${idx}`"
              :value="variant.supplier_sku || ''"
              type="text"
              class="variant-input"
              placeholder="Supplier SKU"
              @input="(e) => updateVariantField(idx, 'supplier_sku', e.target.value)"
            >
          </td>
          <!-- 价格 -->
          <td class="p-2 ">
            <div class="relative">
              <span class="absolute top-1/2 left-2 -translate-y-1/2 text-xs text-(--text-muted)">{{ currencySymbol }}</span>
              <input
                :data-testid="`variant-price-${idx}`"
                :value="variant.price ?? ''"
                type="number"
                step="0.01"
                class="variant-input pl-6!"
                placeholder="0.00"
                @input="(e) => updateVariantField(idx, 'price', parseNumberInput(e.target.value))"
              >
            </div>
          </td>
          <!-- 成本 -->
          <td class="p-2 ">
            <div class="relative">
              <span class="absolute top-1/2 left-2 -translate-y-1/2 text-xs text-(--text-muted)">{{ currencySymbol }}</span>
              <input
                :data-testid="`variant-cost-${idx}`"
                :value="variant.cost_price ?? ''"
                type="number"
                step="0.01"
                class="variant-input pl-6!"
                placeholder="0.00"
                @input="(e) => updateVariantField(idx, 'cost_price', parseNumberInput(e.target.value))"
              >
            </div>
          </td>
          <!-- 库存 -->
          <td class="p-2 ">
            <input
              :data-testid="`variant-stock-${idx}`"
              :value="variant.stock_quantity ?? ''"
              type="number"
              class="variant-input"
              placeholder="0"
              :readonly="isStockReadonly(variant)"
              @input="(e) => updateVariantField(idx, 'stock_quantity', parseNumberInput(e.target.value))"
            >
          </td>
          <!-- 预警 -->
          <td class="p-2 ">
            <input
              :data-testid="`variant-alert-${idx}`"
              :value="variant.alert_threshold ?? ''"
              type="number"
              class="variant-input"
              placeholder="10"
              @input="(e) => updateVariantField(idx, 'alert_threshold', parseNumberInput(e.target.value))"
            >
          </td>
          <!-- 状态 -->
          <td class="px-3 py-2">
            <span
              v-if="variant.status === 'pending_incomplete'"
              class="bg-warning-bg text-warning-text border-warning/30 inline-flex items-center rounded-full border px-2 py-1 text-[11px] font-semibold"
            >
              {{ t('product.table.variant.pending', 'Pending') }}
            </span>
            <button
              v-else
              type="button"
              class="flex items-center justify-center rounded-md p-1 transition-colors outline-none hover:bg-(--bg-muted)"
              :title="variant.status === 'archived' ? t('common.archived', 'Archived') : t('common.active', 'Active')"
              @click="updateVariantField(idx, 'status', variant.status === 'archived' ? 'active' : 'archived')"
            >
              <AppIcon v-if="variant.status !== 'archived'" name="check-circle-solid" class="size-5 text-emerald-500" />
              <AppIcon v-else name="minus-circle-solid" class="size-5 text-(--text-muted)" />
            </button>
          </td>
          <!-- 图片数量 -->
          <td class="px-4 py-2 text-xs text-(--text-secondary)">
            {{ variant.images?.length || 0 }}
          </td>
          <td class="px-3 py-2">
            <button
              :data-testid="`delete-variant-${idx}`"
              type="button"
              class="text-danger inline-flex items-center justify-center rounded-md p-1 transition-colors hover:bg-danger/10"
              :title="t('common.delete', 'Delete')"
              @click="removeVariant(indexSafe(idx))"
            >
              <AppIcon name="trash" class="size-4.5" />
            </button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup>
import { nextTick, onMounted, onBeforeUnmount, ref, watch } from 'vue';
import { useI18n } from '@/composables/useI18n';
import AppIcon from '@/components/ui/AppIcon.vue';

const { t } = useI18n();

const props = defineProps({
    modelValue: {
        type: Array,
        default: () => []
    },
    inventoryReadonly: {
        type: Boolean,
        default: false,
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
const isStockReadonly = (variant) => Boolean(props.inventoryReadonly && variant?.id);

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

const removeVariant = (index) => {
    emitNextVariants((list) => list.filter((_, itemIndex) => itemIndex !== index));
};

const indexSafe = (index) => Number(index);

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
    border-color: varprimary;
    background-color: var(--bg-card);
    box-shadow: 0 0 0 1px varprimary;
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
