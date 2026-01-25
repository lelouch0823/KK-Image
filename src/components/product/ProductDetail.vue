<template>
  <div class="grid grid-cols-1 gap-6 lg:grid-cols-12">
    <!-- Left: Gallery (8 cols) -->
    <div class="lg:col-span-8 space-y-4">
        <div class="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] p-1 shadow-sm overflow-hidden">
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
            <div v-if="images.length > 1" class="flex gap-2 p-3 overflow-x-auto scrollbar-hide">
                <button 
                  v-for="(img, idx) in images" 
                  :key="idx"
                  @click="currentIndex = idx"
                  class="relative size-16 shrink-0 overflow-hidden rounded-lg border-2 transition-all"
                  :class="currentIndex === idx ? 'border-[var(--color-primary)] opacity-100 ring-2 ring-[var(--color-primary)]/20' : 'border-transparent opacity-60 hover:opacity-100'"
                >
                   <AppImage :src="`/file/${img}`" fit="cover" class="size-full" />
                </button>
            </div>
        </div>
        
        <!-- Description (Desktop) -->
        <div class="hidden lg:block rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] p-6 shadow-sm">
            <h3 class="mb-3 font-bold text-[var(--text-main)]">{{ t('product.form.description') }}</h3>
            <p class="whitespace-pre-wrap text-sm leading-relaxed text-[var(--text-secondary)]">
                {{ product.description || t('common.text.no_description') }}
            </p>
        </div>
    </div>

    <!-- Right: Info (4 cols) -->
    <div class="lg:col-span-4 space-y-4">
        <!-- Header Info -->
        <div class="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] p-5 shadow-sm">
             <div class="mb-3 flex items-start justify-between gap-2">
                 <div>
                     <span v-if="product.brand" class="mb-1 inline-block text-xs font-semibold text-[var(--color-primary)] uppercase tracking-wider">{{ product.brand }}</span>
                     <h2 class="text-xl font-bold text-[var(--text-main)] line-clamp-2">{{ product.name }}</h2>
                     <div class="mt-1 flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                         <span v-if="product.sku" class="font-mono bg-[var(--bg-muted)] px-1.5 py-0.5 rounded text-xs">{{ product.sku }}</span>
                         <span v-if="product.series">&bull; {{ product.series }}</span>
                     </div>
                 </div>
                 <StatusBadge :status="product.status" />
             </div>
             
             <div class="mt-6 flex items-baseline gap-1">
                 <span class="text-xs text-[var(--text-secondary)]">¥</span>
                 <span class="font-[Outfit] text-3xl font-bold text-[var(--text-main)]">{{ product.price?.toFixed(2) }}</span>
             </div>
        </div>

        <!-- Specs -->
        <div class="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] p-5 shadow-sm">
             <h3 class="mb-4 text-sm font-bold text-[var(--text-main)] uppercase tracking-wider opacity-80">{{ t('product.form.specifications') }}</h3>
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
             <h3 class="mb-4 text-sm font-bold text-[var(--text-main)] uppercase tracking-wider opacity-80">{{ t('product.form.inventory') }}</h3>
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
        <div class="lg:hidden rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] p-5 shadow-sm">
            <h3 class="mb-2 font-bold text-[var(--text-main)]">{{ t('product.form.description') }}</h3>
            <p class="whitespace-pre-wrap text-sm leading-relaxed text-[var(--text-secondary)]">
                {{ product.description || t('common.text.no_description') }}
            </p>
        </div>

        <!-- Actions -->
        <div class="flex gap-3 pt-2">
            <button 
                @click="$emit('edit', product)"
                class="flex-1 rounded-xl bg-[var(--color-primary)] py-2.5 text-sm font-medium text-white shadow-lg shadow-[var(--color-primary)]/20 transition-all hover:bg-[var(--color-primary-hover)] active:scale-95"
            >
                {{ t('product.action.edit') }}
            </button>
            <button 
                @click="$emit('close')"
                class="rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] px-5 py-2.5 text-sm font-medium text-[var(--text-main)] hover:bg-[var(--bg-hover)] active:scale-95"
            >
                {{ t('common.close') }}
            </button>
        </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, toRefs } from 'vue';
import { useI18n } from '@/composables/useI18n';
import AppImage from '@/components/ui/AppImage.vue';
import StatusBadge from '@/components/ui/StatusBadge.vue';

const props = defineProps({
    product: {
        type: Object,
        required: true
    }
});

const emit = defineEmits(['edit', 'close']);
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
    if (q <= t) return 'text-red-500 font-bold';
    return 'text-[var(--text-main)]';
});

const stockBgClass = computed(() => {
    const q = props.product.stockQuantity || 0;
    const t = props.product.alertThreshold || 10;
     if (q <= t) return 'bg-red-500';
    return 'bg-green-500';
});
</script>
