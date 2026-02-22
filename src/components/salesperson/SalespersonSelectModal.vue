<template>
  <Modal
    :model-value="show"
    size="md"
    :title="t('spaceManager.selectSalespersons') || '选择销售员'"
    body-class="!p-0"
    @update:model-value="$emit('update:show', $event)"
    @close="$emit('close')"
  >
    <div class="flex flex-col h-[60vh] md:h-[500px]">
      <!-- 搜索栏 -->
      <div class="border-b border-[var(--border-color)] px-4 py-3">
        <div class="relative">
          <svg
            class="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--text-muted)]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            v-model="searchQuery"
            type="text"
            class="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-muted)] py-2.5 pl-9 pr-4 text-sm text-[var(--text-main)] outline-none transition-colors focus:border-[var(--color-primary)] focus:bg-[var(--bg-card)]"
            :placeholder="t('common.search') || '搜索销售员姓名...'"
          />
        </div>
      </div>

      <!-- 列表内容区 -->
      <div class="flex-1 overflow-y-auto p-2">
        <!-- 加载中 -->
        <div v-if="loading" class="flex h-32 items-center justify-center">
          <svg class="size-6 animate-spin text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
        
        <!-- 空状态 -->
        <div v-else-if="filteredSalespersons.length === 0" class="flex h-32 flex-col items-center justify-center py-8 text-[var(--text-muted)]">
          <svg class="mb-2 size-8 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
          <span class="text-sm">{{ t('salesperson.noAvailable') || '暂无销售员信息' }}</span>
        </div>
        
        <!-- 数据列表 -->
        <div v-else class="space-y-1">
          <button
            v-for="sp in filteredSalespersons"
            :key="sp.id"
            type="button"
            class="group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-[var(--bg-hover)]"
            @click="toggleSelection(sp.id)"
          >
            <!-- 勾选复选框 -->
            <span
              class="flex size-5 shrink-0 items-center justify-center rounded border transition-colors"
              :class="localSelectedIds.includes(sp.id)
                ? 'border-[var(--color-primary)] bg-[var(--color-primary)] text-white'
                : 'border-[var(--border-strong)] bg-[var(--bg-card)] group-hover:border-[var(--color-primary)]'"
            >
              <svg v-if="localSelectedIds.includes(sp.id)" class="size-3.5" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
              </svg>
            </span>
            
            <!-- 头像占位 -->
            <div class="flex size-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary)]/10 text-[var(--color-primary)] font-medium text-xs">
              {{ sp.name.charAt(0).toUpperCase() }}
            </div>

            <!-- 信息 -->
            <div class="flex-1 overflow-hidden">
              <div class="truncate text-sm font-medium text-[var(--text-main)]">{{ sp.name }}</div>
              <div v-if="sp.store" class="truncate text-xs text-[var(--text-secondary)]">{{ sp.store }}</div>
            </div>
          </button>
        </div>
      </div>
    </div>

    <!-- 底部操作栏 -->
    <template #footer>
      <div class="flex w-full items-center justify-between">
        <div class="text-sm text-[var(--text-secondary)]">
          {{ t('common.selected') || '已选' }}: <span class="font-semibold text-[var(--color-primary)]">{{ localSelectedIds.length }}</span>
        </div>
        <div class="flex gap-3">
          <button
            class="rounded-lg px-4 py-2 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-main)]"
            @click="handleCancel"
          >
            {{ t('common.cancel') || '取消' }}
          </button>
          <button
            class="rounded-lg bg-[var(--color-primary)] px-6 py-2 text-sm font-medium text-white shadow-sm transition-all hover:opacity-90 active:scale-95"
            @click="handleConfirm"
          >
            {{ t('common.confirm') || '确定' }}
          </button>
        </div>
      </div>
    </template>
  </Modal>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { API } from '@/utils/constants';
import Modal from '@/components/ui/Modal.vue';

const props = defineProps({
  show: {
    type: Boolean,
    default: false,
  },
  initialSelectedIds: {
    type: Array,
    default: () => [],
  },
});

const emit = defineEmits(['update:show', 'close', 'confirm']);

const { t } = useI18n();

const loading = ref(false);
const salespersons = ref([]);
const searchQuery = ref('');

// 内部维护的选中态
const localSelectedIds = ref([]);

// 当弹窗打开时，初始化本地选中状态并加载数据
watch(() => props.show, (val) => {
  if (val) {
    localSelectedIds.value = [...props.initialSelectedIds];
    searchQuery.value = '';
    if (salespersons.value.length === 0) {
      loadSalespersons();
    }
  }
});

const loadSalespersons = async () => {
  loading.value = true;
  try {
    const response = await fetch(API.SALESPERSONS, { credentials: 'include' });
    const result = await response.json();
    if (result.success && result.data) {
      salespersons.value = result.data.salespersons || result.data || [];
    }
  } catch (err) {
    console.error('Load salespersons failed:', err);
  } finally {
    loading.value = false;
  }
};

const filteredSalespersons = computed(() => {
  if (!searchQuery.value) return salespersons.value;
  const q = searchQuery.value.toLowerCase();
  return salespersons.value.filter(sp => 
    sp.name.toLowerCase().includes(q) || 
    (sp.store && sp.store.toLowerCase().includes(q))
  );
});

const toggleSelection = (id) => {
  const index = localSelectedIds.value.indexOf(id);
  if (index > -1) {
    localSelectedIds.value.splice(index, 1);
  } else {
    localSelectedIds.value.push(id);
  }
};

const handleCancel = () => {
  emit('update:show', false);
  emit('close');
};

const handleConfirm = () => {
  const selectedObjects = salespersons.value.filter(sp => localSelectedIds.value.includes(sp.id));
  emit('confirm', [...localSelectedIds.value], selectedObjects);
  emit('update:show', false);
};
</script>
