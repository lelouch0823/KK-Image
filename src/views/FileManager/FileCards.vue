<template>
  <TransitionGroup name="list" tag="div" class="space-y-3">
    <AppCard
      v-for="file in files"
      :key="file.id"
      padding="p-3"
      class="group relative flex items-center gap-3 transition-all duration-300 active:scale-[0.98] active:bg-(--bg-muted)"
      selected-border
      :selected="selectedIds?.has(file.id)"
      @click="$emit('select', file)"
    >
      <div
        class="relative size-14 shrink-0 overflow-hidden rounded-xl border border-(--border-color) bg-(--bg-muted)"
      >
        <AppImage
          v-if="isImage(file)"
          :src="file.url"
          :alt="file.name"
          class="size-full transition-transform duration-500 group-active:scale-110"
          width="56"
          height="56"
          rounded="none"
        />
        <div
          v-else
          class="text-secondary flex size-full items-center justify-center text-xs font-bold tracking-wider uppercase"
        >
          {{ getFileExtension(file.name) }}
        </div>
      </div>

      <!-- Info -->
      <div class="min-w-0 flex-1 py-0.5">
        <h4 class="text-primary truncate text-sm leading-tight font-semibold">
          {{ file.originalName || file.name }}
        </h4>
        <div class="text-secondary mt-1 flex items-center gap-2 text-xs">
          <span>{{ formatSize(file.size) }}</span>
          <span class="size-0.5 rounded-full bg-current opacity-50"></span>
          <span>{{ formatDate(file.createdAt) }}</span>
        </div>
      </div>

      <!-- Actions -->
      <div class="flex items-center gap-1">
        <AppButton
          variant="ghost"
          size="sm"
          class="!size-8 !p-1.5"
          @click.stop="$emit('share', file)"
        >
          <template #icon-left>
            <AppIcon name="share" class="size-5" />
          </template>
        </AppButton>
        <AppButton
          variant="ghost"
          size="sm"
          class="!size-8 !p-1.5"
          @click.stop="$emit('context-menu', $event, file)"
        >
          <template #icon-left>
            <AppIcon name="ellipsis-vertical" class="size-5" />
          </template>
        </AppButton>
      </div>
    </AppCard>
  </TransitionGroup>
</template>

<script setup>
import { useFileManager } from '@/composables/useFileManager';
import AppIcon from '@/components/ui/AppIcon.vue';
import AppCard from '@/components/ui/AppCard.vue';
import AppImage from '@/components/ui/AppImage.vue';
import AppButton from '@/components/ui/AppButton.vue';

defineProps({
  files: {
    type: Array,
    required: true,
  },
});

defineEmits(['share', 'delete', 'context-menu', 'preview']);

const { formatSize, formatDate, getFileExtension, isImage } = useFileManager();
</script>
