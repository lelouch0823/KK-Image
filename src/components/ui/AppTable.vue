<template>
  <div 
    class="w-full overflow-hidden"
    :class="[
      noBorder ? '' : 'rounded-xl border border-(--border-color) bg-(--bg-card) shadow-sm'
    ]"
  >
    <!-- Toolbar / Header Slot -->
    <div v-if="$slots.toolbar" class="border-b border-(--border-color) px-4 py-3">
      <slot name="toolbar" />
    </div>

    <div 
      ref="parentRef"
      class="overflow-x-auto" 
      :class="{ 'max-h-[600px] overflow-y-auto': virtual }"
    >
      <table class="w-full text-left text-sm">
        <thead class="sticky top-0 z-10 bg-(--bg-card)/90 font-medium text-(--text-secondary) shadow-sm backdrop-blur-sm">
          <tr class="border-b border-(--border-color)">
            <th
              v-for="col in columns"
              :key="col.key"
              class="px-4 py-3 font-medium whitespace-nowrap"
              :class="[
                col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left',
                col.class
              ]"
              :style="{ width: col.width }"
            >
              <slot :name="`header-${col.key}`" :column="col">
                {{ col.label }}
              </slot>
            </th>
          </tr>
        </thead>
        <tbody class="divide-y divide-(--border-color)/30">
          <!-- Loading State -->
          <template v-if="loading">
            <tr v-for="i in 5" :key="i">
              <td
                v-for="col in columns"
                :key="col.key"
                class="p-4"
              >
                <div class="h-4 w-3/4 animate-pulse rounded bg-(--bg-muted)"></div>
              </td>
            </tr>
          </template>

          <!-- Empty State -->
          <template v-else-if="!data || data.length === 0">
            <tr>
              <td :colspan="columns.length" class="px-4 py-12 text-center text-(--text-secondary)">
                <slot name="empty">
                  <div class="flex flex-col items-center justify-center gap-2">
                    <svg class="size-8 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                    </svg>
                    <span>{{ emptyText || t('common.noData') }}</span>
                  </div>
                </slot>
              </td>
            </tr>
          </template>

          <!-- Data Rows (Virtual Mode with TanStack) -->
          <template v-else-if="virtual">
            <tr :style="{ height: `${virtualTotalSize}px`, position: 'relative' }">
              <td :colspan="columns.length" class="p-0" style="position: relative;">
                <div
                  v-for="virtualRow in virtualItems"
                  :key="data[virtualRow.index]?.[rowKey] || virtualRow.index"
                  :data-index="virtualRow.index"
                  class="group absolute top-0 left-0 w-full transition-colors hover:bg-(--bg-hover)"
                  :style="{
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${virtualRow.start}px)`,
                  }"
                  @click="handleRowClick(virtualRow.index)"
                >
                  <table class="w-full text-left text-sm">
                    <tr>
                      <td
                        v-for="col in columns"
                        :key="col.key"
                        class="px-4 py-3 align-middle"
                        :class="[
                          col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left',
                          col.tdClass
                        ]"
                        :style="{ width: col.width }"
                      >
                        <slot :name="`cell-${col.key}`" :row="data[virtualRow.index]" :index="virtualRow.index" :value="data[virtualRow.index]?.[col.key]">
                          {{ data[virtualRow.index]?.[col.key] }}
                        </slot>
                      </td>
                    </tr>
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
              class="group transition-colors hover:bg-(--bg-hover)"
              @click="$emit('row-click', row)"
            >
              <td
                v-for="col in columns"
                :key="col.key"
                class="px-4 py-3 align-middle"
                :class="[
                  col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left',
                  col.tdClass
                ]"
              >
                <slot :name="`cell-${col.key}`" :row="row" :index="index" :value="row[col.key]">
                  {{ row[col.key] }}
                </slot>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>

    <!-- Footer / Pagination -->
    <div v-if="$slots.footer" class="border-t border-(--border-color) px-4 py-3">
      <slot name="footer" />
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
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
});

const emit = defineEmits(['row-click']);

const { t } = useI18n();
const parentRef = ref(null);

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
