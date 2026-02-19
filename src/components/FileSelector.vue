<template>
  <Modal
    :model-value="true"
    size="2xl"
    body-class="flex flex-col p-0 h-[80vh] overflow-hidden"
    @update:model-value="$emit('close')"
  >
    <template #header>
      <div>
        <h2 class="text-primary text-lg font-semibold">{{ t('fileSelector.title') }}</h2>
        <p class="text-secondary mt-0.5 text-sm">
          {{
            t('fileSelector.selectedCount', {
              count: selectedIds.length + selectedFolderIds.length,
            })
          }}
        </p>
      </div>
    </template>

    <!-- 路径导航 (Fixed at top of body) -->
    <div
      class="flex shrink-0 items-center gap-2 overflow-x-auto border-b border-[var(--border-color)] bg-[var(--bg-muted)]/30 px-6 py-3 text-sm whitespace-nowrap backdrop-blur-sm"
    >
      <button
        class="hover:text-primary flex items-center gap-1 transition-colors"
        :class="!currentFolderId ? 'text-primary font-semibold' : 'text-secondary'"
        @click="navigateTo(null)"
      >
        <svg class="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
          ></path>
        </svg>
        {{ t('fileSelector.allFiles') }}
      </button>
      <template v-for="folder in breadcrumbs" :key="folder.id">
        <span class="text-[var(--border-color)]">/</span>
        <button
          class="transition-colors hover:text-[var(--color-primary)]"
          :class="currentFolderId === folder.id ? 'text-primary font-semibold' : 'text-secondary'"
          @click="navigateTo(folder.id)"
        >
          {{ folder.name }}
        </button>
      </template>
    </div>

    <!-- 文件列表 (Scrollable) -->
    <div class="content-area flex-1 overflow-y-auto p-4">
      <div v-if="loading" class="flex justify-center py-10">
        <div class="border-primary size-8 animate-spin rounded-full border-b-2"></div>
      </div>

      <div v-else class="grid grid-cols-2 content-start gap-3 sm:grid-cols-3 md:grid-cols-4">
        <!-- 文件夹列表 -->
        <div
          v-for="folder in currentFolders"
          :key="'f-' + folder.id"
          class="group relative flex aspect-square cursor-pointer flex-col items-center justify-center rounded-xl border-2 bg-[var(--color-info-bg)] transition-all hover:opacity-80"
          :class="
            selectedFolderIds.includes(folder.id)
              ? 'border-[var(--color-primary)] ring-2 ring-[var(--color-primary-light)]'
              : 'border-transparent'
          "
          @click="navigateTo(folder.id, folder)"
        >
          <div
            class="absolute top-2 right-2 z-10 opacity-0 transition-opacity group-hover:opacity-100"
            :class="{ 'opacity-100': selectedFolderIds.includes(folder.id) }"
            @click="(e) => toggleFolderSelect(folder.id, e)"
          >
            <div
              class="flex size-6 items-center justify-center rounded-full border shadow-sm transition-all"
              :class="
                selectedFolderIds.includes(folder.id)
                  ? 'bg-primary border-primary'
                  : 'hover:border-primary border-border bg-surface'
              "
            >
              <svg
                v-if="selectedFolderIds.includes(folder.id)"
                class="size-3.5 text-[var(--text-inverse)]"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="3"
                  d="M5 13l4 4L19 7"
                ></path>
              </svg>
            </div>
          </div>
          <svg
            class="mb-2 size-12 text-[var(--color-info)] transition-transform duration-200 group-hover:scale-110"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z"></path>
          </svg>
          <span class="w-full truncate px-2 text-center text-xs font-medium text-[var(--text-main)]">{{
            folder.name
          }}</span>
        </div>

        <!-- 文件列表 -->
        <div
          v-for="file in files"
          :key="file.id"
          class="group relative aspect-square cursor-pointer overflow-hidden rounded-xl border-2 transition-all hover:shadow-lg"
          :class="
            selectedIds.includes(file.id)
              ? 'border-primary ring-primary/20 ring-2'
              : 'border-transparent'
          "
          @click="toggleSelect(file.id)"
        >
          <!-- 图片预览 -->
          <AppImage
            v-if="isImage(file)"
            :src="file.url"
            :alt="file.name"
            :blurhash="file.blurhash"
            class="size-full transition-transform duration-300 group-hover:scale-105"
            fit="cover"
            rounded="none"
          />
          <!-- 非图片 -->
          <div v-else class="flex size-full flex-col items-center justify-center bg-[var(--bg-muted)]">
            <span class="text-xs font-bold text-[var(--text-muted)] uppercase">{{
              file.name?.split('.').pop()
            }}</span>
            <span class="mt-1 w-full truncate px-2 text-center text-[10px] text-[var(--text-muted)]">{{
              file.originalName || file.name
            }}</span>
          </div>
          <!-- 选中标记 -->
          <div
            v-if="selectedIds.includes(file.id)"
            class="bg-primary animate-in zoom-in absolute top-2 right-2 flex size-6 items-center justify-center rounded-full shadow-md duration-200"
          >
            <svg class="size-3.5 text-[var(--text-inverse)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="3"
                d="M5 13l4 4L19 7"
              ></path>
            </svg>
          </div>
        </div>
      </div>

      <div
        v-if="!loading && currentFolders.length === 0 && files.length === 0"
        class="flex h-full flex-col items-center justify-center pb-10 text-[var(--text-secondary)]"
      >
        <div class="mb-4 flex size-16 items-center justify-center rounded-full bg-[var(--bg-muted)]">
          <svg class="size-8 text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
            ></path>
          </svg>
        </div>
        <p>{{ t('fileSelector.empty') }}</p>
      </div>
    </div>

    <!-- Footer -->
    <template #footer>
      <button
        class="text-secondary px-4 py-2 text-sm font-medium transition-colors hover:text-primary"
        @click="$emit('close')"
      >
        {{ t('fileSelector.cancel') }}
      </button>
      <button
        :disabled="selectedIds.length === 0 && selectedFolderIds.length === 0"
        class="bg-primary shadow-primary/20 rounded-lg px-6 py-2 text-sm font-medium text-[var(--text-inverse)] shadow-lg transition-all hover:bg-[var(--color-primary-hover)] active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
        @click="confirmSelect"
      >
        {{ t('fileSelector.add') }}
        {{
          selectedIds.length + selectedFolderIds.length > 0
            ? `(${selectedIds.length + selectedFolderIds.length})`
            : ''
        }}
      </button>
    </template>
  </Modal>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import { API } from '@/utils/constants';
