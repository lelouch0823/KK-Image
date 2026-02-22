<template>
  <div class="flex-1 space-y-5 overflow-y-auto p-6">
    <!-- 销售可见性设置 -->
    <div class="overflow-hidden rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)]">
      <!-- 卡片头部 -->
      <div class="flex items-center gap-3 border-b border-[var(--border-color)] px-5 py-4">
        <div class="flex size-9 items-center justify-center rounded-lg bg-[var(--color-primary)]/10">
          <svg class="size-4.5 text-[var(--color-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
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
            :class="currentShareMode === mode.value
              ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/5 shadow-sm'
              : 'border-[var(--border-color)] hover:border-[var(--border-hover)] hover:bg-[var(--bg-hover)]'"
            @click="updateShareMode(mode.value)"
          >
            <!-- 选中指示器 -->
            <span
              v-if="currentShareMode === mode.value"
              class="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-[var(--color-primary)] text-white"
            >
              <svg class="size-2.5" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
              </svg>
            </span>
            <div
              class="flex size-9 items-center justify-center rounded-lg transition-colors"
              :class="currentShareMode === mode.value
                ? 'bg-[var(--color-primary)]/10 text-[var(--color-primary)]'
                : 'bg-[var(--bg-muted)] text-[var(--text-secondary)] group-hover:text-[var(--text-main)]'"
            >
              <component :is="mode.iconComponent" class="size-4.5" />
            </div>
            <span
              class="text-xs font-medium transition-colors"
              :class="currentShareMode === mode.value ? 'text-[var(--color-primary)]' : 'text-[var(--text-main)]'"
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
          <div v-if="currentShareMode === 'selected'" class="mt-4 overflow-hidden">
            <SalespersonPicker
              v-model="selectedSalespersonIds"
              :label="t('spaceManager.selectSalespersons') || '选择可见销售员'"
              :placeholder="t('spaceManager.selectSalespersonsPlaceholder') || '点击选择销售员'"
            />
          </div>
        </Transition>

        <!-- 保存按钮 -->
        <button
          :disabled="publishing || !hasChanges"
          class="mt-4 flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-medium transition-all disabled:cursor-not-allowed disabled:opacity-40"
          :class="hasChanges
            ? 'bg-[var(--color-primary)] text-[var(--text-inverse)] shadow-sm hover:opacity-90 active:scale-[0.98]'
            : 'bg-[var(--bg-muted)] text-[var(--text-secondary)]'"
          @click="saveShareSettings"
        >
          <svg v-if="publishing" class="size-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          {{ publishing ? t('common.saving') : (hasChanges ? t('spaceManager.saveShareSettings') : t('spaceManager.shareSettingsSaved')) }}
        </button>
      </div>
    </div>

    <!-- 公开链接区域 -->
    <div v-if="isPublic" class="overflow-hidden rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)]">
      <div class="flex items-center gap-3 border-b border-[var(--border-color)] px-5 py-4">
        <div class="flex size-9 items-center justify-center rounded-lg bg-[var(--color-success)]/10">
          <svg class="size-4.5 text-[var(--color-success)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
        </div>
        <div class="flex-1">
          <h3 class="text-sm font-semibold text-[var(--text-main)]">{{ t('spaceManager.publicLink') || '公开链接' }}</h3>
          <p class="text-xs text-[var(--text-secondary)]">{{ viewCount || 0 }} {{ t('spacePublic.views') }}</p>
        </div>
      </div>

      <div class="space-y-3 p-5">
        <div class="flex gap-2">
          <input
            type="text"
            readonly
            :value="shareUrl"
            class="flex-1 rounded-xl border border-[var(--border-color)] bg-[var(--bg-muted)] px-4 py-2.5 font-mono text-sm text-[var(--text-main)]"
          />
          <button
            class="flex items-center gap-2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] px-4 py-2.5 text-sm text-[var(--text-main)] transition-colors hover:bg-[var(--bg-hover)]"
            @click="copyLink"
          >
            <svg class="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
            </svg>
            {{ t('common.copy') }}
          </button>
        </div>
        <button
          :disabled="publishing"
          class="w-full rounded-xl border border-[var(--border-color)] py-2.5 text-sm text-[var(--text-secondary)] transition-colors hover:border-[var(--color-danger-text)] hover:text-[var(--color-danger-text)]"
          @click="$emit('unpublish')"
        >
          {{ t('spaceManager.shareCard.unpublish') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, h } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { useClipboard } from '@/composables/useClipboard';
import SalespersonPicker from '@/components/SalespersonPicker.vue';

const props = defineProps({
  isPublic: { type: Boolean, default: false },
  shareUrl: { type: String, default: '' },
  viewCount: { type: Number, default: 0 },
  publishing: { type: Boolean, default: false },
  shareMode: { type: String, default: 'none' },
  sharedSalespersons: { type: Array, default: () => [] },
});

const emit = defineEmits(['publish', 'unpublish', 'update-share-settings']);

const { t } = useI18n();
const { copy } = useClipboard();

// SVG 图标组件 (替代 emoji)
const LockIcon = (_, { attrs }) => h('svg', { fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24', ...attrs }, [
  h('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'stroke-width': '2', d: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z' }),
]);
const UsersIcon = (_, { attrs }) => h('svg', { fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24', ...attrs }, [
  h('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'stroke-width': '2', d: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z' }),
]);
const GlobeIcon = (_, { attrs }) => h('svg', { fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24', ...attrs }, [
  h('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'stroke-width': '2', d: 'M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z' }),
]);

const shareModes = computed(() => [
  { value: 'none', label: t('spaceManager.shareMode.none'), iconComponent: LockIcon },
  { value: 'selected', label: t('spaceManager.shareMode.selected'), iconComponent: UsersIcon },
  { value: 'all', label: t('spaceManager.shareMode.all'), iconComponent: GlobeIcon },
]);

const currentShareMode = ref(props.shareMode);
const selectedSalespersonIds = ref(props.sharedSalespersons.map((sp) => sp.id));

// 脏检查 - 判断是否有改动
const initialShareMode = ref(props.shareMode);
const initialSalespersonIds = ref([...props.sharedSalespersons.map((sp) => sp.id)]);

const hasChanges = computed(() => {
  if (currentShareMode.value !== initialShareMode.value) return true;
  if (currentShareMode.value === 'selected') {
    const a = [...selectedSalespersonIds.value].sort();
    const b = [...initialSalespersonIds.value].sort();
    return JSON.stringify(a) !== JSON.stringify(b);
  }
  return false;
});

// 描述文本
const shareModeDescription = computed(() => {
  switch (currentShareMode.value) {
    case 'none': return t('spaceManager.shareMode.noneDesc') || '不分享给任何销售';
    case 'selected': return t('spaceManager.shareMode.selectedDesc') || '仅特定销售可见';
    case 'all': return t('spaceManager.shareMode.allDesc') || '所有销售均可见';
    default: return '';
  }
});

watch(() => props.shareMode, (val) => {
  currentShareMode.value = val;
  initialShareMode.value = val;
});
watch(() => props.sharedSalespersons, (val) => {
  const ids = val.map((sp) => sp.id);
  selectedSalespersonIds.value = [...ids];
  initialSalespersonIds.value = [...ids];
}, { deep: true });

const updateShareMode = (mode) => {
  currentShareMode.value = mode;
};

const saveShareSettings = () => {
  emit('update-share-settings', {
    shareMode: currentShareMode.value,
    sharedSalespersonIds: currentShareMode.value === 'selected' ? selectedSalespersonIds.value : [],
  });
  // 保存后重置脏检查基线
  initialShareMode.value = currentShareMode.value;
  initialSalespersonIds.value = [...selectedSalespersonIds.value];
};

const copyLink = async () => {
  if (!props.shareUrl) return;
  await copy(props.shareUrl, {
    successMessage: t('share.linkCopied'),
    errorMessage: t('common.copyFailed'),
  });
};
</script>
