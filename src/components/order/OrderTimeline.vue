<template>
  <div class="relative">
    <!-- 列表模式 (Timeline) -->
    <div v-if="mode === 'timeline'">
      <!-- 时间轴线 -->
      <div class="absolute top-2 bottom-2 left-3 w-0.5 bg-[var(--border-color)]"></div>

      <!-- 时间轴项目 -->
      <div class="space-y-4">
        <div
          v-for="item in displayedItems"
          :key="item.id"
          class="relative pl-8 print:break-inside-avoid"
        >
          <!-- ... exist item content ... -->
          <!-- 图标 -->
          <div
            class="absolute left-0 flex size-6 items-center justify-center rounded-full"
            :class="iconClasses[item.actionType]"
          >
            <svg
              v-if="item.actionType === 'created'"
              class="size-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 4v16m8-8H4"
              ></path>
            </svg>
            <svg
              v-else-if="item.actionType === 'field_updated'"
              class="size-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
              ></path>
            </svg>
            <svg
              v-else-if="item.actionType === 'status_changed'"
              class="size-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              ></path>
            </svg>
            <svg v-else class="size-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
              ></path>
            </svg>
          </div>

          <!-- 内容 -->
          <div class="rounded-lg bg-[var(--bg-muted)] p-3">
            <div class="mb-1 flex items-center justify-between">
              <span class="text-xs font-medium" :class="actorTypeColor(item.actorType)">
                {{ item.actorName }}
                <span class="text-secondary font-normal"
                  >({{
                    item.actorType === 'admin'
                      ? t('sidebar.admin')
                      : t('salesperson.title').replace('管理', '')
                  }})</span
                >
              </span>
              <span class="text-secondary text-[10px]">{{ formatTime(item.createdAt) }}</span>
            </div>

            <!-- 创建 -->
            <p v-if="item.actionType === 'created'" class="text-primary text-sm">
              {{ t('order.timeline.created') }}
            </p>

            <!-- 字段修正 (聚合) -->
            <div v-else-if="item.actionType === 'field_updated'">
              <div class="space-y-3">
                <div v-for="(update, idx) in item.updates" :key="idx" class="text-sm">
                  <p class="text-primary font-medium">
                    <span v-if="['files', 'images'].includes(update.fieldName)">{{
                      t('order.timeline.imagesUpdated')
                    }}</span>
                    <span v-else>{{
                      t('order.timeline.fieldUpdated', { field: getDisplayField(update) })
                    }}</span>
                  </p>

                  <!-- 仅当非文件更新，或文件数量发生变化时才显示对比 -->
                  <div
                    v-if="
                      !['files', 'images'].includes(update.fieldName) ||
                      update.oldValue !== update.newValue
                    "
                    class="mt-1 flex items-center gap-2 text-xs"
                  >
                    <span class="text-[var(--color-danger-text)]/60 line-through">
                      {{ getDisplayValue(update, 'oldValue') }}</span
                    >
                    <svg
                      class="text-secondary size-3"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M14 5l7 7m0 0l-7 7m7-7H3"
                      ></path>
                    </svg>
                    <span class="font-medium text-[var(--color-success-text)]">{{
                      getDisplayValue(update, 'newValue')
                    }}</span>
                  </div>

                  <!-- 个别理由 (如果有不同) -->
                  <p
                    v-if="update.reason && !getCommonReason(item.updates)"
                    class="text-secondary mt-1 text-xs"
                  >
                    {{ t('order.timeline.reason') }}: {{ getReasonText(update.reason) }}
                  </p>
                </div>
              </div>

              <!-- 公共理由 (合并显示) -->
              <div
                v-if="getCommonReason(item.updates)"
                class="mt-3 border-t border-dashed border-[var(--border-color)] pt-2"
              >
                <p class="text-secondary text-xs">
                  <span class="font-medium">{{ t('order.timeline.reason') }}:</span>
                  {{ getReasonText(getCommonReason(item.updates)) }}
                </p>
              </div>
            </div>

            <!-- 图片更新 -->
            <div v-else-if="item.actionType === 'files_updated'" class="text-sm">
              <p class="text-primary font-medium">{{ t('order.timeline.imagesUpdated') }}</p>
              <div class="mt-1 flex items-center gap-2 text-xs">
                <span class="text-[var(--color-danger-text)]/60 line-through">{{
                  formatImageCount(item.oldValue)
                }}</span>
                <svg
                  class="text-secondary size-3"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M14 5l7 7m0 0l-7 7m7-7H3"
                  ></path>
                </svg>
                <span class="font-medium text-[var(--color-success-text)]">{{
                  formatImageCount(item.newValue)
                }}</span>
              </div>
              <p v-if="item.reason" class="text-secondary mt-1 text-xs">
                {{ t('order.timeline.reason') }}: {{ getReasonText(item.reason) }}
              </p>
            </div>

            <!-- 状态变更 -->
            <p v-else-if="item.actionType === 'status_changed'" class="text-primary text-sm">
              {{ t('order.timeline.statusChanged') }}
              <StatusBadge :variant="getStatusVariant(item.newValue)" size="sm" class="ml-1">
                {{ t(`order.statuses.${item.newValue}`) }}
              </StatusBadge>
              <span v-if="item.reason" class="text-secondary mt-1 block text-xs">{{
                getReasonText(item.reason)
              }}</span>
            </p>

            <!-- 留言 -->
            <p v-else class="text-primary text-sm">{{ item.comment }}</p>
          </div>
        </div>
      </div>

      <!-- 展开/收起按钮 -->
      <div v-if="hasMore" class="mt-4 text-center">
        <button
          class="text-secondary inline-flex items-center gap-1.5 rounded-full bg-[var(--bg-muted)] px-4 py-2 text-sm transition-colors hover:text-primary hover:bg-[var(--bg-hover)]"
          @click="isExpanded = !isExpanded"
        >
          <template v-if="isExpanded">
            <svg class="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M5 15l7-7 7 7"
              ></path>
            </svg>
            {{ t('order.timeline.collapse') }}
          </template>
          <template v-else>
            <svg class="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M19 9l-7 7-7-7"
              ></path>
            </svg>
            {{ t('order.timeline.viewAll', { count: totalCount }) }}
          </template>
        </button>
      </div>

      <!-- 空状态 -->
      <div
        v-if="!groupedTimeline || groupedTimeline.length === 0"
        class="text-secondary py-8 text-center text-sm"
      >
        {{ t('common.noData') }}
      </div>
    </div>

    <!-- 表格模式 (Print / Table) -->
    <div v-else class="w-full">
      <table class="w-full border-collapse text-left text-sm">
        <thead class="text-secondary border-b border-[var(--border-color)] bg-[var(--bg-muted)] font-medium">
          <tr>
            <th class="w-32 px-3 py-2">{{ t('order.createdAt') }}</th>
            <th class="w-32 px-3 py-2">{{ t('sidebar.role') }}</th>
            <th class="px-3 py-2 pl-8">{{ t('common.actions') }}</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-[var(--border-color)]">
          <tr v-for="item in displayedItems" :key="item.id" class="break-inside-avoid">
            <td class="p-3 align-top text-xs text-gray-500">
              {{ formatTime(item.createdAt) }}
            </td>
            <td class="p-3 align-top font-medium text-gray-700">
              {{ item.actorName }}
              <div class="text-[10px] font-normal text-gray-400">
                {{
                  item.actorType === 'admin'
                    ? t('sidebar.admin')
                    : t('salesperson.title').replace('管理', '')
                }}
              </div>
            </td>
            <td class="p-3 pl-8 align-top">
              <!-- Created -->
              <div v-if="item.actionType === 'created'" class="text-gray-900">
                {{ t('order.timeline.created') }}
              </div>

              <!-- Field Updated -->
              <div v-else-if="item.actionType === 'field_updated'" class="space-y-2">
                <div v-for="(update, idx) in item.updates" :key="idx">
                  <div class="font-medium text-gray-900">
                    <span v-if="['files', 'images'].includes(update.fieldName)">{{
                      t('order.timeline.imagesUpdated')
                    }}</span>
                    <span v-else>{{
                      t('order.timeline.fieldUpdated', { field: getDisplayField(update) })
                    }}</span>
                  </div>
                  <div
                    v-if="
                      !['files', 'images'].includes(update.fieldName) ||
                      update.oldValue !== update.newValue
                    "
                    class="mt-0.5 flex items-center gap-2 text-xs"
                  >
                    <span class="text-gray-400 line-through">{{
                      getDisplayValue(update, 'oldValue')
                    }}</span>
                    <span class="text-gray-300">→</span>
                    <span class="text-gray-900">{{
                      getDisplayValue(update, 'newValue')
                    }}</span>
                  </div>
                  <div v-if="update.reason" class="mt-0.5 text-xs text-gray-500">
                    {{ t('order.timeline.reason') }}: {{ getReasonText(update.reason) }}
                  </div>
                </div>
              </div>

              <!-- Status Changed -->
              <div v-else-if="item.actionType === 'status_changed'">
                <div class="text-gray-900">
                  {{ t('order.timeline.statusChanged') }}
                  <span class="font-medium">{{ t(`order.statuses.${item.newValue}`) }}</span>
                </div>
                <div v-if="item.reason" class="mt-1 text-xs text-gray-500">{{ getReasonText(item.reason) }}</div>
              </div>

              <!-- Comment -->
              <div v-else class="text-gray-900 italic">"{{ item.comment }}"</div>
            </td>
          </tr>
        </tbody>
      </table>
      <div
        v-if="!groupedTimeline || groupedTimeline.length === 0"
        class="text-secondary border-t border-[var(--border-color)] py-4 text-center text-sm"
      >
        {{ t('common.noData') }}
      </div>
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
  maxItems: { type: Number, default: 3 },
  mode: { type: String, default: 'timeline' }, // 'timeline' | 'table'
});