import { isImage } from '@/utils/formatters';
import { useI18n } from '@/composables/useI18n';
import Modal from '@/components/ui/Modal.vue';
import AppImage from '@/components/ui/AppImage.vue';

const emit = defineEmits(['close', 'select']);
const { t } = useI18n();

const allFolders = ref([]); // 所有文件夹扁平列表
const files = ref([]);
const loading = ref(false);
const currentFolderId = ref(null);
const breadcrumbs = ref([]);
const selectedIds = ref([]);

// 计算当前目录下的子文件夹
// 计算当前目录下的子文件夹
const currentFolders = computed(() => {
  // 确保类型一致性，parentId 为 null 或 'root' 时处理根目录
  const currentId = currentFolderId.value;
  return allFolders.value.filter((f) => {
    if (currentId === null || currentId === 'root') {
      return !f.parent_id || f.parent_id === 'root';
    }
    return f.parent_id === currentId;
  });
});

// 加载所有文件夹结构
const loadFoldersStructure = async () => {
  try {
    // 使用 ?all=true 获取完整文件夹树
    const response = await fetch(`${API.FOLDERS}?all=true`, { credentials: 'include' });
    const result = await response.json();
    if (result.success) {
      allFolders.value = result.data || [];
    }
  } catch (err) {
    console.error(t('moveFile.loadFailed'), err);
  }
};

