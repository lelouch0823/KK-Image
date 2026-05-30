<template>
  <Modal
    :model-value="visible"
    size="4xl"
    :closable="false"
    body-class="!p-0"
    @update:model-value="handleModalVisibilityChange"
  >
    <template #header>
      <div
        data-testid="purchase-order-product-picker-shell"
        class="flex items-start justify-between gap-4"
      >
        <div>
          <p class="text-[11px] font-semibold tracking-[0.16em] text-(--text-muted) uppercase">
            Variant Selector
          </p>
          <h2 class="mt-1 text-xl font-bold text-(--text-main)">
            {{ t('purchaseOrder.selection.variantTitle', '选择变体') }}
          </h2>
          <p class="mt-1 text-sm text-(--text-secondary)">
            {{ t('purchaseOrder.selection.variantSubtitle', '仅显示 active 变体，可多选') }}
          </p>
        </div>
        <AppButton variant="ghost" size="sm" class="h-9 w-9 px-0" @click="$emit('close')">
          <AppIcon name="x-mark" class="size-5" />
        </AppButton>
      </div>
    </template>

    <div class="flex min-h-0 flex-col">
      <StatePanel
        variant="toolbar"
        data-testid="purchase-order-product-picker-toolbar"
        class="rounded-none border-x-0 border-t-0 px-6 py-4 shadow-none ring-0"
      >
        <div data-testid="purchase-order-product-picker-search">
          <SearchInput
            v-model="searchQuery"
            :placeholder="t('purchaseOrder.selection.searchVariant', '搜索商品名 / SKU / 变体')"
            input-class="!rounded-xl !bg-(--bg-page)"
            :debounce="0"
            @search="debouncedSearch"
          />
        </div>
        <div class="mt-3 flex flex-wrap items-center gap-2">
          <StatusBadge variant="info">
            {{ t('purchaseOrder.ui.activeVariants', '可选变体') }} {{ sortedVariants.length }}
          </StatusBadge>
          <StatusBadge variant="primary">
            {{ t('purchaseOrder.ui.selectedVariants', '已选变体') }} {{ selectedCount }}
          </StatusBadge>
          <StatusBadge v-if="existingBrands.length > 0" variant="default">
            {{ t('purchaseOrder.selection.recommendedBrand', '同品牌推荐') }}
            {{ existingBrands.length }}
          </StatusBadge>
        </div>
      </StatePanel>

      <div class="min-h-0 flex-1 overflow-y-auto px-6 py-4">
        <StatePanel
          v-if="unavailableCount > 0"
          variant="plain"
          class="mb-3 rounded-2xl border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-(--text-main)"
        >
          {{ t('purchaseOrder.selection.unavailableHint', '找不到的变体可能已被下架或归档') }} ({{
            unavailableCount
          }})
        </StatePanel>

        <StatePanel
          v-if="errorMessage"
          variant="plain"
          role="alert"
          class="mb-3 rounded-2xl border border-danger/30 bg-danger/10 px-3 py-3 text-sm text-(--text-main)"
        >
          <div class="flex items-center justify-between gap-3">
            <span>{{ errorMessage }}</span>
            <AppButton variant="outline" size="sm" @click="loadVariants">
              {{ t('common.action.retry', '重试') }}
            </AppButton>
          </div>
        </StatePanel>

        <div v-if="loading" class="space-y-3">
          <div
            v-for="i in 6"
            :key="'sk-' + i"
            class="flex items-center gap-3 rounded-xl border border-(--border-subtle) p-4"
          >
            <div class="skeleton-shimmer size-5 rounded bg-(--bg-muted)"></div>
            <div class="skeleton-shimmer size-10 rounded-lg bg-(--bg-muted)"></div>
            <div class="flex-1 space-y-2">
              <div class="skeleton-shimmer h-4 w-36 rounded bg-(--bg-muted)"></div>
              <div class="skeleton-shimmer h-3 w-52 rounded bg-(--bg-muted)"></div>
            </div>
          </div>
        </div>

        <StatePanel
          v-else-if="sortedVariants.length === 0"
          variant="plain"
          class="flex flex-col items-center justify-center py-12"
        >
          <div class="flex size-16 items-center justify-center rounded-2xl bg-(--bg-muted)">
            <AppIcon name="cube" class="size-8 text-(--text-muted)" />
          </div>
          <p class="mt-4 text-sm text-(--text-secondary)">
            {{ t('purchaseOrder.selection.noActiveVariants', '暂无可选 active 变体') }}
          </p>
        </StatePanel>

        <div v-else class="space-y-2">
          <div
            v-for="variant in sortedVariants"
            :key="variant.variant_id"
            :data-testid="`purchase-order-product-picker-row-${variant.variant_id}`"
            class="group flex cursor-pointer items-center gap-3 rounded-2xl border p-3.5 transition-colors"
            :class="
              isSelected(variant.variant_id)
                ? 'border-primary bg-primary/5'
                : 'border-(--border-subtle) bg-(--bg-card) hover:border-(--border-color) hover:bg-(--bg-hover)'
            "
            @click="toggleSelect(variant)"
          >
            <div class="pt-0.5" @click.stop>
              <AppCheckbox
                :data-testid="`purchase-order-product-picker-checkbox-${variant.variant_id}`"
                :checked="isSelected(variant.variant_id)"
                @change="toggleSelect(variant)"
              />
            </div>
            <div
              class="size-11 shrink-0 overflow-hidden rounded-xl border border-(--border-subtle) bg-(--bg-muted)"
            >
              <AppImage
                v-if="variant.image"
                :src="getFileUrl(variant.image)"
                :alt="variant.product_name || '商品图片'"
                fit="cover"
                class="size-full"
              />
              <div v-else class="flex size-full items-center justify-center text-(--text-muted)">
                <AppIcon name="photo" class="size-5" />
              </div>
            </div>
            <div class="min-w-0 flex-1">
              <div class="flex items-center justify-between gap-2">
                <span
                  class="truncate text-sm font-medium text-(--text-main)"
                  :title="variant.product_name || '—'"
                >
                  {{ variant.product_name || '—' }}
                </span>
                <span
                  class="shrink-0 rounded-full bg-(--bg-page) px-2 py-0.5 font-mono text-xs font-semibold text-(--text-secondary)"
                >
                  ¥{{ Number(variant.unit_cost || 0).toFixed(2) }}
                </span>
              </div>
              <div class="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-(--text-secondary)">
                <span
                  class="max-w-[12rem] truncate rounded-lg bg-(--bg-muted) px-1.5 py-0.5 font-mono"
                  :title="variant.sku || '—'"
                >
                  {{ variant.sku || '—' }}
                </span>
                <span
                  v-if="variant.brand"
                  class="max-w-[8rem] truncate rounded-full bg-(--bg-page) px-2 py-0.5"
                  :title="variant.brand"
                >
                  {{ variant.brand }}
                </span>
                <span
                  v-if="variant.variant_options && Object.keys(variant.variant_options).length > 0"
                  class="min-w-0 flex-1 truncate"
                  :title="buildVariantOptionsLabel(variant)"
                >
                  · {{ buildVariantOptionsLabel(variant) }}
                </span>
              </div>
            </div>
            <StatusBadge
              v-if="isInitiallySelected(variant.variant_id)"
              variant="primary"
              class="shrink-0 text-[10px]"
            >
              {{ t('purchaseOrder.selection.alreadyAdded', '已添加') }}
            </StatusBadge>
          </div>
        </div>
      </div>
    </div>

    <template #footer>
      <ActionBar>
        <template #leading>
          <span class="text-sm text-(--text-secondary)">
            {{ t('purchaseOrder.selection.selectedCount', { count: selectedCount }) }}
          </span>
        </template>
        <AppButton variant="secondary" @click="$emit('close')">
          {{ t('common.cancel') }}
        </AppButton>
        <AppButton
          data-testid="purchase-order-product-picker-confirm"
          variant="primary"
          @click="confirm"
        >
          {{ t('common.confirm') }} ({{ selectedCount }})
        </AppButton>
      </ActionBar>
    </template>
  </Modal>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { useDebounceFn } from '@vueuse/core';
