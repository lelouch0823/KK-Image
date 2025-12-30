<template>
  <table class="w-full text-sm text-left relative">
    <thead class="bg-[var(--bg-muted)] text-secondary font-medium sticky top-0 z-10 shadow-sm">
      <tr>
        <!-- 批量选择 checkbox -->
        <th v-if="selectable" class="px-4 py-3 w-10">
          <input 
            type="checkbox" 
            :checked="isAllSelected" 
            :indeterminate="isPartialSelected"
            @change="toggleSelectAll"
            class="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
          >
        </th>
        <th class="px-4 py-3">{{ t('order.form.productName') }}</th>
        <th class="px-4 py-3">{{ t('salesperson.name') }}</th>
        <th class="px-4 py-3">{{ t('order.orderNo') }}</th>
        <th class="px-4 py-3">{{ t('order.status') }}</th>
        <th class="px-4 py-3">{{ t('order.createdAt') }}</th>
        <th class="px-4 py-3 text-right">{{ t('common.actions') }}</th>
      </tr>
    </thead>
    <tbody class="divide-y divide-[var(--border-color)]">
      <!-- 加载骨架屏 -->
      <template v-if="loading">
        <tr v-for="i in 5" :key="i" class="animate-pulse">
          <td v-if="selectable" class="px-4 py-4"><div class="h-4 w-4 bg-[var(--color-gray-200)] rounded"></div></td>
          <td v-for="j in 6" :key="j" class="px-4 py-4">
            <div class="h-4 bg-[var(--color-gray-200)] rounded w-2/3"></div>
          </td>
        </tr>
      </template>
      
      <!-- 数据行 -->
      <template v-else-if="data.length > 0">
        <tr 
          v-for="order in data" 
          :key="order.id" 
          class="hover:bg-[var(--bg-hover)] transition-colors group cursor-pointer"
          :class="{ 'bg-primary/5': isSelected(order.id) }"
          @click="$emit('detail', order)"
        >
          <!-- 批量选择 checkbox -->
          <td v-if="selectable" class="px-4 py-3" @click.stop>
            <input 
              type="checkbox" 
              :checked="isSelected(order.id)"
              @change="toggleSelect(order.id)"
              class="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
            >
          </td>
          <td class="px-4 py-3">
            <div class="flex items-center gap-3">
              <!-- 缩略图 -->
              <div class="w-10 h-10 rounded bg-[var(--bg-muted)] flex-shrink-0 overflow-hidden border border-[var(--border-color)]">
                <img v-if="order.mainImage" :src="order.mainImage" class="w-full h-full object-cover">
                <div v-else class="w-full h-full flex items-center justify-center">
                  <svg class="w-4 h-4 text-[var(--color-gray-300)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                  </svg>
                </div>
              </div>
              <div>
                <div class="font-medium text-primary flex items-center gap-2">
                  {{ order.productName || '-' }}
                  <!-- 红点 -->
                  <span v-if="order.hasNewFeedback" class="w-2 h-2 bg-[var(--color-danger)] rounded-full animate-pulse" :title="t('order.portal.hasUpdate')"></span>
                </div>
              </div>
            </div>
          </td>
          <td class="px-4 py-3">
            <div class="text-primary">{{ order.salesperson?.name }}</div>
            <div class="text-xs text-secondary">{{ order.salesperson?.store }}</div>
          </td>
          <td class="px-4 py-3 text-secondary font-mono text-xs">{{ order.orderNo }}</td>
          <td class="px-4 py-3" @click.stop>
            <slot name="status" :order="order"></slot>
          </td>
          <td class="px-4 py-3 text-secondary text-xs">{{ formatTime(order.createdAt) }}</td>
          <td class="px-4 py-3 text-right" @click.stop>
            <button 
              @click="$emit('edit', order)"
              class="text-primary hover:text-primary font-medium text-xs border border-[var(--border-hover)] px-3 py-1.5 rounded-lg hover:bg-[var(--bg-hover)] transition-colors"
            >
              {{ t('order.manage.editOrder') }}
            </button>
          </td>
        </tr>
      </template>

      <!-- 空状态 -->
      <tr v-else>
        <td :colspan="selectable ? 7 : 6" class="px-4 py-16 text-center">
          <EmptyState icon="file" :title="t('order.portal.emptyOrders')" />
        </td>
      </tr>
    </tbody>
  </table>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { formatDate } from '@/utils/formatters';
import EmptyState from '@/components/ui/EmptyState.vue';

const props = defineProps({
  data: {
    type: Array,
    required: true
  },
  loading: {
    type: Boolean,
    default: false
  },
  selectable: {
    type: Boolean,
    default: false
  },
  selectedIds: {
    type: Array,
    default: () => []
  }
});

const emit = defineEmits(['detail', 'edit', 'update:selectedIds']);

const { t } = useI18n();

const formatTime = (timestamp) => formatDate(timestamp, { hour: undefined, minute: undefined });

// 检查是否全选
const isAllSelected = computed(() => {
  return props.data.length > 0 && props.selectedIds.length === props.data.length;
});

// 检查是否部分选中
const isPartialSelected = computed(() => {
  return props.selectedIds.length > 0 && props.selectedIds.length < props.data.length;
});

// 检查某一项是否选中
const isSelected = (id) => props.selectedIds.includes(id);

// 切换全选
const toggleSelectAll = () => {
  if (isAllSelected.value) {
    emit('update:selectedIds', []);
  } else {
    emit('update:selectedIds', props.data.map(o => o.id));
  }
};

// 切换单个选中
const toggleSelect = (id) => {
  if (isSelected(id)) {
    emit('update:selectedIds', props.selectedIds.filter(i => i !== id));
  } else {
    emit('update:selectedIds', [...props.selectedIds, id]);
  }
};
</script>
