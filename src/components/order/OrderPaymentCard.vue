<template>
  <div class="rounded-2xl border border-(--border-color) bg-(--bg-card) p-4">
    <!-- 标题栏 -->
    <div class="mb-4 flex items-center justify-between">
      <h3 class="text-primary text-sm font-medium">{{ t('order.payment.title') }}</h3>
      <AppButton v-if="!showAddForm" variant="link" size="sm" @click="showAddForm = true">
        {{ t('order.payment.addPayment') }}
      </AppButton>
    </div>

    <!-- 付款汇总 -->
    <div class="mb-4 grid grid-cols-3 gap-3">
      <div class="rounded-lg bg-(--bg-secondary) p-3 text-center">
        <div class="text-xs text-(--text-secondary)">{{ t('order.payment.orderAmount') }}</div>
        <div class="text-primary mt-1 text-lg font-semibold">{{ summary.orderAmount }}</div>
      </div>
      <div class="rounded-lg bg-(--bg-secondary) p-3 text-center">
        <div class="text-xs text-(--text-secondary)">{{ t('order.payment.totalPaid') }}</div>
        <div class="text-success mt-1 text-lg font-semibold">{{ summary.totalPaid }}</div>
      </div>
      <div class="rounded-lg bg-(--bg-secondary) p-3 text-center">
        <div class="text-xs text-(--text-secondary)">{{ t('order.payment.outstanding') }}</div>
        <div
          class="mt-1 text-lg font-semibold"
          :class="summary.outstanding > 0 ? 'text-danger' : 'text-success'"
        >
          {{ summary.outstanding }}
        </div>
      </div>
    </div>

    <!-- 未付款警告 -->
    <div
      v-if="summary.outstanding > 0"
      class="border-warning/30 mb-4 rounded-lg border bg-(--color-warning-bg)/60 p-3"
    >
      <p class="text-sm text-(--text-main)">{{ t('order.payment.outstandingWarning') }}</p>
    </div>

    <!-- 添加付款表单 -->
    <div v-if="showAddForm" class="mb-4 rounded-lg border border-(--border-color) p-4">
      <div class="space-y-3">
        <!-- 金额 -->
        <div>
          <label class="mb-1 block text-xs text-(--text-secondary)">
            {{ t('order.payment.amount') }} <span class="text-danger">*</span>
          </label>
          <input
            v-model.number="form.amount"
            type="number"
            min="0"
            step="0.01"
            :placeholder="t('order.payment.amountPlaceholder')"
            class="w-full rounded-lg border border-(--border-color) bg-(--bg-input) px-3 py-2 text-sm"
          />
        </div>

        <!-- 付款方式 -->
        <div>
          <label class="mb-1 block text-xs text-(--text-secondary)">
            {{ t('order.payment.method') }}
          </label>
          <select
            v-model="form.method"
            class="w-full rounded-lg border border-(--border-color) bg-(--bg-input) px-3 py-2 text-sm"
          >
            <option v-for="method in paymentMethods" :key="method.value" :value="method.value">
              {{ method.label }}
            </option>
          </select>
        </div>

        <!-- 参考编号 -->
        <div>
          <label class="mb-1 block text-xs text-(--text-secondary)">
            {{ t('order.payment.referenceNo') }}
          </label>
          <input
            v-model="form.referenceNo"
            type="text"
            :placeholder="t('order.payment.referenceNoPlaceholder')"
            class="w-full rounded-lg border border-(--border-color) bg-(--bg-input) px-3 py-2 text-sm"
          />
        </div>

        <!-- 备注 -->
        <div>
          <label class="mb-1 block text-xs text-(--text-secondary)">
            {{ t('order.payment.notes') }}
          </label>
          <textarea
            v-model="form.notes"
            rows="2"
            :placeholder="t('order.payment.notesPlaceholder')"
            class="w-full rounded-lg border border-(--border-color) bg-(--bg-input) px-3 py-2 text-sm"
          />
        </div>

        <!-- 操作按钮 -->
        <div class="flex justify-end gap-2">
          <AppButton variant="ghost" size="sm" @click="cancelAdd">
            {{ t('common.cancel') }}
          </AppButton>
          <AppButton
            variant="primary"
            size="sm"
            :disabled="!isValid"
            :loading="adding"
            :loading-text="t('common.submitting')"
            @click="handleSubmit"
          >
            {{ t('common.confirm') }}
          </AppButton>
        </div>
      </div>
    </div>

    <!-- 付款记录列表 -->
    <div v-if="payments.length > 0" class="space-y-2">
      <div
        v-for="payment in payments"
        :key="payment.id"
        class="flex items-center justify-between rounded-lg border border-(--border-color) p-3"
      >
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2">
            <span class="text-primary font-medium">{{ payment.amount }}</span>
            <span class="rounded bg-(--bg-secondary) px-2 py-0.5 text-xs text-(--text-secondary)">
              {{ getMethodLabel(payment.method) }}
            </span>
          </div>
          <div class="mt-1 flex items-center gap-2 text-xs text-(--text-secondary)">
            <span>{{ formatDate(payment.receivedAt) }}</span>
            <span v-if="payment.referenceNo">· {{ payment.referenceNo }}</span>
          </div>
          <div v-if="payment.notes" class="mt-1 text-xs text-(--text-secondary)">
            {{ payment.notes }}
          </div>
        </div>
        <AppButton
          variant="ghost"
          size="sm"
          class="ml-2 text-danger hover:text-danger/80"
          @click="handleDelete(payment.id)"
        >
          {{ t('common.delete') }}
        </AppButton>
      </div>
    </div>

    <!-- 空状态 -->
    <div v-else-if="!loading" class="py-6 text-center text-sm text-(--text-secondary)">
      {{ t('order.payment.noPayments') }}
    </div>

    <!-- 加载状态 -->
    <div v-if="loading" class="py-4 text-center">
      <div
        class="border-primary mx-auto h-6 w-6 animate-spin rounded-full border-2 border-t-transparent"
      />
    </div>

    <ConfirmDialog
      v-model="confirmData.show"
      :title="confirmData.title"
      :message="confirmData.message"
      :type="confirmData.type"
      :loading="confirmData.loading"
      @confirm="confirmData.onConfirm"
    />
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { usePayments } from '@/composables/usePayments';
import AppButton from '@/components/ui/AppButton.vue';
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue';
import { formatDate } from '@/utils/formatters';
import { formatReadableLabel } from '@/utils/event-display';

