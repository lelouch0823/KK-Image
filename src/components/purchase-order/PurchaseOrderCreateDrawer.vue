<template>
  <div
    v-if="show"
    data-testid="purchase-order-create-shell"
    class="fixed inset-0 z-50 flex items-center justify-center p-4"
  >
    <div class="absolute inset-0 bg-(--color-overlay-dim) backdrop-blur-sm" @click="$emit('close')"></div>
    <div
      class="relative flex w-full max-w-5xl flex-col overflow-hidden rounded-[2rem] border border-(--border-color)/70 bg-(--color-modal-bg) shadow-[0_32px_90px_-45px_rgba(15,23,42,0.38)]"
      style="max-height: calc(100vh - 3rem)"
    >
      <div
        class="relative flex items-start justify-between border-b border-(--border-color) bg-linear-to-r from-sky-50/75 via-(--bg-card) to-amber-50/40 px-6 py-5"
      >
        <div
          class="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.1),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(249,115,22,0.1),transparent_24%)]"
        ></div>
        <div class="relative">
          <p class="text-xs font-semibold tracking-[0.18em] text-(--text-muted) uppercase">
            Draft Builder
          </p>
          <h2 class="mt-1 text-xl font-bold text-(--text-main)">
            {{ t('purchaseOrder.action.create') }}
          </h2>
          <p class="mt-1 text-sm text-(--text-secondary)">
            {{ t('purchaseOrder.ui.createHint', '先设置成本策略，再补充采购商品和关联预定单。') }}
          </p>
        </div>
        <button
          type="button"
          class="cursor-pointer rounded-lg p-2 text-(--text-secondary) hover:bg-(--bg-hover)"
          @click="$emit('close')"
        >
          <AppIcon name="x-mark" class="size-5" />
        </button>
      </div>

      <div class="min-h-0 flex-1 overflow-y-auto px-6 py-4">
        <div class="space-y-5">
          <section
            class="rounded-[1.6rem] border border-(--border-color)/70 bg-linear-to-br from-(--bg-card) to-sky-50/30 p-4 shadow-sm"
          >
            <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p class="text-[11px] font-semibold tracking-[0.16em] text-(--text-muted) uppercase">
                  Configuration
                </p>
                <h3 class="mt-1 text-sm font-semibold text-(--text-main)">
                  {{ t('purchaseOrder.ui.configurationTitle', '采购策略与费用设置') }}
                </h3>
              </div>
              <div class="flex flex-wrap items-center gap-2">
                <StatusBadge variant="info" class="text-[10px]">
                  {{ t('purchaseOrder.detail.items') }} {{ poItems.length }}
                </StatusBadge>
                <StatusBadge variant="success" class="text-[10px]">
                  {{ t('purchaseOrder.form.totalQty') }} {{ totalCreateQty }}
                </StatusBadge>
                <StatusBadge
                  v-if="shortageItems.length > 0"
                  variant="warning"
                  class="text-[10px]"
                >
                  {{ t('purchaseOrder.form.quantityWarning') }} {{ shortageItems.length }}
                </StatusBadge>
              </div>
            </div>

            <div class="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(22rem,1fr)]">
              <div class="rounded-2xl border border-(--border-subtle) bg-(--bg-card)/85 p-4">
                <label class="text-xs font-medium text-(--text-secondary)">
                  {{ t('purchaseOrder.form.remark') }}
                </label>
                <AppInput
                  data-testid="purchase-order-create-remark"
                  :model-value="createForm.remark"
                  type="text"
                  class="mt-2"
                  :placeholder="t('purchaseOrder.form.remarkPlaceholder')"
                  @update:model-value="updateCreateField('remark', $event)"
                />
              </div>

              <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                <div class="rounded-2xl border border-(--border-subtle) bg-(--bg-card)/85 p-4">
                  <label class="text-xs font-medium text-(--text-secondary)">
                    {{ t('purchaseOrder.form.currency') }}
                  </label>
                  <AppSelect
                    :model-value="createForm.currency"
                    :options="currencyOptions"
                    :placeholder="t('purchaseOrder.form.currency')"
                    size="sm"
                    class="mt-2"
                    @update:model-value="updateCreateField('currency', $event)"
                  />
                </div>
                <div class="rounded-2xl border border-(--border-subtle) bg-(--bg-card)/85 p-4">
                  <label class="text-xs font-medium text-(--text-secondary)">
                    {{ t('purchaseOrder.form.estimatedShipping') }}
                  </label>
                  <AppInput
                    :model-value="createForm.estimated_shipping_cost"
                    type="number"
                    step="0.01"
                    class="mt-2"
                    @update:model-value="updateCreateField('estimated_shipping_cost', $event)"
                  />
                </div>
                <div class="rounded-2xl border border-(--border-subtle) bg-(--bg-card)/85 p-4">
                  <label class="text-xs font-medium text-(--text-secondary)">
                    {{ t('purchaseOrder.form.estimatedTariff') }}
                  </label>
                  <AppInput
                    :model-value="createForm.estimated_tariff_cost"
                    type="number"
                    step="0.01"
                    class="mt-2"
                    @update:model-value="updateCreateField('estimated_tariff_cost', $event)"
                  />
                </div>
                <div
                  class="rounded-2xl border border-(--border-subtle) bg-(--bg-card)/85 p-4 sm:col-span-2 xl:col-span-3"
                >
                  <label class="text-xs font-medium text-(--text-secondary)">
                    {{ t('purchaseOrder.form.allocationMethod') }}
                  </label>
                  <AppSelect
                    :model-value="createForm.allocation_method"
                    :options="allocationMethodOptions"
                    :placeholder="t('purchaseOrder.form.byQuantity')"
                    size="sm"
                    class="mt-2"
                    @update:model-value="updateCreateField('allocation_method', $event)"
                  />
                </div>
              </div>
            </div>
          </section>

          <section class="rounded-[1.6rem] border border-(--border-color)/70 bg-(--bg-card) shadow-sm">
            <div
              class="flex flex-col gap-3 border-b border-(--border-subtle) p-4 lg:flex-row lg:items-center lg:justify-between"
            >
              <div>
                <p class="text-[11px] font-semibold tracking-[0.16em] text-(--text-muted) uppercase">
                  Procurement Mix
                </p>
                <h3 class="mt-1 text-sm font-semibold text-(--text-main)">
                  {{ t('purchaseOrder.form.itemList', '采购商品') }}
                  <span
                    v-if="poItems.length > 0"
                    class="ml-1 font-mono text-xs font-normal tabular-nums text-(--text-secondary)"
                  >
                    ({{ poItems.length }})
                  </span>
                </h3>
              </div>
              <div class="flex items-center gap-2">
                <button
                  type="button"
                  class="border-primary/30 bg-primary/5 text-primary flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-primary/10"
                  @click="$emit('open-order-picker', 'create')"
                >
                  <AppIcon name="clipboard-document-list" class="size-3.5" />
                  {{ t('purchaseOrder.action.linkOrders') }}
                </button>
                <button
                  type="button"
                  data-testid="purchase-order-open-product-picker-create"
                  class="flex cursor-pointer items-center gap-1.5 rounded-lg border border-(--border-color) px-3 py-1.5 text-xs font-medium text-(--text-main) transition-colors hover:bg-(--bg-hover)"
                  @click="$emit('open-product-picker', 'create')"
                >
                  <AppIcon name="plus" class="size-3.5" />
                  {{ t('purchaseOrder.action.addProduct') }}
                </button>
              </div>
            </div>

            <div v-if="poItems.length === 0" class="flex flex-col items-center py-12">
              <div
                class="flex size-16 items-center justify-center rounded-[1.35rem] bg-linear-to-br from-(--bg-muted) to-sky-50/40"
              >
                <AppIcon name="cube" class="size-7 text-(--text-muted)" />
              </div>
              <p class="mt-3 text-sm text-(--text-secondary)">
                {{ t('purchaseOrder.form.noItems') }}
              </p>
            </div>

            <div v-else class="overflow-x-auto">
              <table class="w-full">
                <thead>
                  <tr class="border-b border-(--border-subtle) text-left text-xs font-medium text-(--text-secondary)">
                    <th class="px-4 py-2.5">{{ t('purchaseOrder.table.product') }}</th>
                    <th class="px-4 py-2.5 text-center">{{ t('purchaseOrder.table.quantity') }}</th>
                    <th class="px-4 py-2.5 text-right">{{ t('purchaseOrder.table.unitCost') }}</th>
                    <th class="px-4 py-2.5 text-center">{{ t('purchaseOrder.form.source') }}</th>
                    <th class="w-10 px-2 py-2.5"></th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-(--border-subtle)">
                  <tr
                    v-for="(item, idx) in poItems"
                    :key="idx"
                    class="group transition-colors hover:bg-(--bg-hover)"
                  >
                    <td class="px-4 py-3">
                      <div class="flex items-center gap-2.5">
                        <div
                          class="size-8 shrink-0 overflow-hidden rounded-lg border border-(--border-subtle) bg-(--bg-muted)"
                        >
                          <AppImage v-if="item.image" :src="getFileUrl(item.image)" class="size-full" />
                          <div
                            v-else
                            class="flex size-full items-center justify-center text-(--text-muted)"
                          >
                            <AppIcon name="photo" class="size-4" />
                          </div>
                        </div>
                        <div class="min-w-0">
                          <div class="truncate text-sm font-medium text-(--text-main)" :title="item.product_name || '—'">
                            {{ item.product_name || '—' }}
                          </div>
                          <div class="flex min-w-0 items-center gap-1.5 text-xs text-(--text-secondary)">
                            <span class="max-w-[8rem] truncate font-mono" :title="item.sku || '-'">
                              {{ item.sku || '-' }}
                            </span>
                            <span v-if="item.brand" class="max-w-[7rem] truncate" :title="item.brand">
                              · {{ item.brand }}
                            </span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td class="px-4 py-3 text-center">
                      <div class="flex flex-col items-center">
                        <AppInput
                          v-model="item.quantity"
                          type="number"
                          min="1"
                          class="w-20 text-center"
                          size="sm"
                        />
                        <span
                          v-if="item.required_quantity && item.quantity < item.required_quantity"
                          class="text-danger mt-1 text-[10px] font-medium"
                        >
                          {{ t('purchaseOrder.form.quantityWarning') }} ({{ item.required_quantity }})
                        </span>
                      </div>
                    </td>
                    <td class="px-4 py-3 text-right">
                      <AppInput
                        v-model="item.unit_cost"
                        type="number"
                        step="0.01"
                        min="0"
                        class="w-24 text-right"
                        size="sm"
                      />
                    </td>
                    <td class="px-4 py-3 text-center">
                      <span
                        v-if="item.pre_order_id"
                        class="bg-info/10 text-info inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
                      >
                        <AppIcon name="shopping-bag" class="size-3" />
                        {{ t('purchaseOrder.form.sourceOrder') }}
                      </span>
                      <span
                        v-else
                        class="inline-flex items-center gap-1 rounded-full bg-(--bg-muted) px-2 py-0.5 text-[10px] font-semibold text-(--text-secondary)"
                      >
                        <AppIcon name="building-storefront" class="size-3" />
                        {{ t('purchaseOrder.form.sourceStock') }}
                      </span>
                    </td>
                    <td class="px-2 py-3">
                      <button
                        type="button"
                        class="hover:bg-danger/10 hover:text-danger cursor-pointer rounded-lg p-1.5 text-(--text-muted) opacity-0 transition-all group-hover:opacity-100"
                        @click="$emit('remove-item', idx)"
                      >
                        <AppIcon name="trash" class="size-4" />
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>

      <div
        class="flex flex-col gap-3 border-t border-(--border-color) bg-linear-to-r from-(--bg-card) to-(--bg-muted)/30 px-6 py-4 lg:flex-row lg:items-center lg:justify-between"
      >
        <div class="text-sm text-(--text-secondary)">
          <span v-if="poItems.length > 0">
            {{ poItems.length }} {{ t('purchaseOrder.form.itemsCount') }} ·
            {{ t('purchaseOrder.form.totalQty') }}:
            <strong class="font-mono font-semibold tabular-nums text-(--text-main)">
              {{ totalCreateQty }}
            </strong>
          </span>
        </div>
        <div class="flex items-center gap-3">
          <button
            type="button"
            class="cursor-pointer rounded-xl px-4 py-2.5 text-sm font-medium text-(--text-secondary) transition-colors hover:bg-(--bg-hover)"
            @click="$emit('close')"
          >
            {{ t('common.cancel') }}
          </button>
          <button
            type="button"
            data-testid="purchase-order-create-submit"
            :disabled="poItems.length === 0"
            class="bg-primary cursor-pointer rounded-xl px-5 py-2.5 text-sm font-medium text-(--text-inverse) shadow-sm transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            @click="$emit('submit')"
          >
            {{ t('common.create', '创建') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import AppImage from '@/components/ui/AppImage.vue';
import AppIcon from '@/components/ui/AppIcon.vue';
import AppInput from '@/components/ui/AppInput.vue';
import AppSelect from '@/components/ui/Select.vue';
import StatusBadge from '@/components/ui/StatusBadge.vue';

defineProps({
  show: { type: Boolean, default: false },
  t: { type: Function, required: true },
  createForm: { type: Object, required: true },
  currencyOptions: { type: Array, default: () => [] },
  allocationMethodOptions: { type: Array, default: () => [] },
  poItems: { type: Array, default: () => [] },
  totalCreateQty: { type: Number, default: 0 },
  shortageItems: { type: Array, default: () => [] },
  getFileUrl: { type: Function, required: true },
});

const emit = defineEmits([
  'close',
  'open-order-picker',
  'open-product-picker',
  'remove-item',
  'submit',
  'update:create-form',
]);

const updateCreateField = (field, value) => {
  emit('update:create-form', { [field]: value });
};
</script>
