<template>
  <div
    class="flex max-h-[80vh] w-80 flex-col overflow-hidden rounded-lg border border-[var(--border-color)] bg-white shadow-xl sm:w-96"
  >
    <!-- Header -->
    <div
      class="flex items-center justify-between border-b border-[var(--border-color)] bg-gray-50/50 px-4 py-3"
    >
      <h3 class="font-medium text-gray-900">{{ t('notification.title') }}</h3>
      <div class="flex items-center gap-2">
        <button
          v-if="unreadCount > 0"
          class="text-primary text-xs font-medium transition-colors hover:text-primary-hover"
          @click="markAllAsRead"
        >
          {{ t('notification.markAllRead') }}
        </button>
      </div>
    </div>

    <!-- List -->
    <div class="min-h-[100px] flex-1 overflow-y-auto">
      <div v-if="loading && notifications.length === 0" class="p-8 text-center text-gray-400">
        <div
          class="border-primary mx-auto mb-2 size-5 animate-spin rounded-full border-2 border-t-transparent"
        ></div>
        <span class="text-xs">{{ t('common.loading') }}</span>
      </div>

      <div
        v-else-if="notifications.length === 0"
        class="flex flex-col items-center p-8 text-center text-gray-400"
      >
        <svg
          class="mb-2 size-10 text-gray-200"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="1.5"
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
        <span class="text-sm">{{ t('notification.empty') }}</span>
      </div>

      <div v-else class="divide-y divide-gray-100">
        <div
          v-for="item in notifications"
          :key="item.id"
          class="group relative cursor-pointer p-4 transition-colors hover:bg-[var(--bg-hover)]"
          :class="{ 'bg-primary/5': item.is_read === 0 }"
          @click="handleClick(item)"
        >
          <div class="flex items-start gap-3">
            <!-- Icon based on type -->
            <div class="mt-0.5 shrink-0">
              <span
                v-if="item.type === 'order'"
                class="mt-1.5 block size-2 rounded-full bg-[var(--color-info)]"
              ></span>
              <span
                v-else-if="item.type === 'deadline'"
                class="mt-1.5 block size-2 rounded-full bg-[var(--color-warning)]"
              ></span>
              <span
                v-else
                class="mt-1.5 block size-2 rounded-full bg-[var(--color-text-muted)]"
              ></span>
            </div>

            <div class="min-w-0 flex-1">
              <p
                class="truncate pr-4 text-sm font-medium text-gray-900"
                :class="{ 'font-semibold': item.is_read === 0 }"
              >
                {{ renderText(item.title) }}
              </p>
              <p class="text-secondary mt-0.5 line-clamp-2 text-xs">
                {{ renderText(item.content) }}
              </p>
              <p class="text-muted mt-1.5 text-xs">{{ formatDate(item.created_at) }}</p>
            </div>

            <!-- Unread indicator dot -->
            <div v-if="item.is_read === 0" class="shrink-0 self-center">
              <div class="bg-primary size-2 rounded-full"></div>
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
  close: { type: Function, default: () => {} },
});

const { notifications, unreadCount, loading, markAsRead, markAllAsRead, fetchNotifications } =
  useNotifications();
const { t } = useI18n();
const router = useRouter();

const fetchList = () => {
  fetchNotifications();
};

onMounted(() => {
  fetchList();
});

// 处理可能的 JSON 格式翻译包
const renderText = (val) => {
  if (!val) return '';
  if (val.startsWith('{')) {
    try {
      const data = JSON.parse(val);
      if (data.key) {
        return t(data.key, data);
      }
    } catch (_e) {
      return val;
    }
  }
  // 如果是 key 则翻译，翻译不到则返回原值
  const translated = t(val);
  return translated === val ? val : translated;
};

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
