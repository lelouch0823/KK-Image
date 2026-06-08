<template>
  <div data-testid="product-detail-content" class="grid grid-cols-1 gap-6 lg:grid-cols-12">
    <!-- Left: Gallery -->
    <div class="space-y-4 lg:col-span-7">
      <div
        class="overflow-hidden rounded-2xl border border-(--border-color) bg-(--bg-card) p-1 shadow-card"
      >
        <!-- Main Image -->
        <div
          class="relative aspect-square w-full overflow-hidden rounded-xl bg-(--bg-muted) sm:aspect-4/3 lg:aspect-video"
        >
          <AppImage
            v-if="currentImage"
            :src="currentImage"
            :alt="product.name || 'Product image'"
            fit="contain"
            class="size-full transition-transform duration-500 motion-safe:hover:scale-105"
          />
          <div v-else class="flex size-full items-center justify-center text-(--text-secondary)">
            <span class="text-sm">{{ t('product.text.no_images') }}</span>
          </div>
        </div>

        <!-- Thumbnails -->
        <div v-if="images.length > 1" class="scrollbar-hide flex gap-2 overflow-x-auto p-3">
          <AppButton
            v-for="(img, idx) in images"
            :key="idx"
            variant="ghost"
            size="sm"
            class="focus-visible:ring-primary/20 relative !h-16 !w-16 shrink-0 overflow-hidden rounded-lg border-2 !p-0 transition-all [&_span]:contents"
            :class="
              currentIndex === idx
                ? 'border-primary ring-primary/20 opacity-100 ring-2'
                : 'border-transparent opacity-60 hover:opacity-100'
            "
            @click="currentIndex = idx"
          >
            <AppImage
              :src="img"
              :alt="`${product.name || 'Product'} thumbnail ${idx + 1}`"
              fit="cover"
              class="size-full"
            />
          </AppButton>
        </div>
      </div>

      <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div class="rounded-xl border border-(--border-color) bg-(--bg-card) px-3 py-2">
          <p class="text-xs text-(--text-secondary)">
            {{ t('product.table.variant.images', 'Images') }}
          </p>
          <p class="mt-1 text-lg font-semibold text-(--text-main)">{{ images.length }}</p>
        </div>
        <div class="rounded-xl border border-(--border-color) bg-(--bg-card) px-3 py-2">
          <p class="text-xs text-(--text-secondary)">
            {{ t('product.form.variants_title', 'Variants') }}
          </p>
          <p class="mt-1 text-lg font-semibold text-(--text-main)">{{ activeVariantCount }}</p>
        </div>
        <div class="rounded-xl border border-(--border-color) bg-(--bg-card) px-3 py-2">
          <p class="text-xs text-(--text-secondary)">
            {{ t('product.form.inventory', 'Inventory') }}
          </p>
          <p class="mt-1 text-lg font-semibold text-(--text-main)">{{ totalStock }}</p>
        </div>
        <div class="rounded-xl border border-(--border-color) bg-(--bg-card) px-3 py-2">
          <p class="text-xs text-(--text-secondary)">
            {{ t('spaceManager.associatedLinks') || 'Associated Links' }}
          </p>
          <p class="mt-1 text-lg font-semibold text-(--text-main)">{{ associatedSpaces.length }}</p>
        </div>
      </div>

      <!-- Description (Desktop) -->
      <div
        class="hidden rounded-2xl border border-(--border-color) bg-(--bg-card) p-6 shadow-card lg:block"
      >
        <h3 class="mb-3 font-bold text-(--text-main)">{{ t('product.form.description') }}</h3>
        <p class="text-sm leading-relaxed whitespace-pre-wrap text-(--text-secondary)">
          {{ product.description || t('common.text.no_description') }}
        </p>
      </div>

      <!-- Associated Share Links -->
      <StatePanel class="shadow-sm">
        <div class="mb-4 flex items-center justify-between">
          <h3 class="font-bold text-(--text-main)">
            {{ t('spaceManager.associatedLinks') || 'Associated Share Links' }}
          </h3>
          <span class="rounded-full bg-(--bg-muted) px-2 py-0.5 text-xs text-(--text-secondary)">{{
            associatedSpaces.length
          }}</span>
        </div>

        <div v-if="loadingSpaces" class="flex justify-center py-4">
          <AppIcon name="spinner" class="text-primary size-6 animate-spin" />
        </div>
        <div
          v-else-if="spacesError"
          class="rounded-xl border border-danger/20 bg-danger/5 px-4 py-4 text-center"
        >
          <p class="text-sm text-danger">{{ spacesError }}</p>
          <AppButton
            variant="primary"
            size="sm"
            class="mt-3"
            data-testid="associated-spaces-retry"
            @click="loadAssociatedSpaces(props.product?.id)"
          >
            {{ t('common.retry') }}
          </AppButton>
        </div>
        <div
          v-else-if="associatedSpaces.length === 0"
          class="flex flex-col items-center justify-center py-6 text-center text-(--text-secondary)"
        >
          <AppIcon name="link" class="mb-2 size-10 opacity-20" />
          <span class="text-sm">{{
            t('spaceManager.noAssociatedLinks') || 'No shared spaces linked to this product yet.'
          }}</span>
        </div>
        <div v-else class="space-y-3">
          <div
            v-for="space in associatedSpaces"
            :key="space.id"
            class="group flex items-center justify-between rounded-xl border border-(--border-color) bg-(--bg-muted)/50 p-3 transition-colors hover:bg-(--bg-hover)"
          >
            <div class="flex min-w-0 items-center gap-3">
              <div
                class="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-lg"
              >
                <AppIcon name="link" class="size-5" />
              </div>
              <div class="min-w-0">
                <h4
                  class="group-hover:text-primary truncate text-sm font-medium text-(--text-main) transition-colors"
                >
                  {{ space.name }}
                </h4>
                <div class="mt-0.5 flex items-center gap-2 text-xs text-(--text-secondary)">
                  <span>{{ new Date(space.createdAt).toLocaleDateString() }}</span>
                  <span v-if="space.viewCount !== undefined"
                    >&bull; {{ space.viewCount }} views</span
                  >
                  <StatusBadge v-if="space.isPublic" variant="success" class="px-1.5! py-0!"
                    >Public</StatusBadge
                  >
                </div>
              </div>
            </div>
            <div
              class="flex shrink-0 items-center gap-2 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100"
            >
              <AppButton
                variant="ghost"
                size="sm"
                class="!h-8 !w-8 !px-0"
                :title="t('common.copyLink')"
                :aria-label="`${t('common.copyLink')}: ${space.name}`"
                @click="copyShareLink(space)"
              >
                <AppIcon name="document-duplicate" class="size-4" />
              </AppButton>
              <router-link
                :to="{ name: 'Spaces', query: { id: space.id } }"
                class="hover:text-primary hover:bg-(--bg-card) focus-visible:ring-primary focus-visible:ring-2 focus-visible:outline-none cursor-pointer rounded-lg p-1.5 text-(--text-secondary) transition-colors"
              >
                <AppIcon name="arrow-top-right-on-square" class="size-4" />
              </router-link>
            </div>
          </div>
        </div>
      </StatePanel>
    </div>

    <!-- Right: Info -->
    <div class="space-y-4 lg:sticky lg:top-4 lg:col-span-5 lg:min-w-[24rem] lg:self-start">
      <!-- Header Info -->
      <StatePanel class="shadow-sm">
        <div class="mb-3 flex items-start justify-between gap-2">
          <div>
            <span
              v-if="product.brand"
              data-testid="product-detail-brand"
              class="text-primary mb-1 inline-block text-xs font-semibold tracking-wider uppercase"
              >{{ product.brand }}</span
            >
            <h2
              data-testid="product-detail-name"
              class="line-clamp-2 text-xl font-bold text-(--text-main)"
            >
              {{ product.name }}
            </h2>
            <div class="mt-1 flex items-center gap-2 text-sm text-(--text-secondary)">
              <span
                v-if="product.spu"
                data-testid="product-detail-spu"
                class="rounded bg-(--bg-muted) px-1.5 py-0.5 font-mono text-xs"
                >{{ product.spu }}</span
              >
              <span v-if="product.series">&bull; {{ product.series }}</span>
            </div>
          </div>
          <StatusBadge
            class="shrink-0 whitespace-nowrap"
            :label="formatProductStatusLabel(product.status || 'archived')"
            :variant="getProductStatusVariant(product.status || 'archived')"
          />
        </div>

        <div class="mt-6">
          <p class="text-xs text-(--text-secondary)">{{ t('product.form.price', 'Price') }}</p>
          <div class="mt-1 flex items-center gap-2">
            <span
              data-testid="product-detail-price"
              class="text-3xl font-semibold text-(--text-main)"
              >{{ formatMoney(product.price) }}</span
            >
            <span
              class="rounded bg-(--bg-muted) px-2 py-0.5 text-xs font-medium text-(--text-secondary)"
              >{{ currencyCode }}</span
            >
          </div>
          <span
            v-if="product.cost_price !== undefined && product.cost_price !== null"
            class="mt-1 block text-xs text-(--text-secondary)"
          >
            {{ t('product.form.cost', 'Cost') }}: {{ formatMoney(product.cost_price) }}
          </span>
        </div>
      </StatePanel>

      <!-- Variants or Specs -->
      <div
        v-if="activeVariants.length > 0"
        class="rounded-2xl border border-(--border-color) bg-(--bg-card) p-5 shadow-card"
      >
        <h3 class="mb-4 text-sm font-bold tracking-wider text-(--text-main) uppercase opacity-80">
          {{ t('product.form.variants_title', 'Variants') }}
        </h3>
        <div class="hidden overflow-hidden md:block">
          <AppTable :columns="variantColumns" :data="activeVariants" no-border>
            <template #cell-variant="{ row: variant }">
              <div class="font-medium text-(--text-main)">
                {{ formatVariantName(variant.options_values) }}
              </div>
              <div class="mt-0.5 font-mono text-xs text-(--text-secondary) sm:text-xs">
                {{ variant.sku }}
              </div>
            </template>
            <template #cell-price="{ row: variant }">
              <span class="font-mono font-medium text-(--text-main)">{{
                formatMoney(variant.price)
              }}</span>
            </template>
            <template #cell-stock="{ row: variant }">
              <StatusBadge
                :variant="
                  resolveVariantStock(variant) <=
                  resolveAlertThreshold(
                    variant.alert_threshold,
                    resolveAlertThreshold(product.alert_threshold)
                  )
                    ? 'danger'
                    : 'success'
                "
                :dot="true"
                class="rounded-full! px-2! py-0.5!"
              >
                {{ resolveVariantStock(variant) }}
              </StatusBadge>
            </template>
          </AppTable>
        </div>
        <div class="space-y-2 md:hidden">
          <div
            v-for="variant in activeVariants"
            :key="variant.id"
            class="rounded-lg border border-(--border-color) bg-(--bg-muted)/30 p-3"
          >
            <div class="flex items-start justify-between gap-2">
              <div class="min-w-0">
                <p class="truncate text-sm font-medium text-(--text-main)">
                  {{ formatVariantName(variant.options_values) }}
                </p>
                <p class="mt-0.5 font-mono text-xs text-(--text-secondary)">
                  {{ variant.sku }}
                </p>
              </div>
              <span class="text-sm font-semibold text-(--text-main)">{{
                formatMoney(variant.price)
              }}</span>
            </div>
            <div class="mt-2 flex items-center justify-between text-xs">
              <span class="text-(--text-secondary)">{{
                t('product.table.variant.stock', 'Stock')
              }}</span>
              <span
                :class="
                  resolveVariantStock(variant) <=
                  resolveAlertThreshold(
                    variant.alert_threshold,
                    resolveAlertThreshold(product.alert_threshold)
                  )
                    ? 'text-danger'
                    : 'text-success'
                "
              >
                {{ resolveVariantStock(variant) }}
              </span>
            </div>
          </div>
        </div>
      </div>
      <div v-else class="rounded-2xl border border-(--border-color) bg-(--bg-card) p-5 shadow-card">
        <h3 class="mb-4 text-sm font-bold tracking-wider text-(--text-main) uppercase opacity-80">
          {{ t('product.form.specifications') }}
        </h3>
        <div class="space-y-3">
          <div
            class="flex justify-between border-b border-(--border-color)/50 pb-2 text-sm last:border-0 last:pb-0"
          >
            <span class="text-(--text-secondary)">{{ t('order.form.size') }}</span>
            <span class="font-medium text-(--text-main)">{{ specs.size || '-' }}</span>
          </div>
          <div
            class="flex justify-between border-b border-(--border-color)/50 pb-2 text-sm last:border-0 last:pb-0"
          >
            <span class="text-(--text-secondary)">{{ t('order.form.color') }}</span>
            <span class="font-medium text-(--text-main)">{{ specs.color || '-' }}</span>
          </div>
          <div
            class="flex justify-between border-b border-(--border-color)/50 pb-2 text-sm last:border-0 last:pb-0"
          >
            <span class="text-(--text-secondary)">{{ t('order.form.material') }}</span>
            <span class="font-medium text-(--text-main)">{{ specs.material || '-' }}</span>
          </div>
          <div
            class="flex justify-between border-b border-(--border-color)/50 pb-2 text-sm last:border-0 last:pb-0"
          >
            <span class="text-(--text-secondary)">{{ t('product.form.category') }}</span>
            <span class="font-medium text-(--text-main)">{{ product.category || '-' }}</span>
          </div>
        </div>
      </div>

      <!-- Multi-tier Pricing -->
      <div
        v-if="activeVariants.length > 0"
        class="rounded-2xl border border-(--border-color) bg-(--bg-card) p-5 shadow-card"
      >
        <h3 class="mb-4 text-sm font-bold tracking-wider text-(--text-main) uppercase opacity-80">
          {{ t('product.price_rules.title', '多级价格') }}
        </h3>
        <PriceRuleManager
          :product-id="product.id"
          :variants="activeVariants"
          :currency-symbol="currencySymbol"
        />
      </div>

      <!-- Inventory -->
      <div class="rounded-2xl border border-(--border-color) bg-(--bg-card) p-5 shadow-card">
        <h3 class="mb-4 text-sm font-bold tracking-wider text-(--text-main) uppercase opacity-80">
          {{ t('product.form.inventory') }}
        </h3>
        <div class="space-y-4">
          <div class="flex justify-between text-sm">
            <span class="text-(--text-secondary)">{{ t('product.stats.stock_level') }}</span>
            <span
              data-testid="product-detail-total-stock"
              :class="stockColorClass"
              class="font-medium"
              >{{ totalStock }}</span
            >
          </div>
          <div class="h-2 w-full overflow-hidden rounded-full bg-(--bg-muted)">
            <div
              class="h-full rounded-full transition-all duration-500"
              :class="stockBgClass"
              :style="{ width: stockProgress + '%' }"
            ></div>
          </div>
          <div class="flex justify-between text-xs text-(--text-secondary)">
            <span
              >{{ t('product.form.alert_at') }}:
              {{ resolveAlertThreshold(product.alert_threshold) }}</span
            >
            <span
              >{{ t('product.table.variant.status', 'Status') }}:
              {{ formatProductStatusLabel(product.status || 'archived') }}</span
            >
          </div>
        </div>
      </div>

      <!-- Mobile Description -->
      <div
        class="rounded-2xl border border-(--border-color) bg-(--bg-card) p-5 shadow-card lg:hidden"
      >
        <h3 class="mb-2 font-bold text-(--text-main)">{{ t('product.form.description') }}</h3>
        <p class="text-sm leading-relaxed whitespace-pre-wrap text-(--text-secondary)">
          {{ product.description || t('common.text.no_description') }}
        </p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { hasEntries } from '@/utils/object-utils';
