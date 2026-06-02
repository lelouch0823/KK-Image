<template>
  <div class="space-y-3">
    <div 
        v-for="product in products" 
        :key="product.id"
        :class="[
            'group relative cursor-pointer overflow-hidden rounded-2xl border border-(--border-color) bg-(--bg-card) shadow-sm transition-all duration-300 active:scale-[0.98] active:bg-(--bg-hover) active:shadow-none',
            getStatusBorderClass(product.status),
            cardClass(product),
        ]"
        @click="$emit('view', product)"
    >
        <div class="flex items-start gap-3 p-3">
            <!-- Image (Larger for better visual appeal) -->
            <div class="size-20 shrink-0 overflow-hidden rounded-xl border border-(--border-color) bg-(--bg-muted)">
                 <AppImage
                    v-if="getMainImageSrc(product)"
                    :src="getMainImageSrc(product)"
                    :alt="product.name" 
                    fit="cover"
                    class="size-full"
                    rounded="none"
                >
                    <template #placeholder>
                         <div class="flex size-full items-center justify-center bg-(--bg-muted) text-(--text-secondary)/30">
                             <AppIcon name="photo" class="size-6 animate-pulse" />
                         </div>
                    </template>
                </AppImage>
                <div v-else class="flex size-full items-center justify-center text-(--text-secondary)/30">
                    <AppIcon name="photo" class="size-8" />
                </div>
            </div>
            
            <!-- Info -->
            <div class="min-w-0 flex-1">
                <!-- Title -->
                <h3 class="truncate text-[15px] leading-tight font-medium text-(--text-main)" :title="product.name || '-'">
                    {{ product.name }}
                </h3>
                
                <!-- SPU + Stock Row -->
                <div class="mt-1.5 flex min-w-0 flex-wrap items-center gap-1.5">
                    <span class="max-w-[8.5rem] truncate rounded bg-(--bg-muted) px-1.5 py-0.5 font-mono text-[11px] text-(--text-secondary)" :title="product.spu || '-'">
                        {{ product.spu }}
                    </span>
                    <span class="max-w-[8rem] truncate text-[11px] text-(--text-secondary)" :title="`${t('product.table.header.stock')}: ${resolveDisplayStock(product)}`">
                        {{ t('product.table.header.stock') }}: {{ resolveDisplayStock(product) }}
                    </span>
                    <span v-if="resolveDisplayStock(product) <= resolveAlertThreshold(product)" class="bg-danger-bg text-danger-text rounded px-1.5 py-0.5 text-xs font-bold">
                        {{ t('product.stats.low_stock') }}
                    </span>
                </div>
                
                <!-- Price + Status Row -->
                <div class="mt-2 flex items-end justify-between">
                    <StatusBadge :variant="getStatusVariant(product.status)" size="xs" :dot="true">
                        {{ t(`product.filters.status.${product.status}`) }}
                    </StatusBadge>
                    
                    <div class="flex items-center gap-3">
                        <AppButton
                            variant="ghost"
                            size="sm"
                            class="text-primary hover:bg-primary/10 !h-8 !w-8 !gap-0 !px-0 [&_span]:hidden"
                            :title="t('spaceManager.quickShare') || 'Share'"
                            @click.stop="$emit('share', product)"
                        >
                            <template #icon-left>
                                <AppIcon name="share" class="size-4.5" />
                            </template>
                        </AppButton>
                        <div class="text-primary text-lg font-bold">¥{{ product.price }}</div>
                    </div>
                </div>
            </div>
        </div>
    </div>
  </div>
</template>

<script setup>
import { useI18n } from '@/composables/useI18n';
import AppButton from '@/components/ui/AppButton.vue';
import StatusBadge from '@/components/ui/StatusBadge.vue';
import AppImage from '@/components/ui/AppImage.vue';
import AppIcon from '@/components/ui/AppIcon.vue';
import { resolvePrimaryProductImageSrc } from './image-resolver';

const { t } = useI18n();
defineProps({
    products: {
        type: Array,
        default: () => []
    },
    cardClass: {
        type: Function,
        default: () => '',
    },
});
defineEmits(['view', 'edit', 'share']);

const getMainImageSrc = (product) => resolvePrimaryProductImageSrc(product);

const resolveDisplayStock = (product) =>
    Number(product?.available_quantity ?? product?.available ?? product?.stock_quantity ?? 0);

const resolveAlertThreshold = (product) => {
    const numeric = Number(product?.alert_threshold);
    return Number.isFinite(numeric) ? numeric : 10;
};

const getStatusVariant = (status) => {
    switch(status) {
        case 'active': return 'success';
        case 'draft': return 'warning';
        case 'archived': return 'default'; // or info
        default: return 'default';
    }
};

const getStatusBorderClass = (status) => {
    const variant = getStatusVariant(status);
    switch (variant) {
        case 'success': return 'border-l-4 border-l-success';
        case 'warning': return 'border-l-4 border-l-warning';
        case 'info': return 'border-l-4 border-l-info';
        case 'error': return 'border-l-4 border-l-danger'; 
        default: return 'border-l-4 border-l-(--border-strong)';
    }
};
</script>
