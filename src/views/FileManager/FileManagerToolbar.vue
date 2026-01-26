<template>
  <div class="flex items-center justify-between border-b border-[var(--border-color)] px-6 py-4">
    <!-- Breadcrumbs -->
    <div 
      class="scrollbar-thin flex max-w-2xl items-center gap-2 overflow-x-auto" 
      :class="{ 'hidden lg:flex': selectedCount > 0 }"
    >
      <button
        class="flex items-center gap-1 text-sm font-medium whitespace-nowrap transition-colors"
        :class="!currentFolder ? 'text-primary' : 'text-secondary hover:text-primary'"
        @click="$emit('navigate', null)"
      >
        <svg class="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
          ></path>
        </svg>
        {{ t('fileManager.root') }}
      </button>
      <template v-for="(crumb, index) in breadcrumbs" :key="crumb.id">
        <span class="text-secondary text-sm">/</span>
        <button
          class="text-sm font-medium whitespace-nowrap transition-colors"
          :class="index === breadcrumbs.length - 1 ? 'text-primary' : 'text-secondary hover:text-primary'"
          @click="$emit('navigate', crumb.id)"
        >
          {{ crumb.name }}
        </button>
      </template>
    </div>

    <!-- Actions -->
    <div class="flex items-center gap-3">
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
          class="flex flex-1 items-center gap-2 rounded-xl bg-[var(--color-info)]/10 px-3 py-2 text-sm text-[var(--color-info)] dark:bg-[var(--color-info)]/20 dark:text-blue-300"
        >
          <span class="font-medium whitespace-nowrap">{{ t('fileManager.selected', { count: selectedCount }) }}</span>
          <div class="mx-1 h-4 w-px bg-[var(--color-info)]/20 dark:bg-blue-700"></div>
          <div class="ml-auto flex items-center gap-1 sm:ml-0">
            <button class="px-1 transition-colors hover:text-[var(--color-info)] hover:underline dark:hover:text-blue-100" @click="$emit('batch-move')">
              {{ t('fileManager.actions.move') }}
            </button>
            <button class="px-1 text-[var(--color-danger)] transition-colors hover:text-[var(--color-danger-hover)] hover:underline dark:text-red-400 dark:hover:text-red-300" @click="$emit('batch-delete')">
              {{ t('fileManager.actions.delete') }}
            </button>
            <button class="px-1 text-[var(--text-secondary)] transition-colors hover:text-[var(--text-main)] dark:text-gray-400 dark:hover:text-gray-300" @click="$emit('clear-selection')">
              <svg class="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
          </div>
        </div>
      </Transition>

      <div v-if="selectedCount > 0" class="hidden h-6 w-px bg-[var(--border-color)] lg:block"></div>

      <!-- Regular Actions -->
      <Tooltip v-if="currentFolder" :content="t('fileManager.shareFolder')">
        <button
          class="text-secondary flex size-10 items-center justify-center rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] transition-all hover:text-primary hover:bg-[var(--bg-hover)] active:scale-95"
          @click="$emit('share-folder')"
        >
          <svg class="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
            ></path>
          </svg>
        </button>
      </Tooltip>

      <input ref="fileInput" type="file" multiple class="hidden" @change="handleFileSelect" />

      <Tooltip :content="t('fileManager.upload')">
        <button
          class="flex size-10 items-center justify-center rounded-xl bg-[var(--color-primary)] text-[var(--text-inverse)] shadow-[var(--color-primary)]/20 shadow-lg transition-all hover:-translate-y-0.5 hover:bg-[var(--color-primary-hover)] hover:shadow-[var(--color-primary)]/30 active:translate-y-0 active:scale-95 dark:text-gray-900"
          @click="$refs.fileInput.click()"
        >
          <svg class="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
            ></path>
          </svg>
        </button>
      </Tooltip>

      <Tooltip :content="t('fileManager.newFolder')">
        <button
          class="text-secondary flex size-10 items-center justify-center rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] transition-all hover:text-primary hover:bg-[var(--bg-hover)] active:scale-95"
          @click="$emit('create-folder')"
        >
          <svg class="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z"
            ></path>
          </svg>
        </button>
      </Tooltip>

      <!-- View Toggle -->
      <div class="flex hidden items-center rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] p-1 lg:flex">
        <button
          class="rounded-lg p-1.5 transition-all"
          :class="viewMode === 'list' ? 'text-primary bg-[var(--bg-hover)] shadow-sm' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'"
          :title="t('fileManager.viewMode.list')"
          @click="$emit('update:viewMode', 'list')"
        >
          <svg class="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"></path></svg>
        </button>
        <button
          class="rounded-lg p-1.5 transition-all"
          :class="viewMode === 'grid' ? 'text-primary bg-[var(--bg-hover)] shadow-sm' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'"
          :title="t('fileManager.viewMode.grid')"
          @click="$emit('update:viewMode', 'grid')"
        >
          <svg class="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V16zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"></path></svg>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useI18n } from '@/composables/useI18n';
import Tooltip from '@/components/ui/Tooltip.vue';

const _props = defineProps({
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
});

const emit = defineEmits([
  'navigate',
  'update:viewMode',
  'upload',
  'create-folder',
  'share-folder',
  'batch-move',
  'batch-delete',
  'clear-selection',
]);

const { t } = useI18n();
const fileInput = ref(null);

const handleFileSelect = (e) => {
  if (e.target.files.length > 0) {
    emit('upload', e.target.files);
    e.target.value = '';
  }
};
</script>
