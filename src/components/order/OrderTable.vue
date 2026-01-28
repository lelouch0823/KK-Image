<template>
  <table class="relative w-full text-center text-sm">
    <thead class="sticky top-0 z-10 bg-[var(--bg-card)]/90 font-medium text-[var(--text-secondary)] shadow-sm backdrop-blur-sm">
      <tr class="border-b border-[var(--border-color)]">
        <!-- 批量选择 checkbox -->
        <th v-if="selectable" class="w-10 px-4 py-3">
          <input
            type="checkbox"
            :checked="isAllSelected"
            :indeterminate="isPartialSelected"
            class="size-4 cursor-pointer rounded-lg border-[var(--border-color)] bg-[var(--bg-muted)] text-[var(--color-primary)] transition-all focus:ring-[var(--color-primary)]/20"
            @change="toggleSelectAll"
          />
        </th>
        <th class="px-4 py-3 text-center">{{ t('order.form.productName') }}</th>
        <th class="px-4 py-3 text-center">{{ t('order.form.quantity') }}</th>
        <th class="px-4 py-3 text-center">{{ t('salesperson.name') }}</th>
        <th class="px-4 py-3 text-center">{{ t('order.orderNo') }}</th>
        <th class="px-4 py-3 text-center">{{ t('order.status') }}</th>
        <th class="px-4 py-3 text-center">{{ t('order.createdAt') }}</th>
        <th class="px-4 py-3 text-center">{{ t('common.actions') }}</th>
      </tr>
    </thead>
    <tbody class="divide-y divide-[var(--border-color)]">
      <!-- 加载骨架屏 -->
      <template v-if="loading">
        <tr v-for="i in 5" :key="i" class="animate-pulse">
          <td v-if="selectable" class="p-4">
            <div class="size-4 rounded bg-[var(--bg-muted)]"></div>
          </td>
          <td v-for="j in 7" :key="j" class="p-4">
            <div class="h-4 w-2/3 rounded bg-[var(--bg-muted)]"></div>
          </td>
        </tr>
      </template>

      <!-- 数据行 -->
      <template v-else-if="data.length > 0">
        <tr
          v-for="order in data"
          :key="order.id"
          class="group cursor-pointer transition-colors hover:bg-[var(--bg-hover)]"
          :class="{ 'bg-[var(--color-primary)]/5': isSelected(order.id) }"
          @click="$emit('detail', order)"
        >
          <!-- 批量选择 checkbox -->
          <td v-if="selectable" class="px-4 py-3" @click.stop>
            <input
              type="checkbox"
              :checked="isSelected(order.id)"
              class="size-4 cursor-pointer rounded-lg border-[var(--border-color)] bg-[var(--bg-muted)] text-[var(--color-primary)] transition-all focus:ring-[var(--color-primary)]/20"
              @change="toggleSelect(order.id)"
            />
          </td>
          <td class="px-4 py-3">
            <div class="flex items-center justify-center gap-3">
              <!-- 缩略图 -->
              <div
                class="size-10 flex-shrink-0 overflow-hidden rounded border border-[var(--border-color)] bg-[var(--bg-muted)]"
              >
                <AppImage 
                  v-if="order.mainImage" 
                  :src="order.mainImage" 
                  :blurhash="order.mainImageBlurhash"
                  fit="cover"
                  class="size-full"
                  rounded="none"
                />
                <div v-else class="flex size-full items-center justify-center">
                  <svg
                    class="size-4 text-[var(--text-secondary)]/30"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="1.5"
                      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                    ></path>
                  </svg>
                </div>
              </div>
              <div>
                <div class="flex items-center gap-2 font-bold text-[var(--text-main)]">
                  {{ order.productName || '-' }}
                  <!-- 红点 -->
                  <span
                    v-if="order.hasNewFeedback"
                    class="size-2.5 animate-pulse rounded-full border-2 border-[var(--bg-card)] bg-[var(--color-danger)]"
                    :title="t('order.portal.hasUpdate')"
                  ></span>
                </div>
              </div>
            </div>
          </td>
          <td class="px-4 py-3 text-center font-mono font-medium text-[var(--color-primary)]">
            x {{ order.quantity || 1 }}
          </td>
          <td class="px-4 py-3">
            <div class="font-medium text-[var(--text-main)]">
              {{ order.salespersonName || '-' }}
            </div>
            <div class="text-xs text-[var(--text-secondary)]">{{ order.store }}</div>
          </td>
          <td class="px-4 py-3 font-mono text-xs text-[var(--text-secondary)]">{{ order.orderNo }}</td>
          <td class="px-4 py-3" @click.stop>
            <slot name="status" :order="order"></slot>
          </td>
          <td class="px-4 py-3 text-center text-xs text-[var(--text-secondary)]">{{ formatTime(order.createdAt) }}</td>
          <td class="px-4 py-3 text-center" @click.stop>
            <div class="flex items-center justify-center gap-1 opacity-100 transition-opacity lg:opacity-0 lg:group-hover:opacity-100">
              <!-- 查看 -->
              <button
                class="rounded-lg p-1.5 transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--color-primary)] text-[var(--text-secondary)]"
                :title="t('common.view')"
                @click="$emit('detail', order)"
              >
                <svg class="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                  />
                </svg>
              </button>
              <!-- 编辑 -->
              <button
                class="rounded-lg p-1.5 transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--color-primary)] text-[var(--text-secondary)]"
                :title="t('common.edit')"
                @click="$emit('edit', order)"
              >
                <svg class="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                  />
                </svg>
              </button>
              <!-- 作废 -->
              <button
                v-if="order.status !== 'void'"
                class="rounded-xl p-2 text-[var(--text-secondary)] transition-all hover:bg-[var(--color-danger-bg)] hover:text-[var(--color-danger)] active:scale-90"
                :title="t('order.actions.void')"
                @click="$emit('void', order)"
              >
                <svg class="size-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
              </button>
            </div>
          </td>
        </tr>
      </template>

      <!-- 空状态 -->
      <tr v-else>
        <td :colspan="selectable ? 8 : 7" class="px-4 py-16 text-center">
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
import AppImage from '@/components/ui/AppImage.vue';

const {
  data,
  loading = false,
  selectable = false,
  selectedIds = [],
} = defineProps({
  data: {
    type: Array,
    required: true,
  },
  loading: {
    type: Boolean,
    default: false,
  },
  selectable: {
    type: Boolean,
    default: false,
  },
  selectedIds: {
    type: Array,
    default: () => [],
  },
});

const emit = defineEmits(['detail', 'edit', 'void', 'update:selectedIds']);

const { t } = useI18n();

const formatTime = (timestamp) => formatDate(timestamp);

// 检查是否全选
const isAllSelected = computed(() => {
  return data.length > 0 && selectedIds.length === data.length;
});

// 检查是否部分选中
const isPartialSelected = computed(() => {
  return selectedIds.length > 0 && selectedIds.length < data.length;
});

// 检查某一项是否选中
const isSelected = (id) => selectedIds.includes(id);

// 切换全选
const toggleSelectAll = () => {
  if (isAllSelected.value) {
    emit('update:selectedIds', []);
  } else {
    emit(
      'update:selectedIds',
      data.map((o) => o.id)
    );
  }
};

// 切换单个选中
const toggleSelect = (id) => {
  if (isSelected(id)) {
    emit(
      'update:selectedIds',
      selectedIds.filter((i) => i !== id)
    );
  } else {
    emit('update:selectedIds', [...selectedIds, id]);
  }
};
</script>
