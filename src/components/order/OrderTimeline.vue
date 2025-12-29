<template>
  <div class="relative">
    <!-- 时间轴线 -->
    <div class="absolute left-3 top-2 bottom-2 w-0.5 bg-gray-200"></div>

    <!-- 时间轴项目 -->
    <div class="space-y-4">
      <div 
        v-for="item in timeline" 
        :key="item.id"
        class="relative pl-8"
      >
        <!-- 图标 -->
        <div 
          class="absolute left-0 w-6 h-6 rounded-full flex items-center justify-center"
          :class="iconClasses[item.actionType]"
        >
          <svg v-if="item.actionType === 'created'" class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
          </svg>
          <svg v-else-if="item.actionType === 'field_updated'" class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
          </svg>
          <svg v-else-if="item.actionType === 'status_changed'" class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
          <svg v-else class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path>
          </svg>
        </div>

        <!-- 内容 -->
        <div class="bg-[var(--bg-muted)] rounded-lg p-3">
          <div class="flex items-center justify-between mb-1">
            <span class="text-xs font-medium" :class="actorTypeColor(item.actorType)">
              {{ item.actorName }}
              <span class="text-secondary font-normal">({{ item.actorType === 'admin' ? t('sidebar.admin') : t('salesperson.title').replace('管理', '') }})</span>
            </span>
            <span class="text-[10px] text-secondary">{{ formatTime(item.createdAt) }}</span>
          </div>

          <!-- 创建 -->
          <p v-if="item.actionType === 'created'" class="text-sm text-primary">
            {{ t('order.timeline.created') }}
          </p>

          <!-- 字段修正 -->
          <div v-else-if="item.actionType === 'field_updated'" class="text-sm">
            <p class="text-primary">
              {{ t('order.timeline.fieldUpdated', { field: getFieldLabel(item.fieldName) }) }}
            </p>
            <div class="flex items-center gap-2 mt-1 text-xs">
              <span class="line-through text-red-400">{{ item.oldValue }}</span>
              <svg class="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path>
              </svg>
              <span class="text-green-600 font-medium">{{ item.newValue }}</span>
            </div>
            <p v-if="item.reason" class="text-xs text-secondary mt-1">
              {{ t('order.timeline.reason') }}: {{ item.reason }}
            </p>
          </div>

          <!-- 状态变更 -->
          <p v-else-if="item.actionType === 'status_changed'" class="text-sm text-primary">
            {{ t('order.timeline.statusChanged') }}
            <span 
              class="inline-flex items-center px-1.5 py-0.5 text-xs font-medium rounded ml-1"
              :class="statusClasses[item.newValue] || 'bg-gray-100 text-gray-600'"
            >
              {{ t(`order.statuses.${item.newValue}`) }}
            </span>
            <span v-if="item.reason" class="text-secondary text-xs block mt-1">{{ item.reason }}</span>
          </p>

          <!-- 留言 -->
          <p v-else class="text-sm text-primary">{{ item.comment }}</p>
        </div>
      </div>
    </div>

    <!-- 空状态 -->
    <div v-if="!timeline || timeline.length === 0" class="text-center py-8 text-secondary text-sm">
      {{ t('common.noData') }}
    </div>
  </div>
</template>

<script setup>
import { useI18n } from '@/composables/useI18n';

const props = defineProps({
  timeline: { type: Array, default: () => [] }
});

const { t } = useI18n();

// 图标样式
const iconClasses = {
  created: 'bg-blue-100 text-blue-600',
  field_updated: 'bg-orange-100 text-orange-600',
  status_changed: 'bg-green-100 text-green-600',
  comment: 'bg-gray-100 text-gray-600'
};

// 状态样式
const statusClasses = {
  pending: 'bg-yellow-50 text-yellow-700',
  confirmed: 'bg-blue-50 text-blue-700',
  rejected: 'bg-red-50 text-red-700',
  production: 'bg-purple-50 text-purple-700',
  shipping: 'bg-cyan-50 text-cyan-700',
  arrived: 'bg-green-50 text-green-700',
  delivered: 'bg-gray-100 text-gray-600'
};

// 操作人颜色
const actorTypeColor = (type) => {
  return type === 'admin' ? 'text-blue-600' : 'text-primary';
};

// 获取字段标签
const getFieldLabel = (fieldName) => {
  const labels = {
    name: t('order.form.productName'),
    size: t('order.form.size'),
    color: t('order.form.color'),
    material: t('order.form.material'),
    remark: t('order.form.remark')
  };
  return labels[fieldName] || fieldName;
};

// 格式化时间
const formatTime = (timestamp) => {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  
  if (isToday) {
    return `${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
  }
  return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
};
</script>