const { t, locale } = useI18n();

// 简化的语言代码 (zh-CN -> zh)
const currentLang = computed(() => locale.value?.startsWith('zh') ? 'zh' : 'en');

// 获取显示字段名 (优先使用后端返回的双语)
const getDisplayField = (update) => {
  if (update.display?.field) {
    return update.display.field[currentLang.value] || update.display.field.zh;
  }
  return getFieldLabel(update.fieldName);
};

// 获取显示值 (优先使用后端返回的双语)
const getDisplayValue = (update, type) => {
  if (update.display?.[type]) {
    return update.display[type][currentLang.value] || update.display[type].zh;
  }
  return formatFieldValue(update.fieldName, update[type]);
};

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
      if (
        prev &&
        prev.actionType === 'field_updated' &&
        prev.actorId === item.actorId &&
        Math.abs(prev.createdAt - item.createdAt) < 60000
      ) {
        prev.updates.push(item);
        return;
      }

      // 开始新组
      currentGroup = {
        ...item,
        updates: [item],
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
  comment: 'bg-[var(--bg-muted)] text-secondary',
};

// 状态样式
const _statusClasses = STATUS_STYLES;

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
    sku: t('order.form.sku'),
    status: t('order.detail.status'),
    images: t('order.detail.images'),
    files: t('order.detail.images'), // 兼容后端 fieldName: 'files'
    'order.detail.status': t('order.detail.status'), // 兼容后端直接存了 key 的情况
  };
  return labels[fieldName] || fieldName;
};

