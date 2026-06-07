<template>
  <div class="mt-4 rounded-2xl border border-(--border-color) bg-(--bg-card) p-3 shadow-sm">
    <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
      <div class="min-w-0">
        <div class="flex flex-wrap items-center gap-2">
          <h4 class="text-sm font-semibold text-(--text-main)">
            {{ t('order.detail.lineActions', '履约动作') }}
          </h4>
          <span class="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
            {{ t('order.detail.remainingQty', '剩余') }} {{ limits.ship }}
          </span>
        </div>
        <p class="mt-1 text-xs text-(--text-secondary)">
          {{
            t(
              'order.detail.lineActionHint',
              '按单行执行预留、释放和出货，成功后会自动刷新当前订单详情。'
            )
          }}
        </p>
        <p
          v-if="!isVariantBacked"
          class="mt-2 rounded-xl border border-warning/20 bg-(--color-warning-bg) px-3 py-2 text-xs text-(--color-warning-text)"
        >
          {{
            t(
              'order.detail.lineCommandVariantRequired',
              'Bind a product variant before using fulfillment actions.'
            )
          }}
        </p>
        <p
          v-else-if="unshipBlockedByDeliveryStatus"
          class="mt-2 rounded-xl border border-info/20 bg-(--color-info-bg) px-3 py-2 text-xs text-(--color-info-text)"
        >
          {{
            t(
              'order.detail.lineCommandDeliveredOrderLocked',
              'Delivered orders cannot reverse shipped quantity.'
            )
          }}
        </p>
        <p
          v-else-if="!returnAllowedByOrderStatus && limits.return > 0"
          class="mt-2 rounded-xl border border-success/20 bg-(--color-success-bg) px-3 py-2 text-xs text-(--color-success-text)"
        >
          {{
            t(
              'order.detail.lineCommandReturnRequiresDelivered',
              'Returns are only available after delivery is confirmed.'
            )
          }}
        </p>

        <div class="mt-3 flex flex-wrap gap-2">
          <span class="rounded-full bg-primary/8 px-2.5 py-1 text-xs font-medium text-primary">
            {{ t('order.detail.reservableQty', '可预留') }} {{ limits.reserve }}
          </span>
          <span
            class="rounded-full border border-(--border-color) bg-(--bg-muted) px-2.5 py-1 text-xs font-medium text-(--text-secondary)"
          >
            {{ t('order.detail.reservedQty', '已预留') }} {{ limits.release }}
          </span>
          <span
            class="rounded-full border border-warning/20 bg-(--color-warning-bg) px-2.5 py-1 text-xs font-medium text-(--color-warning-text)"
          >
            {{ t('order.detail.shippableQty', '可出货') }} {{ limits.ship }}
          </span>
          <span
            class="rounded-full border border-info/20 bg-(--color-info-bg) px-2.5 py-1 text-xs font-medium text-(--color-info-text)"
          >
            {{ t('order.detail.unshippableQty', '可撤销出货') }} {{ limits.unship }}
          </span>
          <span
            class="rounded-full border border-success/20 bg-(--color-success-bg) px-2.5 py-1 text-xs font-medium text-(--color-success-text)"
          >
            {{ t('order.detail.returnableQty', '可退回') }} {{ limits.return }}
          </span>
        </div>
      </div>

      <label class="min-w-[120px]">
        <span class="mb-1 block text-xs font-medium text-(--text-secondary)">
          {{ t('order.detail.lineActionQuantity', '数量') }}
        </span>
        <AppInput
          :model-value="quantity"
          type="number"
          min="1"
          size="sm"
          class="!rounded-xl !bg-(--bg-muted)/40"
          @update:model-value="quantity = Number($event)"
        />
      </label>
    </div>

    <div class="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-5">
      <AppButton
        variant="outline"
        size="sm"
        data-testid="line-command-reserve"
        class="border-primary/20 bg-primary/8 text-primary hover:border-primary/30 hover:bg-primary/14 hover:text-primary"
        :disabled="loading || !isVariantBacked || limits.reserve <= 0"
        @click="submit('reserve')"
      >
        {{ t('order.detail.reserveAction', '预留') }}
      </AppButton>
      <AppButton
        variant="secondary"
        size="sm"
        data-testid="line-command-release"
        class="bg-(--bg-muted)/65 text-(--text-main)"
        :disabled="loading || !isVariantBacked || limits.release <= 0"
        @click="submit('release')"
      >
        {{ t('order.detail.releaseAction', '释放') }}
      </AppButton>
      <AppButton
        variant="outline"
        size="sm"
        data-testid="line-command-ship"
        class="border-warning/20 bg-(--color-warning-bg) text-(--color-warning-text) hover:opacity-90"
        :disabled="loading || !isVariantBacked || limits.ship <= 0"
        @click="submit('ship')"
      >
        {{ t('order.detail.shipAction', '出货') }}
      </AppButton>
      <AppButton
        variant="outline"
        size="sm"
        data-testid="line-command-unship"
        class="border-info/20 bg-(--color-info-bg) text-(--color-info-text) hover:opacity-90"
        :disabled="
          loading || !isVariantBacked || unshipBlockedByDeliveryStatus || limits.unship <= 0
        "
        @click="submit('unship')"
      >
        {{ t('order.detail.unshipAction', '撤销出货') }}
      </AppButton>
      <AppButton
        variant="outline"
        size="sm"
        data-testid="line-command-return"
        class="border-success/20 bg-(--color-success-bg) text-(--color-success-text) hover:opacity-90"
        :disabled="loading || !isVariantBacked || !returnAllowedByOrderStatus || limits.return <= 0"
        @click="submit('return')"
      >
        {{ t('order.detail.returnAction', '退回') }}
      </AppButton>
    </div>

    <p
      v-if="mergedError"
      class="mt-3 rounded-xl border border-danger/20 bg-danger/6 px-3 py-2 text-xs text-danger"
    >
      {{ mergedError }}
    </p>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue';
