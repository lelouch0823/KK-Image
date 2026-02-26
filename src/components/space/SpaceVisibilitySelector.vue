<template>
  <div class="overflow-hidden rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)]">
    <!-- 卡片头部 -->
    <div class="flex items-center gap-3 border-b border-[var(--border-color)] px-5 py-4">
      <div class="flex size-9 items-center justify-center rounded-lg bg-[var(--color-primary)]/10">
        <AppIcon name="users" class="size-4.5 text-[var(--color-primary)]" />
      </div>
      <div class="flex-1">
        <h3 class="text-sm font-semibold text-[var(--text-main)]">{{ t('spaceManager.shareSettings') }}</h3>
        <p class="text-xs text-[var(--text-secondary)]">{{ shareModeDescription }}</p>
      </div>
    </div>

    <!-- 分享模式选择器 -->
    <div class="p-5">
      <div class="grid grid-cols-3 gap-2">
        <button
          v-for="mode in shareModes"
          :key="mode.value"
          type="button"
          class="group relative flex flex-col items-center gap-2 rounded-xl border p-3 transition-all duration-200"
          :class="modelValue === mode.value
            ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/5 shadow-sm'
            : 'border-[var(--border-color)] hover:border-[var(--border-hover)] hover:bg-[var(--bg-hover)]'"
          @click="updateShareMode(mode.value)"
        >
          <!-- 选中指示器 -->
          <span
            v-if="modelValue === mode.value"
            class="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-[var(--color-primary)] text-white"
          >
            <AppIcon name="check" class="size-2.5" stroke-width="4" />
          </span>
          <div
            class="flex size-9 items-center justify-center rounded-lg transition-colors"
            :class="modelValue === mode.value
              ? 'bg-[var(--color-primary)]/10 text-[var(--color-primary)]'
              : 'bg-[var(--bg-muted)] text-[var(--text-secondary)] group-hover:text-[var(--text-main)]'"
          >
            <component :is="mode.iconComponent" class="size-4.5" />
          </div>
          <span
            class="text-xs font-medium transition-colors"
            :class="modelValue === mode.value ? 'text-[var(--color-primary)]' : 'text-[var(--text-main)]'"
          >
            {{ mode.label }}
          </span>
        </button>
      </div>

      <!-- 选择销售员 (仅 selected 模式) - 带展开动画 -->
      <Transition
        enter-active-class="transition-all duration-200 ease-out"
        enter-from-class="max-h-0 opacity-0"
        enter-to-class="max-h-96 opacity-100"
        leave-active-class="transition-all duration-150 ease-in"
        leave-from-class="max-h-96 opacity-100"
        leave-to-class="max-h-0 opacity-0"
      >
        <div v-if="modelValue === 'selected'" class="mt-4 overflow-hidden">
          <SalespersonPicker
            :model-value="selectedSalespersons"
            :label="t('spaceManager.selectSalespersons') || '选择可见销售员'"
            :placeholder="t('spaceManager.selectSalespersonsPlaceholder') || '点击选择销售员'"
            @update:model-value="updateSalespersons"
          />
        </div>
      </Transition>

      <slot name="footer" />
    </div>
  </div>
</template>

<script setup>
import { computed, h } from 'vue';
import { useI18n } from '@/composables/useI18n';
import SalespersonPicker from '@/components/SalespersonPicker.vue';
import AppIcon from '@/components/ui/AppIcon.vue';

const props = defineProps({
  // shareMode: 'none' | 'selected' | 'all'
  modelValue: {
    type: String,
    default: 'none',
  },
  // selectedSalespersonIds: Array of IDs (strings or numbers)
  selectedSalespersons: {
    type: Array,
    default: () => [],
  },
});

const emit = defineEmits(['update:modelValue', 'update:selectedSalespersons']);

const { t } = useI18n();

// SVG 图标组件
const LockIcon = (_, { attrs }) => h(AppIcon, { name: 'lock-closed', ...attrs });
const UsersIcon = (_, { attrs }) => h(AppIcon, { name: 'users', ...attrs });
const GlobeIcon = (_, { attrs }) => h(AppIcon, { name: 'globe-alt', ...attrs });

const shareModes = computed(() => [
  { value: 'none', label: t('spaceManager.shareMode.none'), iconComponent: LockIcon },
  { value: 'selected', label: t('spaceManager.shareMode.selected'), iconComponent: UsersIcon },
  { value: 'all', label: t('spaceManager.shareMode.all'), iconComponent: GlobeIcon },
]);

// 描述文本
const shareModeDescription = computed(() => {
  switch (props.modelValue) {
    case 'none': return t('spaceManager.shareMode.noneDesc') || '不分享给任何销售';
    case 'selected': return t('spaceManager.shareMode.selectedDesc') || '仅特定销售可见';
    case 'all': return t('spaceManager.shareMode.allDesc') || '所有销售均可见';
    default: return '';
  }
});

const updateShareMode = (mode) => {
  emit('update:modelValue', mode);
  // 如果切换出 selected 模式，也可以选择不清理已选 ids，保存以备切换回来，此处由父组件决定是否清理
};

const updateSalespersons = (ids) => {
  emit('update:selectedSalespersons', ids);
};
</script>
