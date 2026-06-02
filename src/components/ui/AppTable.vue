<template>
  <div
    :data-table-surface="noBorder ? 'plain' : 'card'"
    :data-min-rows="minRows"
    class="app-table flex w-full flex-col overflow-hidden"
    :class="[
      noBorder
        ? 'app-table--plain'
        : 'app-table--card rounded-2xl border border-(--border-color)/70 bg-(--bg-card) shadow-card',
    ]"
  >
    <!-- Toolbar / Header Slot -->
    <div v-if="$slots.toolbar">
      <slot name="toolbar" />
    </div>

    <div
      data-table-stage
      class="app-table__stage flex min-w-0 flex-1 flex-col"
      :data-table-stage-mode="stageMode"
      :style="{ minHeight: stageMinHeight }"
    >
      <div
        ref="parentRef"
        class="overflow-x-auto"
        :class="{ 'max-h-[600px] overflow-y-auto': virtual }"
      >
        <table class="w-full text-left text-sm" :style="{ tableLayout }">
          <thead
            class="app-table__head sticky top-0 z-10 bg-(--bg-card) font-medium text-(--text-secondary)"
            :class="{ 'app-table__head--plain': noBorder }"
          >
            <tr
              :class="
                noBorder
                  ? 'border-b border-(--border-color)/35'
                  : 'border-b border-(--border-color)/70'
              "
            >
              <th
                v-for="(col, colIndex) in normalizedColumns"
                :key="col.key"
                class="px-4 py-3.5 font-semibold whitespace-nowrap"
                :class="[
                  col.headerClassList,
                  stickyFirstColumn && colIndex === 0 ? 'app-table__sticky-col sticky left-0 z-20 bg-(--bg-card)' : '',
                ]"
                :style="col.headerStyleValue"
                :aria-sort="col.sortable && sortBy === col.key ? (sortOrder === 'asc' ? 'ascending' : 'descending') : undefined"
                :tabindex="col.sortable ? 0 : undefined"
                @click="toggleSort(col)"
                @keydown.enter="toggleSort(col)"
                @keydown.space.prevent="toggleSort(col)"
              >
                <slot :name="`header-${col.key}`" :column="col">
                  <span class="inline-flex items-center gap-1">
                    <span>{{ col.label }}</span>
                    <AppIcon
                      v-if="col.sortable"
                      :name="getSortIcon(col)"
                      class="size-4 text-(--text-muted)"
                    />
                  </span>
                </slot>
              </th>
            </tr>
          </thead>
          <tbody
            class="app-table__body"
            :class="[
              noBorder
                ? 'app-table__body--plain divide-y divide-(--border-color)/15'
                : 'divide-y divide-(--border-color)/30',
            ]"
          >
            <!-- Loading State -->
            <template v-if="loading">
              <tr v-for="i in 5" :key="i">
                <td
                  v-for="(col, colIndex) in normalizedColumns"
                  :key="col.key"
                  class="p-4"
                  :class="stickyFirstColumn && colIndex === 0 ? 'app-table__sticky-col sticky left-0 z-10 bg-(--bg-card)' : ''"
                  :style="col.cellStyleValue"
                >
                  <div class="h-4 w-3/4 animate-pulse rounded bg-(--bg-muted)"></div>
                </td>
              </tr>
            </template>

            <!-- Empty State -->
            <template v-else-if="!data || data.length === 0">
              <tr>
                <td
                  :colspan="columns.length"
                  class="px-4 py-12 text-center text-(--text-secondary)"
                >
                  <slot name="empty">
                    <div class="flex flex-col items-center justify-center gap-2">
                      <AppIcon name="archive-box" class="size-8 opacity-20" />
                      <span>{{ emptyText || t('common.noData') }}</span>
                    </div>
                  </slot>
                </td>
              </tr>
            </template>

            <!-- Data Rows (Virtual Mode with TanStack) -->
            <template v-else-if="virtual">
              <tr :style="{ height: `${virtualTotalSize}px`, position: 'relative' }">
                <td :colspan="normalizedColumns.length" class="p-0" style="position: relative">
                  <div
                    v-for="virtualRow in virtualItems"
                    :key="data[virtualRow.index]?.[rowKey] || virtualRow.index"
                    :data-index="virtualRow.index"
                    class="group absolute top-0 left-0 w-full transition-colors hover:bg-(--bg-hover)/70"
                    :class="{ 'cursor-pointer': clickable }"
                    :style="{
                      height: `${virtualRow.size}px`,
                      transform: `translateY(${virtualRow.start}px)`,
                    }"
                    @click="handleRowClick(virtualRow.index)"
                  >
                    <table class="w-full text-left text-sm" :style="{ tableLayout }">
                      <tbody>
                        <tr>
                          <td
                            v-for="(col, colIndex) in normalizedColumns"
                            :key="col.key"
                            class="px-4 py-3 align-middle"
                            :class="[
                              col.cellClassList,
                              stickyFirstColumn && colIndex === 0 ? 'app-table__sticky-col sticky left-0 z-10 bg-(--bg-card) group-hover:bg-(--bg-hover)/70' : '',
                            ]"
                            :style="col.cellStyleValue"
                          >
                            <slot
                              :name="`cell-${col.key}`"
                              :row="data[virtualRow.index]"
                              :index="virtualRow.index"
                              :value="data[virtualRow.index]?.[col.key]"
                            >
                              <span :class="col.defaultContentClass">{{
                                data[virtualRow.index]?.[col.key]
                              }}</span>
                            </slot>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </td>
              </tr>
            </template>

            <!-- Data Rows (Normal Mode) -->
            <template v-else>
              <tr
                v-for="(row, index) in data"
                :key="row[rowKey] || index"
                class="group transition-colors hover:bg-(--bg-hover)/70"
                :class="{ 'cursor-pointer': clickable }"
                @click="$emit('row-click', row)"
              >
                <td
                  v-for="(col, colIndex) in normalizedColumns"
                  :key="col.key"
                  class="px-4 py-3 align-middle"
                  :class="[
                    col.cellClassList,
                    stickyFirstColumn && colIndex === 0 ? 'app-table__sticky-col sticky left-0 z-10 bg-(--bg-card) group-hover:bg-(--bg-hover)/70' : '',
                  ]"
                  :style="col.cellStyleValue"
                >
                  <slot :name="`cell-${col.key}`" :row="row" :index="index" :value="row[col.key]">
                    <span :class="col.defaultContentClass">{{ row[col.key] }}</span>
                  </slot>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>

      <div
        v-if="stageMode === 'sparse' && fillSparseSpace"
        data-table-sparse-fill
        class="flex-1 border-t border-(--border-color)/20 bg-(--bg-muted)/20 pointer-events-none"
      ></div>
    </div>

    <!-- Footer / Pagination -->
    <div
      v-if="$slots.footer"
      data-table-footer
      class="border-t border-(--border-color)/70 px-4 py-3"
    >
      <slot name="footer" />
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import AppIcon from '@/components/ui/AppIcon.vue';
import { useVirtualizer } from '@tanstack/vue-virtual';
import { useI18n } from '@/composables/useI18n';

