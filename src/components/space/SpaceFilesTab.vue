<template>
  <div class="flex min-h-0 flex-1 flex-col overflow-hidden bg-[var(--bg-muted)]/50">
    <!-- Toolbar -->
    <div
      class="flex shrink-0 items-center justify-between border-b border-[var(--border-color)] bg-[var(--bg-card)] p-4"
    >
      <div class="flex items-center gap-3">
        <Tooltip :content="t('spaceManager.addFile')">
          <button
            class="bg-primary flex size-8 items-center justify-center rounded-lg text-sm font-medium text-[var(--text-inverse)] transition-colors hover:bg-[var(--color-primary-hover)]"
            @click="$emit('addFiles')"
          >
            <svg class="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 4v16m8-8H4"
              />
            </svg>
          </button>
        </Tooltip>
        <span class="text-secondary text-xs">{{
          t('fileManager.totalFiles', { count: files?.length || 0 })
        }}</span>
      </div>
      <!-- Cover Indicator -->
      <div
        v-if="currentCoverFile"
        class="border-primary/20 bg-primary/5 flex items-center gap-2 rounded-lg border px-3 py-1.5"
      >
        <svg class="text-primary size-4" fill="currentColor" viewBox="0 0 20 20">
          <path
            fill-rule="evenodd"
            d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z"
            clip-rule="evenodd"
          />
        </svg>
        <span class="text-primary max-w-[100px] truncate text-xs font-medium">{{
          currentCoverFile.originalName || currentCoverFile.name
        }}</span>
      </div>
    </div>

    <!-- File Grid -->
    <div class="flex-1 overflow-y-auto p-4">
      <div
        v-if="files?.length === 0"
        class="text-secondary flex h-full flex-col items-center justify-center py-12"
      >
        <p>{{ t('spaceManager.emptyFiles') }}</p>
      </div>
      <div v-else class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        <div
          v-for="file in files"
          :key="file.id"
          class="group relative aspect-square overflow-hidden rounded-lg border border-[var(--border-color)] bg-[var(--bg-muted)] transition-shadow hover:shadow-md"
          :class="{ 'ring-primary ring-2': coverFileId === file.id }"
        >
          <!-- Cover Badge -->
          <div
            v-if="coverFileId === file.id"
            class="bg-primary absolute top-1.5 left-1.5 z-10 flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-medium text-[var(--text-inverse)] shadow-sm"
          >
            <svg class="size-3" fill="currentColor" viewBox="0 0 20 20">
              <path
                fill-rule="evenodd"
                d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z"
                clip-rule="evenodd"
              />
            </svg>
            {{ t('spaceManager.cover') }}
          </div>
          <img
            v-if="file.mimeType?.startsWith('image/')"
            :src="file.url"
            class="size-full object-cover"
            alt=""
          />
          <div
            v-else
            class="flex size-full items-center justify-center bg-[var(--bg-card)] text-xs font-bold text-[var(--text-muted)] uppercase"
          >
            {{ file.name?.split('.').pop() }}
          </div>
          <div
            class="absolute inset-0 flex items-center justify-center gap-2 bg-black/40 opacity-0 transition-opacity group-hover:opacity-100"
          >
            <!-- Set as Cover Button -->
            <button
              v-if="file.mimeType?.startsWith('image/') && coverFileId !== file.id"
              class="bg-primary rounded-full p-1.5 text-[var(--text-inverse)] transition-colors hover:bg-[var(--color-primary-hover)]"
              :title="t('spaceManager.setCover')"
              @click.stop="$emit('setCover', file.id)"
            >
              <svg class="size-4" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fill-rule="evenodd"
                  d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z"
                  clip-rule="evenodd"
                />
              </svg>
            </button>
            <!-- Remove Button -->
            <button
              class="rounded-full bg-[var(--color-danger)] p-1.5 text-[var(--text-inverse)] transition-colors hover:bg-red-600"
              @click.stop="$emit('remove', file.id)"
            >
              <svg class="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from '@/composables/useI18n';
import Tooltip from '@/components/ui/Tooltip.vue';

const props = defineProps({
  files: {
    type: Array,
    default: () => [],
  },
  coverFileId: {
    type: [String, null],
    default: null,
  },
});

defineEmits(['addFiles', 'setCover', 'remove']);

const { t } = useI18n();

const currentCoverFile = computed(() => {
  if (!props.coverFileId || !props.files) return null;
  return props.files.find((f) => f.id === props.coverFileId);
});
</script>
