<template>
  <table class="w-full text-left text-sm">
    <thead class="sticky top-0 z-10 bg-[var(--bg-card)]/90 font-medium text-[var(--text-secondary)] shadow-sm backdrop-blur-sm">
      <tr>
        <th class="px-4 py-3">{{ t('salesperson.name') }}</th>
        <th class="px-4 py-3">{{ t('salesperson.store') }}</th>
        <th class="px-4 py-3">{{ t('salesperson.phone') }}</th>
        <th class="px-4 py-3">{{ t('salesperson.orderCount') }}</th>
        <th class="px-4 py-3 text-center">{{ t('salesperson.status') }}</th>
        <th class="px-4 py-3 text-right">{{ t('common.actions') }}</th>
      </tr>
    </thead>
    <tbody class="divide-y divide-[var(--border-color)]">
      <!-- 加载骨架屏 -->
      <template v-if="loading">
        <tr v-for="i in 3" :key="i" class="animate-pulse">
          <td v-for="j in 6" :key="j" class="p-4">
            <div class="h-4 w-2/3 rounded bg-[var(--bg-muted)]"></div>
          </td>
        </tr>
      </template>

      <!-- 数据行 -->
      <template v-else-if="data.length > 0">
        <tr
          v-for="person in data"
          :key="person.id"
          class="group transition-colors hover:bg-[var(--bg-hover)]"
        >
          <td class="px-4 py-3">
            <div class="font-medium text-[var(--text-main)]">{{ person.name }}</div>
          </td>
          <td class="px-4 py-3 text-[var(--text-secondary)]">{{ person.store || '-' }}</td>
          <td class="px-4 py-3 text-[var(--text-secondary)]">{{ person.phone || '-' }}</td>
          <td class="px-4 py-3">
            <button
              v-if="person.orderCount > 0"
              class="cursor-pointer text-info hover:underline"
              :title="t('salesperson.viewOrders')"
              @click="$emit('view-orders', person)"
            >
              <StatusBadge variant="info">{{ person.orderCount }}</StatusBadge>
            </button>
            <StatusBadge v-else variant="default">{{ person.orderCount }}</StatusBadge>
          </td>
          <td class="px-4 py-3 text-center">
            <StatusBadge :variant="person.isActive ? 'success' : 'default'">
              {{ person.isActive ? t('salesperson.active') : t('salesperson.disabled') }}
            </StatusBadge>
          </td>
          <td class="px-4 py-3 text-right">
            <div class="mobile:opacity-100 flex items-center justify-end gap-2 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
              <button
                class="rounded-lg p-1.5 text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--color-primary)] active:scale-90"
                :title="t('salesperson.copyLink')"
                @click="$emit('copy', person.accessToken)"
              >
                <svg class="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                  ></path>
                </svg>
              </button>
              <button
                class="rounded-lg p-1.5 text-[var(--text-secondary)] transition-colors hover:bg-[var(--color-info-bg)] hover:text-[var(--color-info-text)] active:scale-90"
                :title="t('salesperson.edit')"
                @click="$emit('edit', person)"
              >
                <svg class="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                  ></path>
                </svg>
              </button>
              <button
                class="rounded-lg p-1.5 text-[var(--text-secondary)] transition-colors hover:bg-[var(--color-danger-bg)] hover:text-[var(--color-danger-text)] active:scale-90 disabled:cursor-not-allowed disabled:opacity-30"
                :title="t('common.delete')"
                :disabled="person.orderCount > 0"
                @click="$emit('delete', person)"
              >
                <svg class="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  ></path>
                </svg>
              </button>
            </div>
          </td>
        </tr>
      </template>

      <!-- 空状态 -->
      <tr v-else>
        <td colspan="6" class="px-4 py-12 text-center">
          <EmptyState icon="user" :title="t('salesperson.emptyList')" />
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
    required: true,
  },
  loading: {
    type: Boolean,
    default: false,
  },
});

defineEmits(['edit', 'delete', 'copy', 'view-orders']);

const { t } = useI18n();
</script>