const props = defineProps({
  columns: {
    type: Array,
    required: true,
  },
  data: {
    type: Array,
    default: () => [],
  },
  loading: {
    type: Boolean,
    default: false,
  },
  rowKey: {
    type: String,
    default: 'id',
  },
  emptyText: {
    type: String,
    default: '',
  },
  noBorder: {
    type: Boolean,
    default: false,
  },
  virtual: {
    type: Boolean,
    default: false,
  },
  estimateSize: {
    type: Number,
    default: 64, // 预估行高，TanStack 会自动动态测量
  },
  clickable: {
    type: Boolean,
    default: false,
  },
  minRows: {
    type: Number,
    default: 7,
  },
  sparseThreshold: {
    type: Number,
    default: 3,
  },
  fillSparseSpace: {
    type: Boolean,
    default: true,
  },
  sortBy: {
    type: String,
    default: '',
  },
  sortOrder: {
    type: String,
    default: '',
  },
  tableLayout: {
    type: String,
    default: 'auto',
  },
  stickyFirstColumn: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(['row-click', 'sort-change']);

const { t } = useI18n();
const parentRef = ref(null);
const normalizeCssLength = (value) => {
  if (value === undefined || value === null || value === '') return undefined;
  return typeof value === 'number' ? `${value}px` : value;
};

const resolveColumnBaseStyle = (column) => {
  const width = normalizeCssLength(column.width);
  const minWidth = normalizeCssLength(column.minWidth);
  const maxWidth = normalizeCssLength(column.maxWidth);
  const style = {};

  if (width) style.width = width;
  if (minWidth) style.minWidth = minWidth;
  if (maxWidth) style.maxWidth = maxWidth;

  return style;
};

const resolveColumnKindDefaults = (column) => {
  const map = {
    identifier: {
      nowrap: true,
      truncate: true,
    },
    path: {
      nowrap: true,
      truncate: true,
    },
    status: {
      nowrap: true,
    },
    numeric: {
      nowrap: true,
      cellClass: 'tabular-nums',
    },
    datetime: {
      nowrap: true,
      cellClass: 'tabular-nums',
    },
  };

  return map[column?.kind] || {};
};

const resolveAlignmentClass = (column) => {
  if (column.align === 'right') return 'text-right';
  if (column.align === 'center') return 'text-center';
  return 'text-left';
};

const resolveLegacyResponsiveCellClass = (column) => {
  const legacyClass = String(column?.class || '').trim();
  if (!legacyClass) return '';

  const tokens = legacyClass.split(/\s+/).filter(Boolean);
  const responsiveVisibilityTokens = tokens.filter(
    (token) => token === 'hidden' || token.endsWith(':table-cell')
  );

  return responsiveVisibilityTokens.join(' ');
};

const normalizedColumns = computed(() =>
  (props.columns || []).map((column) => {
    const kindDefaults = resolveColumnKindDefaults(column);
    const resolvedColumn = {
      ...kindDefaults,
      ...column,
    };
    const baseStyle = resolveColumnBaseStyle(resolvedColumn);
    const shouldNowrap = Boolean(resolvedColumn.nowrap || resolvedColumn.truncate);
    const legacyResponsiveCellClass = resolveLegacyResponsiveCellClass(resolvedColumn);

    return {
      ...resolvedColumn,
      headerClassList: [
        resolvedColumn.sortable ? 'cursor-pointer select-none' : '',
        resolveAlignmentClass(resolvedColumn),
        kindDefaults.headerClass,
        resolvedColumn.class,
        resolvedColumn.headerClass,
      ],
      cellClassList: [
        resolveAlignmentClass(resolvedColumn),
        kindDefaults.cellClass,
        resolvedColumn.tdClass,
        resolvedColumn.cellClass,
        legacyResponsiveCellClass,
        shouldNowrap ? 'whitespace-nowrap' : '',
        resolvedColumn.truncate ? 'truncate' : '',
      ],
      headerStyleValue: [baseStyle, resolvedColumn.headerStyle],
      cellStyleValue: [baseStyle, resolvedColumn.cellStyle],
      defaultContentClass: [
        shouldNowrap ? 'block whitespace-nowrap' : '',
        resolvedColumn.truncate ? 'truncate' : '',
      ],
    };
  })
);

const stageMode = computed(() => {
  if (props.loading) return 'loading';
  if (!props.data || props.data.length === 0) return 'empty';
  if (props.data.length <= props.sparseThreshold) return 'sparse';
  return 'normal';
});

const stageMinHeight = computed(() => {
  const headerHeight = 52;
  const rowHeight = props.estimateSize || 48;
  return `${headerHeight + rowHeight * props.minRows}px`;
});

const getSortIcon = (column) => {
  if (props.sortBy !== column.key || !props.sortOrder) return 'arrows-up-down';
  return props.sortOrder === 'asc' ? 'chevron-up' : 'chevron-down';
};

const toggleSort = (column) => {
  if (!column?.sortable) return;

  if (props.sortBy !== column.key) {
    emit('sort-change', { sortBy: column.key, sortOrder: 'asc' });
    return;
  }

  if (props.sortOrder === 'asc') {
    emit('sort-change', { sortBy: column.key, sortOrder: 'desc' });
    return;
  }

  emit('sort-change', { sortBy: '', sortOrder: '' });
};

// TanStack Virtual 配置 - 使用 computed 来响应数据变化
const rowVirtualizerOptions = computed(() => ({
  count: props.data.length,
  getScrollElement: () => parentRef.value,
  estimateSize: () => props.estimateSize,
  overscan: 5, // 缓冲区大小
}));

// 使用 useVirtualizer 组合式函数
const rowVirtualizer = useVirtualizer(rowVirtualizerOptions);

// 计算属性：获取虚拟项目列表
const virtualItems = computed(() => {
  if (!props.virtual) return [];
  return rowVirtualizer.value.getVirtualItems();
});

// 计算属性：获取总高度
const virtualTotalSize = computed(() => {
  if (!props.virtual) return 0;
  return rowVirtualizer.value.getTotalSize();
});

// 处理行点击
const handleRowClick = (index) => {
  if (props.data[index]) {
    emit('row-click', props.data[index]);
  }
};

// 暴露 scrollToIndex 方法供外部使用
defineExpose({
  scrollToIndex: (index, options) => {
    rowVirtualizer.value.scrollToIndex(index, options);
  },
  scrollToOffset: (offset, options) => {
    rowVirtualizer.value.scrollToOffset(offset, options);
  },
});
</script>

<style scoped>
.app-table__sticky-col::after {
  content: '';
  position: absolute;
  top: 0;
  right: -8px;
  bottom: 0;
  width: 8px;
  background: linear-gradient(to right, var(--table-sticky-shadow, rgba(0, 0, 0, 0.06)), transparent);
  pointer-events: none;
}

:root.dark .app-table__sticky-col::after {
  background: linear-gradient(to right, var(--table-sticky-shadow-dark, rgba(0, 0, 0, 0.2)), transparent);
}
</style>
