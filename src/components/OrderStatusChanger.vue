<template>
  <div class="relative inline-block text-left" ref="container">
    <button 
      @click="toggle"
      ref="triggerRef"
      class="inline-flex items-center justify-between gap-2 px-3 py-1.5 text-xs font-medium rounded-full border transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-primary/20"
      :class="currentStatusClass"
    >
      <span>{{ t(`order.statuses.${status}`) }}</span>
      <svg class="w-4 h-4 opacity-75" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
      </svg>
    </button>

    <!-- 下拉菜单 - 使用 Teleport 移到 body 避免被父元素 overflow 裁剪 -->
    <Teleport to="body">
      <div 
        v-if="isOpen" 
        class="fixed w-56 bg-white rounded-xl shadow-lg border border-[var(--border-color)] z-[100] overflow-hidden animate-fade-in ring-1 ring-black ring-opacity-5"
        :style="dropdownStyle"
      >
        <div class="p-2 border-b border-[var(--bg-muted)] bg-[var(--bg-muted)]/50">
          <h4 class="text-xs font-medium text-secondary px-2">{{ t('order.manage.changeStatus') }}</h4>
        </div>
        
        <div class="py-1 max-h-64 overflow-y-auto">
          <button
            v-for="s in statusOptions"
            :key="s"
            @click="selectStatus(s)"
            class="w-full text-left px-4 py-2 text-sm flex items-center justify-between hover:bg-[var(--bg-hover)] transition-colors group"
            :class="{'bg-primary/5 text-primary font-medium': s === status}"
          >
            <span 
              class="flex items-center gap-2"
              :class="{'font-medium': s === status}"
            >
              <span class="w-2 h-2 rounded-full" :class="getStatusDotColor(s)"></span>
              {{ t(`order.statuses.${s}`) }}
            </span>
            <svg v-if="s === status" class="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
            </svg>
          </button>
        </div>
      </div>
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
