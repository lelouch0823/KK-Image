<template>
  <div class="space-y-2">
    <label v-if="label" class="text-secondary block text-sm font-medium">{{ label }}</label>
    
    <!-- 已选销售员标签 -->
    <div v-if="selectedIds.length > 0" class="mb-2 flex flex-wrap gap-2">
      <span
        v-for="sp in selectedSalespersons"
        :key="sp.id"
        class="inline-flex items-center gap-1 rounded-full bg-[var(--color-primary-bg)] px-3 py-1 text-sm text-[var(--color-primary)]"
      >
        {{ sp.name }}
        <button
          type="button"
          class="ml-1 text-[var(--color-primary)] hover:text-[var(--color-danger)]"
          @click="remove(sp.id)"
        >
          <svg class="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </span>
    </div>

    <!-- 下拉选择器 -->
    <div class="relative">
      <button
        type="button"
        class="flex w-full items-center justify-between rounded-xl border border-[var(--border-color)] bg-white px-4 py-3 text-left transition-colors hover:border-[var(--border-hover)]"
        @click="isOpen = !isOpen"
      >
        <span class="text-secondary">{{ placeholder }}</span>
        <svg
          class="text-muted size-5 transition-transform"
          :class="{ 'rotate-180': isOpen }"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      <!-- 下拉列表 -->
      <Transition
        enter-active-class="transition ease-out duration-100"
        enter-from-class="transform opacity-0 scale-95"
        enter-to-class="transform opacity-100 scale-100"
        leave-active-class="transition ease-in duration-75"
        leave-from-class="transform opacity-100 scale-100"
        leave-to-class="transform opacity-0 scale-95"
      >
        <div
          v-if="isOpen"
          class="absolute z-50 mt-2 max-h-60 w-full overflow-auto rounded-xl border border-[var(--border-color)] bg-white shadow-xl"
        >
          <!-- 加载中 -->
          <div v-if="loading" class="flex items-center justify-center py-4">
            <svg class="size-5 animate-spin text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
          
          <!-- 空状态 -->
          <div v-else-if="availableSalespersons.length === 0" class="text-muted py-4 text-center text-sm">
            {{ t('salesperson.noAvailable') }}
          </div>
          
          <!-- 列表 -->
          <div v-else class="py-1">
            <button
              v-for="sp in availableSalespersons"
              :key="sp.id"
              type="button"
              class="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--bg-hover)]"
              @click="toggle(sp.id)"
            >
              <!-- 勾选状态 -->
              <span
                class="flex size-5 items-center justify-center rounded border"
                :class="selectedIds.includes(sp.id)
                  ? 'border-[var(--color-primary)] bg-[var(--color-primary)] text-white'
                  : 'border-[var(--border-color)]'"
              >
                <svg v-if="selectedIds.includes(sp.id)" class="size-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                </svg>
              </span>
              
              <!-- 信息 -->
              <div class="flex-1">
                <div class="text-primary font-medium">{{ sp.name }}</div>
                <div v-if="sp.store" class="text-secondary text-xs">{{ sp.store }}</div>
              </div>
            </button>
          </div>
        </div>
      </Transition>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { API } from '@/utils/constants';

const props = defineProps({
  modelValue: {
    type: Array,
    default: () => [],
  },
  label: {
    type: String,
    default: '',
  },
  placeholder: {
    type: String,
    default: '选择销售员',
  },
});

const emit = defineEmits(['update:modelValue']);

const { t } = useI18n();
const isOpen = ref(false);
const loading = ref(false);
const salespersons = ref([]);
const selectedIds = ref([...props.modelValue]);

// 同步 modelValue
watch(() => props.modelValue, (val) => {
  selectedIds.value = [...val];
}, { deep: true });

// 已选销售员对象
const selectedSalespersons = computed(() =>
  salespersons.value.filter((sp) => selectedIds.value.includes(sp.id))
);

// 可选销售员 (未选)
const availableSalespersons = computed(() => salespersons.value);

// 加载销售员列表
const loadSalespersons = async () => {
  loading.value = true;
  try {
    const response = await fetch(API.SALESPERSONS, { credentials: 'include' });
    const result = await response.json();
    if (result.success) {
      salespersons.value = result.data;
    }
  } catch (err) {
    console.error('Load salespersons failed:', err);
  } finally {
    loading.value = false;
  }
};

// 切换选择
const toggle = (id) => {
  const idx = selectedIds.value.indexOf(id);
  if (idx >= 0) {
    selectedIds.value.splice(idx, 1);
  } else {
    selectedIds.value.push(id);
  }
  emit('update:modelValue', [...selectedIds.value]);
};

// 移除
const remove = (id) => {
  const idx = selectedIds.value.indexOf(id);
  if (idx >= 0) {
    selectedIds.value.splice(idx, 1);
    emit('update:modelValue', [...selectedIds.value]);
  }
};

// 点击外部关闭
const handleClickOutside = (e) => {
  if (isOpen.value && !e.target.closest('.relative')) {
    isOpen.value = false;
  }
};

onMounted(() => {
  loadSalespersons();
  document.addEventListener('click', handleClickOutside);
});

// SOTA: 清理事件监听器防止内存泄漏
onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside);
});
</script>
