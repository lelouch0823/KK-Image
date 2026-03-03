<template>
  <Modal
    :model-value="show"
    size="md"
    :title="t('spaceManager.selectSalespersons') || '选择销售员'"
    body-class="!p-0"
    @update:model-value="$emit('update:show', $event)"
    @close="$emit('close')"
  >
    <div class="flex h-[60vh] flex-col md:h-[500px]">
      <!-- 搜索栏 -->
      <div class="border-b border-(--border-color) px-4 py-3">
        <div class="relative">
          <AppIcon
            name="magnifying-glass"
            class="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-(--text-muted)"
          />
          <input
            v-model="searchQuery"
            class="w-full rounded-lg border border-(--border-color) bg-(--bg-muted) py-2.5 pr-4 pl-9 text-sm text-(--text-main) transition-colors outline-none focus:border-primary focus:bg-(--bg-card) dark:focus:bg-(--bg-muted)"
          />
        </div>
      </div>

      <!-- 列表内容区 -->
      <div class="flex-1 overflow-y-auto p-2">
        <!-- 加载中 -->
        <div v-if="loading" class="flex h-32 items-center justify-center">
          <AppIcon name="spinner" class="size-6 animate-spin text-primary" />
        </div>
        
        <!-- 空状态 -->
        <div v-else-if="filteredSalespersons.length === 0" class="flex h-32 flex-col items-center justify-center py-8 text-(--text-muted)">
          <AppIcon name="users" class="mb-2 size-8 opacity-50" />
          <span class="text-sm">{{ t('salesperson.noAvailable') || '暂无销售员信息' }}</span>
        </div>
        
        <!-- 数据列表 -->
        <div v-else class="space-y-1">
          <button
            v-for="sp in filteredSalespersons"
            :key="sp.id"
            type="button"
            class="group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all duration-200"
            :class="localSelectedIds.includes(sp.id)
              ? 'bg-primary/10 ring-1 ring-primary/30 ring-inset dark:bg-primary/20 dark:ring-primary/50'
              : 'hover:bg-(--bg-hover) hover:shadow-sm'"
            @click="toggleSelection(sp.id)"
          >
            <!-- 单选与多选形态自适应 -->
            <span
              class="flex flex-shrink-0 items-center justify-center border transition-all duration-200"
              :class="[
                multiple ? 'size-5 rounded' : 'size-5 rounded-full',
                localSelectedIds.includes(sp.id)
                  ? 'border-primary bg-primary text-white shadow-primary/20 shadow-sm dark:shadow-none'
                  : 'border-(--border-strong) bg-(--bg-card) group-hover:border-primary dark:bg-(--bg-muted)'
              ]"
            >
              <template v-if="localSelectedIds.includes(sp.id)">
                <!-- Checkbox SVG -->
                <AppIcon v-if="multiple" name="check" class="size-3.5" />
                <!-- Radio Dot -->
                <div v-else class="size-2 rounded-full bg-white"></div>
              </template>
            </span>
            
            <!-- 头像占位 -->
            <div
              class="flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-medium shadow-sm"
              :class="localSelectedIds.includes(sp.id)
                ? 'bg-gradient-to-br from-primary to-primary/70 text-white shadow-primary/30 dark:shadow-none'
                : 'border border-(--border-color) bg-(--bg-muted) text-(--text-secondary) dark:bg-(--bg-card)'"
            >
              {{ sp.name.charAt(0).toUpperCase() }}
            </div>

            <!-- 信息 -->
            <div class="flex-1 overflow-hidden">
              <div
                class="truncate text-sm font-medium transition-colors"
                :class="localSelectedIds.includes(sp.id) ? 'text-primary' : 'text-(--text-main)'"
              >
                {{ sp.name }}
              </div>
              <div v-if="sp.store" class="truncate text-xs text-(--text-secondary)">{{ sp.store }}</div>
            </div>
          </button>
        </div>
      </div>
    </div>

    <!-- 底部操作栏 -->
    <template #footer>
      <div class="flex w-full items-center justify-between">
        <div class="text-sm text-(--text-secondary)">
          {{ t('common.selected') || '已选' }}: <span class="font-semibold text-primary">{{ localSelectedIds.length }}</span>
        </div>
        <div class="flex gap-3">
          <button
            class="rounded-lg px-4 py-2 text-sm font-medium text-(--text-secondary) transition-colors hover:bg-(--bg-hover) hover:text-(--text-main)"
            @click="handleCancel"
          >
            {{ t('common.cancel') || '取消' }}
          </button>
          <button
            class="rounded-lg bg-primary px-6 py-2 text-sm font-medium text-white shadow-sm transition-all hover:opacity-90 active:scale-95"
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
import { ref, computed, watch } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { API } from '@/utils/constants';
import Modal from '@/components/ui/Modal.vue';
import AppIcon from '@/components/ui/AppIcon.vue';

const props = defineProps({
  show: {
    type: Boolean,
    default: false,
  },
  initialSelectedIds: {
    type: Array,
    default: () => [],
  },
  multiple: {
    type: Boolean,
    default: true,
  },
  maxSelection: {
    type: Number,
    default: 0, // 0 = 无限制
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
  if (!props.multiple) {
    // 单选模式：直接替换，如果点击已选，允许取消（取决于业务需求，目前保持可取消状态以便灵活，或强制不取消）
    if (localSelectedIds.value[0] === id) {
      localSelectedIds.value = [];
    } else {
      localSelectedIds.value = [id];
    }
    return;
  }

  // 多选模式
  const index = localSelectedIds.value.indexOf(id);
  if (index > -1) {
    localSelectedIds.value.splice(index, 1);
  } else {
    if (props.maxSelection > 0 && localSelectedIds.value.length >= props.maxSelection) {
      // TODO: 若需要提示用户超过最大可选数量，可以在此处追加 Toast
      return;
    }
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
