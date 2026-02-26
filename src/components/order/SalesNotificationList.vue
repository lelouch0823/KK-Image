<template>
  <div
    class="flex max-h-[80vh] w-full flex-col overflow-hidden rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] shadow-xl"
  >
    <!-- Header -->
    <div
      class="flex items-center justify-between border-b border-[var(--border-color)] bg-[var(--bg-muted)] px-4 py-3"
    >
      <h3 class="font-medium text-[var(--text-main)]">{{ t('notification.title') }}</h3>
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
    <div class="scrollbar-thin min-h-[100px] flex-1 overflow-y-auto">
      <div
        v-if="loading && notifications.length === 0"
        class="flex flex-col items-center justify-center p-12 text-center text-[var(--text-muted)]"
      >
        <div
          class="border-primary mx-auto mb-3 size-6 animate-spin rounded-full border-2 border-t-transparent"
        ></div>
        <span class="text-xs font-medium">{{ t('common.loading') }}</span>
      </div>

      <div v-else-if="notifications.length === 0" class="py-4">
        <EmptyState icon="inbox" :title="t('notification.empty')" size="sm" />
      </div>

      <div v-else class="divide-y divide-[var(--border-color)]">
        <TransitionGroup
          name="list"
          tag="div"
          class="divide-y divide-[var(--border-color)]"
        >
          <div
            v-for="item in notifications"
            :key="item.id"
            class="group relative cursor-pointer p-4 transition-all duration-200 hover:bg-[var(--bg-hover)] active:scale-[0.99]"
            :class="{ 'bg-[var(--color-primary-bg)]': item.is_read === 0 }"
            @click="handleClick(item)"
          >
            <div class="flex items-start gap-3">
              <!-- Icon based on type -->
              <div class="mt-1 shrink-0">
                <span
                  v-if="item.type === 'order'"
                  class="block size-2 rounded-full bg-[var(--color-info)] shadow-sm"
                ></span>
                <span
                  v-else-if="item.type === 'deadline'"
                  class="block size-2 rounded-full bg-[var(--color-warning)] shadow-sm"
                ></span>
                <span
                  v-else
                  class="block size-2 rounded-full bg-[var(--color-text-muted)] shadow-sm"
                ></span>
              </div>

              <div class="min-w-0 flex-1">
                <p
                  class="group-hover:text-primary truncate pr-4 text-sm font-medium text-[var(--text-main)] transition-colors"
                  :class="{ 'font-semibold': item.is_read === 0 }"
                  :title="renderText(item.title)"
                >
                  {{ renderText(item.title) }}
                </p>
                <p class="text-secondary mt-0.5 line-clamp-2 text-xs leading-relaxed" :title="renderText(item.content)">
                  {{ renderText(item.content) }}
                </p>
                <p class="text-muted mt-2 flex items-center gap-1.5 text-[10px] font-medium tracking-wider uppercase">
                  <AppIcon name="clock" class="size-3" />
                  {{ formatDate(item.created_at) }}
                </p>
              </div>

              <!-- Unread indicator dot & Mark Read Action -->
              <div v-if="item.is_read === 0" class="flex shrink-0 items-center gap-2 self-center">
                <button 
                  class="text-primary hidden size-6 items-center justify-center rounded-full transition-colors group-hover:flex hover:bg-black/5 dark:hover:bg-white/10"
                  title="标记为已读"
                  @click.stop="markAsRead(item.id)"
                >
                  <AppIcon name="check" class="size-4" />
                </button>
                <div class="bg-primary size-2 animate-pulse rounded-full"></div>
              </div>
            </div>
          </div>
        </TransitionGroup>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted } from 'vue';
import { useNotifications } from '@/composables/useNotifications';
import { useI18n } from '@/composables/useI18n';
import { formatDate } from '@/utils/formatters';
import EmptyState from '@/components/ui/EmptyState.vue';
import AppIcon from '@/components/ui/AppIcon.vue';

const props = defineProps({
  close: { type: Function, default: () => {} },
  onNavigate: { type: Function, default: null },
});

const { notifications, unreadCount, loading, markAsRead, markAllAsRead, fetchNotifications } =
  useNotifications();
const { t } = useI18n();

onMounted(() => {
  fetchNotifications();
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

  // 销售端通过 onNavigate 回调处理跳转
  if (props.onNavigate && item.orderId) {
    props.onNavigate(item.orderId);
    if (props.close) props.close();
  } else if (props.close) {
    props.close();
  }
};
</script>

<style scoped>
.list-enter-active,
.list-leave-active {
  transition: all 0.3s ease;
}
.list-enter-from,
.list-leave-to {
  opacity: 0;
  transform: translateX(10px);
}
</style>
