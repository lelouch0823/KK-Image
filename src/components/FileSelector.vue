<template>
  <Modal 
    :modelValue="true" 
    size="2xl"
    bodyClass="flex flex-col p-0 h-[80vh] overflow-hidden"
    @update:modelValue="$emit('close')"
  >
    <template #header>
        <div>
          <h2 class="text-lg font-semibold text-primary">{{ t('fileSelector.title') }}</h2>
          <p class="text-sm text-secondary mt-0.5">{{ t('fileSelector.selectedCount', { count: selectedIds.length + selectedFolderIds.length }) }}</p>
        </div>
    </template>

    <!-- 路径导航 (Fixed at top of body) -->
    <div class="px-6 py-3 border-b border-[var(--border-color)] flex items-center gap-2 text-sm shrink-0 overflow-x-auto whitespace-nowrap bg-[var(--bg-muted)]/30 backdrop-blur-sm">
      <button @click="navigateTo(null)" 
        class="hover:text-primary transition-colors flex items-center gap-1"
        :class="!currentFolderId ? 'font-semibold text-primary' : 'text-secondary'">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"></path></svg>
        {{ t('fileSelector.allFiles') }}
      </button>
      <template v-for="(folder, index) in breadcrumbs" :key="folder.id">
        <span class="text-gray-300">/</span>
        <button @click="navigateTo(folder.id)" 
          class="hover:text-primary transition-colors"
          :class="currentFolderId === folder.id ? 'font-semibold text-primary' : 'text-secondary'">
          {{ folder.name }}
        </button>
      </template>
    </div>

    <!-- 文件列表 (Scrollable) -->
    <div class="flex-1 overflow-y-auto p-4 content-area">
      <div v-if="loading" class="flex justify-center py-10">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
      
      <div v-else class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 content-start">
        <!-- 文件夹列表 -->
        <div v-for="folder in currentFolders" :key="'f-' + folder.id"
          @click="navigateTo(folder.id, folder)"
          class="aspect-square bg-blue-50/50 hover:bg-blue-50 rounded-xl flex flex-col items-center justify-center cursor-pointer transition-all group relative border-2"
          :class="selectedFolderIds.includes(folder.id) ? 'border-primary ring-2 ring-primary/20 bg-blue-50' : 'border-transparent'">
          <div class="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity" :class="{'opacity-100': selectedFolderIds.includes(folder.id)}" @click="(e) => toggleFolderSelect(folder.id, e)">
              <div class="w-6 h-6 rounded-full border flex items-center justify-center transition-all shadow-sm"
                   :class="selectedFolderIds.includes(folder.id) ? 'bg-primary border-primary' : 'bg-white border-gray-300 hover:border-primary'">
                  <svg v-if="selectedFolderIds.includes(folder.id)" class="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path>
                  </svg>
              </div>
          </div>
          <svg class="w-12 h-12 text-blue-400 group-hover:text-blue-500 mb-2 transition-transform group-hover:scale-110 duration-200" fill="currentColor" viewBox="0 0 20 20">
            <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z"></path>
          </svg>
          <span class="text-xs font-medium text-gray-700 px-2 text-center truncate w-full">{{ folder.name }}</span>
        </div>

        <!-- 文件列表 -->
        <div v-for="file in files" :key="file.id"
          @click="toggleSelect(file.id)"
          class="relative aspect-square rounded-xl overflow-hidden cursor-pointer border-2 transition-all hover:shadow-lg group"
          :class="selectedIds.includes(file.id) ? 'border-primary ring-2 ring-primary/20' : 'border-transparent'">
          <!-- 图片预览 -->
          <img v-if="isImage(file)" :src="file.url" :alt="file.name" 
            class="w-full h-full object-cover transition-transform group-hover:scale-105 duration-300" loading="lazy">
          <!-- 非图片 -->
          <div v-else class="w-full h-full bg-gray-50 flex flex-col items-center justify-center">
            <span class="text-xs font-bold text-gray-400 uppercase">{{ file.name?.split('.').pop() }}</span>
            <span class="text-[10px] text-gray-400 mt-1 px-2 truncate w-full text-center">{{ file.originalName || file.name }}</span>
          </div>
          <!-- 选中标记 -->
          <div v-if="selectedIds.includes(file.id)"
            class="absolute top-2 right-2 w-6 h-6 bg-primary rounded-full flex items-center justify-center shadow-md animate-in zoom-in duration-200">
            <svg class="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path>
            </svg>
          </div>
        </div>
      </div>
      
      <div v-if="!loading && currentFolders.length === 0 && files.length === 0" class="flex flex-col items-center justify-center h-full text-secondary pb-10">
         <div class="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
             <svg class="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"></path></svg>
         </div>
         <p>{{ t('fileSelector.empty') }}</p>
      </div>
    </div>

    <!-- Footer -->
    <template #footer>
      <button @click="$emit('close')" class="px-4 py-2 text-sm font-medium text-secondary hover:text-primary transition-colors">
        {{ t('fileSelector.cancel') }}
      </button>
      <button @click="confirmSelect" :disabled="selectedIds.length === 0 && selectedFolderIds.length === 0"
        class="px-6 py-2 text-sm font-medium bg-primary text-white rounded-lg hover:bg-[var(--color-primary-hover)] disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-primary/20 transition-all active:scale-95">
        {{ t('fileSelector.add') }} {{ (selectedIds.length + selectedFolderIds.length) > 0 ? `(${selectedIds.length + selectedFolderIds.length})` : '' }}
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
  return allFolders.value.filter(f => {
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

const navigateTo = (folderId, folderObj = null) => {
  currentFolderId.value = folderId;
  
  if (folderId === null) {
    breadcrumbs.value = [];
  } else {
    // 鲁棒的面包屑逻辑：根据当前文件夹回溯所有父级
    const crumbs = [];
    let tempId = folderId;
    while (tempId) {
      const folder = allFolders.value.find(f => f.id === tempId);
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
        folderIds: selectedFolderIds.value 
    });
};

onMounted(() => {
  loadFoldersStructure();
  loadFiles();
});
</script>
