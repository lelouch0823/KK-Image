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
      class="flex shrink-0 items-center gap-2 overflow-x-auto border-b border-(--border-color) bg-(--bg-muted)/30 px-6 py-3 text-sm whitespace-nowrap backdrop-blur-sm"
    >
      <AppButton
        variant="link"
        size="sm"
        class="hover:text-primary flex items-center gap-1 no-underline"
        :class="!currentFolderId ? 'text-primary font-semibold' : 'text-secondary'"
        @click="navigateTo(null)"
      >
        <template #icon-left>
          <AppIcon name="home" class="size-4" />
        </template>
        {{ t('fileSelector.allFiles') }}
      </AppButton>
      <template v-for="folder in breadcrumbs" :key="folder.id">
        <span class="text-(--border-color)">/</span>
        <AppButton
          variant="link"
          size="sm"
          class="hover:text-primary no-underline"
          :class="currentFolderId === folder.id ? 'text-primary font-semibold' : 'text-secondary'"
          @click="navigateTo(folder.id)"
        >
          {{ folder.name }}
        </AppButton>
      </template>
    </div>

    <!-- 文件列表 (Scrollable) -->
    <div class="content-area flex-1 overflow-y-auto p-4">
      <div v-if="loading" class="flex justify-center py-10">
        <AppIcon name="spinner" class="text-primary size-8 animate-spin" />
      </div>

      <div v-else class="grid grid-cols-2 content-start gap-3 sm:grid-cols-3 md:grid-cols-4">
        <!-- 文件夹列表 -->
        <div
          v-for="folder in currentFolders"
          :key="'f-' + folder.id"
          class="group relative flex aspect-square cursor-pointer flex-col items-center justify-center rounded-xl border-2 bg-(--color-info-bg) transition-all hover:opacity-80"
          :class="
            selectedFolderIds.includes(folder.id)
              ? 'border-primary ring-2 ring-(--color-primary-light)'
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
              <AppIcon
                v-if="selectedFolderIds.includes(folder.id)"
                name="check"
                class="size-3.5 stroke-3 text-(--text-inverse)"
              />
            </div>
          </div>
          <AppIcon
            name="folder-solid"
            class="text-info mb-2 size-12 transition-transform duration-200 group-hover:scale-110"
          />
          <span class="w-full truncate px-2 text-center text-xs font-medium text-(--text-main)">{{
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
          <div v-else class="flex size-full flex-col items-center justify-center bg-(--bg-muted)">
            <span class="text-xs font-bold text-(--text-muted) uppercase">{{
              file.name?.split('.').pop()
            }}</span>
            <span class="mt-1 w-full truncate px-2 text-center text-[10px] text-(--text-muted)">{{
              file.originalName || file.name
            }}</span>
          </div>
          <!-- 选中标记 -->
          <div
            v-if="selectedIds.includes(file.id)"
            class="bg-primary animate-in zoom-in absolute top-2 right-2 flex size-6 items-center justify-center rounded-full shadow-md duration-200"
          >
            <AppIcon name="check" class="size-3.5 stroke-3 text-(--text-inverse)" />
          </div>
        </div>
      </div>

      <div
        v-if="!loading && currentFolders.length === 0 && files.length === 0"
        class="flex h-full flex-col items-center justify-center pb-10 text-(--text-secondary)"
      >
        <div class="mb-4 flex size-16 items-center justify-center rounded-full bg-(--bg-muted)">
          <AppIcon name="archive-box" class="size-8 text-(--text-muted)" />
        </div>
        <p>{{ t('fileSelector.empty') }}</p>
      </div>
    </div>

    <!-- Footer -->
    <template #footer>
      <ActionBar class="w-full border-none bg-transparent px-0 py-0 shadow-none">
        <AppButton variant="secondary" @click="$emit('close')">
          {{ t('fileSelector.cancel') }}
        </AppButton>
        <AppButton
          variant="primary"
          :disabled="selectedIds.length === 0 && selectedFolderIds.length === 0"
          @click="confirmSelect"
        >
          {{ t('fileSelector.add') }}
          {{
            selectedIds.length + selectedFolderIds.length > 0
              ? `(${selectedIds.length + selectedFolderIds.length})`
              : ''
          }}
        </AppButton>
      </ActionBar>
    </template>
  </Modal>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import { API } from '@/utils/constants';
import { isImage } from '@/utils/formatters';
import { useI18n } from '@/composables/useI18n';
import { useAuth } from '@/composables/useAuth';
import ActionBar from '@/design-system/composed/ActionBar.vue';
import AppButton from '@/components/ui/AppButton.vue';
import Modal from '@/components/ui/Modal.vue';
import AppImage from '@/components/ui/AppImage.vue';
import AppIcon from '@/components/ui/AppIcon.vue';

const emit = defineEmits(['close', 'select']);
const { t } = useI18n();
const { authFetch } = useAuth();

const allFolders = ref([]); // 所有文件夹扁平列表
const files = ref([]);
const loading = ref(false);
const currentFolderId = ref(null);
const breadcrumbs = ref([]);
const selectedIds = ref([]);
const folderAccessDenied = ref(false);

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
    const response = await authFetch(`${API.FOLDERS}?all=true`);
    const result = await response.json();
    if (result.success) {
      folderAccessDenied.value = false;
      allFolders.value = result.data || [];
    }
  } catch (err) {
    const message = err?.data?.error || err?.message || '';
    if (Number(err?.status) === 403 || message.includes('权限不足')) {
      folderAccessDenied.value = true;
      allFolders.value = [];
      return;
    }
    console.error(t('common.loadFailed'), err);
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
    const url = currentFolderId.value ? API.FOLDER_BY_ID(currentFolderId.value) : API.FILES;

    const response = await authFetch(url);
    const result = await response.json();

    if (result.success) {
      // 文件夹详情接口返回结构: data: { ...folderInfo, files: [] }
      // 列表接口返回结构: data: [...]

      if (currentFolderId.value) {
        files.value = result.data.files || [];
      } else {
        files.value = Array.isArray(result.data) ? result.data : result.data?.data || [];
      }
    } else {
      files.value = [];
    }
  } catch (err) {
    const message = err?.data?.error || err?.message || '';
    if (!folderAccessDenied.value || currentFolderId.value) {
      console.error(t('common.loadFailed'), err);
    } else if (Number(err?.status) !== 403 && !message.includes('权限不足')) {
      console.error(t('common.loadFailed'), err);
    }
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