import StatePanel from '@/design-system/composed/StatePanel.vue';
import AppButton from '@/components/ui/AppButton.vue';
import AppImage from '@/components/ui/AppImage.vue';
import StatusBadge from '@/components/ui/StatusBadge.vue';
import AppTable from '@/components/ui/AppTable.vue';
import AppIcon from '@/components/ui/AppIcon.vue';
import PriceRuleManager from '@/components/product/PriceRuleManager.vue';
import { getProductStatusVariant } from '@/utils/product-status';
import { useSpaces } from '@/composables/useSpaces';
import { useToast } from '@/composables/useToast';
import { useClipboard } from '@/composables/useClipboard';
import { parseJsonObject } from '@/utils/json.js';
import {
  resolveProductImageSrcList,
  resolveVariantPrimaryImageSrc,
} from '@/utils/product-image.js';
import { isCatalogActiveVariant } from '@/utils/product-variants.js';
import { formatReadableLabel } from '@/utils/event-display';

const props = defineProps({
  product: {
    type: Object,
    required: true,
  },
});

defineEmits(['edit', 'close']);
const { t } = useI18n();
const currentIndex = ref(0);

const variantColumns = computed(() => [
  { key: 'variant', label: 'Variant' },
  { key: 'price', label: 'Price' },
  { key: 'stock', label: 'Stock' },
]);

