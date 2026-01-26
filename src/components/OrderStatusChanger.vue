<template>
  <div class="inline-block">
    <!-- 触发按钮 -->
    <button
      :disabled="loading"
      class="focus:ring-primary/30 focus:ring-2 focus:ring-offset-1 focus:outline-none inline-flex items-center justify-between gap-2 rounded-full border px-3.5 py-1.5 text-xs font-semibold shadow-sm transition-all duration-200 hover:shadow-md active:scale-95 disabled:opacity-50"
      :class="currentStatusClass"
      @click="openModal"
    >
      <span class="flex items-center gap-1.5">
        <span class="size-2 rounded-full" :class="getStatusDotColor(status)"></span>
        {{ t(`order.statuses.${status}`) }}
      </span>
      <svg class="size-3.5 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M8 9l4-4 4 4m0 6l-4 4-4-4"
        ></path>
      </svg>
    </button>

    <!-- 状态变更弹窗 -->
    <Teleport to="body">
      <transition name="fade-scale">
        <div
          v-if="showModal"
          class="fixed inset-0 z-[100] flex items-center justify-center bg-[var(--color-overlay-dim)] p-4 backdrop-blur-sm"
          @click.self="closeModal"
        >
          <div
            class="w-full max-w-md transform overflow-hidden rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] shadow-2xl transition-all"
            @click.stop
          >
            <!-- 顶部渐变装饰 + 图标 -->
            <div
              class="from-primary/10 relative flex h-20 items-center justify-center overflow-hidden bg-gradient-to-br via-[var(--color-info)]/10 to-[var(--color-success)]/10"
            >
              <div class="absolute inset-0 scale-150 transform opacity-20 blur-2xl">
                <div class="bg-primary absolute top-0 left-1/4 size-20 rounded-full"></div>
                <div
                  class="absolute right-1/4 bottom-0 size-16 rounded-full bg-[var(--color-success)]"
                ></div>
              </div>

              <div
                class="from-primary/20 to-primary/5 ring-primary/10 relative z-10 flex size-12 items-center justify-center rounded-xl bg-gradient-to-br ring-1"
              >
                <svg
                  class="text-primary size-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
              </div>
            </div>

            <!-- 标题 -->
            <div class="px-6 pt-5 pb-3 text-center">
              <h3 class="text-primary text-lg font-bold">{{ t('order.manage.changeStatus') }}</h3>
              <p class="text-secondary mt-1 text-sm">
                {{ t('order.manage.currentStatus') }}:
                <span class="text-primary font-medium">{{ t(`order.statuses.${status}`) }}</span>
              </p>
            </div>

            <!-- 状态选择列表 -->
            <div class="px-6 pb-4">
              <div class="grid grid-cols-2 gap-2">
                <button
                  v-for="s in statusOptions"
                  :key="s"
                  class="relative flex items-center gap-2.5 rounded-xl border-2 px-4 py-3 text-left transition-all duration-150"
                  :class="[
                    selectedStatus === s
                      ? 'border-primary bg-primary/5 ring-primary/20 ring-2'
                      : 'border-[var(--border-color)] hover:border-[var(--border-hover)] hover:bg-[var(--bg-hover)]',
                  ]"
                  @click="selectedStatus = s"
                >
                  <span
                    class="size-3 flex-shrink-0 rounded-full ring-2 ring-offset-1"
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

                  <!-- 选中勾 -->
                  <svg
                    v-if="selectedStatus === s"
                    class="text-primary absolute top-2 right-2 size-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2.5"
                      d="M5 13l4 4L19 7"
                    ></path>
                  </svg>
                </button>
              </div>
            </div>

            <div class="px-6 pb-4">
              <label class="text-secondary mb-2 block text-xs font-medium">
                {{ t('order.manage.statusNote') }}
                <span class="text-muted">({{ t('common.optional') }})</span>
              </label>
              <input
                ref="noteInput"
                v-model="statusNote"
                type="text"
                :placeholder="t('order.manage.statusNotePlaceholder')"
                class="input"
                @keyup.enter="handleConfirm"
              />
            </div>

            <!-- 危险操作提示 -->
            <div v-if="isDangerousStatus" class="px-6 pb-4">
              <div
                class="flex items-start gap-2 rounded-xl border border-[var(--color-danger)]/20 bg-[var(--color-danger-light)] p-3"
              >
                <svg
                  class="mt-0.5 size-5 flex-shrink-0 text-[var(--color-danger)]"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
                <p class="text-xs text-[var(--color-danger)]">
                  {{ t('order.manage.dangerousStatusWarning') }}
                </p>
              </div>
            </div>

            <!-- 操作按钮 -->
            <div class="flex items-center gap-3 px-6 pb-6">
              <button
                :disabled="submitting"
                class="text-secondary flex-1 rounded-xl bg-[var(--bg-muted)] px-4 py-2.5 text-sm font-semibold transition-all hover:bg-[var(--bg-hover)] active:scale-95 disabled:opacity-50"
                @click="closeModal"
              >
                {{ t('common.cancel') }}
              </button>
              <button
                :disabled="!canConfirm"
                :class="[
                  'flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-[var(--text-inverse)] shadow-lg transition-all active:scale-95',
                  isDangerousStatus
                    ? 'bg-[var(--color-danger)] shadow-[var(--color-danger)]/20 hover:bg-[var(--color-danger)]/90'
                    : 'bg-[var(--color-primary)] shadow-[var(--color-primary)]/20 hover:opacity-90',
                  !canConfirm ? 'cursor-not-allowed opacity-70' : '',
                ]"
                @click="handleConfirm"
              >
                <svg v-if="submitting" class="size-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle
                    class="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    stroke-width="4"
                  ></circle>
                  <path
                    class="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  ></path>
                </svg>
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

const props = defineProps({
  status: { type: String, required: true },
  loading: Boolean,
});

const emit = defineEmits(['change']);

const { t } = useI18n();

// 状态
const showModal = ref(false);
const selectedStatus = ref('');
const statusNote = ref('');
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
  () => selectedStatus.value === 'void' || selectedStatus.value === 'refunded'
);

// 是否可以确认
const canConfirm = computed(
  () => selectedStatus.value && selectedStatus.value !== props.status && !submitting.value
);

// 打开弹窗
const openModal = () => {
  if (props.loading) return;
  selectedStatus.value = props.status;
  statusNote.value = '';
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
    await emit('change', {
      status: selectedStatus.value,
      note: statusNote.value,
    });
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
</style>
