<template>
  <Modal
    :model-value="show"
    size="4xl"
    :closable="false"
    body-class="!p-0"
    @update:model-value="handleVisibilityChange"
  >
    <template #header>
      <div
        data-testid="purchase-order-suggestions-shell"
        class="flex items-start justify-between gap-3"
      >
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
        <AppButton variant="ghost" size="sm" class="h-9 w-9 px-0" @click="$emit('close')">
          <AppIcon name="x-mark" class="size-5" />
        </AppButton>
      </div>
    </template>

    <div class="space-y-4 px-6 py-5">
      <div v-if="!suggestionsLoading && suggestionSummaryCards.length > 0" class="grid gap-3 md:grid-cols-3">
        <AppCard
          v-for="card in suggestionSummaryCards"
          :key="card.key"
          class="p-4"
        >
          <p class="text-xs font-semibold tracking-[0.16em] text-(--text-muted) uppercase">
            {{ card.label }}
          </p>
          <div class="mt-2 font-mono text-2xl font-semibold tabular-nums text-(--text-main)">
            {{ card.value }}
          </div>
          <p class="mt-1 text-xs leading-5 text-(--text-secondary)">{{ card.hint }}</p>
        </AppCard>
      </div>

      <div v-if="suggestionsLoading" class="flex items-center justify-center py-12">
        <AppIcon name="spinner" class="text-primary size-8 animate-spin" />
      </div>
      <div v-else-if="suggestions.length === 0" class="py-12 text-center">
        <AppIcon name="light-bulb" class="mx-auto size-10 text-(--text-muted)" />
        <p class="mt-3 text-sm text-(--text-secondary)">
          {{ t('purchaseOrder.suggestions.empty') }}
        </p>
      </div>
      <div v-else class="max-h-96 space-y-2 overflow-y-auto">
        <AppCard
          v-for="s in suggestions"
          :key="`${s.product_id}-${s.variant_id || 'no-variant'}`"
          class="p-4 transition-colors hover:bg-(--bg-hover)"
        >
          <div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div class="flex min-w-0 items-center gap-3">
              <AppCheckbox
                v-model="selectionModel"
                :value="s"
                :disabled="getSuggestionOrderIds(s).length === 0"
              />
              <div class="min-w-0">
                <div class="truncate text-sm font-medium text-(--text-main)" :title="s.product_name || '-'">
                  {{ s.product_name || '-' }}
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
              <StatusBadge variant="danger" class="text-xs">
                {{ t('purchaseOrder.suggestions.shortage') }} {{ s.shortage }}
              </StatusBadge>
              <StatusBadge variant="default" class="text-xs">
                {{ t('purchaseOrder.suggestions.stock') }} {{ s.available_quantity ?? s.stock_quantity }}
              </StatusBadge>
              <span class="rounded-full bg-(--bg-muted) px-2.5 py-1 font-mono tabular-nums text-(--text-secondary)">
                {{ t('purchaseOrder.suggestions.cost') }} ¥{{ (s.variant_cost_price || s.cost_price || 0).toFixed(2) }}
              </span>
              <span class="bg-primary/8 text-primary rounded-full px-2.5 py-1 font-mono tabular-nums">
                {{ t('purchaseOrder.suggestions.suggested') }} ¥{{ (s.suggested_purchase_price || s.cost_price || 0).toFixed(2) }}
              </span>
              <span v-if="s.last_purchase_price != null" class="font-mono tabular-nums text-(--text-secondary)">
                {{ t('purchaseOrder.suggestions.recent') }} ¥{{ Number(s.last_purchase_price).toFixed(2) }}
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
        </AppCard>
      </div>
    </div>

    <template #footer>
      <ActionBar
        v-if="suggestions.length > 0"
        class="!justify-end border-none bg-transparent px-0 py-0 shadow-none"
      >
        <AppButton
          data-testid="purchase-order-suggestions-submit"
          :disabled="selectedSuggestionOrderIds.length === 0"
          @click="$emit('submit')"
        >
          {{ t('purchaseOrder.suggestions.addSelected') }} ({{ selectedSuggestions.length }})
        </AppButton>
      </ActionBar>
    </template>
  </Modal>
</template>

<script setup>
import { computed } from 'vue';
import ActionBar from '@/design-system/composed/ActionBar.vue';
import AppCheckbox from '@/components/ui/AppCheckbox.vue';
import AppButton from '@/components/ui/AppButton.vue';
import AppCard from '@/components/ui/AppCard.vue';
import AppIcon from '@/components/ui/AppIcon.vue';
import Modal from '@/components/ui/Modal.vue';
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

const handleVisibilityChange = (nextVisible) => {
  if (!nextVisible) {
    emit('close');
  }
};

const selectionModel = computed({
  get: () => props.selectedSuggestions,
  set: (value) => emit('update:selected-suggestions', value),
});
</script>
