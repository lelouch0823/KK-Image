<template>
  <div class="w-full overflow-hidden rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] shadow-sm">
    <!-- Toolbar / Header Slot -->
    <div v-if="$slots.toolbar" class="border-b border-[var(--border-color)] px-4 py-3">
      <slot name="toolbar" />
    </div>

    <div class="overflow-x-auto">
      <table class="w-full text-left text-sm">
        <thead class="bg-[var(--bg-muted)]/50 text-[var(--text-secondary)]">
          <tr class="border-b border-[var(--border-color)]/50">
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
              {{ col.label }}
            </th>
          </tr>
        </thead>
        <tbody class="divide-y divide-[var(--border-color)]/30">
          <!-- Loading State -->
          <template v-if="loading">
            <tr v-for="i in 5" :key="i">
              <td
                v-for="col in columns"
                :key="col.key"
                class="px-4 py-4"
              >
                <div class="h-4 w-3/4 animate-pulse rounded bg-[var(--bg-muted)]"></div>
              </td>
            </tr>
          </template>

          <!-- Empty State -->
          <template v-else-if="!data || data.length === 0">
            <tr>
              <td :colspan="columns.length" class="px-4 py-12 text-center text-[var(--text-secondary)]">
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

          <!-- Data Rows -->
          <template v-else>
            <tr
              v-for="(row, index) in data"
              :key="row[rowKey] || index"
              class="group transition-colors hover:bg-[var(--bg-hover)]"
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
    <div v-if="$slots.footer" class="border-t border-[var(--border-color)] px-4 py-3">
      <slot name="footer" />
    </div>
  </div>
</template>

<script setup>
import { useI18n } from '@/composables/useI18n';

defineProps({
  columns: {
    type: Array,
    required: true,
    // { key: string, label: string, align?: 'left'|'center'|'right', width?: string, class?: string, tdClass?: string }
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
});

defineEmits(['row-click']);

const { t } = useI18n();
</script>
