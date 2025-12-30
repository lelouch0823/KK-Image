<template>
  <div class="w-80 sm:w-96 max-h-[80vh] flex flex-col bg-white rounded-lg shadow-xl border border-[var(--border-color)] overflow-hidden">
    <!-- Header -->
    <div class="px-4 py-3 border-b border-[var(--border-color)] flex justify-between items-center bg-gray-50/50">
      <h3 class="font-medium text-gray-900">{{ t('notification.title') || '通知中心' }}</h3>
      <div class="flex items-center gap-2">
        <button 
          v-if="unreadCount > 0"
          @click="markAllAsRead"
          class="text-xs text-primary hover:text-primary-hover font-medium transition-colors"
        >
          {{ t('notification.markAllRead') || '全部已读' }}
        </button>
      </div>
    </div>

    <!-- List -->
    <div class="flex-1 overflow-y-auto min-h-[100px]">
      <div v-if="loading && notifications.length === 0" class="p-8 text-center text-gray-400">
        <div class="animate-spin w-5 h-5 border-2 border-primary border-t-transparent rounded-full mx-auto mb-2"></div>
        <span class="text-xs">{{ t('common.loading') }}</span>
      </div>

      <div v-else-if="notifications.length === 0" class="p-8 text-center text-gray-400 flex flex-col items-center">
        <svg class="w-10 h-10 text-gray-200 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        <span class="text-sm">{{ t('notification.empty') || '暂无通知' }}</span>
      </div>

      <div v-else class="divide-y divide-gray-100">
        <div 
          v-for="item in notifications" 
          :key="item.id"
          @click="handleClick(item)"
          class="p-4 hover:bg-gray-50 transition-colors cursor-pointer relative group"
          :class="{ 'bg-blue-50/30': item.is_read === 0 }"
        >
          <div class="flex items-start gap-3">
            <!-- Icon based on type -->
            <div class="shrink-0 mt-0.5">
              <span v-if="item.type === 'order'" class="w-2 h-2 rounded-full bg-blue-500 block mt-1.5"></span>
              <span v-else-if="item.type === 'deadline'" class="w-2 h-2 rounded-full bg-orange-500 block mt-1.5"></span>
              <span v-else class="w-2 h-2 rounded-full bg-gray-400 block mt-1.5"></span>
            </div>
            
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium text-gray-900 truncate pr-4" :class="{ 'font-semibold': item.is_read === 0 }">
                {{ item.title }}
              </p>
              <p class="text-xs text-gray-500 mt-0.5 line-clamp-2">{{ item.content }}</p>
              <p class="text-xs text-gray-400 mt-1.5">{{ formatDate(item.created_at) }}</p>
            </div>

            <!-- Unread indicator dot -->
            <div v-if="item.is_read === 0" class="shrink-0 self-center">
              <div class="w-2 h-2 bg-primary rounded-full"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted } from 'vue';
import { useNotifications } from '@/composables/useNotifications';
import { useI18n } from '@/composables/useI18n';
import { formatDate } from '@/utils/formatters';
import { useRouter } from 'vue-router';

const props = defineProps({
  close: Function
});

const { notifications, unreadCount, loading, markAsRead, markAllAsRead, fetchNotifications } = useNotifications();
const { t } = useI18n();
const router = useRouter();

onMounted(() => {
  fetchNotifications();
});

const handleClick = async (item) => {
  if (item.is_read === 0) {
    await markAsRead(item.id);
  }
  
  if (item.link) {
    router.push(item.link);
    if (props.close) props.close();
  }
};
</script>
