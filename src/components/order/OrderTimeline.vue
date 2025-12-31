<template>
  <div class="relative">
    <!-- 时间轴线 -->
    <div class="absolute left-3 top-2 bottom-2 w-0.5 bg-[var(--border-color)]"></div>

    <!-- 时间轴项目 -->
    <div class="space-y-4">
      <div 
        v-for="item in displayedItems" 
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

          <!-- 字段修正 (聚合) -->
          <div v-else-if="item.actionType === 'field_updated'" class="space-y-3">
            <div v-for="(update, idx) in item.updates" :key="idx" class="text-sm">
              <p class="text-primary font-medium">
                <span v-if="['files', 'images'].includes(update.fieldName)">{{ t('order.timeline.imagesUpdated') }}</span>
                <span v-else>{{ t('order.timeline.fieldUpdated', { field: getFieldLabel(update.fieldName) }) }}</span>
              </p>
              
              <!-- 仅当非文件更新，或文件数量发生变化时才显示对比 -->
              <div 
                v-if="!['files', 'images'].includes(update.fieldName) || update.oldValue !== update.newValue"
                class="flex items-center gap-2 mt-1 text-xs"
              >
                <span class="line-through text-[var(--color-danger-text)]/60"> {{ formatFieldValue(update.fieldName, update.oldValue) }}</span>
                <svg class="w-3 h-3 text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path>
                </svg>
                <span class="text-[var(--color-success-text)] font-medium">{{ formatFieldValue(update.fieldName, update.newValue) }}</span>
              </div>
              
              <p v-if="update.reason" class="text-xs text-secondary mt-1">
                {{ t('order.timeline.reason') }}: {{ update.reason }}
              </p>
            </div>
          </div>

          <!-- 图片更新 -->
          <div v-else-if="item.actionType === 'files_updated'" class="text-sm">
            <p class="text-primary font-medium">{{ t('order.timeline.imagesUpdated') }}</p>
            <div class="flex items-center gap-2 mt-1 text-xs">
              <span class="line-through text-[var(--color-danger-text)]/60">{{ formatImageCount(item.oldValue) }}</span>
              <svg class="w-3 h-3 text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path>
              </svg>
              <span class="text-[var(--color-success-text)] font-medium">{{ formatImageCount(item.newValue) }}</span>
            </div>
            <p v-if="item.reason" class="text-xs text-secondary mt-1">
              {{ t('order.timeline.reason') }}: {{ item.reason }}
            </p>
          </div>

          <!-- 状态变更 -->
          <p v-else-if="item.actionType === 'status_changed'" class="text-sm text-primary">
            {{ t('order.timeline.statusChanged') }}
            <StatusBadge :variant="getStatusVariant(item.newValue)" size="sm" class="ml-1">
              {{ t(`order.statuses.${item.newValue}`) }}
            </StatusBadge>
            <span v-if="item.reason" class="text-secondary text-xs block mt-1">{{ item.reason }}</span>
          </p>

          <!-- 留言 -->
          <p v-else class="text-sm text-primary">{{ item.comment }}</p>
        </div>
      </div>
    </div>

    <!-- 展开/收起按钮 -->
    <div v-if="hasMore" class="mt-4 text-center">
      <button 
        @click="isExpanded = !isExpanded"
        class="inline-flex items-center gap-1.5 px-4 py-2 text-sm text-secondary hover:text-primary bg-[var(--bg-muted)] hover:bg-[var(--bg-hover)] rounded-full transition-colors"
      >
        <template v-if="isExpanded">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7"></path>
          </svg>
          {{ t('order.timeline.collapse') }}
        </template>
        <template v-else>
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
          </svg>
          {{ t('order.timeline.viewAll', { count: totalCount }) }}
        </template>
      </button>
    </div>

    <!-- 空状态 -->
    <div v-if="!groupedTimeline || groupedTimeline.length === 0" class="text-center py-8 text-secondary text-sm">
      {{ t('common.noData') }}
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { STATUS_STYLES, getStatusVariant } from '@/utils/status';
import { formatTimelineTime } from '@/utils/formatters';
import StatusBadge from '@/components/ui/StatusBadge.vue';

const props = defineProps({
  timeline: { type: Array, default: () => [] },
  maxItems: { type: Number, default: 3 }
});

const { t } = useI18n();

const isExpanded = ref(false);

// 聚合时间线数据
const groupedTimeline = computed(() => {
  if (!props.timeline?.length) return [];
  
  const groups = [];
  let currentGroup = null;

  props.timeline.forEach((item) => {
    // 只有 field_updated 才合并
    if (item.actionType === 'field_updated') {
      const prev = currentGroup;
      // 检查是否可以合并到上一组 (相同操作人，相同类型，1分钟内)
      if (prev && 
          prev.actionType === 'field_updated' && 
          prev.actorId === item.actorId &&
          Math.abs(prev.createdAt - item.createdAt) < 60000) { 
        prev.updates.push(item);
        return;
      }
      
      // 开始新组
      currentGroup = {
        ...item,
        updates: [item]
      };
      groups.push(currentGroup);
    } else {
      // 非合并项，直接添加
      currentGroup = { ...item };
      groups.push(currentGroup); // 更新 currentGroup 为最近一项
    }
  });
  
  return groups;
});

// 总条目数
const totalCount = computed(() => groupedTimeline.value.length);

// 是否有更多条目
const hasMore = computed(() => totalCount.value > props.maxItems);

// 显示的条目
const displayedItems = computed(() => {
  if (isExpanded.value || !hasMore.value) {
    return groupedTimeline.value;
  }
  return groupedTimeline.value.slice(0, props.maxItems);
});

// 图标样式
const iconClasses = {
  created: 'bg-[var(--color-info-bg)] text-[var(--color-info-text)]',
  field_updated: 'bg-[var(--color-warning-bg)] text-[var(--color-warning-text)]',
  status_changed: 'bg-[var(--color-success-bg)] text-[var(--color-success-text)]',
  comment: 'bg-[var(--bg-muted)] text-secondary'
};

// 状态样式
const statusClasses = STATUS_STYLES;

// 操作人颜色
const actorTypeColor = (type) => {
  return type === 'admin' ? 'text-[var(--color-info-text)]' : 'text-primary';
};

// 获取字段标签
const getFieldLabel = (fieldName) => {
  const labels = {
    name: t('order.form.productName'),
    size: t('order.form.size'),
    color: t('order.form.color'),
    material: t('order.form.material'),
    remark: t('order.form.remark'),
    deadline: t('order.form.expectedArrival'),
    brand: t('order.form.brand'),
    series: t('order.form.series'),
    images: t('order.detail.images'),
    files: t('order.detail.images') // 兼容后端 fieldName: 'files'
  };
  return labels[fieldName] || fieldName;
};

// 格式化字段值 (处理图片数量等特殊显示)
const formatFieldValue = (fieldName, value) => {
  if ((fieldName === 'images' || fieldName === 'files') && value) {
    const match = value.match(/(\d+)/);
    if (match) {
      return t('order.timeline.imageCount', { count: match[1] });
    }
  }
  return value || '-';
};

// 格式化图片数量
const formatImageCount = (value) => {
  if (!value) return '-';
  const match = value.match(/(\d+)/);
  if (match) {
    return t('order.timeline.imageCount', { count: match[1] });
  }
  return value;
};

// 格式化时间
const formatTime = (timestamp) => formatTimelineTime(timestamp);
</script>

