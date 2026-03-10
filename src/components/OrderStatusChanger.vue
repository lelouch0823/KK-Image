<template>
  <div class="inline-block">
    <!-- 触发按钮 -->
    <button
      type="button"
      :disabled="loading"
      class="focus-visible:ring-primary/30 focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:outline-none inline-flex items-center justify-between gap-2 rounded-full border px-3.5 py-1.5 text-xs font-semibold shadow-sm transition-all duration-200 hover:shadow-md active:scale-95 disabled:opacity-50"
      :class="currentStatusClass"
      @click="openModal"
    >
      <span class="flex items-center gap-1.5">
        <span class="size-2 rounded-full" :class="getStatusDotColor(status)"></span>
        {{ t(`order.statuses.${status}`) }}
      </span>
      <AppIcon name="chevron-up-down" class="size-3.5 opacity-60" />
    </button>

    <!-- 状态变更弹窗 -->
    <Teleport to="body">
      <transition name="fade-scale">
        <div
          v-if="showModal"
          class="fixed inset-0 z-[100] flex items-center justify-center bg-(--color-overlay-dim) p-4 backdrop-blur-sm"
          @click.self="closeModal"
        >
          <div
            class="w-full max-w-md transform overflow-hidden rounded-2xl border border-(--border-color) bg-(--bg-card) shadow-2xl transition-all"
            @click.stop
          >
            <!-- 顶部渐变装饰 + 图标 -->
            <div
              class="from-primary/10 via-info/10 to-success/10 relative flex h-20 items-center justify-center overflow-hidden bg-linear-to-br"
            >
              <div class="absolute inset-0 scale-150 transform opacity-20 blur-2xl">
                <div class="bg-primary absolute top-0 left-1/4 size-20 rounded-full"></div>
                <div
                  class="bg-success absolute right-1/4 bottom-0 size-16 rounded-full"
                ></div>
              </div>

              <div
                class="from-primary/20 to-primary/5 ring-primary/10 relative z-10 flex size-12 items-center justify-center rounded-xl bg-linear-to-br ring-1"
              >
                <AppIcon name="arrow-path" class="text-primary size-6" />
              </div>
            </div>

            <!-- 标题 -->
            <div class="px-6 pt-5 pb-3 text-center">
              <h3 class="text-primary text-lg font-bold">{{ t('order.manage.changeStatus') }}</h3>
              <p class="mt-1 text-sm text-(--text-secondary)">
                {{ t('order.manage.currentStatus') }}:
                <span class="text-primary font-medium">{{ t(`order.statuses.${status}`) }}</span>
              </p>
              <p class="mt-1 text-xs text-(--text-muted)">
                {{ t('order.manage.transitionHint') }}
              </p>
            </div>
            <div class="px-6 pb-4">
              <div
                class="border-info/20 bg-info-bg/40 rounded-xl border px-3 py-2"
                aria-live="polite"
              >
                <p class="text-info text-xs">{{ t(friendlyTipKey) }}</p>
              </div>
              <p
                v-if="!canUseForceOverride"
                class="mt-2 text-xs text-(--text-secondary)"
              >
                {{ t('order.manage.friendlyNoPermissionTip') }}
              </p>
            </div>

            <!-- 状态选择列表 -->
            <div class="px-6 pb-4">
              <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <button
                  v-for="s in orderedStatusOptions"
                  :key="s"
                  type="button"
                  :disabled="isOutOfFlowStatus(s) && !canUseForceOverride"
                  :aria-label="getStatusButtonAriaLabel(s)"
                  class="focus-visible:ring-primary/30 focus-visible:ring-2 focus-visible:outline-none relative flex cursor-pointer items-center gap-2.5 rounded-xl border-2 px-4 py-3 text-left transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50"
                  :class="[
                    selectedStatus === s
                      ? 'border-primary bg-primary/5 ring-primary/20 ring-2'
                      : 'border-(--border-color) hover:border-(--border-hover) hover:bg-(--bg-hover)',
                    isOutOfFlowStatus(s) ? 'border-warning/40' : '',
                  ]"
                  @click="selectedStatus = s"
                >
                  <span
                    class="size-3 shrink-0 rounded-full ring-2 ring-offset-1"
                    :class="[
                      getStatusDotColor(s),
                      selectedStatus === s ? 'ring-current/30' : 'ring-transparent',
                    ]"
                  ></span>
                  <span
                    class="text-sm"
                    :class="selectedStatus === s ? 'text-primary font-semibold' : 'text-primary'"
                  >
                    {{ t(`order.statuses.${s}`) }}
                  </span>

                  <span
                    class="ml-auto rounded-full px-2 py-0.5 text-[10px] font-medium"
                    :class="[
                      s === status
                        ? 'bg-(--bg-muted) text-(--text-secondary)'
                        : isOutOfFlowStatus(s)
                          ? 'bg-warning/15 text-warning'
                          : 'bg-success/15 text-success',
                    ]"
                  >
                    {{ getStatusTagText(s) }}
                  </span>

                  <!-- 选中勾 -->
                  <AppIcon
                    v-if="selectedStatus === s"
                    name="check"
                    class="text-primary absolute top-2 right-2 size-4"
                  />
                </button>
              </div>
            </div>

            <div class="px-6 pb-4">
              <label class="mb-2 block text-xs font-medium text-(--text-secondary)">
                {{ t('order.manage.statusNote') }}
                <span v-if="!requiresForceOverride" class="text-(--text-muted)">({{ t('common.optional') }})</span>
                <span v-else class="text-danger">*</span>
              </label>
              <input
                ref="noteInput"
                v-model="statusNote"
                type="text"
                :placeholder="t('order.manage.statusNotePlaceholder')"
                class="input"
                :aria-required="requiresForceOverride ? 'true' : 'false'"
                @keyup.enter="handleConfirm"
              />
              <p
                v-if="requiresForceOverride && !forceReasonValid"
                role="alert"
                class="text-warning mt-2 text-xs"
              >
                {{ t('order.manage.forceReasonRequired') }}
              </p>
            </div>

            <div v-if="requiresForceOverride" class="px-6 pb-4">
              <div aria-live="polite" class="border-warning/30 rounded-xl border bg-(--color-warning-bg)/50 p-3">
                <p class="text-sm text-(--text-main)">
                  {{ t('order.manage.forceTransitionWarning') }}
                </p>
                <label class="mt-2 flex items-center gap-2 text-sm text-(--text-main)">
                  <input
                    v-model="forceOverrideConfirmed"
                    :disabled="!canUseForceOverride"
                    type="checkbox"
                    class="size-4 rounded border-(--border-color)"
                  />
                  <span v-if="canUseForceOverride">{{ t('order.manage.forceTransitionConfirm') }}</span>
                  <span v-else class="text-danger">{{ t('order.manage.forceTransitionNoPermission') }}</span>
                </label>
              </div>
            </div>

            <!-- 危险操作提示 -->
            <div v-if="isDangerousStatus" class="px-6 pb-4">
              <div
                aria-live="polite"
                class="border-danger/20 bg-danger-bg flex items-start gap-2 rounded-xl border p-3"
              >
                <AppIcon
                  name="exclamation-triangle"
                  class="text-danger mt-0.5 size-5 shrink-0"
                />
                <p class="text-danger text-xs">
                  {{ t('order.manage.dangerousStatusWarning') }}
                </p>
              </div>
            </div>

            <!-- 操作按钮 -->
            <div class="flex items-center gap-3 px-6 pb-6">
              <button
                type="button"
                :disabled="submitting"
                class="rounded-xl bg-(--bg-muted) px-4 py-2.5 text-sm font-semibold text-(--text-secondary) transition-all hover:bg-(--bg-hover) active:scale-95 disabled:opacity-50"
                @click="closeModal"
              >
                {{ t('common.cancel') }}
              </button>
              <button
                type="button"
                :disabled="!canConfirm"
                :class="[
                  'flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-(--text-inverse) shadow-lg transition-all active:scale-95',
                  isDangerousStatus
                    ? 'bg-danger shadow-danger/20 hover:bg-danger/90'
                    : 'bg-primary shadow-primary/20 hover:opacity-90',
                  !canConfirm ? 'cursor-not-allowed opacity-70' : '',
                ]"
                @click="handleConfirm"
              >
                <AppIcon v-if="submitting" name="spinner" class="size-4 animate-spin" />
                {{ t('common.confirm') }}
              </button>
            </div>
          </div>
        </div>
      </transition>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { STATUS_OPTIONS, STATUS_STYLES, STATUS_DOTS } from '@/utils/status';
