<template>
  <div class="relative inline-block text-left" ref="container">
    <button 
      @click="toggle"
      ref="triggerRef"
      class="inline-flex items-center justify-between gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-full border shadow-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-primary/30 hover:shadow-md active:scale-95"
      :class="currentStatusClass"
    >
      <span class="flex items-center gap-1.5">
        <span class="w-2 h-2 rounded-full" :class="getStatusDotColor(status)"></span>
        {{ t(`order.statuses.${status}`) }}
      </span>
      <svg class="w-3.5 h-3.5 opacity-60 transition-transform duration-200" :class="{ 'rotate-180': isOpen }" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
      </svg>
    </button>

    <!-- 下拉菜单 - 使用 Teleport 移到 body 避免被父元素 overflow 裁剪 -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition duration-200 ease-out"
        enter-from-class="opacity-0 scale-95 -translate-y-1"
        enter-to-class="opacity-100 scale-100 translate-y-0"
        leave-active-class="transition duration-150 ease-in"
        leave-from-class="opacity-100 scale-100 translate-y-0"
        leave-to-class="opacity-0 scale-95 -translate-y-1"
      >
        <div 
          v-if="isOpen" 
          class="fixed w-60 bg-white rounded-2xl shadow-xl border border-[var(--border-color)] z-[100] overflow-hidden ring-1 ring-black/5"
          :style="dropdownStyle"
        >
          <!-- 顶部渐变装饰条 -->
          <div class="h-1 bg-gradient-to-r from-primary via-[var(--color-info)] to-[var(--color-success)]"></div>
          
          <div class="p-3 border-b border-[var(--bg-muted)] bg-gradient-to-b from-[var(--bg-muted)]/50 to-transparent">
            <h4 class="text-xs font-semibold text-secondary">{{ t('order.manage.changeStatus') }}</h4>
          </div>
          
          <div class="py-2 max-h-64 overflow-y-auto">
            <button
              v-for="s in statusOptions"
              :key="s"
              @click="selectStatus(s)"
              class="w-full text-left px-4 py-2.5 text-sm flex items-center justify-between transition-all duration-150 group"
              :class="[
                s === status 
                  ? 'bg-primary/5 text-primary' 
                  : 'hover:bg-[var(--bg-hover)] text-primary'
              ]"
            >
              <span class="flex items-center gap-2.5">
                <span 
                  class="w-2.5 h-2.5 rounded-full ring-2 ring-offset-1 transition-transform duration-150 group-hover:scale-110" 
                  :class="[getStatusDotColor(s), s === status ? 'ring-current/30' : 'ring-transparent']"
                ></span>
                <span :class="{'font-semibold': s === status}">{{ t(`order.statuses.${s}`) }}</span>
              </span>
              <svg v-if="s === status" class="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"></path>
              </svg>
            </button>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- 备注输入弹窗 -->
    <Modal v-model="showNoteModal" :title="t('order.manage.statusNote')" size="sm">
      <div class="py-2">
        <p class="text-sm text-secondary mb-4">
          {{ t('order.timeline.statusChanged') }} 
          <span class="font-medium text-primary mx-1">{{ t(`order.statuses.${status}`) }}</span>
          →
          <span class="font-medium text-primary mx-1">{{ t(`order.statuses.${pendingStatus}`) }}</span>
        </p>
        <label class="block text-xs font-medium text-secondary mb-1">
          {{ t('order.manage.statusNote') }}
        </label>
        <input 
          v-model="statusNote"
          type="text"
          :placeholder="t('order.manage.statusNotePlaceholder')"
          class="input"
          @keyup.enter="confirmChange"
          autofocus
        >
      </div>
      <template #footer>
        <button @click="cancelChange" class="btn btn-secondary">{{ t('common.cancel') }}</button>
        <button @click="confirmChange" :disabled="submitting" class="btn btn-primary">
          <svg v-if="submitting" class="w-4 h-4 animate-spin mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
          </svg>
          {{ t('common.confirm') }}
        </button>
      </template>
    </Modal>

    <!-- Confirm Dialog (用于重要状态变更提示) -->
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
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { STATUS_OPTIONS, STATUS_STYLES, STATUS_DOTS } from '@/utils/status';
import Modal from '@/components/ui/Modal.vue';
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue';

const props = defineProps({
  status: { type: String, required: true },
  loading: Boolean
});

const emit = defineEmits(['change']);

const { t } = useI18n();

const isOpen = ref(false);
const container = ref(null);
const triggerRef = ref(null);
const pendingStatus = ref(null);
const statusNote = ref('');
const submitting = ref(false);
const showNoteModal = ref(false);
const dropdownPosition = ref({ top: 0, right: 0 });

// 确认弹窗状态
const confirmData = ref({
  show: false,
  title: '',
  message: '',
  type: 'primary',
  loading: false,
  onConfirm: () => {}
});

const statusOptions = STATUS_OPTIONS;

const currentStatusClass = computed(() => STATUS_STYLES[props.status] || STATUS_STYLES.pending);

const getStatusDotColor = (s) => STATUS_DOTS[s] || 'bg-gray-400';

// 计算下拉菜单位置
const dropdownStyle = computed(() => ({
  top: `${dropdownPosition.value.top}px`,
  right: `${dropdownPosition.value.right}px`
}));

const updateDropdownPosition = () => {
  if (triggerRef.value) {
    const rect = triggerRef.value.getBoundingClientRect();
    dropdownPosition.value = {
      top: rect.bottom + 8,
      right: window.innerWidth - rect.right
    };
  }
};

const toggle = () => {
  if (!props.loading) {
    isOpen.value = !isOpen.value;
    if (isOpen.value) {
      nextTick(updateDropdownPosition);
    }
  }
};

const selectStatus = (s) => {
  if (s === props.status) return;
  
  // 对于重要状态变更（如作废、退款），使用 ConfirmDialog
  if (s === 'void' || s === 'refunded') {
    confirmData.value = {
      show: true,
      title: t('order.manage.confirmStatusChange'),
      message: t('order.manage.confirmStatusChangeDesc', { status: t(`order.statuses.${s}`) }),
      type: 'danger',
      onConfirm: () => {
        pendingStatus.value = s;
        showNoteModal.value = true;
        confirmData.value.show = false;
      }
    };
  } else {
    pendingStatus.value = s;
    showNoteModal.value = true;
  }
  
  isOpen.value = false;
  statusNote.value = '';
};

const cancelChange = () => {
  pendingStatus.value = null;
  statusNote.value = '';
  showNoteModal.value = false;
};

const confirmChange = async () => {
  if (submitting.value) return;
  submitting.value = true;
  try {
    await emit('change', {
      status: pendingStatus.value,
      note: statusNote.value
    });
    pendingStatus.value = null;
    showNoteModal.value = false;
  } finally {
    submitting.value = false;
  }
};

// 点击外部关闭
const handleClickOutside = (e) => {
  if (container.value && !container.value.contains(e.target)) {
    isOpen.value = false;
  }
};

onMounted(() => document.addEventListener('click', handleClickOutside));
onUnmounted(() => document.removeEventListener('click', handleClickOutside));
</script>

<style scoped>
@keyframes fade-in {
  from { opacity: 0; transform: translateY(-5px); }
  to { opacity: 1; transform: translateY(0); }
}
.animate-fade-in {
  animation: fade-in 0.15s ease-out;
}

@keyframes scale-in {
  from { opacity: 0; transform: scale(0.95); }
  to { opacity: 1; transform: scale(1); }
}
.animate-scale-in {
  animation: scale-in 0.2s ease-out;
}
</style>
