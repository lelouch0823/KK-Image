<template>
  <TransitionGroup
    name="list"
    tag="div"
    class="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
  >
    <div
      v-for="folder in folders"
      :key="folder.id"
      class="group relative cursor-pointer rounded-xl border p-3 transition-all hover:shadow-md active:scale-[0.98] sm:p-4"
      :class="[
        selectedIds.has(folder.id)
          ? 'border-primary bg-primary/10 ring-primary ring-1 dark:bg-primary/20'
          : 'border-(--border-color) bg-(--bg-card) hover:border-(--border-hover)',
      ]"
      @click="$emit('navigate', folder.id)"
      @contextmenu.prevent.stop="handleContextMenu($event, folder)"
    >
      <div class="flex flex-col items-center">
        <!-- 文件夹图标: 移动端 size-12, 桌面端 size-16 -->
        <AppIcon
          name="folder-solid"
          class="text-warning mb-2 size-12 transition-transform group-hover:scale-110 sm:size-14 lg:size-16"
        />
        <!-- 文件夹名称 -->
        <div
          class="text-primary w-full truncate px-1 text-center text-xs font-medium sm:px-2 sm:text-sm"
          :title="folder.name"
        >
          {{ folder.name }}
        </div>
        <!-- 项目数量 -->
        <div class="mt-0.5 text-xs text-(--text-secondary) sm:mt-1 sm:text-xs">
          {{ (folder.fileCount || 0) + (folder.subfolderCount || 0) }} {{ t('common.items') }}
        </div>
      </div>

      <!-- More Actions Button -->
      <AppButton
        variant="white"
        size="sm"
        class="text-secondary absolute top-1.5 right-1.5 z-10 !h-9 !w-9 !px-0 shadow-sm sm:top-2 sm:right-2 sm:!h-9 sm:!w-9 lg:opacity-0 lg:group-hover:opacity-100"
        @click.stop="$emit('context-menu', $event, folder)"
      >
        <template #icon-left>
          <AppIcon name="ellipsis-vertical" class="size-3.5 sm:size-4" />
        </template>
      </AppButton>
    </div>
  </TransitionGroup>
</template>

<script setup>
import { useI18n } from '@/composables/useI18n';
import AppButton from '@/components/ui/AppButton.vue';
import AppIcon from '@/components/ui/AppIcon.vue';

defineProps({
  folders: {
    type: Array,
    required: true,
  },
  selectedIds: {
    type: Set,
    default: () => new Set(),
  },
});

const emit = defineEmits(['navigate', 'select', 'delete', 'context-menu']);

const { t } = useI18n();

const handleContextMenu = (e, folder) => {
  emit('context-menu', e, folder);
};
</script>
