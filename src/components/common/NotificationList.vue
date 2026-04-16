<template>
  <div
    class="flex max-h-[80vh] w-80 flex-col overflow-hidden rounded-lg border border-(--border-color) bg-(--bg-card) shadow-xl sm:w-96"
  >
    <!-- Header -->
    <div
      class="flex items-center justify-between border-b border-(--border-color) bg-(--bg-muted) px-4 py-3"
    >
      <h3 class="text-primary font-medium">{{ t('notification.title') }}</h3>
      <div class="flex items-center gap-2">
        <AppButton
          v-if="unreadCount > 0 && canWriteNotifications"
          variant="link"
          size="sm"
          class="text-xs font-medium"
          :text="t('notification.markAllRead')"
          @click="markAllAsRead"
        />
      </div>
    </div>

    <!-- List -->
    <div class="min-h-[100px] flex-1 overflow-y-auto">
      <div
        v-if="loading && notifications.length === 0"
        class="p-8 text-center text-(--text-muted)"
      >
        <div
          class="border-primary mx-auto mb-2 size-5 animate-spin rounded-full border-2 border-t-transparent"
        ></div>
        <span class="text-xs">{{ t('common.loading') }}</span>
      </div>

      <div
        v-else-if="notifications.length === 0"
        class="text-secondary flex flex-col items-center p-8 text-center"
      >
        <AppIcon name="bell" class="mb-2 size-10 text-(--text-muted)" />
        <span class="text-sm">{{ t('notification.empty') }}</span>
      </div>

      <div v-else class="divide-y divide-(--border-color)">
        <div
          v-for="item in notifications"
          :key="item.id"
          class="group relative cursor-pointer p-4 transition-colors hover:bg-(--bg-hover)"
          :class="{ 'bg-(--color-primary-bg)': item.is_read === 0 }"
          @click="handleClick(item)"
        >
          <div class="flex items-start gap-3">
            <!-- Icon based on type -->
            <div class="mt-0.5 shrink-0">
              <span
                v-if="item.type === 'order'"
                class="bg-info mt-1.5 block size-2 rounded-full"
              ></span>
              <span
                v-else-if="item.type === 'deadline'"
                class="bg-warning mt-1.5 block size-2 rounded-full"
              ></span>
              <span
                v-else
                class="mt-1.5 block size-2 rounded-full bg-(--text-muted)"
              ></span>
            </div>

            <div class="min-w-0 flex-1">
              <p
                class="text-primary truncate pr-4 text-sm font-medium"
                :class="{ 'font-semibold': item.is_read === 0 }"
              >
                {{ renderText(item.title) }}
              </p>
              <p class="text-secondary mt-0.5 line-clamp-2 text-xs">
                {{ renderText(item.content) }}
              </p>
              <p class="text-muted mt-1.5 text-xs">{{ formatDate(item.created_at) }}</p>
            </div>

            <!-- Unread indicator dot & Mark Read Action -->
            <div v-if="item.is_read === 0" class="flex shrink-0 items-center gap-2 self-center">
              <AppButton
                v-if="canWriteNotifications"
                variant="ghost"
                size="sm"
                class="text-primary !hidden !size-6 !rounded-full !p-0 group-hover:!inline-flex hover:!bg-(--bg-hover)"
                title="标记为已读"
                @click.stop="markAsRead(item.id)"
              >
                <template #icon-left>
                  <AppIcon name="check" class="size-4" />
                </template>
              </AppButton>
              <div class="bg-primary size-2 rounded-full"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { useNotifications } from '@/composables/useNotifications';
import { useI18n } from '@/composables/useI18n';
import { useAccessControl } from '@/composables/useAccessControl';
import { formatDate } from '@/utils/formatters';
import { useRouter } from 'vue-router';
import AppButton from '@/components/ui/AppButton.vue';
import AppIcon from '@/components/ui/AppIcon.vue';

const props = defineProps({
  close: { type: Function, default: () => {} },
});

const { notifications, unreadCount, loading, markAsRead, markAllAsRead, fetchNotifications } =
  useNotifications();
const { t } = useI18n();
const { hasPermission, loadPermissions } = useAccessControl();
const router = useRouter();
const canWriteNotifications = ref(false);

const fetchList = () => {
  fetchNotifications();
};

onMounted(async () => {
  await loadPermissions();
  canWriteNotifications.value = hasPermission('notifications:write');
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
  if (item.is_read === 0 && canWriteNotifications.value) {
    await markAsRead(item.id);
  }

  if (item.link) {
    router.push(item.link);
    if (props.close) props.close();
  }
};
</script>