import { useI18n } from '@/composables/useI18n';
import AppButton from '@/components/ui/AppButton.vue';
import AppInput from '@/components/ui/AppInput.vue';

const props = defineProps({
  line: {
    type: Object,
    required: true,
  },
  loading: {
    type: Boolean,
    default: false,
  },
  error: {
    type: String,
    default: '',
  },
  orderStatus: {
    type: String,
    default: '',
  },
  deliveryStatus: {
    type: String,
    default: 'not_shipped',
  },
});

const emit = defineEmits(['command']);
const { t } = useI18n();
const quantity = ref(1);
const localError = ref('');
const isVariantBacked = computed(() => Boolean(props.line?.variantId));
const orderStatusNormalized = computed(() =>
  String(props.orderStatus || '')
    .trim()
    .toLowerCase()
);
const deliveryStatusNormalized = computed(() =>
  String(props.deliveryStatus || '')
    .trim()
    .toLowerCase()
);
const orderIsTerminalFulfilled = computed(() =>
  ['fulfilled', 'delivered'].includes(orderStatusNormalized.value)
);
const unshipBlockedByDeliveryStatus = computed(
  () =>
    orderStatusNormalized.value === 'delivered' ||
    ['delivered', 'partially_returned', 'returned'].includes(deliveryStatusNormalized.value)
);
const returnAllowedByOrderStatus = computed(
  () =>
    orderStatusNormalized.value === 'delivered' ||
    ['delivered', 'returned'].includes(deliveryStatusNormalized.value)
);

const limits = computed(() => {
  if (!isVariantBacked.value) {
    return {
      reserve: 0,
      release: 0,
      ship: 0,
      unship: 0,
    };
  }

  const ordered = Math.max(0, Number(props.line?.orderedQuantity) || 0);
  const received = Math.max(0, Number(props.line?.receivedQuantity) || 0);
  const reserved = Math.max(0, Number(props.line?.reservedQuantity) || 0);
  const shipped = Math.max(0, Number(props.line?.shippedQuantity) || 0);
  const returned = Math.max(0, Number(props.line?.returnedQuantity) || 0);
  const cancelled = Math.max(0, Number(props.line?.cancelledQuantity) || 0);
  const remaining = Math.max(ordered - cancelled - shipped, 0);
  const ready = Math.max(received - shipped, 0);
  const reserveCap =
    received > 0 ? Math.max(ready - reserved, 0) : Math.max(remaining - reserved, 0);
  const shipCap = received > 0 ? Math.max(Math.min(remaining, ready), 0) : remaining;

  return {
    reserve: reserveCap,
    release: reserved,
    ship: shipCap,
    unship: unshipBlockedByDeliveryStatus.value ? 0 : shipped,
    return: Math.max(shipped - returned, 0),
  };
});

const mergedError = computed(() => localError.value || props.error || '');

function submit(action) {
  if (!isVariantBacked.value) {
    localError.value = t(
      'order.detail.lineCommandVariantRequired',
      'Bind a product variant before using fulfillment actions.'
    );
    return;
  }

  const nextQuantity = Math.floor(Number(quantity.value) || 0);
  const limit = limits.value[action] ?? 0;

  if (nextQuantity <= 0 || nextQuantity > limit) {
    localError.value = t('order.detail.lineCommandLimitExceeded', '超过当前动作允许数量');
    return;
  }

  localError.value = '';
  emit('command', {
    action,
    lineId: props.line.id,
    quantity: nextQuantity,
  });
}
</script>
