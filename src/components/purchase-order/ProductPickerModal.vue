<template>
  <Teleport to="body">
    <transition name="fade">
      <div v-if="visible" class="fixed inset-0 z-60 bg-(--color-overlay-dim) backdrop-blur-sm" @click="$emit('close')"></div>
    </transition>

    <transition name="modal-slide">
      <div v-if="visible" class="fixed inset-0 z-[61] flex items-center justify-center p-4 sm:p-6">
        <div class="relative flex w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-(--color-modal-bg) shadow-2xl" style="max-height: calc(100vh - 3rem)">
          <div class="flex items-center justify-between border-b border-(--border-color) px-6 py-4">
            <div>
              <h2 class="text-main text-lg font-bold">{{ t('purchaseOrder.selection.variantTitle', '选择变体') }}</h2>
              <p class="text-secondary mt-0.5 text-sm">{{ t('purchaseOrder.selection.variantSubtitle', '仅显示 active 变体，可多选') }}</p>
            </div>
            <button type="button" class="text-secondary cursor-pointer rounded-lg p-2 transition-colors hover:bg-(--bg-hover)" @click="$emit('close')">
              <AppIcon name="x-mark" class="size-5" />
            </button>
          </div>

          <div class="border-b border-(--border-subtle) px-6 py-3">
            <div class="relative">
              <div class="text-muted pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <AppIcon name="magnifying-glass" class="size-4" />
              </div>
              <input
                v-model="searchQuery"
                type="text"
                class="text-main w-full rounded-xl border border-(--border-color) bg-(--bg-page) py-2.5 pr-4 pl-10 text-sm transition-colors placeholder:text-muted focus:border-primary focus:ring-primary/20 focus:ring-2 focus:outline-none"
                :placeholder="t('purchaseOrder.selection.searchVariant', '搜索商品名 / SKU / 变体')"
                @input="debouncedSearch"
              />
            </div>
          </div>

          <div class="min-h-0 flex-1 overflow-y-auto px-6 py-3">
            <div
              v-if="unavailableCount > 0"
              class="mb-3 rounded-xl border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-(--text-main)"
            >
              {{ t('purchaseOrder.selection.unavailableHint', '找不到的变体可能已被下架或归档') }} ({{ unavailableCount }})
            </div>

            <div v-if="errorMessage" role="alert" class="mb-3 rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-(--text-main)">
              <div class="flex items-center justify-between gap-3">
                <span>{{ errorMessage }}</span>
                <button type="button" class="cursor-pointer rounded-lg border border-(--border-color) px-2 py-1 text-xs font-medium hover:bg-(--bg-hover)" @click="loadVariants">
                  {{ t('common.action.retry', '重试') }}
                </button>
              </div>
            </div>

            <div v-if="loading" class="space-y-3">
              <div v-for="i in 6" :key="'sk-' + i" class="flex items-center gap-3 rounded-xl border border-(--border-subtle) p-4">
                <div class="skeleton-shimmer size-5 rounded bg-(--bg-muted)"></div>
                <div class="skeleton-shimmer size-10 rounded-lg bg-(--bg-muted)"></div>
                <div class="flex-1 space-y-2">
                  <div class="skeleton-shimmer h-4 w-36 rounded bg-(--bg-muted)"></div>
                  <div class="skeleton-shimmer h-3 w-52 rounded bg-(--bg-muted)"></div>
                </div>
              </div>
            </div>

            <div v-else-if="sortedVariants.length === 0" class="flex flex-col items-center justify-center py-12">
              <div class="flex size-16 items-center justify-center rounded-2xl bg-(--bg-muted)">
                <AppIcon name="cube" class="text-muted size-8" />
              </div>
              <p class="text-secondary mt-4 text-sm">{{ t('purchaseOrder.selection.noActiveVariants', '暂无可选 active 变体') }}</p>
            </div>

            <div v-else class="space-y-2">
              <label
                v-for="variant in sortedVariants"
                :key="variant.variant_id"
                class="group flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition-all duration-200"
                :class="isSelected(variant.variant_id)
                  ? 'border-primary bg-primary/5 shadow-sm'
                  : 'border-(--border-subtle) hover:border-(--border-color) hover:bg-(--bg-hover)'"
              >
                <input
                  type="checkbox"
                  :checked="isSelected(variant.variant_id)"
                  class="text-primary size-4 cursor-pointer rounded border-(--border-color) focus:ring-primary"
                  @change="toggleSelect(variant)"
                />
                <div class="size-10 shrink-0 overflow-hidden rounded-lg border border-(--border-subtle) bg-(--bg-muted)">
                  <AppImage v-if="variant.image" :src="getFileUrl(variant.image)" fit="cover" class="size-full" />
                  <div v-else class="text-muted flex size-full items-center justify-center">
                    <AppIcon name="photo" class="size-5" />
                  </div>
                </div>
                <div class="min-w-0 flex-1">
                  <div class="flex items-center justify-between gap-2">
                    <span class="text-main truncate text-sm font-medium">{{ variant.product_name }}</span>
                    <span class="text-secondary shrink-0 font-[Outfit] text-xs">¥{{ Number(variant.unit_cost || 0).toFixed(2) }}</span>
                  </div>
                  <div class="text-secondary mt-0.5 flex flex-wrap items-center gap-2 text-xs">
                    <span class="rounded bg-(--bg-muted) px-1.5 py-0.5 font-mono">{{ variant.sku || '—' }}</span>
                    <span v-if="variant.brand">{{ variant.brand }}</span>
                    <span v-if="variant.variant_options && Object.keys(variant.variant_options).length > 0">
                      · {{ Object.values(variant.variant_options).join(' / ') }}
                    </span>
                  </div>
                </div>
                <div
                  v-if="isInitiallySelected(variant.variant_id)"
                  class="bg-primary/10 text-primary shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold"
                >
                  {{ t('purchaseOrder.selection.alreadyAdded', '已添加') }}
                </div>
              </label>
            </div>
          </div>

          <div class="flex items-center justify-between border-t border-(--border-color) bg-(--bg-card) px-6 py-4">
            <span class="text-secondary text-sm">{{ t('purchaseOrder.selection.selectedCount', { count: selectedCount }) }}</span>
            <div class="flex items-center gap-3">
              <button type="button" class="text-secondary cursor-pointer rounded-xl px-4 py-2.5 text-sm font-medium transition-colors hover:bg-(--bg-hover)" @click="$emit('close')">
                {{ t('common.cancel') }}
              </button>
              <button
                type="button"
                class="bg-primary text-inverse cursor-pointer rounded-xl px-5 py-2.5 text-sm font-medium shadow-sm transition-all hover:opacity-90"
                @click="confirm"
              >
                {{ t('common.confirm') }} ({{ selectedCount }})
              </button>
            </div>
          </div>
        </div>
      </div>
    </transition>
  </Teleport>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { useDebounceFn } from '@vueuse/core';
