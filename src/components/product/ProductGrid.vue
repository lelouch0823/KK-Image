<template>
  <div class="space-y-3">
    <div 
        v-for="product in products" 
        :key="product.id"
        :class="[
            'border-(--border-color) bg-(--bg-card) active:bg-(--bg-hover) group relative cursor-pointer overflow-hidden rounded-2xl border shadow-sm transition-all duration-300 active:scale-[0.98] active:shadow-none',
            getStatusBorderClass(product.status)
        ]"
        @click="$emit('view', product)"
    >
        <div class="flex items-start gap-3 p-3">
            <!-- Image (Larger for better visual appeal) -->
            <div class="border-(--border-color) bg-(--bg-muted) size-20 shrink-0 overflow-hidden rounded-xl border">
                 <AppImage 
                    v-if="getMainImage(product)" 
                    :src="getFileUrl(getMainImage(product))" 
                    fit="cover"
                    class="size-full"
                    rounded="none"
                >
                    <template #placeholder>
                         <div class="bg-(--bg-muted) text-(--text-secondary)/30 flex size-full items-center justify-center">
                             <AppIcon name="photo" class="size-6 animate-pulse" />
                         </div>
                    </template>
                </AppImage>
                <div v-else class="text-(--text-secondary)/30 flex size-full items-center justify-center">
                    <AppIcon name="photo" class="size-8" />
                </div>
            </div>
            
            <!-- Info -->
            <div class="min-w-0 flex-1">
                <!-- Title -->
                <h3 class="text-(--text-main) truncate text-[15px] leading-tight font-medium">
                    {{ product.name }}
                </h3>
                
                <!-- SPU + Stock Row -->
                <div class="mt-1.5 flex items-center gap-2">
                    <span class="bg-(--bg-muted) text-(--text-secondary) rounded px-1.5 py-0.5 font-mono text-[11px]">
                        {{ product.spu }}
                    </span>
                    <span class="text-(--text-secondary) text-[11px]">
                        {{ t('product.table.header.stock') }}: {{ product.stock_quantity }}
                    </span>
                    <span v-if="product.stock_quantity <= (product.alert_threshold || 10)" class="bg-danger-bg text-danger-text rounded px-1.5 py-0.5 text-[10px] font-bold">
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
                            class="hover:bg-primary/10 text-primary rounded p-1 transition-colors"
                            :title="t('spaceManager.quickShare') || 'Share'"
                            @click.stop="$emit('share', product)"
                        >
                            <AppIcon name="share" class="size-4.5" />
                        </button>
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
import StatusBadge from '@/components/ui/StatusBadge.vue';
import AppImage from '@/components/ui/AppImage.vue';
import AppIcon from '@/components/ui/AppIcon.vue';

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
        case 'success': return 'border-l-4 border-l-success';
        case 'warning': return 'border-l-4 border-l-warning';
        case 'info': return 'border-l-4 border-l-info';
        case 'error': return 'border-l-4 border-l-danger'; 
        default: return 'border-l-4 border-l-(--border-strong)';
    }
};
</script>
