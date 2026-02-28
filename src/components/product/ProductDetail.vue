<template>
  <div class="grid grid-cols-1 gap-6 lg:grid-cols-12">
    <!-- Left: Gallery -->
    <div class="space-y-4 lg:col-span-7">
        <div class="overflow-hidden rounded-2xl border border-(--border-color) bg-(--bg-card) p-1 shadow-sm">
             <!-- Main Image -->
            <div class="relative aspect-square w-full overflow-hidden rounded-xl bg-(--bg-muted) sm:aspect-[4/3] lg:aspect-video">
                 <AppImage 
                    v-if="currentImage"
                    :src="`/file/${currentImage}`"
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
                <button 
                  v-for="(img, idx) in images" 
                  :key="idx"
                  type="button"
                  class="focus-visible:ring-primary/20 focus-visible:ring-2 focus-visible:outline-none relative size-16 shrink-0 cursor-pointer overflow-hidden rounded-lg border-2 transition-all"
                  :class="currentIndex === idx ? 'border-primary ring-primary/20 opacity-100 ring-2' : 'border-transparent opacity-60 hover:opacity-100'"
                  @click="currentIndex = idx"
                >
                   <AppImage :src="`/file/${img}`" :alt="`${product.name || 'Product'} thumbnail ${idx + 1}`" fit="cover" class="size-full" />
                </button>
            </div>
        </div>

        <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div class="rounded-xl border border-(--border-color) bg-(--bg-card) px-3 py-2">
            <p class="text-[11px] text-(--text-secondary)">{{ t('product.table.variant.images', 'Images') }}</p>
            <p class="mt-1 text-lg font-semibold text-(--text-main)">{{ images.length }}</p>
          </div>
          <div class="rounded-xl border border-(--border-color) bg-(--bg-card) px-3 py-2">
            <p class="text-[11px] text-(--text-secondary)">{{ t('product.form.variants_title', 'Variants') }}</p>
            <p class="mt-1 text-lg font-semibold text-(--text-main)">{{ variantCount }}</p>
          </div>
          <div class="rounded-xl border border-(--border-color) bg-(--bg-card) px-3 py-2">
            <p class="text-[11px] text-(--text-secondary)">{{ t('product.form.inventory', 'Inventory') }}</p>
            <p class="mt-1 text-lg font-semibold text-(--text-main)">{{ totalStock }}</p>
          </div>
          <div class="rounded-xl border border-(--border-color) bg-(--bg-card) px-3 py-2">
            <p class="text-[11px] text-(--text-secondary)">{{ t('spaceManager.associatedLinks') || 'Associated Links' }}</p>
            <p class="mt-1 text-lg font-semibold text-(--text-main)">{{ associatedSpaces.length }}</p>
          </div>
        </div>
        
        <!-- Description (Desktop) -->
        <div class="hidden rounded-2xl border border-(--border-color) bg-(--bg-card) p-6 shadow-sm lg:block">
            <h3 class="mb-3 font-bold text-(--text-main)">{{ t('product.form.description') }}</h3>
            <p class="text-sm leading-relaxed whitespace-pre-wrap text-(--text-secondary)">
                {{ product.description || t('common.text.no_description') }}
            </p>
        </div>

        <!-- Associated Share Links -->
        <div class="rounded-2xl border border-(--border-color) bg-(--bg-card) p-6 shadow-sm">
            <div class="mb-4 flex items-center justify-between">
                <h3 class="font-bold text-(--text-main)">{{ t('spaceManager.associatedLinks') || 'Associated Share Links' }}</h3>
                <span class="rounded-full bg-(--bg-muted) px-2 py-0.5 text-xs text-(--text-secondary)">{{ associatedSpaces.length }}</span>
            </div>
            
            <div v-if="loadingSpaces" class="flex justify-center py-4">
                <AppIcon name="spinner" class="text-primary size-6 animate-spin" />
            </div>
            <div v-else-if="associatedSpaces.length === 0" class="flex flex-col items-center justify-center py-6 text-center text-(--text-secondary)">
                <AppIcon name="link" class="mb-2 size-10 opacity-20" />
                <span class="text-sm">{{ t('spaceManager.noAssociatedLinks') || 'No shared spaces linked to this product yet.' }}</span>
            </div>
            <div v-else class="space-y-3">
                <div v-for="space in associatedSpaces" :key="space.id" class="group flex items-center justify-between rounded-xl border border-(--border-color) bg-(--bg-muted)/50 p-3 transition-colors hover:bg-(--bg-hover)">
                    <div class="flex min-w-0 items-center gap-3">
                        <div class="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-lg">
                            <AppIcon name="link" class="size-5" />
                        </div>
                        <div class="min-w-0">
                            <h4 class="group-hover:text-primary truncate text-sm font-medium text-(--text-main) transition-colors">{{ space.name }}</h4>
                            <div class="mt-0.5 flex items-center gap-2 text-xs text-(--text-secondary)">
                                <span>{{ new Date(space.createdAt || space.created_at).toLocaleDateString() }}</span>
                                <span v-if="space.view_count !== undefined">&bull; {{ space.view_count }} views</span>
                                <span v-if="space.is_public" class="bg-success/10 text-success rounded px-1.5 font-medium">Public</span>
                            </div>
                        </div>
                    </div>
                    <div class="flex shrink-0 items-center gap-2 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100">
                        <button 
                          type="button" 
                          class="hover:text-primary hover:bg-(--bg-card) focus-visible:ring-primary focus-visible:ring-2 focus-visible:outline-none cursor-pointer rounded-lg p-1.5 text-(--text-secondary) transition-colors" 
                          :title="t('common.copyLink')" 
                          :aria-label="`${t('common.copyLink')}: ${space.name}`" 
                          @click="copyShareLink(space)"
                        >
                            <AppIcon name="document-duplicate" class="size-4" />
                        </button>
                        <router-link 
                          :to="`/manage/space/${space.id}`" 
                          class="hover:text-primary hover:bg-(--bg-card) focus-visible:ring-primary focus-visible:ring-2 focus-visible:outline-none cursor-pointer rounded-lg p-1.5 text-(--text-secondary) transition-colors"
                        >
                            <AppIcon name="arrow-top-right-on-square" class="size-4" />
                        </router-link>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- Right: Info -->
    <div class="space-y-4 lg:sticky lg:top-4 lg:col-span-5 lg:min-w-[24rem] lg:self-start">
        <!-- Header Info -->
        <div class="rounded-2xl border border-(--border-color) bg-(--bg-card) p-5 shadow-sm">
             <div class="mb-3 flex items-start justify-between gap-2">
                 <div>
                     <span v-if="product.brand" class="text-primary mb-1 inline-block text-xs font-semibold tracking-wider uppercase">{{ product.brand }}</span>
                     <h2 class="line-clamp-2 text-xl font-bold text-(--text-main)">{{ product.name }}</h2>
                     <div class="mt-1 flex items-center gap-2 text-sm text-(--text-secondary)">
                         <span v-if="product.spu" class="rounded bg-(--bg-muted) px-1.5 py-0.5 font-mono text-xs">{{ product.spu }}</span>
                         <span v-if="product.series">&bull; {{ product.series }}</span>
                     </div>
                 </div>
                 <StatusBadge 
                   class="shrink-0 whitespace-nowrap"
                   :label="t(`product.filters.status.${product.status || 'archived'}`)" 
                   :variant="getProductStatusVariant(product.status || 'archived')" 
                 />
             </div>
             
             <div class="mt-6">
                 <p class="text-[11px] text-(--text-secondary)">{{ t('product.form.price', 'Price') }}</p>
                 <div class="mt-1 flex items-center gap-2">
                    <span class="font-[Outfit] text-3xl font-bold text-(--text-main)">{{ formatMoney(product.price) }}</span>
                    <span class="rounded bg-(--bg-muted) px-2 py-0.5 text-[10px] font-medium text-(--text-secondary)">{{ currencyCode }}</span>
                 </div>
                 <span v-if="product.cost_price !== undefined && product.cost_price !== null" class="mt-1 block text-xs text-(--text-secondary)">
                   {{ t('product.form.cost', 'Cost') }}: {{ formatMoney(product.cost_price) }}
                 </span>
             </div>
        </div>

        <!-- Variants or Specs -->
        <div v-if="product.variants && product.variants.length > 0" class="rounded-2xl border border-(--border-color) bg-(--bg-card) p-5 shadow-sm">
             <h3 class="mb-4 text-sm font-bold tracking-wider text-(--text-main) uppercase opacity-80">{{ t('product.form.variants_title', 'Variants') }}</h3>
             <div class="hidden overflow-x-auto md:block">
                 <table class="w-full min-w-[32rem] text-left text-sm md:min-w-0 md:whitespace-nowrap">
                     <thead class="bg-(--bg-muted)/50 text-xs font-medium text-(--text-secondary) uppercase">
                         <tr>
                             <th class="rounded-l-lg px-3 py-2">Variant</th>
                             <th class="px-3 py-2">Price</th>
                             <th class="rounded-r-lg px-3 py-2">Stock</th>
                         </tr>
                     </thead>
                     <tbody class="divide-y divide-(--border-color)/50">
                         <tr v-for="variant in product.variants" :key="variant.id" class="transition-colors hover:bg-(--bg-muted)/30">
                             <td class="px-3 py-2.5">
                                 <div class="font-medium text-(--text-main)">{{ formatVariantName(variant.options_values) }}</div>
                                 <div class="mt-0.5 font-mono text-[10px] text-(--text-secondary) sm:text-xs">{{ variant.sku }}</div>
                             </td>
                             <td class="px-3 py-2.5 font-[Outfit] font-medium text-(--text-main)">{{ formatMoney(variant.price) }}</td>
                             <td class="px-3 py-2.5 text-(--text-main)">
                                 <span class="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium" :class="variant.stock_quantity <= (variant.alert_threshold || product.alert_threshold || 10) ? 'bg-danger/10 text-danger' : 'bg-success/10 text-success'">
                                     <span class="size-1.5 rounded-full" :class="variant.stock_quantity <= (variant.alert_threshold || product.alert_threshold || 10) ? 'bg-danger' : 'bg-success'"></span>
                                     {{ variant.stock_quantity }}
                                 </span>
                             </td>
                         </tr>
                     </tbody>
                 </table>
             </div>
             <div class="space-y-2 md:hidden">
                <div v-for="variant in product.variants" :key="variant.id" class="rounded-lg border border-(--border-color) bg-(--bg-muted)/30 p-3">
                  <div class="flex items-start justify-between gap-2">
                    <div class="min-w-0">
                      <p class="truncate text-sm font-medium text-(--text-main)">{{ formatVariantName(variant.options_values) }}</p>
                      <p class="mt-0.5 font-mono text-[10px] text-(--text-secondary)">{{ variant.sku }}</p>
                    </div>
                    <span class="text-sm font-semibold text-(--text-main)">{{ formatMoney(variant.price) }}</span>
                  </div>
                  <div class="mt-2 flex items-center justify-between text-xs">
                    <span class="text-(--text-secondary)">{{ t('product.table.variant.stock', 'Stock') }}</span>
                    <span :class="variant.stock_quantity <= (variant.alert_threshold || product.alert_threshold || 10) ? 'text-danger' : 'text-success'">
                      {{ variant.stock_quantity }}
                    </span>
                  </div>
                </div>
             </div>
        </div>
        <div v-else class="rounded-2xl border border-(--border-color) bg-(--bg-card) p-5 shadow-sm">
             <h3 class="mb-4 text-sm font-bold tracking-wider text-(--text-main) uppercase opacity-80">{{ t('product.form.specifications') }}</h3>
             <div class="space-y-3">
                 <div class="flex justify-between border-b border-(--border-color)/50 pb-2 text-sm last:border-0 last:pb-0">
                     <span class="text-(--text-secondary)">{{ t('order.form.size') }}</span>
                     <span class="font-medium text-(--text-main)">{{ specs.size || '-' }}</span>
                 </div>
                 <div class="flex justify-between border-b border-(--border-color)/50 pb-2 text-sm last:border-0 last:pb-0">
                     <span class="text-(--text-secondary)">{{ t('order.form.color') }}</span>
                     <span class="font-medium text-(--text-main)">{{ specs.color || '-' }}</span>
                 </div>
                 <div class="flex justify-between border-b border-(--border-color)/50 pb-2 text-sm last:border-0 last:pb-0">
                     <span class="text-(--text-secondary)">{{ t('order.form.material') }}</span>
                     <span class="font-medium text-(--text-main)">{{ specs.material || '-' }}</span>
                 </div>
                 <div class="flex justify-between border-b border-(--border-color)/50 pb-2 text-sm last:border-0 last:pb-0">
                     <span class="text-(--text-secondary)">{{ t('product.form.category') }}</span>
                     <span class="font-medium text-(--text-main)">{{ product.category || '-' }}</span>
                 </div>
             </div>
        </div>

        <!-- Inventory -->
        <div class="rounded-2xl border border-(--border-color) bg-(--bg-card) p-5 shadow-sm">
             <h3 class="mb-4 text-sm font-bold tracking-wider text-(--text-main) uppercase opacity-80">{{ t('product.form.inventory') }}</h3>
             <div class="space-y-4">
                 <div class="flex justify-between text-sm">
                     <span class="text-(--text-secondary)">{{ t('product.stats.stock_level') }}</span>
                     <span :class="stockColorClass" class="font-medium">{{ totalStock }}</span>
                 </div>
                 <div class="h-2 w-full overflow-hidden rounded-full bg-(--bg-muted)">
                      <div class="h-full rounded-full transition-all duration-500" :class="stockBgClass" :style="{ width: stockProgress + '%' }"></div>
                 </div>
                 <div class="flex justify-between text-xs text-(--text-secondary)">
                     <span>{{ t('product.form.alert_at') }}: {{ product.alert_threshold || 10 }}</span>
                     <span>{{ t('product.table.variant.status', 'Status') }}: {{ t(`product.filters.status.${product.status || 'archived'}`) }}</span>
                 </div>
             </div>
        </div>
        
        <!-- Mobile Description -->
        <div class="rounded-2xl border border-(--border-color) bg-(--bg-card) p-5 shadow-sm lg:hidden">
            <h3 class="mb-2 font-bold text-(--text-main)">{{ t('product.form.description') }}</h3>
            <p class="text-sm leading-relaxed whitespace-pre-wrap text-(--text-secondary)">
                {{ product.description || t('common.text.no_description') }}
            </p>
        </div>


    </div>
  </div>