import {
  getAllowedOrderTransitions,
  hasForceStatusPermission,
  isHighRiskOrderStatus,
} from '@/utils/order-state-machine';

const props = defineProps({
  status: { type: String, required: true },
  loading: Boolean,
  permissions: { type: Array, default: () => [] },
  // 异步回调：返回 Promise 以便弹窗等待 API 完成后再关闭
  onStatusChange: { type: Function, default: null },
});

const emit = defineEmits(['change']);

const { t } = useI18n();

// 状态
const showModal = ref(false);
const selectedStatus = ref('');
const statusNote = ref('');
const forceOverrideConfirmed = ref(false);
const submitting = ref(false);
const noteInput = ref(null);

// 状态选项
const statusOptions = STATUS_OPTIONS;

// 当前状态样式
const currentStatusClass = computed(() => STATUS_STYLES[props.status] || STATUS_STYLES.pending);

// 获取状态圆点颜色
const getStatusDotColor = (s) => STATUS_DOTS[s] || 'bg-gray-400';

// 是否为危险状态
const isDangerousStatus = computed(
  () => isHighRiskOrderStatus(selectedStatus.value)
);

const allowedTransitions = computed(() => getAllowedOrderTransitions(props.status));
const isOutOfFlowStatus = (s) => s !== props.status && !allowedTransitions.value.includes(s);
const requiresForceOverride = computed(() => selectedStatus.value && isOutOfFlowStatus(selectedStatus.value));
const canUseForceOverride = computed(() => hasForceStatusPermission(props.permissions));
const forceReasonValid = computed(() => String(statusNote.value || '').trim().length > 0);
const orderedStatusOptions = computed(() => {
  const inFlow = statusOptions.filter((s) => s === props.status || allowedTransitions.value.includes(s));
  const outOfFlow = statusOptions.filter((s) => !inFlow.includes(s));
  return [...inFlow, ...outOfFlow];
});