// 格式化字段值 (处理图片数量等特殊显示)
const formatFieldValue = (fieldName, value) => {
  if (!value) return '-';

  // 图片数量
  if (fieldName === 'images' || fieldName === 'files') {
    const match = String(value).match(/(\d+)/);
    if (match) {
      return t('order.timeline.imageCount', { count: match[1] });
    }
  }

  // 状态值翻译
  if (['status', 'order.detail.status'].includes(fieldName)) {
    // 尝试翻译状态值
    const key = `order.statuses.${value}`;
    const translated = t(key);
    // 如果翻译结果与 key 不同，说明找到了翻译
    if (translated !== key) {
      return translated;
    }
  }

  return value;
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

// 尝试翻译理由 (处理历史数据的 Key)
const getReasonText = (reason) => {
  if (!reason) return '';
  // 如果是由于之前的 Bug 导致存入了 Key，尝试翻译它
  if (reason.startsWith('order.') || reason.includes('.reason.')) {
    return t(reason); // vue-i18n 如果找不到 key 会直接返回 key 本身，所以是安全的
  }
  return reason;
};

// 获取公共理由 (如果所有更新的理由相同)
const getCommonReason = (updates) => {
  if (!updates || updates.length === 0) return null;
  const firstReason = updates[0].reason;
  if (!firstReason) return null;
  
  // 检查是否所有理由都相同
  return updates.every((u) => u.reason === firstReason) ? firstReason : null;
};

</script>
