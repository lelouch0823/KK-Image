<template>
  <div class="flex-1 space-y-4 overflow-y-auto p-6">
    <!-- 分享设置卡片 -->
    <div
      class="rounded-2xl border border-[var(--color-primary)]/20 bg-gradient-to-br from-[var(--color-primary)]/5 to-[var(--color-primary)]/10 p-5"
    >
      <div class="mb-4 flex items-center gap-3">
        <div class="flex size-10 items-center justify-center rounded-xl bg-[var(--color-primary)]/10">
          <svg
            class="size-5 text-[var(--color-primary)]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
            />
          </svg>
        </div>
        <div class="flex-1">
          <h3 class="font-semibold text-[var(--color-primary)]">{{ t('spaceManager.shareSettings') }}</h3>
          <p class="text-sm text-[var(--text-secondary)]">
            {{ shareModeLabel }}
          </p>
        </div>
      </div>

      <!-- 分享模式选择器 -->
      <div class="mb-4 space-y-3">
        <label class="block text-sm font-medium text-[var(--text-secondary)]">{{ t('spaceManager.shareMode.label') || '分享模式' }}</label>
        <div class="flex gap-2">
          <button
            v-for="mode in shareModes"
            :key="mode.value"
            type="button"
            class="flex flex-1 flex-col items-center gap-2 rounded-xl border p-3  transition-all"
            :class="currentShareMode === mode.value
              ? 'border-[var(--color-primary)] bg-[var(--color-primary-bg)]'
              : 'border-[var(--border-color)] hover:border-[var(--border-hover)]'"
            @click="updateShareMode(mode.value)"
          >
            <span class="text-lg">{{ mode.icon }}</span>
            <span class="text-sm font-medium" :class="currentShareMode === mode.value ? 'text-[var(--color-primary)]' : 'text-[var(--text-main)]'">
              {{ mode.label }}
            </span>
          </button>
        </div>
      </div>

      <!-- 选择销售员 (仅 selected 模式) -->
      <div v-if="currentShareMode === 'selected'" class="mb-4">
        <SalespersonPicker
          v-model="selectedSalespersonIds"
          :label="t('spaceManager.selectSalespersons') || '选择可见销售员'"
          :placeholder="t('spaceManager.selectSalespersonsPlaceholder') || '点击选择销售员'"
        />
      </div>

      <!-- 保存分享设置按钮 -->
      <button
        :disabled="publishing"
        class="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--color-primary)] py-3 font-medium text-[var(--text-inverse)] shadow-[var(--color-primary)]/20 shadow-lg transition-all hover:opacity-90 disabled:opacity-50"
        @click="saveShareSettings"
      >
        <svg v-if="publishing" class="size-5 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        {{ publishing ? t('common.saving') : t('common.save') }}
      </button>
    </div>

    <!-- 公开链接区域 (仅 is_public 为 true 时) -->
    <div v-if="isPublic" class="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5">
      <div class="mb-4 flex items-center gap-3">
        <div class="flex size-10 items-center justify-center rounded-xl bg-[var(--color-success)]/10">
          <svg class="size-5 text-[var(--color-success)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101" />
          </svg>
        </div>
        <div class="flex-1">
          <h3 class="font-semibold text-[var(--color-success)]">{{ t('spaceManager.publicLink') || '公开链接' }}</h3>
          <p class="text-sm text-[var(--text-secondary)]">{{ viewCount || 0 }} {{ t('spacePublic.views') }}</p>
        </div>
      </div>

      <!-- 链接显示 -->
      <div class="flex gap-2">
        <input
          type="text"
          readonly
          :value="shareUrl"
          class="flex-1 rounded-xl border border-[var(--border-color)] bg-[var(--bg-muted)] px-4 py-2.5 font-mono text-sm text-[var(--text-main)]"
        />
        <button
          class="flex items-center gap-2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] px-4 py-2.5 text-[var(--text-main)] transition-colors hover:bg-[var(--bg-hover)]"
          @click="copyLink"
        >
          <svg class="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
          </svg>
          {{ t('common.copy') }}
        </button>
      </div>

      <!-- 取消公开 -->
      <button
        :disabled="publishing"
        class="mt-3 w-full rounded-xl border border-[var(--border-color)] py-2.5 text-sm text-[var(--text-secondary)] transition-colors hover:border-[var(--color-danger-text)] hover:text-[var(--color-danger-text)]"
        @click="$emit('unpublish')"
      >
        {{ t('spaceManager.shareCard.unpublish') }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { useClipboard } from '@/composables/useClipboard';
import SalespersonPicker from '@/components/SalespersonPicker.vue';

const props = defineProps({
  isPublic: {
    type: Boolean,
    default: false,
  },
  shareUrl: {
    type: String,
    default: '',
  },
  viewCount: {
    type: Number,
    default: 0,
  },
  publishing: {
    type: Boolean,
    default: false,
  },
  // 新增: 当前分享模式
  shareMode: {
    type: String,
    default: 'none',
  },
  // 新增: 已分享的销售员列表
  sharedSalespersons: {
    type: Array,
    default: () => [],
  },
});

const emit = defineEmits(['publish', 'unpublish', 'update-share-settings']);

const { t } = useI18n();
const { copy } = useClipboard();

// 分享模式选项 (使用 i18n)
const shareModes = computed(() => [
  { value: 'none', label: t('spaceManager.shareMode.none'), icon: '🔒' },
  { value: 'selected', label: t('spaceManager.shareMode.selected'), icon: '👥' },
  { value: 'all', label: t('spaceManager.shareMode.all'), icon: '🌍' },
]);

// 当前分享模式
const currentShareMode = ref(props.shareMode);

// 已选销售员 IDs
const selectedSalespersonIds = ref(props.sharedSalespersons.map((sp) => sp.id));

// 监听 props 变化
watch(() => props.shareMode, (val) => {
  currentShareMode.value = val;
});
watch(() => props.sharedSalespersons, (val) => {
  selectedSalespersonIds.value = val.map((sp) => sp.id);
}, { deep: true });

// 分享模式标签
const shareModeLabel = computed(() => {
  const mode = shareModes.value.find((m) => m.value === currentShareMode.value);
  return mode ? `${mode.icon} ${mode.label}` : t('spaceManager.shareCard.notPublic');
});

// 更新分享模式
const updateShareMode = (mode) => {
  currentShareMode.value = mode;
};

// 保存分享设置
const saveShareSettings = () => {
  emit('update-share-settings', {
    shareMode: currentShareMode.value,
    sharedSalespersonIds: currentShareMode.value === 'selected' ? selectedSalespersonIds.value : [],
  });
};

// 复制链接
const copyLink = async () => {
  if (!props.shareUrl) return;
  await copy(props.shareUrl, {
    successMessage: t('share.linkCopied'),
    errorMessage: t('common.copyFailed'),
  });
};
</script>