const getStatusTagText = (s) => {
  if (s === props.status) return t('order.manage.currentTag');
  if (isOutOfFlowStatus(s)) return t('order.manage.forceTag');
  return t('order.manage.flowTag');
};

const getStatusButtonAriaLabel = (s) => {
  const label = t(`order.statuses.${s}`);
  const tag = getStatusTagText(s);
  return `${label} - ${tag}`;
};

const friendlyTipKey = computed(() => {
  if (!selectedStatus.value || selectedStatus.value === props.status) {
    return 'order.manage.friendlyPickTip';
  }
  if (requiresForceOverride.value) {
    if (!canUseForceOverride.value) return 'order.manage.friendlyNoPermissionTip';
    if (!forceOverrideConfirmed.value) return 'order.manage.friendlyForceConfirmTip';
    if (!forceReasonValid.value) return 'order.manage.friendlyForceReasonTip';
    return 'order.manage.friendlyForceReadyTip';
  }
  if (isHighRiskOrderStatus(selectedStatus.value)) {
    return 'order.manage.friendlyRiskTip';
  }
  return 'order.manage.friendlyFlowTip';
});

// 是否可以确认
const canConfirm = computed(() => {
  if (!selectedStatus.value || selectedStatus.value === props.status || submitting.value) return false;
  if (!requiresForceOverride.value) return true;
  if (!canUseForceOverride.value) return false;
  if (!forceOverrideConfirmed.value) return false;
  return forceReasonValid.value;
});

// 打开弹窗
const openModal = () => {
  if (props.loading) return;
  selectedStatus.value = props.status;
  statusNote.value = '';
  forceOverrideConfirmed.value = false;
  showModal.value = true;
};

// 关闭弹窗
const closeModal = () => {
  if (submitting.value) return;
  showModal.value = false;
};

// 确认变更
const handleConfirm = async () => {
  if (!canConfirm.value) return;

  submitting.value = true;
  try {
    const payload = {
      status: selectedStatus.value,
      note: statusNote.value,
      force: requiresForceOverride.value && forceOverrideConfirmed.value,
    };

    // SOTA: 使用 onStatusChange prop 回调实现真正的异步等待
    // 确保弹窗在 API 调用完成后才关闭，避免用户打开详情时数据未刷新
    if (props.onStatusChange) {
      await props.onStatusChange(payload);
    } else {
      emit('change', payload);
    }
    showModal.value = false;
  } finally {
    submitting.value = false;
  }
};

// ESC 关闭
const handleKeyDown = (e) => {
  if (!showModal.value) return;
  if (e.key === 'Escape' && !submitting.value) {
    closeModal();
  }
};

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown);
});

// 弹窗打开时聚焦输入框
watch(showModal, (val) => {
  if (val) {
    nextTick(() => noteInput.value?.focus());
  }
});
</script>

<style scoped>
.fade-scale-enter-active,
.fade-scale-leave-active {
  transition: opacity 0.3s ease;
}
.fade-scale-enter-from,
.fade-scale-leave-to {
  opacity: 0;
}
.fade-scale-enter-active .transform {
  transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.fade-scale-enter-from .transform {
  transform: scale(0.9);
}

@media (prefers-reduced-motion: reduce) {
  .fade-scale-enter-active,
  .fade-scale-leave-active,
  .fade-scale-enter-active .transform {
    transition: none !important;
  }
}
</style>
