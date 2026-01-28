<template>
  <div>
    <!-- 加载骨架屏 -->
    <template v-if="loading">
      <div class="grid grid-cols-2 gap-3">
        <div v-for="i in 4" :key="i" class="animate-pulse rounded-xl bg-[var(--bg-muted)] p-3">
          <div class="mx-auto mb-2 size-10 rounded-full bg-[var(--border-color)] opacity-50"></div>
          <div class="mx-auto mb-1 h-4 w-16 rounded bg-[var(--border-color)] opacity-50"></div>
          <div class="mx-auto h-3 w-12 rounded bg-[var(--border-color)] opacity-50"></div>
        </div>
      </div>
    </template>

    <!-- 销售卡片网格 -->
    <template v-else-if="data.length > 0">
      <div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div
          v-for="person in data"
          :key="person.id"
          class="group overflow-hidden rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
        >
          <!-- 卡片主体 -->
          <div class="p-4 text-center">
            <!-- 头像 -->
            <div
              class="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-hover)] text-lg font-semibold text-white shadow-inner shadow-black/5 transition-transform group-hover:scale-110"
            >
              {{ person.name?.charAt(0) || '?' }}
            </div>
            <!-- 姓名 -->
            <div class="truncate text-sm font-bold text-[var(--text-main)]">{{ person.name }}</div>
            <!-- 门店 -->
            <div class="mt-0.5 truncate text-xs text-[var(--text-secondary)]">
              {{ person.store || '-' }}
            </div>
            <!-- 订单数 (可点击跳转) -->
            <button
              v-if="person.orderCount > 0"
              class="mt-2 flex items-center justify-center gap-1"
              @click="$emit('view-orders', person)"
            >
              <span class="text-secondary text-xs">{{ t('salesperson.table.orders') }}:</span>
              <StatusBadge variant="info" size="xs">{{ person.orderCount }}</StatusBadge>
            </button>
            <div v-else class="mt-2 flex items-center justify-center gap-1">
              <span class="text-secondary text-xs">{{ t('salesperson.table.orders') }}:</span>
              <StatusBadge variant="default" size="xs">{{ person.orderCount }}</StatusBadge>
            </div>
            <!-- 状态标签 -->
            <div class="mt-2">
              <StatusBadge :variant="person.isActive ? 'success' : 'default'" size="sm">
                {{ person.isActive ? t('salesperson.active') : t('salesperson.disabled') }}
              </StatusBadge>
            </div>
          </div>

          <!-- 图标操作栏 -->
          <div
            class="flex items-center justify-center gap-4 border-t border-[var(--border-color)] bg-[var(--bg-muted)]/50 px-2 py-2.5"
          >
            <!-- 复制链接 -->
            <button
              class="rounded-xl p-2 text-[var(--text-secondary)] transition-all hover:bg-[var(--color-primary)]/5 hover:text-[var(--color-primary)] active:scale-90"
              :title="t('salesperson.copyLink')"
              @click="$emit('copy', person.accessToken)"
            >
              <svg class="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                ></path>
              </svg>
            </button>
            <!-- 编辑 -->
            <button
              class="rounded-xl p-2 text-[var(--text-secondary)] transition-all hover:bg-[var(--color-info-bg)] hover:text-[var(--color-info-text)] active:scale-90"
              :title="t('salesperson.edit')"
              @click="$emit('edit', person)"
            >
              <svg class="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                ></path>
              </svg>
            </button>
            <!-- 删除 -->
            <button
              class="rounded-xl p-2 text-[var(--text-secondary)] transition-all hover:bg-[var(--color-danger-bg)] hover:text-[var(--color-danger-text)] active:scale-90 disabled:cursor-not-allowed disabled:opacity-30"
              :title="t('common.delete')"
              :disabled="person.orderCount > 0"
              @click="$emit('delete', person)"
            >
              <svg class="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                ></path>
              </svg>
            </button>
          </div>
        </div>
      </div>
    </template>

    <!-- 空状态 -->
    <EmptyState v-else icon="user" :title="t('salesperson.emptyList')" />
  </div>
</template>

<script setup>
import { useI18n } from '@/composables/useI18n';
import StatusBadge from '@/components/ui/StatusBadge.vue';
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
});

defineEmits(['edit', 'delete', 'copy', 'view-orders']);

const { t } = useI18n();
</script>
