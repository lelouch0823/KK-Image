<template>
  <div
    class="flex flex-col gap-3 border-b border-(--border-color) px-4 py-3 lg:flex-row lg:items-center lg:justify-between lg:px-6 lg:py-4"
  >
    <!-- 第一行: 面包屑 + 上传按钮 -->
    <div class="flex items-center justify-between gap-3">
      <!-- Breadcrumbs -->
      <div
        class="scrollbar-thin flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto lg:max-w-2xl lg:gap-2"
        :class="{ 'hidden lg:flex': selectedCount > 0 }"
      >
        <AppButton
          variant="link"
          size="sm"
          class="!h-auto shrink-0 !gap-1 !px-0 !text-sm whitespace-nowrap"
          :class="!currentFolder ? 'text-primary' : 'text-(--text-secondary) hover:text-primary'"
          @click="$emit('navigate', null)"
        >
          <template #icon-left>
            <AppIcon name="home" class="size-4" />
          </template>
          <span class="hidden sm:inline">{{ t('fileManager.root') }}</span>
        </AppButton>
        <template v-for="(crumb, index) in breadcrumbs" :key="crumb.id">
          <span class="text-secondary text-xs lg:text-sm">/</span>
          <AppButton
            variant="link"
            size="sm"
            class="max-w-24 !h-auto truncate !px-0 !text-sm whitespace-nowrap sm:max-w-none"
            :class="
              index === breadcrumbs.length - 1
                ? 'text-primary'
                : 'text-(--text-secondary) hover:text-primary'
            "
            @click="$emit('navigate', crumb.id)"
          >
            {{ crumb.name }}
          </AppButton>
        </template>
      </div>

      <!-- 移动端: 上传按钮 (始终可见) -->
      <div class="flex shrink-0 items-center gap-2 lg:hidden">
        <input
          ref="fileInputMobile"
          type="file"
          multiple
          class="hidden"
          @change="handleFileSelect"
        />
        <AppButton
          v-if="canWriteFiles"
          variant="primary"
          size="sm"
          class="size-9 !px-0 shadow-lg"
          @click="triggerUpload('mobile')"
        >
          <template #icon-left>
            <AppIcon name="cloud-arrow-up" class="size-5" />
          </template>
        </AppButton>
      </div>
    </div>

    <!-- 第二行: 搜索 + 操作按钮 + 视图切换 -->
    <div class="flex items-center gap-2 lg:gap-3">
      <!-- Batch Actions -->
      <Transition
        enter-active-class="transition duration-200 ease-out"
        enter-from-class="transform translate-x-4 opacity-0"
        enter-to-class="transform translate-x-0 opacity-100"
        leave-active-class="transition duration-150 ease-in"
        leave-from-class="transform translate-x-0 opacity-100"
        leave-to-class="transform translate-x-4 opacity-0"
      >
        <div
          v-if="selectedCount > 0"
          class="border-primary/20 bg-primary/5 flex items-center gap-1 overflow-hidden rounded-lg border px-2 py-1.5 transition-all"
        >
          <span class="text-primary mr-1 text-xs font-medium lg:mr-2">{{
            t('fileManager.selected', { count: selectedCount })
          }}</span>

          <div class="bg-primary/20 h-4 w-px"></div>

          <AppButton
            v-if="canWriteFiles"
            variant="ghost"
            size="sm"
            class="text-success !px-1.5 hover:bg-success/10 hover:text-success"
            :title="t('fileManager.actions.tag')"
            @click="$emit('batch-tag')"
          >
            <template #icon-left>
              <AppIcon name="tag" class="size-4" />
            </template>
          </AppButton>

          <AppButton
            v-if="canMoveFiles"
            variant="ghost"
            size="sm"
            class="text-info !px-1.5 hover:bg-info/10 hover:text-info"
            :title="t('fileManager.actions.move')"
            @click="$emit('batch-move')"
          >
            <template #icon-left>
              <AppIcon name="arrows-right-left" class="size-4" />
            </template>
          </AppButton>

          <AppButton
            v-if="canDeleteFiles"
            variant="ghost"
            size="sm"
            class="text-danger !px-1.5 hover:bg-danger/10 hover:text-danger"
            :title="t('fileManager.actions.delete')"
            @click="$emit('batch-delete')"
          >
            <template #icon-left>
              <AppIcon name="trash" class="size-4" />
            </template>
          </AppButton>

          <AppButton
            variant="ghost"
            size="sm"
            class="!px-1.5 text-(--text-secondary) hover:text-(--text-main)"
            :title="t('common.cancel')"
            @click="$emit('clear-selection')"
          >
            <template #icon-left>
              <AppIcon name="x-mark" class="size-4" />
            </template>
          </AppButton>
        </div>
      </Transition>

      <div v-if="selectedCount > 0" class="hidden h-6 w-px bg-(--border-color) lg:block"></div>

      <!-- Regular Actions (桌面端显示完整, 移动端简化) -->
      <Tooltip
        v-if="currentFolder && canManageFolders"
        :content="t('fileManager.shareFolder')"
        class="hidden lg:block"
      >
        <AppButton variant="white" size="md" class="size-10 !px-0" @click="$emit('share-folder')">
          <template #icon-left>
            <AppIcon name="share" class="size-5" />
          </template>
        </AppButton>
      </Tooltip>

      <!-- 桌面端上传按钮 -->
      <input ref="fileInput" type="file" multiple class="hidden" @change="handleFileSelect" />
      <div v-if="canWriteFiles" class="hidden lg:block">
        <Tooltip :content="t('fileManager.upload')">
          <AppButton
            variant="primary"
            size="md"
            class="size-10 !px-0 shadow-lg hover:-translate-y-0.5"
            @click="triggerUpload('desktop')"
          >
            <template #icon-left>
              <AppIcon name="cloud-arrow-up" class="size-5" />
            </template>
          </AppButton>
        </Tooltip>
      </div>

      <!-- 新建文件夹 -->
      <Tooltip v-if="canManageFolders" :content="t('fileManager.newFolder')">
        <AppButton
          variant="white"
          size="sm"
          class="size-9 !px-0 lg:size-10"
          @click="$emit('create-folder')"
        >
          <template #icon-left>
            <AppIcon name="folder-plus" class="size-4 lg:size-5" />
          </template>
        </AppButton>
      </Tooltip>

      <!-- 回收站 -->
      <Tooltip :content="t('trash.title')">
        <AppButton
          variant="white"
          size="sm"
          class="size-9 !px-0 hover:border-danger/30 hover:bg-(--color-danger-bg) hover:text-danger lg:size-10"
          @click="$emit('open-trash')"
        >
          <template #icon-left>
            <AppIcon name="trash" class="size-4 lg:size-5" />
          </template>
        </AppButton>
      </Tooltip>

      <!-- 搜索框: 移动端收缩, 桌面端展开 -->
      <AppInput
        v-model="searchQuery"
        size="sm"
        :placeholder="t('common.search')"
        class="w-28 sm:w-40 lg:w-64"
      >
        <template #prepend>
          <AppIcon name="magnifying-glass" class="size-4" />
        </template>
      </AppInput>

      <!-- 视图切换 -->
      <div
        class="hidden items-center rounded-lg border border-(--border-color) bg-(--bg-card) p-1 sm:flex"
      >
        <AppButton
          v-for="mode in ['grid', 'list']"
          :key="mode"
          size="sm"
          variant="ghost"
          class="!h-7 !p-1.5"
          :class="{ 'text-primary bg-(--bg-card) shadow-sm': viewMode === mode }"
          @click="$emit('update:viewMode', mode)"
        >
          <template #icon-left>
            <AppIcon :name="mode === 'grid' ? 'squares-2x2' : 'bars-3'" class="size-4" />
          </template>
        </AppButton>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { useSearch } from '@/composables/useSearch';
