<template>
  <div class="flex-1 space-y-5 overflow-y-auto p-6">
    <!-- 销售可见性设置 -->
    <SpaceVisibilitySelector
      v-model="currentShareMode"
      v-model:selected-salespersons="selectedSalespersonIds"
    >
      <template #footer>
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
      </template>
    </SpaceVisibilitySelector>

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
import { ref, computed, watch } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { useClipboard } from '@/composables/useClipboard';
import SpaceVisibilitySelector from '@/components/space/SpaceVisibilitySelector.vue';

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

watch(() => props.shareMode, (val) => {
  currentShareMode.value = val;
  initialShareMode.value = val;
});
watch(() => props.sharedSalespersons, (val) => {
  const ids = val.map((sp) => sp.id);
  selectedSalespersonIds.value = [...ids];
  initialSalespersonIds.value = [...ids];
}, { deep: true });

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