const navigateTo = (folderId, _folderObj = null) => {
  currentFolderId.value = folderId;

  if (folderId === null) {
    breadcrumbs.value = [];
  } else {
    // 鲁棒的面包屑逻辑：根据当前文件夹回溯所有父级
    const crumbs = [];
    let tempId = folderId;
    while (tempId) {
      const folder = allFolders.value.find((f) => f.id === tempId);
      if (folder) {
        crumbs.unshift({ id: folder.id, name: folder.name });
        tempId = folder.parent_id;
      } else {
        break;
      }
    }
    breadcrumbs.value = crumbs;
  }
  loadFiles();
};

const loadFiles = async () => {
  loading.value = true;
  try {
    const url = currentFolderId.value
      ? API.FOLDER_BY_ID(currentFolderId.value)
      : `${API.FOLDERS}?all_files=true`; // 根目录显示所有未分类文件或者配合后端逻辑

    // 注意：后端 FOLDER_BY_ID 返回 { id, name, files: [] }
    // 根目录逻辑可能需要调整，这里假设后端支持 ?root=true 或者是过滤
    // 修正：复用现有逻辑，如果 currentFolderId 为 null，获取所有文件可能不太对，应该是获取“未分类文件”或“根目录文件”
    // 暂时逻辑：根目录不显示文件，只显示一级文件夹？或者调用一个能获取所有文件的接口？
    // 为了简化，根目录获取所有文件（all_files=true）是之前有的逻辑。

    // 优化：如果 currentFolderId 是 null，我们可能只想显示根文件夹，而不显示所有文件（太多了）。
    // 但用户希望能选文件。
    // 让我们假设 API.FOLDERS 返回所有一级文件夹。
    // 如果 API.FILES 能支持 parent_id=null 最好。目前复用 Folder logic.

    const response = await fetch(url, { credentials: 'include' });
    const result = await response.json();

    if (result.success) {
      // 文件夹详情接口返回结构: data: { ...folderInfo, files: [] }
      // 列表接口返回结构: data: [...]

      if (currentFolderId.value) {
        files.value = result.data.files || [];
      } else {
        // 根目录：all_files=true 返回的是所有文件，不分文件夹。
        // 我们这里如果不传 all_files=true，FOLDERS 接口只返回文件夹列表。
        // 需要一个接口获取“根目录下的文件”。目前系统好像没有专门存“根目录文件”的概念（所有文件都在某种folder里？或者parent_id为null）
        // 暂且：根目录不显示文件，只引导用户进入文件夹。或者显示最近文件。
        // 修正：使用 all_files=true 获取所有文件作为备选，或者让用户必须进文件夹选。
        // 为了体验，根目录暂不显示文件，只显示文件夹。
        files.value = [];
      }
    }
  } catch (err) {
    console.error(t('fileManager.loadFailed'), err);
    files.value = [];
  } finally {
    loading.value = false;
  }
};

const toggleSelect = (fileId) => {
  const index = selectedIds.value.indexOf(fileId);
  if (index >= 0) {
    selectedIds.value.splice(index, 1);
  } else {
    selectedIds.value.push(fileId);
  }
};

const selectedFolderIds = ref([]);

const toggleFolderSelect = (folderId, event) => {
  event.stopPropagation(); // 防止触发进入文件夹
  const index = selectedFolderIds.value.indexOf(folderId);
  if (index >= 0) {
    selectedFolderIds.value.splice(index, 1);
  } else {
    selectedFolderIds.value.push(folderId);
  }
};

const confirmSelect = () => {
  // 传递对象格式，包含文件和文件夹
  emit('select', {
    fileIds: selectedIds.value,
    folderIds: selectedFolderIds.value,
  });
};

onMounted(() => {
  loadFoldersStructure();
  loadFiles();
});
</script>
