<template>
  <OverlayScaffold
    :model-value="show"
    size="4xl"
    :eyebrow="'Shortage Closure'"
    :title="t('purchaseOrder.action.closeOutstanding')"
    :description="t('purchaseOrder.ui.shortageModalHint')"
    @update:model-value="handleVisibilityChange"
    @close="$emit('close')"
  >
    <template #headerActions>
      <AppButton variant="ghost" size="sm" class="h-9 w-9 px-0" @click="$emit('close')">
        <AppIcon name="x-mark" class="size-5" />
      </AppButton>
    </template>

    <div data-testid="purchase-order-shortage-modal" class="space-y-3">
      <AppCard v-for="entry in shortageDrafts" :key="entry.purchase_order_item_id" class="p-4">
        <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div class="min-w-0">
            <div class="flex min-w-0 flex-wrap items-center gap-2">
              <span
                class="line-clamp-1 min-w-0 text-sm font-medium break-all text-(--text-main)"
                :title="entry.product_name"
              >
                {{ entry.product_name || '-' }}
              </span>
              <code
                class="rounded-md border border-(--border-color)/60 bg-(--bg-muted) px-1.5 py-0.5 font-mono text-xs text-(--text-secondary)"
              >
                {{ entry.variant_sku || '-' }}
              </code>
              <span
                v-if="entry.customer_order_no"
                class="bg-info/10 text-info inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
              >
                {{ entry.customer_order_no }}
              </span>
            </div>
            <p class="mt-2 text-xs text-(--text-secondary)">
              {{ t('purchaseOrder.progress.receivedPrefix') }}
              {{ formatInteger(entry.received_qty_before) }} /
              {{ formatInteger(entry.ordered_qty) }} ·
              {{ t('purchaseOrder.progress.cancelledPrefix') }}
              {{ formatInteger(entry.cancelled_qty_before) }} ·
              {{ t('purchaseOrder.progress.outstandingPrefix') }}
              {{ formatInteger(entry.max_closable) }}
            </p>
            <div v-if="hasEntries(entry.variant_options)" class="mt-2 flex min-w-0 flex-wrap gap-1">
              <span
                v-for="(val, key) in entry.variant_options"
                :key="`shortage-draft-${entry.purchase_order_item_id}-${key}`"
                class="border-primary/20 bg-primary/8 text-primary rounded-full border px-2 py-0.5 text-xs font-medium break-all"
              >
                {{ key }}: {{ val }}
              </span>
            </div>
          </div>
          <div class="grid gap-3 lg:w-[19rem]">
            <AppCard class="p-3">
              <label class="text-xs font-medium text-(--text-secondary)">
                {{ t('purchaseOrder.ui.shortageCloseQty') }}
              </label>
              <AppInput
                v-model="entry.close_qty"
                type="number"
                min="0"
                step="1"
                class="mt-2 text-center"
                size="sm"
              />
              <p v-if="isShortageDraftInvalid(entry)" class="text-danger mt-2 text-xs font-medium">
                {{ t('purchaseOrder.ui.shortageQtyOverflow') }}
              </p>
            </AppCard>
          </div>
        </div>
      </AppCard>
    </div>

    <template #footer>
      <ActionBar>
        <template #leading>
          <div class="flex flex-wrap items-center gap-2 text-sm text-(--text-secondary)">
            <span>
              {{ t('purchaseOrder.ui.shortageSelectedLines') }}
              <strong class="font-mono font-semibold tabular-nums text-(--text-main)">
                {{ shortageDraftSelectedCount }}
              </strong>
            </span>
            <span>·</span>
            <span>
              {{ t('purchaseOrder.ui.shortageSelectedQty') }}
              <strong class="font-mono font-semibold tabular-nums text-(--text-main)">
                {{ formatInteger(shortageDraftSelectedQty) }}
              </strong>
            </span>
          </div>
        </template>
        <AppButton variant="secondary" @click="$emit('close')">
          {{ t('common.cancel') }}
        </AppButton>
        <AppButton
          :disabled="shortageSubmitDisabled"
          :loading="shortageSubmitting"
          :loading-text="t('purchaseOrder.ui.shortageSubmitting')"
          @click="$emit('submit')"
        >
          {{ t('purchaseOrder.action.closeOutstanding') }}
        </AppButton>
      </ActionBar>
    </template>
  </OverlayScaffold>
</template>

<script setup>
import OverlayScaffold from '@/design-system/composed/OverlayScaffold.vue';
import ActionBar from '@/design-system/composed/ActionBar.vue';
import { hasEntries } from '@/utils/object-utils';
import AppButton from '@/components/ui/AppButton.vue';
import AppCard from '@/components/ui/AppCard.vue';
import AppIcon from '@/components/ui/AppIcon.vue';
import AppInput from '@/components/ui/AppInput.vue';

defineProps({
  show: { type: Boolean, default: false },
  t: { type: Function, required: true },
  shortageDrafts: { type: Array, default: () => [] },
  shortageDraftSelectedCount: { type: Number, default: 0 },
  shortageDraftSelectedQty: { type: Number, default: 0 },
  shortageSubmitDisabled: { type: Boolean, default: false },
  shortageSubmitting: { type: Boolean, default: false },
  formatInteger: { type: Function, required: true },
  isShortageDraftInvalid: { type: Function, required: true },
});

const emit = defineEmits(['close', 'submit']);

const handleVisibilityChange = (nextVisible) => {
  if (!nextVisible) {
    emit('close');
  }
};
</script>
