<template>
  <div class="relative">
    <!-- 列表模式 (Timeline) -->
    <div v-if="mode === 'timeline'">
      <!-- 时间轴线 -->
      <div class="bg-(--border-color) absolute top-2 bottom-2 left-3 w-0.5"></div>

      <!-- 时间轴项目 -->
      <div class="space-y-4">
        <div
          v-for="item in displayedItems"
          :key="item.id"
          class="relative pl-8 print:break-inside-avoid"
        >
          <!-- 图标 -->
          <div
            class="absolute left-0 flex size-6 items-center justify-center rounded-full"
            :class="iconClasses[item.actionType]"
          >
            <AppIcon
              v-if="item.actionType === 'created'"
              name="plus"
              class="size-3"
            />
            <AppIcon
              v-else-if="item.actionType === 'field_updated'"
              name="pencil-alt"
              class="size-3"
            />
            <AppIcon
              v-else-if="item.actionType === 'status_changed'"
              name="check-circle"
              class="size-3"
            />
            <AppIcon v-else name="chat-bubble-dots" class="size-3" />
          </div>

          <!-- 内容 -->
          <div class="bg-(--bg-muted) rounded-lg p-3">
            <div class="mb-1 flex items-center justify-between">
              <span class="text-xs font-medium" :class="actorTypeColor(item.actorType)">
                {{ item.actorName }}
                <span class="text-(--text-secondary) font-normal"
                  >({{
                    item.actorType === 'admin'
                      ? t('sidebar.admin')
                      : t('salesperson.title').replace('管理', '')
                  }})</span
                >
              </span>
              <span class="text-(--text-secondary) text-[10px]">{{ formatTime(item.createdAt) }}</span>
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
                    class="mt-1 flex items-start gap-2 text-xs"
                  >
                    <span class="text-danger/60 min-w-0 flex-1 line-through break-words">
                      {{ getDisplayValue(update, 'oldValue') }}</span>
                    <AppIcon
                      name="arrow-right"
                      class="text-(--text-secondary) mt-0.5 size-3 shrink-0"
                    />
                    <span class="text-success min-w-0 flex-1 font-medium break-words">{{
                      getDisplayValue(update, 'newValue')
                    }}</span>
                  </div>

                  <!-- 个别理由 (如果有不同) -->
                  <p
                    v-if="update.reason && !getCommonReason(item.updates)"
                    class="text-(--text-secondary) mt-1 text-xs whitespace-pre-wrap break-words"
                  >
                    {{ t('order.timeline.reason') }}: {{ getReasonText(update.reason) }}
                  </p>
                </div>
              </div>

              <!-- 公共理由 (合并显示) -->
              <div
                v-if="getCommonReason(item.updates)"
                class="border-(--border-color) mt-3 border-t border-dashed pt-2"
              >
                <p class="text-(--text-secondary) text-xs whitespace-pre-wrap break-words">
                  <span class="font-medium">{{ t('order.timeline.reason') }}:</span>
                  {{ getReasonText(getCommonReason(item.updates)) }}
                </p>
              </div>
            </div>

            <!-- 图片更新 -->
            <div v-else-if="item.actionType === 'files_updated'" class="text-sm">
              <p class="text-primary font-medium">{{ t('order.timeline.imagesUpdated') }}</p>
              <div class="mt-1 flex items-center gap-2 text-xs">
                <span class="text-danger/60 line-through">{{
                  formatImageCount(item.oldValue)
                }}</span>
                <AppIcon
                  name="arrow-right"
                  class="text-(--text-secondary) size-3"
                />
                <span class="text-success font-medium">{{
                  formatImageCount(item.newValue)
                }}</span>
              </div>
              <p v-if="item.reason" class="text-(--text-secondary) mt-1 text-xs whitespace-pre-wrap break-words">
                {{ t('order.timeline.reason') }}: {{ getReasonText(item.reason) }}
              </p>
            </div>

            <!-- 状态变更 -->
            <p v-else-if="item.actionType === 'status_changed'" class="text-primary text-sm">
              {{ t('order.timeline.statusChanged') }}
              <StatusBadge :variant="getStatusVariant(item.newValue)" size="sm" class="ml-1">
                {{ t(`order.statuses.${item.newValue}`) }}
              </StatusBadge>
              <span v-if="item.reason" class="text-(--text-secondary) mt-1 block text-xs whitespace-pre-wrap break-words">{{
                getReasonText(item.reason)
              }}</span>
            </p>

            <!-- 留言 -->
            <p v-else class="text-primary text-sm whitespace-pre-wrap break-words">{{ item.comment }}</p>
          </div>
        </div>
      </div>

      <!-- 展开/收起按钮 -->
      <div v-if="hasMore" class="mt-4 text-center">
        <button
          class="bg-(--bg-muted) text-(--text-secondary) hover:bg-(--bg-hover) hover:text-primary inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm transition-all shadow-sm"
          @click="isExpanded = !isExpanded"
        >
          <template v-if="isExpanded">
            <AppIcon name="chevron-up" class="size-4" />
            {{ t('order.timeline.collapse') }}
          </template>
          <template v-else>
            <AppIcon name="chevron-down" class="size-4" />
            {{ t('order.timeline.viewAll', { count: totalCount }) }}
          </template>
        </button>
      </div>

      <!-- 空状态 -->
      <div
        v-if="!groupedTimeline || groupedTimeline.length === 0"
        class="text-(--text-secondary) py-8 text-center text-sm"
      >
        {{ t('common.noData') }}
      </div>
    </div>

    <!-- 表格模式 (Print / Table) -->
    <div v-else class="w-full">
      <table class="w-full border-collapse text-left text-sm">
        <thead class="border-(--border-color) bg-(--bg-muted) text-(--text-secondary) border-b font-medium">
          <tr>
            <th class="w-32 px-3 py-2">{{ t('order.createdAt') }}</th>
            <th class="w-32 px-3 py-2">{{ t('sidebar.role') }}</th>
            <th class="px-3 py-2 pl-8">{{ t('common.actions') }}</th>
          </tr>
        </thead>
        <tbody class="divide-(--border-color) divide-y">
          <tr v-for="item in displayedItems" :key="item.id" class="break-inside-avoid">
            <td class="text-(--text-muted) p-3 align-top text-xs">
              {{ formatTime(item.createdAt) }}
            </td>
            <td class="text-(--text-main) p-3 align-top font-medium">
              {{ item.actorName }}
              <div class="text-(--text-muted) text-[10px] font-normal">
                {{
                  item.actorType === 'admin'
                    ? t('sidebar.admin')
                    : t('salesperson.title').replace('管理', '')
                }}
              </div>
            </td>
            <td class="p-3 pl-8 align-top">
              <!-- Created -->
              <div v-if="item.actionType === 'created'" class="text-(--text-main)">
                {{ t('order.timeline.created') }}
              </div>

              <!-- Field Updated -->
              <div v-else-if="item.actionType === 'field_updated'" class="space-y-2">
                <div v-for="(update, idx) in item.updates" :key="idx">
                  <div class="text-(--text-main) font-medium">
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
                    class="mt-0.5 flex items-start gap-2 text-xs"
                  >
                    <span class="text-(--text-muted) min-w-0 flex-1 line-through break-words">{{
                      getDisplayValue(update, 'oldValue')
                    }}</span>
                    <span class="text-(--text-muted)/50 shrink-0">→</span>
                    <span class="text-(--text-main) min-w-0 flex-1 break-words">{{
                      getDisplayValue(update, 'newValue')
                    }}</span>
                  </div>
                  <div v-if="update.reason" class="text-(--text-muted) mt-0.5 text-xs whitespace-pre-wrap break-words">
                    {{ t('order.timeline.reason') }}: {{ getReasonText(update.reason) }}
                  </div>
                </div>
              </div>

              <!-- Status Changed -->
              <div v-else-if="item.actionType === 'status_changed'">
                <div class="text-(--text-main)">
                  {{ t('order.timeline.statusChanged') }}
                  <span class="font-medium">{{ t(`order.statuses.${item.newValue}`) }}</span>
                </div>
                <div v-if="item.reason" class="text-(--text-muted) mt-1 text-xs whitespace-pre-wrap break-words">{{ getReasonText(item.reason) }}</div>
              </div>

              <!-- Comment -->
              <div v-else class="text-(--text-main) break-words whitespace-pre-wrap italic">"{{ item.comment }}"</div>
            </td>
          </tr>
        </tbody>
      </table>
      <div
        v-if="!groupedTimeline || groupedTimeline.length === 0"
        class="border-(--border-color) text-(--text-secondary) border-t py-4 text-center text-sm"
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
import AppIcon from '@/components/ui/AppIcon.vue';

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
  created: 'bg-info-bg text-info',
  field_updated: 'bg-warning-bg text-warning',
  status_changed: 'bg-success-bg text-success',
  comment: 'bg-(--bg-muted) text-(--text-secondary)',
};

// 状态样式
const _statusClasses = STATUS_STYLES;

// 操作人颜色
const actorTypeColor = (type) => {
  return type === 'admin' ? 'text-info' : 'text-primary';
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