</template>

<script setup>
import { computed, ref, onMounted, watch } from 'vue';
import { useI18n } from '@/composables/useI18n';
import AppImage from '@/components/ui/AppImage.vue';
import StatusBadge from '@/components/ui/StatusBadge.vue';
import { getProductStatusVariant } from '@/utils/status';
import { useSpaces } from '@/composables/useSpaces';
import { useToast } from '@/composables/useToast';
import AppIcon from '@/components/ui/AppIcon.vue';

const props = defineProps({
    product: {
        type: Object,
        required: true
    }
});

defineEmits(['edit', 'close']);
const { t } = useI18n();
const currentIndex = ref(0);

const images = computed(() => {
    const variantImages = (props.product.variants || []).flatMap((variant) => {
        if (variant.primaryImage) return [variant.primaryImage];
        if (Array.isArray(variant.images) && variant.images.length > 0) {
            const primary = variant.images.find((img) => Number(img.is_primary) === 1) || variant.images[0];
            return primary?.image_id ? [primary.image_id] : [];
        }
        return [];
    });
    try {
        const productImages = !props.product.images
            ? []
            : (typeof props.product.images === 'string' 
            ? JSON.parse(props.product.images) 
            : props.product.images);
        return [...variantImages, ...productImages].filter((id, index, arr) => id && arr.indexOf(id) === index);
    } catch {
        return variantImages;
    }
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
    try {
        if (!props.product.specifications) return {};
        return typeof props.product.specifications === 'string'
            ? JSON.parse(props.product.specifications)
            : props.product.specifications;
    } catch {
        return {};
    }
});

