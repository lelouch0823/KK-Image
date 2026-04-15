<template>
  <div
    v-if="show"
    data-testid="purchase-order-shortage-modal"
    class="fixed inset-0 z-[61] flex items-center justify-center p-4"
  >
    <div class="absolute inset-0 bg-(--color-overlay-dim) backdrop-blur-sm" @click="$emit('close')"></div>
    <div
      class="relative flex w-full max-w-4xl flex-col overflow-hidden rounded-[1.8rem] border border-(--border-color)/70 bg-(--color-modal-bg) shadow-[0_32px_90px_-45px_rgba(15,23,42,0.38)]"
      style="max-height: calc(100vh - 3rem)"
    >
      <div
        class="relative flex items-start justify-between border-b border-(--border-color) bg-linear-to-r from-slate-50/90 via-(--bg-card) to-amber-50/35 px-6 py-5"
      >
        <div
          class="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(100,116,139,0.14),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(245,158,11,0.1),transparent_24%)]"
        ></div>
        <div class="relative">
          <p class="text-xs font-semibold tracking-[0.18em] text-(--text-muted) uppercase">
            Shortage Closure
          </p>
          <h2 class="mt-1 text-xl font-bold text-(--text-main)">
            {{ t('purchaseOrder.action.closeOutstanding', '关闭待收') }}
          </h2>
          <p class="mt-1 text-sm text-(--text-secondary)">
            {{
              t(
                'purchaseOrder.ui.shortageModalHint',
                '将确认不会再到货的尾差数量转入采购单取消量，只关闭采购侧待收，不改客户订单需求。'
              )
            }}
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
        <div class="space-y-3">
          <article
            v-for="entry in shortageDrafts"
            :key="entry.purchase_order_item_id"
            class="rounded-[1.35rem] border border-(--border-subtle) bg-linear-to-r from-(--bg-card) via-(--bg-card) to-slate-50/40 p-4"
          >
            <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div class="min-w-0">
                <div class="flex min-w-0 flex-wrap items-center gap-2">
                  <span class="line-clamp-1 min-w-0 text-sm font-medium break-all text-(--text-main)" :title="entry.product_name">
                    {{ entry.product_name || '—' }}
                  </span>
                  <code class="rounded-md border border-(--border-color)/60 bg-(--bg-muted) px-1.5 py-0.5 font-mono text-[10px] text-(--text-secondary)">
                    {{ entry.variant_sku || '—' }}
                  </code>
                  <span
                    v-if="entry.customer_order_no"
                    class="bg-info/10 text-info inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium"
                  >
                    {{ entry.customer_order_no }}
                  </span>
                </div>
                <p class="mt-2 text-xs text-(--text-secondary)">
                  {{ t('purchaseOrder.progress.receivedPrefix', '已到') }}
                  {{ formatInteger(entry.received_qty_before) }} /
                  {{ formatInteger(entry.ordered_qty) }} ·
                  {{ t('purchaseOrder.progress.cancelledPrefix', '取消') }}
                  {{ formatInteger(entry.cancelled_qty_before) }} ·
                  {{ t('purchaseOrder.progress.outstandingPrefix', '待收') }}
                  {{ formatInteger(entry.max_closable) }}
                </p>
                <div
                  v-if="entry.variant_options && Object.keys(entry.variant_options).length > 0"
                  class="mt-2 flex min-w-0 flex-wrap gap-1"
                >
                  <span
                    v-for="(val, key) in entry.variant_options"
                    :key="`shortage-draft-${entry.purchase_order_item_id}-${key}`"
                    class="border-primary/20 bg-primary/8 text-primary rounded-full border px-2 py-0.5 text-[10px] font-medium break-all"
                  >
                    {{ key }}: {{ val }}
                  </span>
                </div>
              </div>
              <div class="grid gap-3 lg:w-[19rem]">
                <div class="rounded-2xl border border-(--border-subtle) bg-(--bg-page)/80 p-3">
                  <label class="text-[11px] font-medium text-(--text-secondary)">
                    {{ t('purchaseOrder.ui.shortageCloseQty', '本次关闭数量') }}
                  </label>
                  <AppInput
                    v-model="entry.close_qty"
                    type="number"
                    min="0"
                    step="1"
                    class="mt-2 text-center"
                    size="sm"
                  />
                  <p
                    v-if="isShortageDraftInvalid(entry)"
                    class="text-danger mt-2 text-[11px] font-medium"
                  >
                    {{ t('purchaseOrder.ui.shortageQtyOverflow', '不能超过当前剩余待收数量。') }}
                  </p>
                </div>
              </div>
            </div>
          </article>
        </div>
      </div>

      <div
        class="flex flex-col gap-3 border-t border-(--border-color) bg-linear-to-r from-(--bg-card) to-(--bg-muted)/30 px-6 py-4 lg:flex-row lg:items-center lg:justify-between"
      >
        <div class="flex flex-wrap items-center gap-2 text-sm text-(--text-secondary)">
          <span>
            {{ t('purchaseOrder.ui.shortageSelectedLines', '已填关闭行') }}
            <strong class="font-mono font-semibold tabular-nums text-(--text-main)">
              {{ shortageDraftSelectedCount }}
            </strong>
          </span>
          <span>·</span>
          <span>
            {{ t('purchaseOrder.ui.shortageSelectedQty', '已填关闭数量') }}
            <strong class="font-mono font-semibold tabular-nums text-(--text-main)">
              {{ formatInteger(shortageDraftSelectedQty) }}
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
            :disabled="shortageSubmitDisabled || shortageSubmitting"
            class="bg-primary cursor-pointer rounded-xl px-5 py-2.5 text-sm font-medium text-(--text-inverse) shadow-sm transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            @click="$emit('submit')"
          >
            {{
              shortageSubmitting
                ? t('purchaseOrder.ui.shortageSubmitting', '提交中...')
                : t('purchaseOrder.action.closeOutstanding', '关闭待收')
            }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
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

defineEmits(['close', 'submit']);
</script>
