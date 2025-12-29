<template>
  <table class="w-full text-sm text-left relative">
    <thead class="bg-gray-50 text-gray-500 font-medium sticky top-0 z-10 shadow-sm">
      <tr>
        <th class="px-4 py-3">{{ t('order.form.productName') }}</th>
        <th class="px-4 py-3">{{ t('salesperson.name') }}</th>
        <th class="px-4 py-3">{{ t('order.orderNo') }}</th>
        <th class="px-4 py-3">{{ t('order.status') }}</th>
        <th class="px-4 py-3">{{ t('order.createdAt') }}</th>
        <th class="px-4 py-3 text-right">{{ t('common.actions') }}</th>
      </tr>
    </thead>
    <tbody class="divide-y divide-gray-200">
      <!-- 加载骨架屏 -->
      <template v-if="loading">
        <tr v-for="i in 5" :key="i" class="animate-pulse">
          <td v-for="j in 6" :key="j" class="px-4 py-4">
            <div class="h-4 bg-gray-200 rounded w-2/3"></div>
          </td>
        </tr>
      </template>
      
      <!-- 数据行 -->
      <template v-else-if="data.length > 0">
        <tr 
          v-for="order in data" 
          :key="order.id" 
          class="hover:bg-gray-50 transition-colors group cursor-pointer"
          @click="$emit('detail', order)"
        >
          <td class="px-4 py-3">
            <div class="flex items-center gap-3">
              <!-- 缩略图 -->
              <div class="w-10 h-10 rounded bg-gray-100 flex-shrink-0 overflow-hidden border border-gray-200">
                <img v-if="order.mainImage" :src="order.mainImage" class="w-full h-full object-cover">
                <div v-else class="w-full h-full flex items-center justify-center">
                  <svg class="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                  </svg>
                </div>
              </div>
              <div>
                <div class="font-medium text-gray-900 flex items-center gap-2">
                  {{ order.productName || '-' }}
                  <!-- 红点 -->
                  <span v-if="order.hasNewFeedback" class="w-2 h-2 bg-red-500 rounded-full animate-pulse" :title="t('order.portal.hasUpdate')"></span>
                </div>
              </div>
            </div>
          </td>
          <td class="px-4 py-3">
            <div class="text-gray-900">{{ order.salesperson?.name }}</div>
            <div class="text-xs text-gray-500">{{ order.salesperson?.store }}</div>
          </td>
          <td class="px-4 py-3 text-gray-500 font-mono text-xs">{{ order.orderNo }}</td>
          <td class="px-4 py-3" @click.stop>
            <slot name="status" :order="order"></slot>
          </td>
          <td class="px-4 py-3 text-gray-500 text-xs">{{ formatTime(order.createdAt) }}</td>
          <td class="px-4 py-3 text-right" @click.stop>
            <button 
              @click="$emit('edit', order)"
              class="text-primary hover:text-gray-900 font-medium text-xs border border-gray-300 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
            >
              {{ t('order.manage.editOrder') }}
            </button>
          </td>
        </tr>
      </template>

      <!-- 空状态 -->
      <tr v-else>
        <td colspan="6" class="px-4 py-16 text-center">
          <EmptyState icon="file" :title="t('order.portal.emptyOrders')" />
        </td>
      </tr>
    </tbody>
  </table>
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
