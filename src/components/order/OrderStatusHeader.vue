<template>
  <div class="rounded-2xl border border-(--border-color) bg-(--bg-card) p-4 shadow-card">
    <div class="flex items-start justify-between gap-4">
      <div class="min-w-0 flex-1">
        <p class="mb-1 truncate font-mono text-xs text-(--text-secondary)">{{ orderNo }}</p>
        <h2
          class="text-primary truncate text-lg font-bold"
          :title="productName || t('order.form.productName')"
        >
          {{ productName || t('order.form.productName') }}
        </h2>
        <div class="mt-2">
          <OrderProcurementBadge
            :status="procurementStatus"
            preset="detail"
          />
          <OrderDeliveryStatusBadge
            v-if="deliveryStatus && deliveryStatus !== 'not_shipped'"
            :status="deliveryStatus"
            preset="detail"
            class="mt-2"
          />
        </div>
        <div
          v-if="showDeliveryConfirmationBlock"
          class="mt-3 rounded-xl border border-success/20 bg-(--color-success-bg) px-3 py-3"
        >
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <p class="text-xs font-semibold tracking-wide text-(--color-success-text) uppercase">
                {{ t('order.detail.deliveryConfirmationTitle', 'Delivery Confirmation') }}
              </p>
              <p
                v-if="deliveryConfirmedAt"
                class="mt-1 text-sm text-(--text-main)"
              >
                {{ formatTime(deliveryConfirmedAt) }}
                <span
                  v-if="deliveryConfirmedBy"
                  class="text-(--text-secondary)"
                >
                  · {{ deliveryConfirmedBy }}
                </span>
              </p>
              <p
                v-else
                class="mt-1 text-sm text-(--text-secondary)"
              >
                {{
                  t(
                    'order.detail.deliveryConfirmationHint',
                    'Confirm this after the customer has actually received the shipment.'
                  )
                }}
              </p>
              <p
                v-if="deliveryNote"
                class="mt-1 text-xs break-words whitespace-pre-wrap text-(--text-secondary)"
              >
                {{ deliveryNote }}
              </p>
            </div>
            <AppButton
              v-if="canConfirmDelivery"
              variant="outline"
              size="sm"
              data-testid="confirm-delivery-button"
              class="border-success/20 bg-(--color-success-bg) text-(--color-success-text) hover:opacity-90"
              :disabled="deliveryConfirmPending"
              @click="$emit('confirm-delivery')"
            >
              {{ t('order.detail.deliveryConfirmAction', 'Confirm Delivery') }}
            </AppButton>
          </div>
        </div>
      </div>
      <StatusBadge class="shrink-0" :variant="getStatusVariant(status)" size="md" dot>
        {{ t(`order.statuses.${status}`) }}
      </StatusBadge>
    </div>

    <!-- 状态流程条 -->
    <div class="relative mt-6">
      <div class="absolute top-3 right-0 left-0 h-0.5 bg-(--border-color)"></div>
      <div
        class="bg-primary absolute top-3 left-0 h-0.5 transition-all duration-300"
        :style="{ width: progressWidth }"
      ></div>
      <div class="relative flex justify-between">
        <div
          v-for="(step, index) in statusSteps"
          :key="step"
          class="flex flex-col items-center"
        >
          <div
            class="flex size-6 items-center justify-center rounded-full border-2 text-xs font-medium transition-all"
            :class="
              index <= currentStepIndex
                ? 'bg-primary border-primary text-(--text-inverse)'
                : 'border-(--border-hover) bg-(--bg-card) text-(--text-secondary)'
            "
          >
            <AppIcon v-if="index < currentStepIndex" name="check" class="size-3 stroke-3" />
            <span v-else>{{ index + 1 }}</span>
          </div>
          <span
            class="mt-1.5 text-center text-[10px] whitespace-nowrap"
            :class="
              index <= currentStepIndex ? 'text-primary font-medium' : 'text-(--text-secondary)'
            "
          >
            {{ t(`order.statuses.${step}`) }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { formatTime } from '@/utils/formatters';
import { STATUS_OPTIONS, getStatusVariant } from '@/utils/status';
import { normalizeOrderStatus } from '@/utils/order-state-machine';
import AppButton from '@/components/ui/AppButton.vue';
import StatusBadge from '@/components/ui/StatusBadge.vue';
import AppIcon from '@/components/ui/AppIcon.vue';
import OrderProcurementBadge from './OrderProcurementBadge.vue';
import OrderDeliveryStatusBadge from './OrderDeliveryStatusBadge.vue';

const props = defineProps({
  orderNo: {
    type: String,
    required: true,
  },
  productName: {
    type: String,
    default: '',
  },
  status: {
    type: String,
    required: true,
  },
  procurementStatus: {
    type: String,
    default: 'none',
  },
  deliveryStatus: {
    type: String,
    default: 'not_shipped',
  },
  canConfirmDelivery: {
    type: Boolean,
    default: false,
  },
  deliveryConfirmPending: {
    type: Boolean,
    default: false,
  },
  deliveryConfirmedAt: {
    type: Number,
    default: null,
  },
  deliveryConfirmedBy: {
    type: String,
    default: '',
  },
  deliveryNote: {
    type: String,
    default: '',
  },
  quantity: {
    type: Number,
    default: 1,
  },
});

defineEmits(['confirm-delivery']);

const { t } = useI18n();

// 状态流程 (排除 rejected)
const statusSteps = STATUS_OPTIONS.filter((s) => s !== 'rejected' && s !== 'delivered');

const currentStepIndex = computed(() => {
  const idx = statusSteps.indexOf(normalizeOrderStatus(props.status));
  return idx >= 0 ? idx : 0;
});

const showDeliveryConfirmationBlock = computed(() =>
  props.canConfirmDelivery
  || Boolean(props.deliveryConfirmedAt)
  || Boolean(String(props.deliveryNote || '').trim())
  || props.deliveryStatus === 'delivered'
  || props.deliveryStatus === 'returned'
);

const progressWidth = computed(() => {
  const total = statusSteps.length - 1;
  return `${(currentStepIndex.value / total) * 100}%`;
});
</script>
