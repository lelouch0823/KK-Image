<template>
  <ProductDetailModal
    v-if="viewProductId"
    :show="!!viewProductId"
    :product-id="viewProductId"
    @close="$emit('close-product-detail')"
  />

  <Teleport to="body">
    <transition name="fade">
      <div
        v-if="showShortageConfirm"
        class="fixed inset-0 z-[70] flex items-center justify-center p-4"
      >
        <div class="absolute inset-0 bg-(--color-overlay-dim) backdrop-blur-sm" @click="$emit('close-shortage-confirm')"></div>
        <div
          class="border-warning/20 relative w-full max-w-lg overflow-hidden rounded-[1.8rem] border bg-(--color-modal-bg) p-6 shadow-[0_28px_80px_-42px_rgba(15,23,42,0.42)]"
        >
          <div
            class="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(245,158,11,0.12),transparent_28%)]"
          ></div>
          <div class="relative mb-4 flex items-center gap-3">
            <div class="bg-warning/10 flex size-10 items-center justify-center rounded-full">
              <AppIcon name="exclamation-triangle" class="text-warning size-5" />
            </div>
            <div>
              <p class="text-[11px] font-semibold tracking-[0.16em] text-(--text-muted) uppercase">
                Quantity Guardrail
              </p>
              <h3 class="mt-1 text-base font-bold text-(--text-main)">
                {{ t('purchaseOrder.form.confirmShortageTitle') }}
              </h3>
            </div>
          </div>
          <p class="relative mb-5 text-sm text-(--text-secondary)">
            {{ t('purchaseOrder.form.confirmShortage') }}
          </p>
          <div
            class="border-warning/20 bg-warning/5 relative mb-5 max-h-40 overflow-y-auto rounded-xl border p-3"
          >
            <div
              v-for="item in shortageItems"
              :key="`${item.product_id || 'p'}-${item.variant_id || 'v'}`"
              class="flex items-center justify-between py-1 text-sm"
            >
              <span class="max-w-[70%] truncate text-(--text-main)" :title="item.product_name || '—'">
                {{ item.product_name || '—' }}
              </span>
              <span class="text-danger font-mono font-semibold tabular-nums">
                {{ item.quantity }} / {{ item.required_quantity }}
              </span>
            </div>
          </div>
          <div class="relative flex justify-end gap-3">
            <button
              type="button"
              class="cursor-pointer rounded-xl px-4 py-2.5 text-sm font-medium text-(--text-secondary) hover:bg-(--bg-hover)"
              @click="$emit('close-shortage-confirm')"
            >
              {{ t('common.cancel') }}
            </button>
            <button
              type="button"
              class="bg-warning cursor-pointer rounded-xl px-4 py-2.5 text-sm font-medium text-white hover:opacity-90"
              @click="$emit('confirm-shortage-create')"
            >
              {{ t('purchaseOrder.form.confirmCreate') }}
            </button>
          </div>
        </div>
      </div>
    </transition>
  </Teleport>

  <OrderPickerModal
    :visible="showOrderPicker"
    :exclude-ids="excludeOrderIds"
    @close="$emit('close-order-picker')"
    @confirm="$emit('orders-selected', $event)"
  />
  <ProductPickerModal
    :visible="showProductPicker"
    :existing-brands="existingBrands"
    :initial-selected-variant-ids="selectedVariantIdsForPicker"
    @close="$emit('close-product-picker')"
    @confirm="$emit('products-selected', $event)"
  />
</template>

<script setup>
import OrderPickerModal from '@/components/purchase-order/OrderPickerModal.vue';
import ProductPickerModal from '@/components/purchase-order/ProductPickerModal.vue';
import ProductDetailModal from '@/components/product/ProductDetailModal.vue';
import AppIcon from '@/components/ui/AppIcon.vue';

defineProps({
  t: { type: Function, required: true },
  viewProductId: { type: [String, Number], default: null },
  showShortageConfirm: { type: Boolean, default: false },
  shortageItems: { type: Array, default: () => [] },
  showOrderPicker: { type: Boolean, default: false },
  excludeOrderIds: { type: Array, default: () => [] },
  showProductPicker: { type: Boolean, default: false },
  existingBrands: { type: Array, default: () => [] },
  selectedVariantIdsForPicker: { type: Array, default: () => [] },
});

defineEmits([
  'close-product-detail',
  'close-shortage-confirm',
  'confirm-shortage-create',
  'close-order-picker',
  'orders-selected',
  'close-product-picker',
  'products-selected',
]);
</script>
