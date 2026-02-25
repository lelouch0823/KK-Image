<template>
  <div class="grid grid-cols-1 gap-6 lg:grid-cols-12">
    <!-- Left: Gallery (8 cols) -->
    <div class="space-y-4 lg:col-span-8">
        <div class="overflow-hidden rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] p-1 shadow-sm">
             <!-- Main Image -->
            <div class="relative aspect-video w-full overflow-hidden rounded-xl bg-[var(--bg-muted)]">
                 <AppImage 
                    v-if="currentImage"
                    :src="`/file/${currentImage}`"
                    fit="contain"
                    class="size-full transition-transform duration-500 hover:scale-105"
                 />
                 <div v-else class="flex size-full items-center justify-center text-[var(--text-secondary)]">
                    <span class="text-sm">{{ t('product.text.no_images') }}</span>
                 </div>
            </div>
            
             <!-- Thumbnails -->
            <div v-if="images.length > 1" class="scrollbar-hide flex gap-2 overflow-x-auto p-3">
                <button 
                  v-for="(img, idx) in images" 
                  :key="idx"
                  class="relative size-16 shrink-0 overflow-hidden rounded-lg border-2 transition-all"
                  :class="currentIndex === idx ? 'border-[var(--color-primary)] opacity-100 ring-2 ring-[var(--color-primary)]/20' : 'border-transparent opacity-60 hover:opacity-100'"
                  @click="currentIndex = idx"
                >
                   <AppImage :src="`/file/${img}`" fit="cover" class="size-full" />
                </button>
            </div>
        </div>
        
        <!-- Description (Desktop) -->
        <div class="hidden rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] p-6 shadow-sm lg:block">
            <h3 class="mb-3 font-bold text-[var(--text-main)]">{{ t('product.form.description') }}</h3>
            <p class="text-sm leading-relaxed whitespace-pre-wrap text-[var(--text-secondary)]">
                {{ product.description || t('common.text.no_description') }}
            </p>
        </div>

        <!-- Associated Share Links -->
        <div class="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] p-6 shadow-sm">
            <div class="mb-4 flex items-center justify-between">
                <h3 class="font-bold text-[var(--text-main)]">{{ t('spaceManager.associatedLinks') || 'Associated Share Links' }}</h3>
                <span class="rounded-full bg-[var(--bg-muted)] px-2 py-0.5 text-xs text-[var(--text-secondary)]">{{ associatedSpaces.length }}</span>
            </div>
            
            <div v-if="loadingSpaces" class="flex justify-center py-4">
                <svg class="size-6 animate-spin text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
            </div>
            <div v-else-if="associatedSpaces.length === 0" class="flex flex-col items-center justify-center py-6 text-center text-[var(--text-secondary)]">
                <svg class="mb-2 size-10 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" /></svg>
                <span class="text-sm">{{ t('spaceManager.noAssociatedLinks') || 'No shared spaces linked to this product yet.' }}</span>
            </div>
            <div v-else class="space-y-3">
                <div v-for="space in associatedSpaces" :key="space.id" class="group flex items-center justify-between rounded-xl border border-[var(--border-color)] bg-[var(--bg-muted)]/50 p-3 transition-colors hover:bg-[var(--bg-muted)]">
                    <div class="flex min-w-0 items-center gap-3">
                        <div class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
                            <svg class="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                        </div>
                        <div class="min-w-0">
                            <h4 class="truncate text-sm font-medium text-[var(--text-main)] transition-colors group-hover:text-[var(--color-primary)]">{{ space.name }}</h4>
                            <div class="mt-0.5 flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                                <span>{{ new Date(space.createdAt || space.created_at).toLocaleDateString() }}</span>
                                <span v-if="space.view_count !== undefined">&bull; {{ space.view_count }} views</span>
                                <span v-if="space.is_public" class="rounded bg-[var(--color-success)]/10 px-1.5 font-medium text-[var(--color-success)]">Public</span>
                            </div>
                        </div>
                    </div>
                    <div class="flex shrink-0 items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                        <button class="rounded-lg p-1.5 text-[var(--text-secondary)] hover:bg-[var(--bg-card)] hover:text-[var(--color-primary)]" :title="t('common.copyLink')" @click="copyShareLink(space)">
                            <svg class="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                        </button>
                        <router-link :to="`/manage/space/${space.id}`" class="rounded-lg p-1.5 text-[var(--text-secondary)] hover:bg-[var(--bg-card)] hover:text-[var(--color-primary)]">
                            <svg class="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                        </router-link>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- Right: Info (4 cols) -->
    <div class="space-y-4 lg:col-span-4">
        <!-- Header Info -->
        <div class="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] p-5 shadow-sm">
             <div class="mb-3 flex items-start justify-between gap-2">
                 <div>
                     <span v-if="product.brand" class="mb-1 inline-block text-xs font-semibold tracking-wider text-[var(--color-primary)] uppercase">{{ product.brand }}</span>
                     <h2 class="line-clamp-2 text-xl font-bold text-[var(--text-main)]">{{ product.name }}</h2>
                     <div class="mt-1 flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                         <span v-if="product.sku" class="rounded bg-[var(--bg-muted)] px-1.5 py-0.5 font-mono text-xs">{{ product.sku }}</span>
                         <span v-if="product.series">&bull; {{ product.series }}</span>
                     </div>
                 </div>
                 <StatusBadge 
                   :label="t(`product.filters.status.${product.status || 'draft'}`)" 
                   :variant="getProductStatusVariant(product.status)" 
                 />
             </div>
             
             <div class="mt-6 flex items-baseline gap-1">
                 <span class="text-xs text-[var(--text-secondary)]">¥</span>
                 <span class="font-[Outfit] text-3xl font-bold text-[var(--text-main)]">{{ product.price?.toFixed(2) }}</span>
                 <span v-if="product.cost_price" class="ml-2 text-xs text-[var(--text-secondary)]">({{ t('product.form.cost') }}: ¥{{ product.cost_price }})</span>
             </div>
        </div>

        <!-- Specs -->
        <div class="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] p-5 shadow-sm">
             <h3 class="mb-4 text-sm font-bold tracking-wider text-[var(--text-main)] uppercase opacity-80">{{ t('product.form.specifications') }}</h3>
             <div class="space-y-3">
                 <div class="flex justify-between border-b border-[var(--border-color)]/50 pb-2 text-sm last:border-0 last:pb-0">
                     <span class="text-[var(--text-secondary)]">{{ t('order.form.size') }}</span>
                     <span class="font-medium text-[var(--text-main)]">{{ specs.size || '-' }}</span>
                 </div>
                 <div class="flex justify-between border-b border-[var(--border-color)]/50 pb-2 text-sm last:border-0 last:pb-0">
                     <span class="text-[var(--text-secondary)]">{{ t('order.form.color') }}</span>
                     <span class="font-medium text-[var(--text-main)]">{{ specs.color || '-' }}</span>
                 </div>
                 <div class="flex justify-between border-b border-[var(--border-color)]/50 pb-2 text-sm last:border-0 last:pb-0">
                     <span class="text-[var(--text-secondary)]">{{ t('order.form.material') }}</span>
                     <span class="font-medium text-[var(--text-main)]">{{ specs.material || '-' }}</span>
                 </div>
                 <div class="flex justify-between border-b border-[var(--border-color)]/50 pb-2 text-sm last:border-0 last:pb-0">
                     <span class="text-[var(--text-secondary)]">{{ t('product.form.category') }}</span>
                     <span class="font-medium text-[var(--text-main)]">{{ product.category || '-' }}</span>
                 </div>
             </div>
        </div>

        <!-- Inventory -->
        <div class="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] p-5 shadow-sm">
             <h3 class="mb-4 text-sm font-bold tracking-wider text-[var(--text-main)] uppercase opacity-80">{{ t('product.form.inventory') }}</h3>
             <div class="space-y-4">
                 <div class="flex justify-between text-sm">
                     <span class="text-[var(--text-secondary)]">{{ t('product.stats.stock_level') }}</span>
                     <span :class="stockColorClass" class="font-medium">{{ product.stockQuantity }}</span>
                 </div>
                 <div class="h-2 w-full overflow-hidden rounded-full bg-[var(--bg-muted)]">
                      <div class="h-full rounded-full transition-all duration-500" :class="stockBgClass" :style="{ width: Math.min(100, (product.stockQuantity / 100) * 100) + '%' }"></div>
                 </div>
                 <div class="flex justify-between text-xs text-[var(--text-secondary)]">
                     <span>{{ t('product.form.alert_at') }}: {{ product.alertThreshold }}</span>
                 </div>
             </div>
        </div>
        
        <!-- Mobile Description -->
        <div class="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] p-5 shadow-sm lg:hidden">
            <h3 class="mb-2 font-bold text-[var(--text-main)]">{{ t('product.form.description') }}</h3>
            <p class="text-sm leading-relaxed whitespace-pre-wrap text-[var(--text-secondary)]">
                {{ product.description || t('common.text.no_description') }}
            </p>
        </div>


    </div>
  </div>
</template>

<script setup>
import { computed, ref, onMounted } from 'vue';
import { useI18n } from '@/composables/useI18n';
import AppImage from '@/components/ui/AppImage.vue';
import StatusBadge from '@/components/ui/StatusBadge.vue';
import { getProductStatusVariant } from '@/utils/status';
import { useSpaces } from '@/composables/useSpaces';
import { useToast } from '@/composables/useToast';

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
    try {
        if (!props.product.images) return [];
        return typeof props.product.images === 'string' 
            ? JSON.parse(props.product.images) 
            : props.product.images;
    } catch {
        return [];
    }
});

const currentImage = computed(() => images.value[currentIndex.value]);

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
    const q = props.product.stockQuantity || 0;
    const t = props.product.alertThreshold || 10;
    if (q <= t) return 'text-[var(--color-danger-text)] font-bold';
    return 'text-[var(--text-main)]';
});

const stockBgClass = computed(() => {
    const q = props.product.stockQuantity || 0;
    const t = props.product.alertThreshold || 10;
     if (q <= t) return 'bg-[var(--color-danger)]';
    return 'bg-[var(--color-success)]';
});

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