import { useI18n } from '@/composables/useI18n';
import { useProducts } from '@/composables/useProducts';
import { countUnavailableSelectedVariants } from '@/utils/purchase-order-variant-selection';
import AppImage from '@/components/ui/AppImage.vue';
import AppIcon from '@/components/ui/AppIcon.vue';

const props = defineProps({
  visible: { type: Boolean, default: false },
  existingBrands: { type: Array, default: () => [] },
  initialSelectedVariantIds: { type: Array, default: () => [] },
});

const emit = defineEmits(['close', 'confirm']);

const { t } = useI18n();
const { loadActiveVariants } = useProducts();

const searchQuery = ref('');
const variants = ref([]);
const loading = ref(false);
const errorMessage = ref('');
const selectedVariantIds = ref([]);

const initialSelectedSet = computed(() => new Set(props.initialSelectedVariantIds || []));
const selectedSet = computed(() => new Set(selectedVariantIds.value || []));

const recommendedBrandSet = computed(() => new Set((props.existingBrands || []).map((brand) => String(brand || '').toLowerCase())));

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

const unavailableCount = computed(() => countUnavailableSelectedVariants(props.initialSelectedVariantIds || [], variants.value || []));
const selectedCount = computed(() => selectedVariantIds.value.length);

const isSelected = (variantId) => selectedSet.value.has(variantId);
const isInitiallySelected = (variantId) => initialSelectedSet.value.has(variantId);

const toggleSelect = (variant) => {
  const next = new Set(selectedVariantIds.value);
  if (next.has(variant.variant_id)) {
    next.delete(variant.variant_id);
  } else {
    next.add(variant.variant_id);
  }
  selectedVariantIds.value = Array.from(next);
};

const loadVariants = async () => {
  loading.value = true;
  errorMessage.value = '';
  try {
    const result = await loadActiveVariants({
      search: searchQuery.value,
      page: 1,
      limit: 80,
    });
    variants.value = result.items || [];
  } catch {
    variants.value = [];
    errorMessage.value = t('common.error.network_error', '加载变体失败，请稍后重试');
  } finally {
    loading.value = false;
  }
};

const debouncedSearch = useDebounceFn(loadVariants, 250);

const confirm = () => {
  const variantMap = new Map((variants.value || []).map((variant) => [variant.variant_id, variant]));
  const selectedVariants = selectedVariantIds.value
    .map((variantId) => variantMap.get(variantId))
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
    if (!isVisible) return;
    searchQuery.value = '';
    selectedVariantIds.value = [...(props.initialSelectedVariantIds || [])];
    await loadVariants();
  }
);

const getFileUrl = (id) => `/file/${id}`;
</script>

<style scoped>
.modal-slide-enter-active { transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
.modal-slide-leave-active { transition: all 0.2s ease-in; }
.modal-slide-enter-from { opacity: 0; transform: scale(0.95) translateY(10px); }
.modal-slide-leave-to { opacity: 0; transform: scale(0.97); }

.fade-enter-active, .fade-leave-active { transition: opacity 0.25s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

.skeleton-shimmer {
  position: relative;
  overflow: hidden;
}
.skeleton-shimmer::after {
  content: '';
  position: absolute;
  inset: 0;
  transform: translateX(-100%);
  background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.06) 50%, transparent 100%);
  animation: shimmer 1.8s infinite;
}
@keyframes shimmer {
  100% { transform: translateX(100%); }
}
</style>
