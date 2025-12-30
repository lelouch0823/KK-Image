<template>
  <div class="space-y-3">
    <!-- 加载状态 -->
    <template v-if="loading">
      <div v-for="i in 5" :key="i" class="bg-white rounded-xl border border-[var(--border-color)] p-4 animate-pulse">
        <div class="flex gap-3">
          <div class="w-16 h-16 bg-[var(--color-gray-200)] rounded-lg flex-shrink-0"></div>
          <div class="flex-1 space-y-2">
            <div class="h-4 bg-[var(--color-gray-200)] rounded w-3/4"></div>
            <div class="h-3 bg-[var(--color-gray-200)] rounded w-1/2"></div>
            <div class="h-3 bg-[var(--color-gray-200)] rounded w-1/3"></div>
          </div>
        </div>
      </div>
    </template>

    <!-- 订单卡片 -->
    <template v-else-if="data.length > 0">
      <div 
        v-for="order in data" 
        :key="order.id"
        class="bg-white rounded-xl border border-[var(--border-color)] overflow-hidden active:bg-[var(--bg-active)] transition-colors"
        @click="$emit('detail', order)"
      >
        <div class="p-4 flex gap-3">
          <!-- 主图 -->
          <div class="w-16 h-16 rounded-lg bg-[var(--bg-muted)] flex-shrink-0 overflow-hidden border border-[var(--border-color)]">
            <img v-if="order.mainImage" :src="order.mainImage" class="w-full h-full object-cover">
            <div v-else class="w-full h-full flex items-center justify-center">
              <svg class="w-6 h-6 text-[var(--color-gray-300)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
              </svg>
            </div>
          </div>
          
          <!-- 信息 -->
          <div class="flex-1 min-w-0">
            <div class="flex items-start justify-between gap-2">
              <div class="font-medium text-primary truncate flex items-center gap-2">
                {{ order.productName || '-' }}
                <span v-if="order.hasNewFeedback" class="w-2 h-2 bg-[var(--color-danger)] rounded-full animate-pulse flex-shrink-0"></span>
              </div>
              <div @click.stop>
                <slot name="status" :order="order"></slot>
              </div>
            </div>
            <div class="text-xs text-secondary mt-1">{{ order.salesperson?.name }} · {{ order.salesperson?.store }}</div>
            <div class="text-xs text-muted mt-1 font-mono">{{ order.orderNo }}</div>
          </div>
        </div>
        
        <!-- 底部操作栏 -->
        <div class="border-t border-[var(--border-color)] px-4 py-2.5 flex items-center justify-between bg-[var(--bg-muted)]/50" @click.stop>
          <span class="text-xs text-muted">{{ formatTime(order.createdAt) }}</span>
          <button 
            @click="$emit('edit', order)"
            class="text-primary font-medium text-xs px-3 py-1.5 rounded-lg hover:bg-[var(--bg-hover)] transition-colors"
          >
            {{ t('order.manage.editOrder') }}
          </button>
        </div>
      </div>
    </template>

    <!-- 空状态 -->
    <EmptyState v-else icon="file" :title="t('order.portal.emptyOrders')" />
  </div>
</template>

<script setup>
import { useI18n } from '@/composables/useI18n';
import { formatDate } from '@/utils/formatters';
import EmptyState from '@/components/ui/EmptyState.vue';

defineProps({
  data: {
    type: Array,
    required: true
  },
  loading: {
    type: Boolean,
    default: false
  }
});

defineEmits(['detail', 'edit']);

const { t } = useI18n();

const formatTime = (timestamp) => formatDate(timestamp, { hour: undefined, minute: undefined });
</script>
