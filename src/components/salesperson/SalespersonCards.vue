<template>
  <div>
    <!-- 加载骨架屏 -->
    <template v-if="loading">
      <div class="grid grid-cols-2 gap-3">
        <div v-for="i in 4" :key="i" class="animate-pulse rounded-xl bg-(--bg-muted) p-3">
          <div class="mx-auto mb-2 size-10 rounded-full bg-(--border-color) opacity-50"></div>
          <div class="mx-auto mb-1 h-4 w-16 rounded bg-(--border-color) opacity-50"></div>
          <div class="mx-auto h-3 w-12 rounded bg-(--border-color) opacity-50"></div>
        </div>
      </div>
    </template>

    <!-- 销售卡片网格 -->
    <template v-else-if="data.length > 0">
      <div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <AppCard
          v-for="person in data"
          :key="person.id"
          clickable
          padding="p-0"
          :class="['group relative overflow-hidden', cardClass(person)]"
          @click="$emit('view-detail', person)"
        >
          <!-- 状态标签 (Top Right) -->
          <div class="absolute top-3 right-3 z-10">
            <StatusBadge :variant="person.isActive ? 'success' : 'default'" size="xs">
              {{ person.isActive ? t('salesperson.active') : t('salesperson.disabled') }}
            </StatusBadge>
          </div>

          <!-- 卡片主体 -->
          <div class="p-4 text-center">
            <!-- 头像 -->
            <div
              class="from-primary mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-gradient-to-br to-(--color-primary-hover) text-lg font-semibold text-(--text-inverse) shadow-inner transition-transform group-hover:scale-110"
            >
              {{ person.name?.charAt(0) || '?' }}
            </div>
            <!-- 姓名 -->
            <div class="truncate text-sm font-bold text-(--text-main)" :title="person.name || '-'">
              {{ person.name || '-' }}
            </div>
            <!-- 门店 -->
            <div
              class="mt-0.5 truncate text-xs text-(--text-secondary)"
              :title="person.store || '-'"
            >
              {{ person.store || '-' }}
            </div>
            <!-- 订单数 (可点击跳转) -->
            <div class="mt-4 flex justify-center">
              <AppButton
                v-if="person.orderCount > 0"
                variant="link"
                size="sm"
                class="!h-auto !gap-1 !px-0 text-(--text-secondary)"
                @click.stop="$emit('view-orders', person)"
              >
                <template #icon-left>
                  <span class="text-secondary text-xs">{{ t('salesperson.table.orders') }}:</span>
                </template>
                <StatusBadge variant="info" size="xs">{{ person.orderCount }}</StatusBadge>
              </AppButton>
              <div v-else class="flex items-center justify-center gap-1">
                <span class="text-secondary text-xs">{{ t('salesperson.table.orders') }}:</span>
                <StatusBadge variant="default" size="xs">{{ person.orderCount }}</StatusBadge>
              </div>
            </div>
          </div>

          <template #footer>
            <div class="flex items-center justify-center gap-4">
              <!-- 复制链接 -->
              <AppButton
                variant="ghost"
                size="sm"
                class="!h-9 !w-9 !px-0 hover:text-primary"
                :title="t('salesperson.copyLink')"
                @click.stop="$emit('copy', person.accessToken)"
              >
                <template #icon-left>
                  <AppIcon name="clipboard" class="size-5" />
                </template>
              </AppButton>
              <!-- 编辑 -->
              <AppButton
                v-if="canManage"
                variant="ghost"
                size="sm"
                class="!h-9 !w-9 !px-0 hover:bg-(--color-info-bg) hover:text-(--color-info-text)"
                :title="t('salesperson.edit')"
                @click.stop="$emit('edit', person)"
              >
                <template #icon-left>
                  <AppIcon name="pencil-alt" class="size-5" />
                </template>
              </AppButton>
              <!-- 删除 -->
              <AppButton
                v-if="canManage"
                variant="ghost"
                size="sm"
                class="!h-9 !w-9 !px-0 hover:bg-(--color-danger-bg) hover:text-(--color-danger-text)"
                :title="t('common.delete')"
                :disabled="person.orderCount > 0"
                @click.stop="$emit('delete', person)"
              >
                <template #icon-left>
                  <AppIcon name="trash" class="size-5" />
                </template>
              </AppButton>
            </div>
          </template>
        </AppCard>
      </div>
    </template>

    <!-- 空状态 -->
    <EmptyState v-else icon="user" :title="t('salesperson.emptyList')" />
  </div>
</template>

<script setup>
import { useI18n } from '@/composables/useI18n';
import AppButton from '@/components/ui/AppButton.vue';
import AppCard from '@/components/ui/AppCard.vue';
import StatusBadge from '@/components/ui/StatusBadge.vue';
import AppIcon from '@/components/ui/AppIcon.vue';
import EmptyState from '@/components/ui/EmptyState.vue';

defineProps({
  data: {
    type: Array,
    required: true,
  },
  loading: {
    type: Boolean,
    default: false,
  },
  cardClass: {
    type: Function,
    default: () => '',
  },
  canManage: {
    type: Boolean,
    default: false,
  },
});

defineEmits(['edit', 'delete', 'copy', 'view-orders', 'view-detail']);

const { t } = useI18n();
</script>
