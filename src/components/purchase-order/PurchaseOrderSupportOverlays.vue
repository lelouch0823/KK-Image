<template>
  <ProductDetailModal
    v-if="viewProductId"
    :show="!!viewProductId"
    :product-id="viewProductId"
    @close="$emit('close-product-detail')"
  />

  <Modal
    :model-value="showShortageConfirm"
    size="lg"
    :closable="false"
    body-class="!p-0"
    @update:model-value="handleShortageVisibilityChange"
  >
    <template #header>
      <div
        data-testid="purchase-order-shortage-confirm-shell"
        class="flex items-start justify-between gap-3"
      >
        <div class="flex items-start gap-3">
          <div class="bg-warning/10 flex size-10 items-center justify-center rounded-full">
            <AppIcon name="exclamation-triangle" class="text-warning size-5" />
          </div>
          <div>
            <p class="text-xs font-semibold tracking-[0.16em] text-(--text-muted) uppercase">
              Quantity Guardrail
            </p>
            <h3 class="mt-1 text-base font-bold text-(--text-main)">
              {{ t('purchaseOrder.form.confirmShortageTitle') }}
            </h3>
          </div>
        </div>
        <AppButton
          variant="ghost"
          size="sm"
          class="h-9 w-9 px-0"
          @click="$emit('close-shortage-confirm')"
        >
          <AppIcon name="x-mark" class="size-5" />
        </AppButton>
      </div>
    </template>

    <div class="space-y-4 px-6 py-5">
      <p class="text-sm text-(--text-secondary)">
        {{ t('purchaseOrder.form.confirmShortage') }}
      </p>

      <AppCard class="border-warning/20 bg-warning/5 max-h-40 overflow-y-auto p-3">
        <div
          v-for="item in shortageItems"
          :key="`${item.product_id || 'p'}-${item.variant_id || 'v'}`"
          class="flex items-center justify-between gap-3 py-1 text-sm"
        >
          <span
            class="min-w-0 flex-1 truncate text-(--text-main)"
            :title="item.product_name || '-'"
          >
            {{ item.product_name || '-' }}
          </span>
          <span class="text-danger shrink-0 font-mono font-semibold tabular-nums">
            {{ item.quantity }} / {{ item.required_quantity }}
          </span>
        </div>
      </AppCard>
    </div>

    <template #footer>
      <ActionBar class="!justify-end border-none bg-transparent px-0 py-0 shadow-none">
        <AppButton variant="secondary" @click="$emit('close-shortage-confirm')">
          {{ t('common.cancel') }}
        </AppButton>
        <AppButton
          variant="outline"
          class="border-warning/40 text-warning hover:border-warning hover:bg-warning/10 hover:text-warning"
          @click="$emit('confirm-shortage-create')"
        >
          {{ t('purchaseOrder.form.confirmCreate') }}
        </AppButton>
      </ActionBar>
    </template>
  </Modal>

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
import ActionBar from '@/design-system/composed/ActionBar.vue';
import AppButton from '@/components/ui/AppButton.vue';
import AppCard from '@/components/ui/AppCard.vue';
import AppIcon from '@/components/ui/AppIcon.vue';
import Modal from '@/components/ui/Modal.vue';

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

const emit = defineEmits([
  'close-product-detail',
  'close-shortage-confirm',
  'confirm-shortage-create',
  'close-order-picker',
  'orders-selected',
  'close-product-picker',
  'products-selected',
]);

const handleShortageVisibilityChange = (nextVisible) => {
  if (!nextVisible) {
    emit('close-shortage-confirm');
  }
};
</script>
