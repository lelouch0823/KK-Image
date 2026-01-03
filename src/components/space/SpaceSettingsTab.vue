<template>
  <div class="flex-1 space-y-4 overflow-y-auto p-6">
    <!-- 分享设置卡片 -->
    <div
      class="from-primary/5 to-primary/10 border-primary/20 rounded-2xl border bg-gradient-to-br p-5"
    >
      <div class="mb-4 flex items-center gap-3">
        <div class="bg-primary/10 flex size-10 items-center justify-center rounded-xl">
          <svg
            class="text-primary size-5"
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
          <h3 class="text-primary font-semibold">{{ t('spaceManager.shareSettings') }}</h3>
          <p class="text-secondary text-sm">
            {{
              isPublic
                ? t('spaceManager.publicStatus')
                : t('spaceManager.shareCard.notPublic')
            }}
          </p>
        </div>
      </div>

      <!-- 未公开状态 -->
      <div v-if="!isPublic" class="space-y-4">
        <button
          :disabled="publishing"
          class="bg-primary flex w-full items-center justify-center gap-2 rounded-xl py-3 font-medium text-white transition-all hover:bg-[var(--color-primary-hover)] disabled:opacity-50"
          @click="$emit('publish')"
        >
          <svg
            v-if="!publishing"
            class="size-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
            />
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
            />
          </svg>
          <svg v-else class="size-5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle
              class="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              stroke-width="4"
            />
            <path
              class="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
          {{ publishing ? t('common.saving') : t('spaceManager.shareCard.publishNow') }}
        </button>
        <p class="text-secondary text-center text-xs">
          {{ t('spaceManager.shareCard.publishHint') }}
        </p>
      </div>

      <!-- 已公开状态 -->
      <div v-else class="space-y-4">
        <!-- 访问统计 -->
        <div class="flex items-center gap-4 text-sm">
          <div class="text-secondary flex items-center gap-1.5">
            <svg class="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
              />
            </svg>
            <span>{{ viewCount || 0 }} {{ t('spacePublic.views') }}</span>
          </div>
        </div>

        <!-- 链接显示 -->
        <div class="flex gap-2">
          <input
            type="text"
            readonly
            :value="shareUrl"
            class="text-primary flex-1 rounded-xl border border-[var(--border-color)] bg-white px-4 py-2.5 font-mono text-sm"
          />
          <button
            class="text-primary flex items-center gap-2 rounded-xl border border-[var(--border-color)] bg-white px-4 py-2.5 transition-colors hover:bg-[var(--bg-hover)]"
            @click="copyLink"
          >
            <svg class="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"
              />
            </svg>
            {{ t('common.copy') }}
          </button>
        </div>

        <!-- 取消公开 -->
        <button
          :disabled="publishing"
          class="text-secondary w-full rounded-xl border border-[var(--border-color)] py-2.5 text-sm transition-colors hover:border-[var(--color-danger)] hover:text-[var(--color-danger)]"
          @click="$emit('unpublish')"
        >
          {{ t('spaceManager.shareCard.unpublish') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useI18n } from '@/composables/useI18n';
import { useClipboard } from '@/composables/useClipboard';

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
});

defineEmits(['publish', 'unpublish']);

const { t } = useI18n();
const { copy } = useClipboard();

const copyLink = async () => {
  if (!props.shareUrl) return;
  await copy(props.shareUrl, {
    successMessage: t('share.linkCopied'),
    errorMessage: t('common.copyFailed'),
  });
};
</script>
