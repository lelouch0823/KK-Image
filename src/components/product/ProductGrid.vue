<template>
  <div class="space-y-3">
    <div 
        v-for="product in products" 
        :key="product.id"
        :class="[
            'group relative cursor-pointer overflow-hidden rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] shadow-sm transition-all duration-300 active:scale-[0.98] active:bg-[var(--bg-hover)] active:shadow-none',
            getStatusBorderClass(product.status)
        ]"
        @click="$emit('view', product)"
    >
        <div class="flex items-start gap-3 p-3">
            <!-- Image (Larger for better visual appeal) -->
            <div class="size-20 flex-shrink-0 overflow-hidden rounded-xl border border-[var(--border-color)] bg-[var(--bg-muted)]">
                 <AppImage 
                    v-if="getMainImage(product)" 
                    :src="getFileUrl(getMainImage(product))" 
                    fit="cover"
                    class="size-full"
                    rounded="none"
                >
                    <template #placeholder>
                         <div class="flex size-full items-center justify-center bg-[var(--bg-muted)] text-[var(--text-secondary)]/30">
                             <svg class="size-6 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                 <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                             </svg>
                         </div>
                    </template>
                </AppImage>
                <div v-else class="flex size-full items-center justify-center text-[var(--text-secondary)]/30">
                    <svg class="size-8 " fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                </div>
            </div>
            
            <!-- Info -->
            <div class="min-w-0 flex-1">
                <!-- Title -->
                <h3 class="truncate text-[15px] leading-tight font-medium text-[var(--text-main)]">
                    {{ product.name }}
                </h3>
                
                <!-- SPU + Stock Row -->
                <div class="mt-1.5 flex items-center gap-2">
                    <span class="rounded bg-[var(--bg-muted)] px-1.5 py-0.5 font-mono text-[11px] text-[var(--text-secondary)]">
                        {{ product.spu }}
                    </span>
                    <span class="text-[11px] text-[var(--text-secondary)]">
                        {{ t('product.table.header.stock') }}: {{ product.stock_quantity }}
                    </span>
                    <span v-if="product.stock_quantity <= (product.alert_threshold || 10)" class="rounded bg-[var(--color-danger-bg)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--color-danger-text)]">
                        {{ t('product.stats.low_stock') }}
                    </span>
                </div>
                
                <!-- Price + Status Row -->
                <div class="mt-2 flex items-end justify-between">
                    <StatusBadge :variant="getStatusVariant(product.status)" size="xs" :dot="true">
                        {{ t(`product.filters.status.${product.status}`) }}
                    </StatusBadge>
                    
                    <div class="flex items-center gap-3">
                        <button 
                            class="hover:bg-primary/10 rounded p-1 text-[var(--color-primary)] transition-colors"
                            :title="t('spaceManager.quickShare') || 'Share'"
                            @click.stop="$emit('share', product)"
                        >
                            <svg class="size-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                            </svg>
                        </button>
                        <div class="text-lg font-bold text-[var(--color-primary)]">¥{{ product.price }}</div>
                    </div>
                </div>
            </div>
        </div>
    </div>
  </div>
</template>

<script setup>
import { useI18n } from '@/composables/useI18n';
import StatusBadge from '@/components/ui/StatusBadge.vue';
import AppImage from '@/components/ui/AppImage.vue';

const { t } = useI18n();
defineProps({
    products: {
        type: Array,
        default: () => []
    }
});
defineEmits(['view', 'edit', 'share']);

const getFileUrl = (id) => `/file/${id}`;
const getMainImage = (product) => {
    try {
        if (!product.images) return null;
        const imgs = typeof product.images === 'string' ? JSON.parse(product.images) : product.images;
        return Array.isArray(imgs) && imgs.length > 0 ? imgs[0] : null;
    } catch { return null; }
};

const getStatusVariant = (status) => {
    switch(status) {
        case 'active': return 'success';
        case 'archived': return 'default'; // or info
        default: return 'default';
    }
};

const getStatusBorderClass = (status) => {
    const variant = getStatusVariant(status);
    switch (variant) {
        case 'success': return 'border-l-4 border-l-[var(--color-success)]';
        case 'warning': return 'border-l-4 border-l-[var(--color-warning)]';
        case 'info': return 'border-l-4 border-l-[var(--color-info)]';
        case 'error': return 'border-l-4 border-l-[var(--color-danger)]'; 
        default: return 'border-l-4 border-l-[var(--border-strong)]';
    }
};
</script>
