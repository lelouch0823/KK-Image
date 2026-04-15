<template>
  <div
    v-if="show"
    data-testid="purchase-order-suggestions-shell"
    class="fixed inset-0 z-50 flex items-center justify-center p-4"
  >
    <div class="absolute inset-0 bg-(--color-overlay-dim) backdrop-blur-sm" @click="$emit('close')"></div>
    <div
      class="relative flex w-full max-w-4xl flex-col overflow-hidden rounded-[2rem] border border-(--border-color)/70 bg-(--color-modal-bg) p-6 shadow-[0_32px_90px_-45px_rgba(15,23,42,0.38)]"
    >
      <div
        class="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.08),transparent_26%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.08),transparent_22%)]"
      ></div>
      <div class="relative mb-4 flex items-start justify-between gap-3">
        <div>
          <p class="text-xs font-semibold tracking-[0.18em] text-(--text-muted) uppercase">
            Smart Suggestions
          </p>
          <h2 class="mt-1 text-xl font-bold text-(--text-main)">
            {{ t('purchaseOrder.suggestions.title') }}
          </h2>
          <p class="mt-1 text-sm text-(--text-secondary)">
            {{ t('purchaseOrder.suggestions.subtitle') }}
          </p>
        </div>
        <button
          class="cursor-pointer rounded-lg p-2 text-(--text-secondary) hover:bg-(--bg-hover)"
          @click="$emit('close')"
        >
          <AppIcon name="x-mark" class="size-5" />
        </button>
      </div>

      <div v-if="!suggestionsLoading && suggestionSummaryCards.length > 0" class="relative mb-4 grid gap-3 md:grid-cols-3">
        <article
          v-for="card in suggestionSummaryCards"
          :key="card.key"
          class="rounded-[1.35rem] border border-(--border-color)/60 bg-(--bg-card)/88 p-4"
        >
          <p class="text-[11px] font-semibold tracking-[0.16em] text-(--text-muted) uppercase">
            {{ card.label }}
          </p>
          <div class="mt-2 font-mono text-2xl font-semibold tabular-nums text-(--text-main)">
            {{ card.value }}
          </div>
          <p class="mt-1 text-xs leading-5 text-(--text-secondary)">{{ card.hint }}</p>
        </article>
      </div>

      <div v-if="suggestionsLoading" class="flex items-center justify-center py-12">
        <div class="border-primary size-8 animate-spin rounded-full border-4 border-t-transparent"></div>
      </div>
      <div v-else-if="suggestions.length === 0" class="py-12 text-center">
        <AppIcon name="light-bulb" class="mx-auto size-10 text-(--text-muted)" />
        <p class="mt-3 text-sm text-(--text-secondary)">
          {{ t('purchaseOrder.suggestions.empty') }}
        </p>
      </div>
      <div v-else class="max-h-96 space-y-2 overflow-y-auto">
        <div
          v-for="s in suggestions"
          :key="`${s.product_id}-${s.variant_id || 'no-variant'}`"
          class="flex flex-col gap-3 rounded-[1.35rem] border border-(--border-subtle) bg-(--bg-card)/88 p-4 transition-colors hover:bg-(--bg-hover) lg:flex-row lg:items-center lg:justify-between"
        >
          <div class="flex min-w-0 items-center gap-3">
            <AppCheckbox
              v-model="selectionModel"
              :value="s"
              :disabled="getSuggestionOrderIds(s).length === 0"
            />
            <div class="min-w-0">
              <div class="truncate text-sm font-medium text-(--text-main)" :title="s.product_name || '—'">
                {{ s.product_name || '—' }}
              </div>
              <div class="truncate text-xs text-(--text-secondary)" :title="buildSuggestionMeta(s)">
                {{ buildSuggestionMeta(s) }}
                <template v-if="s.variant_options && Object.keys(s.variant_options).length > 0">
                  · {{ buildSuggestionVariantLabel(s.variant_options) }}
                </template>
              </div>
            </div>
          </div>
          <div class="flex flex-wrap items-center gap-2 text-xs lg:justify-end">
            <StatusBadge variant="danger" class="text-[10px]">
              {{ t('purchaseOrder.suggestions.shortage') }} {{ s.shortage }}
            </StatusBadge>
            <StatusBadge variant="default" class="text-[10px]">
              {{ t('purchaseOrder.suggestions.stock') }} {{ s.available_quantity ?? s.stock_quantity }}
            </StatusBadge>
            <span class="rounded-full bg-(--bg-muted) px-2.5 py-1 font-mono tabular-nums text-(--text-secondary)">
              成本 ¥{{ (s.variant_cost_price || s.cost_price || 0).toFixed(2) }}
            </span>
            <span class="bg-primary/8 text-primary rounded-full px-2.5 py-1 font-mono tabular-nums">
              建议 ¥{{ (s.suggested_purchase_price || s.cost_price || 0).toFixed(2) }}
            </span>
            <span v-if="s.last_purchase_price != null" class="font-mono tabular-nums text-(--text-secondary)">
              最近 ¥{{ Number(s.last_purchase_price).toFixed(2) }}
            </span>
            <span
              v-if="s.price_delta != null"
              class="font-mono font-semibold tabular-nums"
              :class="
                s.price_delta > 0
                  ? 'text-warning'
                  : s.price_delta < 0
                    ? 'text-success'
                    : 'text-(--text-secondary)'
              "
            >
              Δ {{ s.price_delta > 0 ? '+' : '' }}{{ Number(s.price_delta).toFixed(2) }}
            </span>
          </div>
        </div>
      </div>

      <div
        v-if="suggestions.length > 0"
        class="relative mt-4 flex justify-end gap-3 border-t border-(--border-color)/60 pt-4"
      >
        <button
          data-testid="purchase-order-suggestions-submit"
          class="bg-primary cursor-pointer rounded-xl px-4 py-2.5 text-sm font-medium text-(--text-inverse) transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          :disabled="selectedSuggestionOrderIds.length === 0"
          @click="$emit('submit')"
        >
          {{ t('purchaseOrder.suggestions.addSelected') }} ({{ selectedSuggestions.length }})
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import AppCheckbox from '@/components/ui/AppCheckbox.vue';
import AppIcon from '@/components/ui/AppIcon.vue';
import StatusBadge from '@/components/ui/StatusBadge.vue';

const props = defineProps({
  show: { type: Boolean, default: false },
  t: { type: Function, required: true },
  suggestionsLoading: { type: Boolean, default: false },
  suggestions: { type: Array, default: () => [] },
  suggestionSummaryCards: { type: Array, default: () => [] },
  selectedSuggestions: { type: Array, default: () => [] },
  selectedSuggestionOrderIds: { type: Array, default: () => [] },
  buildSuggestionMeta: { type: Function, required: true },
  buildSuggestionVariantLabel: { type: Function, required: true },
  getSuggestionOrderIds: { type: Function, required: true },
});

const emit = defineEmits(['close', 'submit', 'update:selected-suggestions']);

const selectionModel = computed({
  get: () => props.selectedSuggestions,
  set: (value) => emit('update:selected-suggestions', value),
});
</script>