const stockColorClass = computed(() => {
    // If variants exist, aggregate stock
    let q = props.product.stock_quantity || 0;
    if (props.product.variants && props.product.variants.length > 0) {
        q = props.product.variants.reduce((sum, v) => sum + (v.stock_quantity || 0), 0);
    }
    const t_val = props.product.alert_threshold || 10;
    if (q <= t_val) return 'text-danger font-bold';
    return 'text-(--text-main)';
});

const totalStock = computed(() => {
    let q = props.product.stock_quantity || 0;
    if (props.product.variants && props.product.variants.length > 0) {
        q = props.product.variants.reduce((sum, v) => sum + (v.stock_quantity || 0), 0);
    }
    return q;
});
const variantCount = computed(() => Array.isArray(props.product.variants) ? props.product.variants.length : 0);
const inventoryScale = computed(() => {
    const alert = Math.max(1, Number(props.product.alert_threshold || 10));
    return Math.max(50, alert * 5, Number(totalStock.value || 0));
});
const stockProgress = computed(() =>
    Math.min(100, Math.round((Number(totalStock.value || 0) / inventoryScale.value) * 100))
);

const stockBgClass = computed(() => {
    const q = totalStock.value;
    const t_val = props.product.alert_threshold || 10;
    if (q <= t_val) return 'bg-danger';
    return 'bg-success';
});

const formatVariantName = (optionsValues) => {
    try {
        const parsed = typeof optionsValues === 'string' ? JSON.parse(optionsValues) : optionsValues;
        if (!parsed || Object.keys(parsed).length === 0) return 'Default';
        return Object.values(parsed).join(' / ');
    } catch {
        return 'Default';
    }
};

// Associated Spaces Logic
const { loadProductSpaces } = useSpaces();
const { addToast } = useToast();
const associatedSpaces = ref([]);
const loadingSpaces = ref(true);

onMounted(async () => {
    loadingSpaces.value = true;
    try {
        const spaces = await loadProductSpaces(props.product.id);
        associatedSpaces.value = spaces || [];
    } catch (e) {
        console.error('Failed to load associated spaces:', e);
    } finally {
        loadingSpaces.value = false;
    }
});

const copyShareLink = async (space) => {
    try {
        const url = `${window.location.origin}/space/${space.share_token || space.shareToken}`;
        await navigator.clipboard.writeText(url);
        addToast({ message: t('spaces.copyUrlSuccess') || 'Link copied to clipboard!', type: 'success' });
    } catch (_e) {
        addToast({ message: t('common.copyFailed'), type: 'error' });
    }
};
</script>
