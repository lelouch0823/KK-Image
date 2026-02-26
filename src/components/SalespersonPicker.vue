<template>
  <div class="space-y-2">
    <label v-if="label" class="text-secondary block text-sm font-medium">{{ label }}</label>
    
    <!-- 已选销售员标签 (Tags) -->
    <div v-if="selectedIds.length > 0" class="mb-2 flex flex-wrap gap-2">
      <span
        v-for="sp in selectedSalespersons"
        :key="sp.id"
        class="inline-flex items-center gap-1 rounded-full bg-[var(--color-primary)]/10 px-3 py-1 text-sm font-medium text-[var(--color-primary)] shadow-sm ring-1 ring-[var(--color-primary)]/20 ring-inset"
      >
        <span class="flex size-4 items-center justify-center rounded-full bg-[var(--color-primary)]/20 text-[10px]">
          {{ sp.name.charAt(0).toUpperCase() }}
        </span>
        {{ sp.name }}
        <button
          type="button"
          class="ml-0.5 rounded-full p-0.5 text-[var(--color-primary)]/60 transition-colors hover:bg-[var(--color-primary)]/20 hover:text-[var(--color-primary)]"
          @click.stop="remove(sp.id)"
        >
          <AppIcon name="x-mark" class="size-3.5" />
        </button>
      </span>
    </div>

    <!-- 触发选择弹窗的按钮 (代替下拉) -->
    <button
      type="button"
      class="flex w-full items-center justify-between rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] px-4 py-3 text-left shadow-sm transition-all hover:border-[var(--color-primary)] hover:bg-[var(--color-primary)]/5 focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)] focus:outline-none"
      @click="showModal = true"
    >
      <span class="text-secondary">{{ placeholder }}</span>
      <span class="flex items-center gap-2 text-xs font-medium text-[var(--color-primary)]">
        <AppIcon name="plus" class="size-4" />
        {{ t('spaceManager.select') || '选择' }}
      </span>
    </button>

    <SalespersonSelectModal
      :show="showModal"
      :initial-selected-ids="selectedIds"
      :multiple="multiple"
      :max-selection="maxSelection"
      @update:show="showModal = $event"
      @confirm="handleConfirm"
    />
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { API } from '@/utils/constants';
import AppIcon from '@/components/ui/AppIcon.vue';
import SalespersonSelectModal from '@/components/salesperson/SalespersonSelectModal.vue';

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
    default: '点击选择销售员',
  },
  multiple: {
    type: Boolean,
    default: true,
  },
  maxSelection: {
    type: Number,
    default: 0,
  },
});

const emit = defineEmits(['update:modelValue']);

const { t } = useI18n();

const showModal = ref(false);

const salespersons = ref([]);
const selectedIds = ref([...props.modelValue]);

watch(() => props.modelValue, (val) => {
  selectedIds.value = [...val];
}, { deep: true });

// 通过当前组件加载的列表或者之前回传的对象来映射名称
const selectedSalespersons = computed(() =>
  salespersons.value.filter((sp) => selectedIds.value.includes(sp.id))
);

// 此时加载的原因：如果直接由外部传入了 IDs（如编辑态），需要有名称才能渲染 tag
const loadSalespersons = async () => {
  try {
    const response = await fetch(API.SALESPERSONS, { credentials: 'include' });
    const result = await response.json();
    if (result.success && result.data) {
      salespersons.value = result.data.salespersons || result.data || [];
    }
  } catch (err) {
    console.error('Load salespersons failed:', err);
  }
};

const handleConfirm = (newSelectedIds, newSelectedObjects) => {
  // 合并对象到本地以保证 tag 显示（避免每次都需要加载完毕才显示）
  const existingIds = salespersons.value.map(s => s.id);
  newSelectedObjects.forEach(obj => {
    if (!existingIds.includes(obj.id)) {
      salespersons.value.push(obj);
    }
  });
  
  selectedIds.value = newSelectedIds;
  emit('update:modelValue', [...selectedIds.value]);
};

const remove = (id) => {
  const idx = selectedIds.value.indexOf(id);
  if (idx >= 0) {
    selectedIds.value.splice(idx, 1);
    emit('update:modelValue', [...selectedIds.value]);
  }
};

onMounted(() => {
  loadSalespersons();
});

</script>
