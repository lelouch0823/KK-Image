<template>
  <div class="space-y-2">
    <label v-if="label" class="text-secondary block text-sm font-medium">{{ label }}</label>
    
    <!-- 已选销售员标签 (Tags) -->
    <div v-if="selectedIds.length > 0" class="mb-2 flex flex-wrap gap-2">
      <span
        v-for="sp in selectedSalespersons"
        :key="sp.id"
        class="bg-primary/10 text-primary ring-primary/20 inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-medium shadow-sm ring-1 ring-inset"
      >
        <span class="bg-primary/20 flex size-4 items-center justify-center rounded-full text-[10px]">
          {{ sp.name.charAt(0).toUpperCase() }}
        </span>
        {{ sp.name }}
        <AppButton
          type="button"
          variant="ghost"
          size="sm"
          class="text-primary/60 ml-0.5 !h-5 !w-5 rounded-full !px-0 hover:bg-primary/20 hover:text-primary"
          @click.stop="remove(sp.id)"
        >
          <template #icon-left>
            <AppIcon name="x-mark" class="size-3.5" />
          </template>
        </AppButton>
      </span>
    </div>

    <!-- 触发选择弹窗的按钮 (代替下拉) -->
    <AppButton
      type="button"
      variant="white"
      class="w-full !justify-between rounded-xl text-left shadow-sm hover:border-primary hover:bg-primary/5"
      @click="showModal = true"
    >
      <span class="text-secondary">{{ placeholder }}</span>
      <span class="text-primary flex items-center gap-2 text-xs font-medium">
        <AppIcon name="plus" class="size-4" />
        {{ t('spaceManager.select') || '选择' }}
      </span>
    </AppButton>

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
import { useAuth } from '@/composables/useAuth';
import { API } from '@/utils/constants';
import AppButton from '@/components/ui/AppButton.vue';
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
const { authFetch } = useAuth();

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
    const response = await authFetch(API.SALESPERSONS);
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