import { useI18n } from '@/composables/useI18n';
import { useProducts } from '@/composables/useProducts';
import { countUnavailableSelectedVariants } from '@/utils/purchase-order-variant-selection';
import ActionBar from '@/design-system/composed/ActionBar.vue';
import StatePanel from '@/design-system/composed/StatePanel.vue';
import AppButton from '@/components/ui/AppButton.vue';
import AppCheckbox from '@/components/ui/AppCheckbox.vue';
import AppImage from '@/components/ui/AppImage.vue';
import AppIcon from '@/components/ui/AppIcon.vue';
import Modal from '@/components/ui/Modal.vue';
import SearchInput from '@/components/ui/SearchInput.vue';
import StatusBadge from '@/components/ui/StatusBadge.vue';

const props = defineProps({
  visible: { type: Boolean, default: false },
  existingBrands: { type: Array, default: () => [] },
  initialSelectedVariantIds: { type: Array, default: () => [] },
});

const emit = defineEmits(['close', 'confirm']);

const { t } = useI18n();
const { loadActiveVariants } = useProducts();

const handleModalVisibilityChange = (nextVisible) => {
  if (!nextVisible) {
    emit('close');
  }
};

const searchQuery = ref('');
const variants = ref([]);
const loading = ref(false);
const errorMessage = ref('');
const selectedVariantIds = ref([]);
const selectedVariantSnapshots = ref(new Map());
let variantsRequestId = 0;