const isActiveVariant = (variant) => isCatalogActiveVariant(variant);

const formatProductStatusLabel = (status) =>
  t(`product.filters.status.${status || 'archived'}`, formatReadableLabel(status || 'archived'));

const activeVariants = computed(() =>
  Array.isArray(props.product.variants)
    ? props.product.variants.filter((variant) => isActiveVariant(variant))
    : []
);

const images = computed(() => {
  const variantImages = activeVariants.value
    .map((variant) => resolveVariantPrimaryImageSrc(variant))
    .filter(Boolean);
  const productImages = resolveProductImageSrcList(props.product);
  return [...variantImages, ...productImages].filter(
    (src, index, arr) => arr.indexOf(src) === index
  );
});

const currentImage = computed(() => images.value[currentIndex.value]);
watch(images, (nextImages) => {
  if (!Array.isArray(nextImages) || nextImages.length === 0) {
    currentIndex.value = 0;
    return;
  }
  if (currentIndex.value > nextImages.length - 1) {
    currentIndex.value = 0;
  }
});

const currencyCode = computed(() => String(props.product.currency || 'CNY').toUpperCase());
const currencySymbol = computed(() => {
  const symbols = { CNY: '¥', USD: '$', EUR: '€', GBP: '£', JPY: '¥' };
  return symbols[currencyCode.value] || '¥';
});
const currencyFormatter = computed(() => {
  try {
    return new Intl.NumberFormat('zh-CN', {
      style: 'currency',
      currency: currencyCode.value,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  } catch {
    return new Intl.NumberFormat('zh-CN', {
      style: 'currency',
      currency: 'CNY',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }
});
const formatMoney = (value) => currencyFormatter.value.format(Number(value) || 0);

const specs = computed(() => {
  if (!props.product.specifications) return {};
  return parseJsonObject(props.product.specifications, {});
});

const resolveVariantStock = (variant) =>
  Number(variant?.available_quantity ?? variant?.available ?? variant?.stock_quantity ?? 0);

const resolveAlertThreshold = (value, fallback = 10) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
};

const stockColorClass = computed(() => {
  // If variants exist, aggregate stock
  let q = Number(
    props.product.available_quantity ?? props.product.available ?? props.product.stock_quantity ?? 0
  );
  if (activeVariants.value.length > 0) {
    q = activeVariants.value.reduce((sum, v) => sum + resolveVariantStock(v), 0);
  }
  const t_val = resolveAlertThreshold(props.product.alert_threshold);
  if (q <= t_val) return 'text-danger font-bold';
  return 'text-(--text-main)';
});

const totalStock = computed(() => {
  let q = Number(
    props.product.available_quantity ?? props.product.available ?? props.product.stock_quantity ?? 0
  );
  if (activeVariants.value.length > 0) {
    q = activeVariants.value.reduce((sum, v) => sum + resolveVariantStock(v), 0);
  }
  return q;
});
const activeVariantCount = computed(() => activeVariants.value.length);
const inventoryScale = computed(() => {
  const alert = Math.max(1, resolveAlertThreshold(props.product.alert_threshold));
  return Math.max(50, alert * 5, Number(totalStock.value || 0));
});
const stockProgress = computed(() =>
  Math.min(100, Math.round((Number(totalStock.value || 0) / inventoryScale.value) * 100))
);

const stockBgClass = computed(() => {
  const q = totalStock.value;
  const t_val = resolveAlertThreshold(props.product.alert_threshold);
  if (q <= t_val) return 'bg-danger';
  return 'bg-success';
});

const formatVariantName = (optionsValues) => {
  const parsed = parseJsonObject(optionsValues, {});
  if (!hasEntries(parsed)) return 'Default';
  return Object.values(parsed).join(' / ');
};

// Associated Spaces Logic
const { loadProductSpaces } = useSpaces();
const { addToast } = useToast();
const { copyShareLink: copySpaceShareLink } = useClipboard();
const associatedSpaces = ref([]);
const loadingSpaces = ref(true);
const spacesError = ref('');
let associatedSpacesRequestId = 0;

const loadAssociatedSpaces = async (productId) => {
  if (!productId) {
    associatedSpaces.value = [];
    spacesError.value = '';
    loadingSpaces.value = false;
    return;
  }

  const requestId = ++associatedSpacesRequestId;
  loadingSpaces.value = true;
  spacesError.value = '';
  try {
    const spaces = await loadProductSpaces(productId);
    if (requestId !== associatedSpacesRequestId) return;
    associatedSpaces.value = spaces || [];
  } catch (e) {
    if (requestId !== associatedSpacesRequestId) return;
    console.error('Failed to load associated spaces:', e);
    associatedSpaces.value = [];
    spacesError.value = e?.message || t('common.loadFailed');
  } finally {
    if (requestId === associatedSpacesRequestId) {
      loadingSpaces.value = false;
    }
  }
};

watch(
  () => props.product?.id,
  (productId) => {
    void loadAssociatedSpaces(productId);
  },
  { immediate: true }
);

const copyShareLink = async (space) => {
  try {
    const sharePath =
      String(space.shareUrl || '').trim() ||
      (space.shareToken || space.share_token
        ? `/space/${space.shareToken || space.share_token}`
        : '');
    if (!sharePath) {
      addToast({ message: t('common.copyFailed'), type: 'error' });
      return;
    }
    await copySpaceShareLink(sharePath, {
      successMessage: t('spaces.copyUrlSuccess') || 'Link copied to clipboard!',
    });
  } catch (_e) {
    addToast({ message: t('common.copyFailed'), type: 'error' });
  }
};
</script>
