<template>
  <Modal
    v-model="isVisible"
    size="6xl"
    body-class="p-0"
  >
    <template #header>
      <div class="flex items-center gap-4">
        <h3 class="text-lg font-semibold text-(--text-main)">{{ t('order.detail.title') }}</h3>
        <div class="flex items-center gap-2">
          <button
            class="hover:bg-primary hover:text-inverse bg-primary/10 text-primary flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60"
            :disabled="!order || hydrating || editPending"
            @click="$emit('edit', order)"
          >
            <AppIcon
              :name="editPending ? 'spinner' : 'pencil-square'"
              class="size-3.5"
              :class="{ 'animate-spin': editPending }"
            />
            {{ t('order.manage.editOrder') }}
          </button>
          <button
            class="hover:text-primary hover:bg-(--bg-hover) flex items-center gap-1.5 rounded-lg border border-(--border-color) bg-(--bg-card) px-3 py-1.5 text-xs font-medium text-(--text-secondary) transition-colors"
            @click="detailRef?.handleSavePdf?.()"
          >
            <AppIcon name="arrow-down-tray" class="size-3.5" />
            {{ t('common.savePdf') }}
          </button>
        </div>
      </div>
    </template>

    <div class="relative min-h-[320px] p-6">
      <div
        v-if="lineCommandState.pending"
        data-testid="order-line-command-loading"
        class="mb-5 rounded-2xl border border-primary/20 bg-primary/6 px-4 py-3 text-sm text-(--text-main)"
      >
        <div class="flex items-center gap-2">
          <AppIcon name="spinner" class="size-4 animate-spin text-primary" />
          <span>{{ t('order.detail.lineCommandSyncing', '正在执行行级履约动作，订单详情会在完成后自动刷新。') }}</span>
        </div>
      </div>

      <div
        v-else-if="lineCommandState.error"
        data-testid="order-line-command-error"
        class="mb-5 rounded-2xl border border-danger/20 bg-danger/5 px-4 py-3 text-sm text-danger"
      >
        {{ lineCommandState.error }}
      </div>

      <div
        v-if="hydrationError"
        data-testid="order-detail-error"
        role="alert"
        class="border-danger/20 bg-danger/5 text-danger mb-5 rounded-xl border px-4 py-3 text-sm"
      >
        <div class="flex items-center justify-between gap-3">
          <span>{{ hydrationError }}</span>
          <button
            type="button"
            data-testid="order-detail-retry"
            class="border-danger/20 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-danger/10"
            @click="$emit('retry')"
          >
            {{ t('common.retry') }}
          </button>
        </div>
      </div>

      <div
        v-if="hydrating"
        data-testid="order-detail-loading"
        class="mb-5 rounded-2xl border border-(--border-color) bg-(--bg-muted)/55 p-4"
      >
        <div class="flex items-start gap-4">
          <div class="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-full">
            <AppIcon name="sparkles" class="size-5" />
          </div>
          <div class="min-w-0 flex-1">
            <p class="text-sm font-semibold text-(--text-main)">
              {{ t('order.workflow.detail_loading_title', 'Refreshing order details') }}
            </p>
            <p class="mt-1 text-sm text-(--text-secondary)">
              {{ t('order.workflow.detail_loading_body', 'Showing the current snapshot while richer order data loads in the background.') }}
            </p>
            <div class="mt-4 grid gap-3 sm:grid-cols-2">
              <Skeleton height="4" />
              <Skeleton height="4" width="2/3" />
              <Skeleton height="24" container-class="sm:col-span-2" />
            </div>
          </div>
        </div>
      </div>

      <OrderDetail
        v-if="order"
        ref="detailRef"
        :order="order"
        mode="admin"
        :commenting="commenting"
        :line-command-state="lineCommandState"
        @back="$emit('close')"
        @comment="$emit('comment', $event)"
        @refresh="$emit('refresh')"
        @edit="$emit('edit', $event)"
        @delete-order="$emit('delete-order')"
        @line-command="$emit('line-command', $event)"
      />
    </div>
  </Modal>
</template>

<script setup>
import { ref } from 'vue';
import { useI18n } from '@/composables/useI18n';
import Modal from '@/components/ui/Modal.vue';
import Skeleton from '@/components/ui/Skeleton.vue';
import AppIcon from '@/components/ui/AppIcon.vue';
import OrderDetail from '@/components/order/OrderDetail.vue';

const isVisible = defineModel('show', { type: Boolean, default: false });

defineProps({
  order: {
    type: Object,
    default: null,
  },
  hydrating: {
    type: Boolean,
    default: false,
  },
  hydrationError: {
    type: String,
    default: '',
  },
  commenting: {
    type: Boolean,
    default: false,
  },
  editPending: {
    type: Boolean,
    default: false,
  },
  lineCommandState: {
    type: Object,
    default: () => ({
      pending: false,
      lineId: null,
      action: '',
      error: '',
    }),
  },
});

defineEmits(['close', 'retry', 'comment', 'refresh', 'edit', 'delete-order', 'line-command']);

const { t } = useI18n();
const detailRef = ref(null);
</script>