const invalidateVariantLoads = () => {
  variantsRequestId += 1;
  loading.value = false;
};

const initialSelectedSet = computed(() => new Set(props.initialSelectedVariantIds || []));
const selectedSet = computed(() => new Set(selectedVariantIds.value || []));

const recommendedBrandSet = computed(
  () => new Set((props.existingBrands || []).map((brand) => String(brand || '').toLowerCase()))
);

const sortedVariants = computed(() => {
  const list = [...(variants.value || [])];
  return list.sort((a, b) => {
    const aSelected = selectedSet.value.has(a.variant_id) ? 0 : 1;
    const bSelected = selectedSet.value.has(b.variant_id) ? 0 : 1;
    if (aSelected !== bSelected) return aSelected - bSelected;

    const aRecommended = recommendedBrandSet.value.has(String(a.brand || '').toLowerCase()) ? 0 : 1;
    const bRecommended = recommendedBrandSet.value.has(String(b.brand || '').toLowerCase()) ? 0 : 1;
    if (aRecommended !== bRecommended) return aRecommended - bRecommended;

    return String(a.product_name || '').localeCompare(String(b.product_name || ''));
  });
});

const unavailableCount = computed(() =>
  countUnavailableSelectedVariants(props.initialSelectedVariantIds || [], variants.value || [])
);
const selectedCount = computed(() => selectedVariantIds.value.length);

const isSelected = (variantId) => selectedSet.value.has(variantId);
const isInitiallySelected = (variantId) => initialSelectedSet.value.has(variantId);

const rememberSelectedVariant = (variant) => {
  const variantId = variant?.variant_id;
  if (!variantId) return;
  const next = new Map(selectedVariantSnapshots.value);
  next.set(variantId, variant);
  selectedVariantSnapshots.value = next;
};

const forgetSelectedVariant = (variantId) => {
  if (!variantId || !selectedVariantSnapshots.value.has(variantId)) return;
  const next = new Map(selectedVariantSnapshots.value);
  next.delete(variantId);
  selectedVariantSnapshots.value = next;
};

const toggleSelect = (variant) => {
  const next = new Set(selectedVariantIds.value);
  if (next.has(variant.variant_id)) {
    next.delete(variant.variant_id);
    forgetSelectedVariant(variant.variant_id);
  } else {
    next.add(variant.variant_id);
    rememberSelectedVariant(variant);
  }
  selectedVariantIds.value = Array.from(next);
};

const loadVariants = async () => {
  const requestId = ++variantsRequestId;
  loading.value = true;
  errorMessage.value = '';
  try {
    const result = await loadActiveVariants({
      search: searchQuery.value,
      page: 1,
      limit: 80,
    });
    if (requestId !== variantsRequestId || !props.visible) return;
    variants.value = result.items || [];
  } catch {
    if (requestId !== variantsRequestId || !props.visible) return;
    variants.value = [];
    errorMessage.value = t('common.error.network_error', '加载变体失败，请稍后重试');
  } finally {
    if (requestId === variantsRequestId) {
      loading.value = false;
    }
  }
};

const debouncedSearch = useDebounceFn(loadVariants, 250);
const buildVariantOptionsLabel = (variant) =>
  Object.values(variant?.variant_options || {})
    .map((value) => String(value || '').trim())
    .filter(Boolean)
    .join(' / ');

const confirm = () => {
  const variantMap = new Map(
    (variants.value || []).map((variant) => [variant.variant_id, variant])
  );
  const selectedVariants = selectedVariantIds.value
    .map((variantId) => selectedVariantSnapshots.value.get(variantId) || variantMap.get(variantId))
    .filter(Boolean);

  emit('confirm', {
    selectedVariantIds: [...selectedVariantIds.value],
    selectedVariants,
  });
  emit('close');
};

watch(
  () => props.visible,
  async (isVisible) => {
    if (!isVisible) {
      invalidateVariantLoads();
      return;
    }
    searchQuery.value = '';
    selectedVariantIds.value = [...(props.initialSelectedVariantIds || [])];
    selectedVariantSnapshots.value = new Map();
    await loadVariants();
  }
);

const getFileUrl = (id) => `/file/${id}`;
</script>

<style scoped>
.skeleton-shimmer {
  position: relative;
  overflow: hidden;
}
.skeleton-shimmer::after {
  content: '';
  position: absolute;
  inset: 0;
  transform: translateX(-100%);
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(255, 255, 255, 0.06) 50%,
    transparent 100%
  );
  animation: shimmer 1.8s infinite;
}
@keyframes shimmer {
  100% {
    transform: translateX(100%);
  }
}

@media (prefers-reduced-motion: reduce) {
  .skeleton-shimmer::after {
    animation: none !important;
  }
}
</style>
