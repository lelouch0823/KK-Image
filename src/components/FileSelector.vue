<template>
  <div class="fixed inset-0 z-[60] flex items-center justify-center bg-black/50" @click.self="$emit('close')">
    <div class="bg-white rounded-2xl shadow-xl w-full max-w-2xl mx-4 max-h-[80vh] flex flex-col overflow-hidden">
      <!-- Header -->
      <div class="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
        <div>
          <h2 class="text-lg font-semibold text-primary">选择文件</h2>
          <p class="text-sm text-secondary mt-0.5">已选择 {{ selectedIds.length }} 个文件</p>
        </div>
        <button @click="$emit('close')" class="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        </button>
      </div>

      <!-- 路径导航 -->
      <div class="px-6 py-3 border-b border-gray-100 flex items-center gap-2 text-sm shrink-0 overflow-x-auto whitespace-nowrap">
        <button @click="navigateTo(null)" 
          class="hover:text-primary transition-colors"
          :class="!currentFolderId ? 'font-semibold text-primary' : 'text-secondary'">
          全部文件
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

      <!-- 文件列表 -->
      <div class="flex-1 overflow-y-auto p-4">
        <div v-if="loading" class="flex justify-center py-10">
          <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
        </div>
        
        <div v-else class="grid grid-cols-4 gap-3 content-start">
          <!-- 文件夹列表 -->
          <div v-for="folder in currentFolders" :key="'f-' + folder.id"
            @click="navigateTo(folder.id, folder)"
            class="aspect-square bg-blue-50 hover:bg-blue-100 rounded-lg flex flex-col items-center justify-center cursor-pointer transition-colors group relative border-2"
            :class="selectedFolderIds.includes(folder.id) ? 'border-primary ring-2 ring-primary/20' : 'border-transparent'">
            <div class="absolute top-2 right-2 z-10" @click="(e) => toggleFolderSelect(folder.id, e)">
                <div class="w-5 h-5 rounded border flex items-center justify-center transition-colors shadow-sm"
                     :class="selectedFolderIds.includes(folder.id) ? 'bg-primary border-primary' : 'bg-white border-gray-300 hover:border-primary'">
                    <svg v-if="selectedFolderIds.includes(folder.id)" class="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path>
                    </svg>
                </div>
            </div>
            <svg class="w-10 h-10 text-blue-400 group-hover:text-blue-500 mb-2 transition-colors" fill="currentColor" viewBox="0 0 20 20">
              <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z"></path>
            </svg>
            <span class="text-xs font-medium text-gray-700 px-2 text-center truncate w-full">{{ folder.name }}</span>
          </div>

          <!-- 文件列表 -->
          <div v-for="file in files" :key="file.id"
            @click="toggleSelect(file.id)"
            class="relative aspect-square rounded-lg overflow-hidden cursor-pointer border-2 transition-all hover:opacity-80"
            :class="selectedIds.includes(file.id) ? 'border-primary ring-2 ring-primary/20' : 'border-transparent'">
            <!-- 图片预览 -->
            <img v-if="isImage(file)" :src="file.url" :alt="file.name" 
              class="w-full h-full object-cover" loading="lazy">
            <!-- 非图片 -->
            <div v-else class="w-full h-full bg-gray-100 flex flex-col items-center justify-center">
              <span class="text-xs font-bold text-gray-400 uppercase">{{ file.name?.split('.').pop() }}</span>
              <span class="text-[10px] text-gray-400 mt-1 px-2 truncate w-full text-center">{{ file.originalName || file.name }}</span>
            </div>
            <!-- 选中标记 -->
            <div v-if="selectedIds.includes(file.id)"
              class="absolute top-1 right-1 w-5 h-5 bg-primary rounded-full flex items-center justify-center">
              <svg class="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path>
              </svg>
            </div>
          </div>
        </div>
        
        <div v-if="!loading && currentFolders.length === 0 && files.length === 0" class="text-center py-10 text-secondary">
          <p>此文件夹为空</p>
        </div>
      </div>

      <!-- Footer -->
      <div class="px-6 py-4 border-t border-gray-100 flex justify-end gap-3 shrink-0">
        <button @click="$emit('close')" class="px-4 py-2 text-sm font-medium text-secondary hover:text-primary">
          取消
        </button>
        <button @click="confirmSelect" :disabled="selectedIds.length === 0 && selectedFolderIds.length === 0"
          class="px-6 py-2 text-sm font-medium bg-primary text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed">
          添加 {{ (selectedIds.length + selectedFolderIds.length) > 0 ? `(${selectedIds.length + selectedFolderIds.length})` : '' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import { API } from '@/utils/constants';
import { isImage } from '@/utils/formatters';

const emit = defineEmits(['close', 'select']);

const allFolders = ref([]); // 所有文件夹扁平列表
const files = ref([]);
const loading = ref(false);
const currentFolderId = ref(null);
const breadcrumbs = ref([]);
const selectedIds = ref([]);

// 计算当前目录下的子文件夹
const currentFolders = computed(() => {
  return allFolders.value.filter(f => f.parent_id == currentFolderId.value);
});

// 加载所有文件夹结构
const loadFoldersStructure = async () => {
  try {
    const response = await fetch(API.FOLDERS, { credentials: 'include' });
    const result = await response.json();
    if (result.success) {
      allFolders.value = result.data || [];
    }
  } catch (err) {
    console.error('加载文件夹失败:', err);
  }
};

const navigateTo = (folderId, folderObj = null) => {
  currentFolderId.value = folderId;
  
  if (folderId === null) {
    breadcrumbs.value = [];
  } else {
    // 简单面包屑逻辑：如果直接点击子文件夹，追加；如果是导航条点击...这里简化处理，实际应递归查找
    // 假设是点击子文件夹进入：
    if (folderObj) {
      breadcrumbs.value.push(folderObj);
    } else {
      // 导航条回跳：找到该ID在breadcrumbs中的位置，截断后续
      const index = breadcrumbs.value.findIndex(b => b.id === folderId);
      if (index !== -1) {
        breadcrumbs.value = breadcrumbs.value.slice(0, index + 1);
      }
    }
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
    console.error('加载文件失败:', err);
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
