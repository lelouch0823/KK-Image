<template>
  <section
    data-testid="purchase-order-detail-items"
    class="rounded-[1.6rem] border border-(--border-color)/65 bg-(--bg-card) p-4 shadow-none"
  >
    <div class="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div>
        <p class="text-xs font-semibold tracking-[0.16em] text-(--text-muted) uppercase">
          Line Items
        </p>
        <h3 class="mt-1 text-sm font-semibold text-(--text-main)">
          {{ t('purchaseOrder.detail.items') }} ({{ detail.items?.length || 0 }})
        </h3>
      </div>
      <div v-if="detail.status === 'draft'" class="flex items-center gap-2">
        <AppButton
          type="button"
          variant="outline"
          size="sm"
          @click="$emit('open-order-picker', 'detail')"
        >
          <template #icon-left>
            <AppIcon name="plus" class="size-3.5" />
          </template>
          {{ t('purchaseOrder.action.linkOrders') }}
        </AppButton>
        <AppButton
          type="button"
          variant="white"
          size="sm"
          @click="$emit('open-product-picker', 'detail')"
        >
          <template #icon-left>
            <AppIcon name="plus" class="size-3.5" />
          </template>
          {{ t('purchaseOrder.action.addProduct') }}
        </AppButton>
      </div>
    </div>

    <div v-if="detail.items && detail.items.length > 0" class="space-y-3">
      <article
        v-for="item in detail.items"
        :key="item.id"
        data-testid="purchase-order-detail-item-card"
        class="group grid gap-3 rounded-[1.35rem] border border-(--border-subtle) bg-(--bg-card) p-3.5 transition-colors duration-200 hover:border-primary/20 hover:bg-(--bg-hover) sm:grid-cols-[minmax(0,1.35fr)_minmax(12rem,14rem)] sm:items-stretch"
      >
        <div class="flex min-w-0 items-start gap-3">
          <div
            class="size-14 shrink-0 overflow-hidden rounded-xl border border-(--border-subtle) bg-(--bg-muted) shadow-sm"
          >
            <AppImage
              v-if="item.product_images?.[0]"
              :src="getFileUrl(item.product_images[0])"
              :alt="item.product_name"
              class="size-full object-cover"
            />
            <div v-else class="flex size-full items-center justify-center">
              <AppIcon name="photo" class="size-6 text-(--text-muted)" />
            </div>
          </div>

          <div class="flex min-w-0 flex-col gap-1.5">
            <div
              class="hover:text-primary flex min-w-0 cursor-pointer items-center gap-2 transition-colors"
              @click="$emit('view-product-detail', item.product_id)"
            >
              <span
                class="line-clamp-1 min-w-0 text-sm font-medium break-all text-(--text-main)"
                :title="item.product_name"
              >
                {{ item.product_name || '-' }}
              </span>
              <span
                v-if="item.product_brand"
                class="max-w-[8rem] shrink-0 truncate rounded-full border border-(--border-color)/70 bg-(--bg-muted) px-2 py-0.5 text-xs font-medium text-(--text-secondary)"
                :title="item.product_brand"
              >
                {{ item.product_brand }}
              </span>
              <AppButton
                v-if="detail.status === 'draft'"
                type="button"
                variant="link"
                :data-testid="`purchase-order-detail-item-remove-${item.id}`"
                class="shrink-0 text-xs !text-danger opacity-0 transition-opacity group-hover:opacity-100"
                @click="
                  $event.stopPropagation();
                  $emit('remove-item', item.id);
                "
              >
                <template #icon-left>
                  <AppIcon name="trash" class="size-3" />
                </template>
                {{ t('common.delete') }}
              </AppButton>
            </div>

            <div
              class="flex min-w-0 flex-wrap items-center gap-1.5 text-xs text-(--text-secondary)"
            >
              <code
                class="max-w-[10rem] truncate rounded-md border border-(--border-color)/60 bg-(--bg-muted) px-1.5 py-0.5 font-mono text-xs"
                :title="item.variant_sku || item.product_sku || '-'"
              >
                {{ item.variant_sku || item.product_sku || '-' }}
              </code>
              <span class="text-(--text-muted)">·</span>
              <span
                v-if="item.customer_order_no"
                class="bg-info/10 text-info inline-flex max-w-[12rem] items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
                :title="item.customer_order_no"
              >
                <AppIcon name="shopping-bag" class="size-3" />
                {{ item.customer_order_no }}
              </span>
              <span
                v-else
                class="bg-warning/10 text-warning inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
              >
                <AppIcon name="building-storefront" class="size-3" />
                {{ t('purchaseOrder.detail.publicStock') }}
              </span>
            </div>

            <div
              v-if="hasEntries(item.variant_options)"
              data-testid="purchase-order-detail-item-variant-options"
              class="mt-0.5 flex min-w-0 flex-wrap gap-1"
            >
              <span
                v-for="(val, key) in item.variant_options"
                :key="`variant-${key}`"
                class="border-primary/20 bg-primary/8 text-primary rounded-full border px-2 py-0.5 text-xs font-medium break-all"
                :title="`${key}: ${val}`"
              >
                {{ key }}: {{ val }}
              </span>
            </div>

            <div
              v-if="hasEntries(item.product_specifications)"
              class="mt-0.5 flex min-w-0 flex-wrap gap-1"
            >
              <span
                v-for="(val, key) in item.product_specifications"
                :key="key"
                class="max-w-full rounded border border-(--border-subtle) bg-(--bg-page) px-1.5 py-0.5 text-xs break-all text-(--text-secondary)"
                :title="`${key}: ${val}`"
              >
                {{ key }}: {{ val }}
              </span>
            </div>

            <div
              v-if="detail.status !== 'draft'"
              data-testid="purchase-order-detail-item-progress"
              class="mt-0.5 flex min-w-0 flex-wrap items-center gap-1.5 text-xs text-(--text-secondary)"
            >
              <StatusBadge
                :variant="
                  helpers.getProgressStatusVariant(item.display_status || detail.display_status)
                "
                class="text-xs"
              >
                {{ helpers.getProgressStatusLabel(item.display_status || detail.display_status) }}
              </StatusBadge>
              <span>{{ helpers.buildReceiptProgressSummary(item) }}</span>
              <span v-if="helpers.hasReceiptMeta(item)">{{ helpers.buildReceiptMeta(item) }}</span>
            </div>
          </div>
        </div>

        <div
          v-if="detail.status === 'draft'"
          class="rounded-2xl border border-(--border-subtle) bg-(--bg-page)/80 p-3"
        >
          <div class="grid grid-cols-2 gap-3">
            <div class="flex flex-col">
              <span class="mb-1 text-xs text-(--text-secondary)">
                {{ t('purchaseOrder.table.quantity') }}
              </span>
              <AppInput
                v-model="item.quantity"
                :data-testid="`purchase-order-detail-item-quantity-${item.id}`"
                type="number"
                min="1"
                class="w-full text-center"
                size="sm"
                @change="
                  $emit('update-item', { itemId: item.id, field: 'quantity', value: item.quantity })
                "
              />
            </div>
            <div class="flex flex-col">
              <span class="mb-1 text-xs text-(--text-secondary)">
                {{ t('purchaseOrder.table.unitCost') }}
              </span>
              <div class="relative">
                <span class="absolute top-1.5 left-2 text-xs text-(--text-secondary)">¥</span>
                <AppInput
                  v-model="item.unit_cost"
                  :data-testid="`purchase-order-detail-item-unit-cost-${item.id}`"
                  type="number"
                  step="0.01"
                  min="0"
                  class="w-full pr-2 pl-5 text-right"
                  size="sm"
                  @change="
                    $emit('update-item', {
                      itemId: item.id,
                      field: 'unit_cost',
                      value: item.unit_cost,
                    })
                  "
                />
              </div>
            </div>
          </div>
        </div>

        <div
          v-else
          class="flex flex-col justify-between rounded-2xl border border-(--border-subtle) bg-(--bg-page)/80 p-3"
        >
          <div class="space-y-2">
            <div class="flex items-center justify-between gap-3">
              <span class="text-xs font-medium text-(--text-secondary)">
                {{ t('purchaseOrder.table.quantity') }}
              </span>
              <span class="font-mono text-sm font-semibold text-(--text-main) tabular-nums">
                ×{{ item.quantity }}
              </span>
            </div>
            <div class="flex items-center justify-between gap-3">
              <span class="text-xs font-medium text-(--text-secondary)">
                {{ t('purchaseOrder.table.unitCost') }}
              </span>
              <span class="font-mono text-sm font-semibold text-(--text-main) tabular-nums">
                {{ helpers.formatPurchaseCurrency(item.unit_cost, detail.currency) }}
              </span>
            </div>
            <div class="flex items-center justify-between gap-3">
              <span class="text-xs font-medium text-(--text-secondary)">
                {{ t('purchaseOrder.ui.goodsSubtotal', '商品小计') }}
              </span>
              <span class="font-mono text-sm font-semibold text-(--text-main) tabular-nums">
                {{
                  helpers.formatPurchaseCurrency(
                    (item.unit_cost || 0) * (item.quantity || 0),
                    detail.currency
                  )
                }}
              </span>
            </div>
            <div class="flex items-center justify-between gap-3">
              <span class="text-xs font-medium text-(--text-secondary)">
                {{ t('purchaseOrder.ui.allocatedFreight', '分摊运费') }}
              </span>
              <span class="font-mono text-sm text-(--text-main) tabular-nums">
                {{ helpers.formatPurchaseCurrency(item.allocated_freight, detail.currency) }}
              </span>
            </div>
            <div class="flex items-center justify-between gap-3">
              <span class="text-xs font-medium text-(--text-secondary)">
                {{ t('purchaseOrder.ui.allocatedTariff', '分摊关税') }}
              </span>
              <span class="font-mono text-sm text-(--text-main) tabular-nums">
                {{ helpers.formatPurchaseCurrency(item.allocated_tariff, detail.currency) }}
              </span>
            </div>
          </div>
        </div>
      </article>
    </div>

    <div
      v-else
      class="rounded-[1.35rem] border border-dashed border-(--border-subtle) bg-(--bg-page)/60 px-4 py-10 text-center text-sm text-(--text-secondary)"
    >
      {{ t('purchaseOrder.empty') }}
    </div>
  </section>
</template>

<script setup>
import AppButton from '@/components/ui/AppButton.vue';
import AppImage from '@/components/ui/AppImage.vue';
import AppIcon from '@/components/ui/AppIcon.vue';
import AppInput from '@/components/ui/AppInput.vue';
import StatusBadge from '@/components/ui/StatusBadge.vue';
import { hasEntries } from '@/utils/object-utils';

defineProps({
  detail: {
    type: Object,
    required: true,
  },
  t: {
    type: Function,
    required: true,
  },
  helpers: {
    type: Object,
    required: true,
  },
  getFileUrl: {
    type: Function,
    required: true,
  },
});

defineEmits([
  'open-order-picker',
  'open-product-picker',
  'view-product-detail',
  'update-item',
  'remove-item',
]);
</script>