import Tooltip from '@/components/ui/Tooltip.vue';
import AppIcon from '@/components/ui/AppIcon.vue';
import AppButton from '@/components/ui/AppButton.vue';
import AppInput from '@/components/ui/AppInput.vue';

defineProps({
  breadcrumbs: {
    type: Array,
    required: true,
  },
  currentFolder: {
    type: Object,
    default: null,
  },
  viewMode: {
    type: String,
    required: true,
  },
  selectedCount: {
    type: Number,
    default: 0,
  },
  canWriteFiles: {
    type: Boolean,
    default: false,
  },
  canDeleteFiles: {
    type: Boolean,
    default: false,
  },
  canManageFolders: {
    type: Boolean,
    default: false,
  },
  canMoveFiles: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits([
  'navigate',
  'update:viewMode',
  'upload',
  'create-folder',
  'share-folder',
  'batch-move',
  'batch-delete',
  'batch-tag',
  'clear-selection',
  'open-trash', // NEW
]);

const { t } = useI18n();
const { searchQuery } = useSearch();
const fileInput = ref(null);
const fileInputMobile = ref(null);

const triggerUpload = (target) => {
  const input = target === 'mobile' ? fileInputMobile.value : fileInput.value;
  input?.click();
};

const handleFileSelect = (e) => {
  if (e.target.files.length > 0) {
    emit('upload', e.target.files);
    e.target.value = '';
  }
};
</script>
