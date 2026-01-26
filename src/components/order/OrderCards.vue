<template>
  <div class="space-y-3">
    <!-- 加载状态 -->
    <template v-if="loading">
      <div
        v-for="i in 5"
        :key="i"
        class="animate-pulse rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] p-4"
      >
        <div class="flex gap-3">
          <div class="size-16 flex-shrink-0 rounded-lg bg-[var(--bg-muted)]"></div>
          <div class="flex-1 space-y-2">
            <div class="h-4 w-3/4 rounded bg-[var(--bg-muted)]"></div>
            <div class="h-3 w-1/2 rounded bg-[var(--bg-muted)]"></div>
            <div class="h-3 w-1/3 rounded bg-[var(--bg-muted)]"></div>
          </div>
        </div>
      </div>
    </template>

    <!-- 订单卡片 -->
    <template v-else-if="data.length > 0">
      <div
        v-for="order in data"
        :key="order.id"
        class="group overflow-hidden rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] shadow-sm transition-all active:scale-[0.98] active:bg-[var(--bg-hover)]"
        @click="$emit('detail', order)"
      >
        <div class="flex gap-3 p-4">
          <!-- 主图 -->
          <div
            class="size-16 flex-shrink-0 overflow-hidden rounded-lg border border-[var(--border-color)] bg-[var(--bg-muted)]"
          >
            <AppImage 
              v-if="order.mainImage" 
              :src="order.mainImage" 
              :blurhash="order.mainImageBlurhash"
              fit="cover"
              class="order-card-image size-full"
              rounded="none"
            />
            <div v-else class="flex size-full items-center justify-center">
              <svg
                class="size-6 text-[var(--text-secondary)]/30"
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

          <!-- 信息 -->
          <div class="min-w-0 flex-1">
            <div class="flex items-start justify-between gap-2">
              <div class="flex items-center gap-2 truncate font-bold text-[var(--text-main)]">
                {{ order.productName || '-' }}
                <span
                  v-if="order.hasNewFeedback"
                  class="size-2.5 flex-shrink-0 animate-pulse rounded-full border-2 border-[var(--bg-card)] bg-[var(--color-danger)]"
                ></span>
              </div>
              <div @click.stop>
                <slot name="status" :order="order"></slot>
              </div>
            </div>
            <div class="mt-1.5 text-xs font-medium text-[var(--text-secondary)]">
              {{ order.salesperson?.name }} · {{ order.salesperson?.store }}
            </div>
            <div class="mt-1 font-mono text-xs text-[var(--text-secondary)]/60 select-all">
              {{ order.orderNo }}
            </div>
          </div>
        </div>

        <!-- 底部操作栏 -->
        <div
          class="flex items-center justify-between border-t border-[var(--border-color)] bg-[var(--bg-muted)]/30 px-4 py-3"
          @click.stop
        >
          <span class="text-xs text-[var(--text-secondary)]/50">{{
            formatTime(order.createdAt)
          }}</span>
          <button
            class="rounded-xl bg-[var(--color-primary)]/5 px-4 py-2 text-xs font-bold text-[var(--color-primary)] transition-all hover:bg-[var(--color-primary)]/10 active:scale-90"
            @click="$emit('edit', order)"
          >
            {{ t('order.manage.editOrder') }}
          </button>
        </div>
      </div>
    </template>

    <!-- 空状态 -->
    <EmptyState v-else icon="file" :title="t('order.portal.emptyOrders')" />
  </div>
</template>

<script setup>
import { useI18n } from '@/composables/useI18n';
import { formatDate } from '@/utils/formatters';
import EmptyState from '@/components/ui/EmptyState.vue';
import AppImage from '@/components/ui/AppImage.vue';

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

defineEmits(['detail', 'edit']);

const { t } = useI18n();

const formatTime = (timestamp) => formatDate(timestamp, { hour: undefined, minute: undefined });
</script>