const props = defineProps({
  orderId: { type: String, required: true },
  initialPayments: { type: Array, default: null },
  initialSummary: { type: Object, default: null },
});

const emit = defineEmits(['payment-changed']);

const { t } = useI18n();

const { payments, summary, loading, adding, loadPayments, addPayment, deletePayment } = usePayments(
  computed(() => props.orderId)
);

const showAddForm = ref(false);
const confirmData = ref({
  show: false,
  title: '',
  message: '',
  type: 'warning',
  loading: false,
  onConfirm: () => {},
});
const form = ref({
  amount: 0,
  method: 'cash',
  referenceNo: '',
  notes: '',
});

// 付款方式选项
const paymentMethods = computed(() => [
  { value: 'cash', label: t('order.payment.methods.cash') },
  { value: 'bank', label: t('order.payment.methods.bank') },
  { value: 'wechat', label: t('order.payment.methods.wechat') },
  { value: 'alipay', label: t('order.payment.methods.alipay') },
  { value: 'other', label: t('order.payment.methods.other') },
]);

// 表单验证
const isValid = computed(() => {
  return form.value.amount > 0 && form.value.amount <= summary.value.outstanding;
});

// 初始化数据
if (props.initialPayments) {
  payments.value = props.initialPayments;
}
if (props.initialSummary) {
  summary.value = props.initialSummary;
}

// 监听 orderId 变化重新加载
watch(
  () => props.orderId,
  async (newId) => {
    if (newId) {
      await loadPayments();
    }
  },
  { immediate: true }
);

/**
 * 获取付款方式标签
 */
function getMethodLabel(method) {
  const labels = {
    cash: t('order.payment.methods.cash'),
    bank: t('order.payment.methods.bank'),
    wechat: t('order.payment.methods.wechat'),
    alipay: t('order.payment.methods.alipay'),
    other: t('order.payment.methods.other'),
  };
  return labels[method] || formatReadableLabel(method);
}

/**
 * 取消添加
 */
function cancelAdd() {
  showAddForm.value = false;
  form.value = {
    amount: 0,
    method: 'cash',
    referenceNo: '',
    notes: '',
  };
}

/**
 * 提交付款
 */
async function handleSubmit() {
  if (!isValid.value) return;

  const success = await addPayment({
    amount: form.value.amount,
    method: form.value.method,
    referenceNo: form.value.referenceNo || undefined,
    notes: form.value.notes || undefined,
  });

  if (success) {
    cancelAdd();
    emit('payment-changed');
  }
}

/**
 * 删除付款记录
 */
async function handleDelete(paymentId) {
  confirmData.value = {
    show: true,
    title: t('common.confirmTitle'),
    message: t('order.payment.deleteConfirm'),
    type: 'warning',
    loading: false,
    onConfirm: async () => {
      confirmData.value.loading = true;
      try {
        const success = await deletePayment(paymentId);
        if (success) {
          emit('payment-changed');
        }
        confirmData.value.show = false;
      } finally {
        confirmData.value.loading = false;
      }
    },
  };
}
</script>
