<template>
  <table class="w-full text-sm text-left">
    <thead class="bg-gray-50 text-gray-500 font-medium">
      <tr>
        <th class="px-4 py-3">{{ t('salesperson.name') }}</th>
        <th class="px-4 py-3">{{ t('salesperson.store') }}</th>
        <th class="px-4 py-3">{{ t('salesperson.phone') }}</th>
        <th class="px-4 py-3">{{ t('salesperson.orderCount') }}</th>
        <th class="px-4 py-3 text-center">{{ t('salesperson.status') }}</th>
        <th class="px-4 py-3 text-right">{{ t('common.actions') }}</th>
      </tr>
    </thead>
    <tbody class="divide-y divide-gray-200">
      <!-- 加载骨架屏 -->
      <template v-if="loading">
        <tr v-for="i in 3" :key="i" class="animate-pulse">
          <td v-for="j in 6" :key="j" class="px-4 py-4">
            <div class="h-4 bg-gray-200 rounded w-2/3"></div>
          </td>
        </tr>
      </template>
      
      <!-- 数据行 -->
      <template v-else-if="data.length > 0">
        <tr v-for="person in data" :key="person.id" class="hover:bg-gray-50 transition-colors">
          <td class="px-4 py-3">
            <div class="font-medium text-gray-900">{{ person.name }}</div>
          </td>
          <td class="px-4 py-3 text-gray-600">{{ person.store || '-' }}</td>
          <td class="px-4 py-3 text-gray-600">{{ person.phone || '-' }}</td>
          <td class="px-4 py-3">
            <StatusBadge variant="info">{{ person.orderCount }}</StatusBadge>
          </td>
          <td class="px-4 py-3 text-center">
            <StatusBadge :variant="person.isActive ? 'success' : 'default'">
              {{ person.isActive ? t('salesperson.active') : t('salesperson.disabled') }}
            </StatusBadge>
          </td>
          <td class="px-4 py-3 text-right">
            <div class="flex items-center justify-end gap-2">
              <button 
                @click="$emit('copy', person.accessToken)"
                class="p-1.5 text-gray-500 hover:text-primary hover:bg-gray-100 rounded-lg transition-colors"
                :title="t('salesperson.copyLink')"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
                </svg>
              </button>
              <button 
                @click="$emit('edit', person)"
                class="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                :title="t('salesperson.edit')"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
                </svg>
              </button>
              <button 
                @click="$emit('delete', person)"
                class="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                :title="t('common.delete')"
                :disabled="person.orderCount > 0"
                :class="{ 'opacity-50 cursor-not-allowed': person.orderCount > 0 }"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                </svg>
              </button>
            </div>
          </td>
        </tr>
      </template>

      <!-- 空状态 -->
      <tr v-else>
        <td colspan="6" class="px-4 py-12 text-center">
          <EmptyState 
            icon="user" 
            :title="t('salesperson.emptyList')"
          />
        </td>
      </tr>
    </tbody>
  </table>
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
