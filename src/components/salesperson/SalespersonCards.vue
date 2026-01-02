<template>
  <div>
    <!-- 加载骨架屏 -->
    <template v-if="loading">
      <div class="grid grid-cols-2 gap-3">
        <div v-for="i in 4" :key="i" class="bg-[var(--bg-muted)] rounded-xl p-3 animate-pulse">
          <div class="w-10 h-10 bg-[var(--border-color)] rounded-full mx-auto mb-2 opacity-50"></div>
          <div class="h-4 bg-[var(--border-color)] rounded w-16 mx-auto mb-1 opacity-50"></div>
          <div class="h-3 bg-[var(--border-color)] rounded w-12 mx-auto opacity-50"></div>
        </div>
      </div>
    </template>

    <!-- 销售卡片网格 -->
    <template v-else-if="data.length > 0">
      <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div 
          v-for="person in data" 
          :key="person.id"
          class="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl overflow-hidden hover:shadow-lg transition-all duration-300 hover:-translate-y-1 group"
        >
          <!-- 卡片主体 -->
          <div class="p-4 text-center">
            <!-- 头像 -->
            <div class="w-12 h-12 rounded-full bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-hover)] flex items-center justify-center text-white font-semibold text-lg mx-auto mb-3 shadow-inner shadow-black/5 group-hover:scale-110 transition-transform">
              {{ person.name?.charAt(0) || '?' }}
            </div>
            <!-- 姓名 -->
            <div class="font-bold text-[var(--text-main)] text-sm truncate">{{ person.name }}</div>
            <!-- 门店 -->
            <div class="text-xs text-[var(--text-secondary)] truncate mt-0.5">{{ person.store || '-' }}</div>
            <!-- 订单数 -->
            <div class="mt-2 flex items-center justify-center gap-1">
              <span class="text-xs text-secondary">{{ t('salesperson.table.orders') }}:</span>
              <StatusBadge variant="info" size="xs">{{ person.orderCount }}</StatusBadge>
            </div>
            <!-- 状态标签 -->
            <div class="mt-2">
              <StatusBadge :variant="person.isActive ? 'success' : 'default'" size="sm">
                {{ person.isActive ? t('salesperson.active') : t('salesperson.disabled') }}
              </StatusBadge>
            </div>
          </div>
          
          <!-- 图标操作栏 -->
          <div class="border-t border-[var(--border-color)] px-2 py-2.5 flex items-center justify-center gap-4 bg-[var(--bg-muted)]/50">
            <!-- 复制链接 -->
            <button 
              @click="$emit('copy', person.accessToken)"
              class="p-2 rounded-xl text-[var(--text-secondary)] hover:text-[var(--color-primary)] hover:bg-[var(--color-primary)]/5 transition-all active:scale-90"
              :title="t('salesperson.copyLink')"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
              </svg>
            </button>
            <!-- 编辑 -->
            <button 
              @click="$emit('edit', person)"
              class="p-2 rounded-xl text-[var(--text-secondary)] hover:text-[var(--color-info-text)] hover:bg-[var(--color-info-bg)] transition-all active:scale-90"
              :title="t('salesperson.edit')"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
              </svg>
            </button>
            <!-- 删除 -->
            <button 
              @click="$emit('delete', person)"
              class="p-2 rounded-xl text-[var(--text-secondary)] hover:text-[var(--color-danger-text)] hover:bg-[var(--color-danger-bg)] transition-all active:scale-90 disabled:opacity-30 disabled:cursor-not-allowed"
              :title="t('common.delete')"
              :disabled="person.orderCount > 0"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
              </svg>
            </button>
          </div>
        </div>
      </div>
    </template>

    <!-- 空状态 -->
    <EmptyState 
      v-else
      icon="user" 
      :title="t('salesperson.emptyList')"
    />
  </div>
</template>

<script setup>
import { useI18n } from '@/composables/useI18n';
import StatusBadge from '@/components/ui/StatusBadge.vue';
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

defineEmits(['edit', 'delete', 'copy']);

const { t } = useI18n();
</script>
