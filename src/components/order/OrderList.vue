<template>
  <div>
    <!-- 下拉刷新提示 -->
    <div 
      v-if="isPulling" 
      class="flex items-center justify-center py-4 text-secondary text-sm"
    >
      <svg class="w-4 h-4 mr-2 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
      </svg>
      {{ t('common.loading') }}
    </div>

    <!-- 空状态 -->
    <div v-if="!loading && orders.length === 0" class="text-center py-16">
      <div class="w-20 h-20 mx-auto mb-6 bg-gray-100 rounded-full flex items-center justify-center">
        <svg class="w-10 h-10 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path>
        </svg>
      </div>
      <h3 class="text-lg font-medium text-primary mb-2">{{ t('order.portal.emptyOrders') }}</h3>
      <p class="text-sm text-secondary">{{ t('order.portal.emptyHint') }}</p>
    </div>

    <!-- 订单列表 -->
    <div v-else class="space-y-3">
      <div 
        v-for="order in orders" 
        :key="order.id"
        @click="$emit('view', order)"
        class="bg-white rounded-xl border border-[var(--border-color)] p-4 cursor-pointer hover:shadow-md hover:border-gray-300 transition-all active:scale-[0.98]"
      >
        <div class="flex items-start gap-3">
          <!-- 主图 -->
          <div class="w-16 h-16 rounded-lg bg-gray-100 overflow-hidden flex-shrink-0">
            <img 
              v-if="order.mainImage" 
              :src="order.mainImage" 
              class="w-full h-full object-cover"
              loading="lazy"
            >
            <div v-else class="w-full h-full flex items-center justify-center">
              <svg class="w-6 h-6 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
              </svg>
            </div>
          </div>

          <!-- 信息 -->
          <div class="flex-1 min-w-0">
            <div class="flex items-start justify-between gap-2">
              <h4 class="font-medium text-primary truncate">{{ order.productName || t('order.form.productName') }}</h4>
              <!-- 红点 -->
              <div v-if="order.hasNewFeedback" class="flex-shrink-0">
                <span class="inline-flex items-center gap-1 px-2 py-0.5 bg-red-50 text-red-600 text-xs font-medium rounded-full">
                  <span class="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse"></span>
                  {{ t('order.portal.hasUpdate') }}
                </span>
              </div>
            </div>
            
            <p class="text-xs text-secondary mt-1">{{ order.orderNo }}</p>
            
            <div class="flex items-center justify-between mt-2">
              <!-- 状态标签 -->
              <span 
                class="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full"
                :class="statusClasses[order.status]"
              >
                {{ t(`order.statuses.${order.status}`) }}
              </span>
              
              <!-- 时间 -->
              <span class="text-xs text-secondary">{{ formatTime(order.createdAt) }}</span>
            </div>
          </div>

          <!-- 箭头 -->
          <svg class="w-5 h-5 text-gray-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
          </svg>
        </div>
      </div>
    </div>

    <!-- 加载状态 -->
    <div v-if="loading" class="flex items-center justify-center py-8">
      <div class="w-8 h-8 border-3 border-gray-200 border-t-primary rounded-full animate-spin"></div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useI18n } from '@/composables/useI18n';

const props = defineProps({
  orders: { type: Array, default: () => [] },
  loading: Boolean
});

const emit = defineEmits(['refresh', 'view']);

const { t } = useI18n();
const isPulling = ref(false);

// 状态样式映射
const statusClasses = {
  pending: 'bg-yellow-50 text-yellow-700',
  confirmed: 'bg-blue-50 text-blue-700',
  rejected: 'bg-red-50 text-red-700',
  production: 'bg-purple-50 text-purple-700',
  shipping: 'bg-cyan-50 text-cyan-700',
  arrived: 'bg-green-50 text-green-700',
  delivered: 'bg-gray-100 text-gray-600'
};

// 格式化时间
const formatTime = (timestamp) => {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now - date;
  
  // 一分钟内
  if (diff < 60000) return t('stats.justNow');
  // 一小时内
  if (diff < 3600000) return t('stats.minutesAgo', { count: Math.floor(diff / 60000) });
  // 一天内
  if (diff < 86400000) return t('stats.hoursAgo', { count: Math.floor(diff / 3600000) });
  // 超过一天
  return `${date.getMonth() + 1}/${date.getDate()}`;
};
</script>
