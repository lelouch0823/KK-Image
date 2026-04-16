<template>
  <div class="flex min-h-0 flex-1 flex-col overflow-hidden bg-(--bg-muted)/50">
    <!-- Toolbar -->
    <div
      class="flex shrink-0 items-center justify-between border-b border-(--border-color) bg-(--bg-card) p-4"
    >
      <div class="flex items-center gap-3">
        <!-- Add existing file -->
        <Tooltip v-if="canManage" :content="t('spaceManager.addFile')">
          <AppButton
            variant="white"
            size="sm"
            class="group hover:border-(--color-primary-light) hover:text-(--text-primary) hover:shadow-md"
            @click="$emit('addFiles')"
          >
            <template #icon-left>
              <AppIcon
                name="arrow-up-tray"
                class="size-4 text-(--text-muted) transition-colors group-hover:text-(--text-primary)"
              />
            </template>
            <span>{{ t('spaceManager.addFile') || 'Select Files' }}</span>
          </AppButton>
        </Tooltip>

        <!-- Upload new file -->
        <Tooltip v-if="canManage" :content="t('common.upload')">
          <AppButton
            variant="primary"
            size="sm"
            class="group shadow-primary/20 shadow-lg hover:-translate-y-0.5"
            @click="$emit('upload')"
          >
            <template #icon-left>
              <AppIcon name="plus" class="size-4.5 transition-transform group-hover:scale-110" />
            </template>
            <span>{{ t('common.upload') || 'Upload' }}</span>
          </AppButton>
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
        <AppIcon name="photo-solid" class="text-primary size-4" />
        <span class="text-primary max-w-[100px] truncate text-xs font-medium" :title="currentCoverFile.originalName || currentCoverFile.name || '-'">{{
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
          class="group relative aspect-square overflow-hidden rounded-lg border border-(--border-color) bg-(--bg-muted) transition-shadow hover:shadow-md"
          :class="{ 'ring-primary ring-2': coverFileId === file.id }"
        >
          <!-- Cover Badge -->
          <div
            v-if="coverFileId === file.id"
            class="bg-primary absolute top-1.5 left-1.5 z-10 flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-medium text-(--text-inverse) shadow-sm"
          >
            <AppIcon name="photo-solid" class="size-3" />
            {{ t('spaceManager.cover') }}
          </div>
          <AppImage
            v-if="file.mimeType?.startsWith('image/')"
            :src="file.url"
            :blurhash="file.blurhash"
            class="size-full"
            fit="cover"
            rounded="none"
          />
          <div
            v-else
            class="flex size-full items-center justify-center bg-(--bg-card) text-xs font-bold text-(--text-muted) uppercase"
            :title="file.name || '-'"
          >
            {{ file.name?.split('.').pop() }}
          </div>
          <div
            class="absolute inset-0 flex items-center justify-center gap-2 bg-(--color-overlay-dim) opacity-0 transition-opacity group-hover:opacity-100"
          >
            <!-- Set as Cover Button -->
            <AppButton
              v-if="canManage && file.mimeType?.startsWith('image/') && coverFileId !== file.id"
              variant="primary"
              size="sm"
              class="!h-8 !w-8 rounded-full !px-0 shadow-sm [&_span]:contents"
              :title="t('spaceManager.setCover')"
              @click.stop="$emit('setCover', file.id)"
            >
              <AppIcon name="photo-solid" class="size-4" />
            </AppButton>
            <!-- Remove Button -->
            <AppButton
              v-if="canManage"
              variant="danger"
              size="sm"
              class="!h-8 !w-8 rounded-full !px-0 shadow-sm hover:opacity-90 [&_span]:contents"
              @click.stop="$emit('remove', file.id)"
            >
              <AppIcon name="trash" class="size-4" />
            </AppButton>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from '@/composables/useI18n';
import AppButton from '@/components/ui/AppButton.vue';
import Tooltip from '@/components/ui/Tooltip.vue';
import AppImage from '@/components/ui/AppImage.vue';
import AppIcon from '@/components/ui/AppIcon.vue';

const props = defineProps({
  files: {
    type: Array,
    default: () => [],
  },
  coverFileId: {
    type: [String, null],
    default: null,
  },
  canManage: {
    type: Boolean,
    default: false,
  },
});

defineEmits(['addFiles', 'upload', 'setCover', 'remove']);

const { t } = useI18n();

const currentCoverFile = computed(() => {
  if (!props.coverFileId || !props.files) return null;
  return props.files.find((f) => f.id === props.coverFileId);
});
</script>
