<template>
  <div class="space-y-3">
    <!-- 加载骨架屏 -->
    <template v-if="loading">
      <div v-for="i in 3" :key="i" class="bg-gray-50 rounded-xl p-4 animate-pulse">
        <div class="flex items-start gap-3">
          <div class="w-10 h-10 bg-gray-200 rounded-full flex-shrink-0"></div>
          <div class="flex-1 space-y-2">
            <div class="h-4 bg-gray-200 rounded w-24"></div>
            <div class="h-3 bg-gray-200 rounded w-32"></div>
          </div>
        </div>
      </div>
    </template>

    <!-- 销售卡片 -->
    <template v-else-if="data.length > 0">
      <div 
        v-for="person in data" 
        :key="person.id"
        class="bg-gray-50 rounded-xl overflow-hidden"
      >
        <div class="p-4">
          <div class="flex items-start justify-between">
            <!-- 头像和姓名 -->
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-full bg-gradient-to-br from-gray-700 to-gray-900 flex items-center justify-center text-white font-semibold text-sm">
                {{ person.name?.charAt(0) || '?' }}
              </div>
              <div>
                <div class="font-medium text-gray-900">{{ person.name }}</div>
                <div class="text-xs text-gray-500">{{ person.store || '-' }}</div>
              </div>
            </div>
            <!-- 状态 -->
            <StatusBadge :variant="person.isActive ? 'success' : 'default'">
              {{ person.isActive ? t('salesperson.active') : t('salesperson.disabled') }}
            </StatusBadge>
          </div>
          
          <!-- 详情 -->
          <div class="mt-3 grid grid-cols-2 gap-2 text-sm">
            <div>
              <span class="text-gray-500">{{ t('salesperson.phone') }}:</span>
              <span class="ml-1 text-gray-900">{{ person.phone || '-' }}</span>
            </div>
            <div>
              <span class="text-gray-500">{{ t('salesperson.orderCount') }}:</span>
              <StatusBadge variant="info" size="xs" class="ml-1">{{ person.orderCount }}</StatusBadge>
            </div>
          </div>
        </div>
        
        <!-- 操作栏 -->
        <div class="border-t border-gray-200 px-4 py-2.5 flex items-center justify-end gap-3 bg-white">
          <button 
            @click="$emit('copy', person.accessToken)"
            class="flex items-center gap-1.5 text-xs text-gray-600 hover:text-primary"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
            </svg>
            {{ t('salesperson.copyLink') }}
          </button>
          <button 
            @click="$emit('edit', person)"
            class="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
            </svg>
            {{ t('salesperson.edit') }}
          </button>
          <button 
            @click="$emit('delete', person)"
            class="flex items-center gap-1.5 text-xs text-red-600 hover:text-red-700"
            :disabled="person.orderCount > 0"
            :class="{ 'opacity-50 cursor-not-allowed': person.orderCount > 0 }"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
            </svg>
            {{ t('common.delete') }}
          </button>
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
