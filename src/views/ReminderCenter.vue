<template>
  <ManagementListShell
    :title="t('reminders.title', '提醒中心')"
    :description="t('reminders.description', '集中处理待跟进、待确认和系统提醒事项。')"
  >
    <div v-if="isPermissionDenied" class="flex flex-1 items-center justify-center py-12">
      <PermissionDeniedState
        :title="t('reminders.permissionTitle', '提醒中心权限不足')"
        :description="
          permissionReason ||
          t('reminders.permissionDesc', '当前账号没有 notifications:read 权限。')
        "
        required-permission="notifications:read"
      />
    </div>

    <div v-else class="space-y-4">
      <div
        class="flex flex-col gap-3 rounded-2xl border border-(--border-color) bg-(--bg-card) p-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <div class="flex items-center gap-3">
          <StatusBadge variant="warning">
            {{ unreadCountValue }}
          </StatusBadge>
          <div>
            <div class="text-sm font-medium text-(--text-main)">
              {{ t('reminders.unreadCount', '未处理提醒') }}
            </div>
            <div class="text-xs text-(--text-secondary)">
              {{ t('reminders.unreadHint', '已读表示当前提醒已被查看，不会改写原业务事实。') }}
            </div>
          </div>
        </div>
        <div class="flex gap-2">
          <AppButton
            variant="secondary"
            size="md"
            :text="t('common.refresh')"
            :disabled="isLoading"
            @click="fetchNotifications"
          />
          <AppButton
            variant="primary"
            size="md"
            :text="t('reminders.markAllRead', '全部标记已读')"
            :disabled="isLoading || unreadCountValue <= 0"
            @click="markAllAsRead"
          />
        </div>
      </div>

      <div v-if="notificationsList.length === 0 && !isLoading">
        <EmptyState
          :title="t('reminders.emptyTitle', '当前没有待处理提醒')"
          :description="t('reminders.emptyDesc', '新的订单、通知或异常事件会在这里集中展示。')"
        />
      </div>

      <div v-else class="space-y-3">
        <article
          v-for="notification in notificationsList"
          :key="notification.id"
          class="rounded-2xl border border-(--border-color) bg-(--bg-card) p-4"
        >
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-2">
                <StatusBadge :variant="notification.is_read ? 'neutral' : 'warning'">
                  {{ notification.is_read ? t('common.read', '已读') : t('common.unread', '未读') }}
                </StatusBadge>
                <h2 class="truncate text-sm font-semibold text-(--text-main)">
                  {{ notification.title || t('reminders.untitled', '未命名提醒') }}
                </h2>
              </div>
              <p class="mt-2 text-sm text-(--text-secondary)">
                {{ notification.content || t('reminders.noContent', '暂无补充说明') }}
              </p>
              <div class="mt-3 text-xs text-(--text-muted)">
                {{ formatDate(notification.created_at, { hour12: false }) }}
              </div>
            </div>
            <AppButton
              v-if="!notification.is_read"
              :data-testid="`mark-read-${notification.id}`"
              variant="secondary"
              size="md"
              :text="t('reminders.markRead', '标记已读')"
              @click="markAsRead(notification.id)"
            />
          </div>
        </article>
      </div>
    </div>
  </ManagementListShell>
</template>

<script setup>
import { computed, onMounted, unref } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { useNotifications } from '@/composables/useNotifications';
import AppButton from '@/components/ui/AppButton.vue';
import StatusBadge from '@/components/ui/StatusBadge.vue';
import EmptyState from '@/components/ui/EmptyState.vue';
import PermissionDeniedState from '@/components/ui/PermissionDeniedState.vue';
import ManagementListShell from '@/design-system/patterns/ManagementListShell.vue';
import { formatDate } from '@/utils/formatters';

const { t } = useI18n();
const {
  notifications,
  unreadCount,
  loading,
  permissionDenied,
  permissionDeniedReason,
  fetchNotifications,
  markAsRead,
  markAllAsRead,
  setAdminMode,
} = useNotifications();

const notificationsList = computed(() => unref(notifications) || []);
const unreadCountValue = computed(() => Number(unref(unreadCount) || 0));
const isLoading = computed(() => Boolean(unref(loading)));
const isPermissionDenied = computed(() => Boolean(unref(permissionDenied)));
const permissionReason = computed(() => String(unref(permissionDeniedReason) || ''));

onMounted(() => {
  setAdminMode();
  fetchNotifications();
});
</script>
