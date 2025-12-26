<template>
  <div class="bg-white rounded-xl border border-[var(--border-color)] min-h-[calc(100vh-8rem)] flex flex-col">
    <!-- 工具栏 -->
    <div class="px-6 py-4 border-b border-[var(--border-color)] flex items-center justify-between">
      <!-- 面包屑 -->
      <div class="flex items-center gap-2 overflow-x-auto scrollbar-thin max-w-2xl">
        <button @click="navigateTo(null)"
          class="flex items-center gap-1 text-sm font-medium hover:text-primary transition-colors whitespace-nowrap"
          :class="!currentFolder ? 'text-primary' : 'text-secondary'">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
             <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"></path>
          </svg>
          根目录
        </button>
        <template v-for="(crumb, index) in breadcrumbs" :key="crumb.id">
          <span class="text-secondary text-sm">/</span>
          <button @click="navigateTo(crumb.id)"
            class="text-sm font-medium hover:text-primary transition-colors whitespace-nowrap"
            :class="index === breadcrumbs.length - 1 ? 'text-primary' : 'text-secondary'">
            {{ crumb.name }}
          </button>
        </template>
      </div>

      <!-- 操作按钮 -->
      <div class="flex items-center gap-3">
        <!-- New: Share Folder Button -->
        <button v-if="currentFolder" @click="handleShareFolder" class="btn btn-secondary gap-2" title="分享文件夹">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"></path>
            </svg>
            <span class="hidden sm:inline">分享</span>
        </button>

        <input type="file" ref="fileInput" multiple class="hidden" @change="handleFileSelect">
        <button @click="$refs.fileInput.click()" 
          class="btn btn-primary gap-2">
           <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path>
           </svg>
           上传
        </button>
        <button @click="openCreateFolderModal" 
          class="btn btn-secondary gap-2">
           <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z"></path>
           </svg>
           新建文件夹
        </button>
      </div>
    </div>

    <!-- 当前文件夹信息 -->
    <div v-if="currentFolder" class="px-6 py-3 bg-[var(--bg-muted)] border-b border-[var(--border-color)] flex items-center justify-between text-sm">
       <div class="flex items-center gap-4 text-secondary">
         <!-- Fix: Use local array lengths -->
         <span>{{ files.length }} 个文件</span>
         <span>{{ subfolders.length }} 个文件夹</span>
       </div>
       <div class="flex items-center gap-3">
          <!-- 文件夹操作栏 (Red delete text removed) -->
       </div>
    </div>

    <!-- 加载中 -->
    <div v-if="loading" class="flex-1 flex items-center justify-center min-h-[200px]">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>

    <!-- 内容区域 -->
    <div v-else class="flex-1 flex flex-col">
      <!-- 文件夹列表 -->
      <div v-if="subfolders.length > 0" class="p-6 pb-0 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        <div v-for="folder in subfolders" :key="folder.id"
          @click="navigateTo(folder.id)"
          class="group bg-white border border-[var(--border-color)] rounded-xl p-4 hover:shadow-md transition-all cursor-pointer relative hover:border-gray-300">
          <div class="flex flex-col items-center">
             <svg class="w-16 h-16 text-yellow-400 mb-2 group-hover:scale-110 transition-transform" fill="currentColor" viewBox="0 0 20 20">
              <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z"></path>
             </svg>
             <div class="text-sm font-medium text-primary text-center truncate w-full px-2" :title="folder.name">{{ folder.name }}</div>
             <div class="text-xs text-secondary mt-1">{{ folder.fileCount }} 项</div>
          </div>
        </div>
      </div>

      <!-- 分隔线 -->
      <div v-if="subfolders.length > 0 && files.length > 0" class="mx-6 h-px bg-[var(--border-color)] my-6"></div>

      <!-- 文件列表 -->
      <div v-if="files.length > 0" class="p-6 pt-0 flex-1">
        <h3 v-if="subfolders.length > 0" class="text-sm font-semibold text-secondary mb-4 mt-6">文件</h3>
        <div class="overflow-x-auto">
          <table class="w-full">
            <thead>
              <tr class="text-left text-xs font-medium text-secondary uppercase tracking-wider border-b border-[var(--border-color)]">
                <th class="px-4 py-3">名称</th>
                <th class="px-4 py-3">大小</th>
                <th class="px-4 py-3">类型</th>
                <th class="px-4 py-3">上传时间</th>
                <th class="px-4 py-3 text-right">操作</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-[var(--border-color)]">
              <tr v-for="file in files" :key="file.id" class="hover:bg-[var(--bg-hover)] group transition-colors">
                <td class="px-4 py-3">
                  <div class="flex items-center gap-3">
                    <img v-if="isImage(file)" :src="file.url" class="w-8 h-8 rounded object-cover border border-[var(--border-color)] bg-gray-50">
                    <div v-else class="w-8 h-8 rounded bg-gray-100 flex items-center justify-center text-xs text-secondary uppercase border border-[var(--border-color)]">
                      {{ getFileExtension(file.name) }}
                    </div>
                    <a :href="file.url" target="_blank" class="text-sm font-medium text-primary truncate max-w-[200px] hover:underline" :title="file.originalName">{{ file.originalName || file.name }}</a>
                  </div>
                </td>
                <td class="px-4 py-3 text-sm text-secondary">{{ formatSize(file.size) }}</td>
                <td class="px-4 py-3 text-sm text-secondary uppercase">{{ getFileExtension(file.name) }}</td>
                <td class="px-4 py-3 text-sm text-secondary">{{ formatDate(file.createdAt) }}</td>
                <td class="px-4 py-3 text-right">
                  <div class="flex items-center justify-end gap-1">
                    <!-- Share -->
                    <button @click="handleShareFile(file)" class="p-1.5 text-secondary hover:text-primary hover:bg-gray-100 rounded-lg transition-colors" title="分享链接">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"></path></svg>
                    </button>
                    <!-- Move -->
                    <button @click="handleMoveFile(file)" class="p-1.5 text-secondary hover:text-primary hover:bg-gray-100 rounded-lg transition-colors" title="移动文件">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"></path></svg>
                    </button>
                    <!-- Delete -->
                    <button @click="deleteFile(file.id)" class="p-1.5 text-secondary hover:text-danger hover:bg-red-50 rounded-lg transition-colors" title="删除">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- 空状态 -->
      <div v-if="!loading && subfolders.length === 0 && files.length === 0" class="flex-1 flex flex-col items-center justify-center py-16 text-center">
         <div class="w-16 h-16 mb-4 bg-gray-50 rounded-full flex items-center justify-center border-2 border-dashed border-gray-200">
            <svg class="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 4v16m8-8H4"></path>
            </svg>
         </div>
         <h3 class="text-lg font-medium text-primary">此文件夹为空</h3>
         <p class="text-secondary text-sm mt-1">拖拽文件到此处上传，或创建新文件夹</p>
      </div>
    </div>

    <!-- 创建文件夹 Modal -->
    <div v-if="showModal" class="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div class="bg-white rounded-xl shadow-xl w-full max-w-md p-6 animate-in fade-in zoom-in duration-200">
        <h3 class="text-lg font-semibold text-primary mb-4">新建文件夹</h3>
        <form @submit.prevent="handleCreateFolder">
          <div class="mb-4">
            <label class="block text-sm font-medium text-primary mb-1">名称</label>
            <input v-model="folderName" type="text" required class="input" placeholder="输入文件夹名称" autofocus>
          </div>
          <div class="flex justify-end gap-3">
            <button type="button" @click="showModal = false" class="btn btn-secondary">取消</button>
            <button type="submit" class="btn btn-primary">确定</button>
          </div>
        </form>
      </div>
    </div>

    <!-- Move File Modal -->
    <MoveFileModal 
      v-model="showMoveModal" 
      :files-to-move="filesToMove" 
      @moved="handleMoved" 
    />

    <!-- Share Folder Modal -->
    <ShareFolderModal
      v-model="showShareModal"
      :folder="currentFolder"
      @updated="handleShareUpdated"
    />

  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { useFileManager } from '@/composables/useFileManager';
import MoveFileModal from '@/components/MoveFileModal.vue';
import ShareFolderModal from '@/components/ShareFolderModal.vue';
import { useToast } from '@/composables/useToast';

const { addToast } = useToast();

const {
  loading,
  currentFolder,
  subfolders,
  files,
  breadcrumbs,
  loadFolderData,
  createFolder,
  deleteFolder,
  deleteFile,
  uploadFiles,
  formatSize,
  formatDate,
  getFileExtension,
  isImage
} = useFileManager();

const showModal = ref(false);
const showMoveModal = ref(false);
const filesToMove = ref([]);

const navigateTo = (id) => {
  loadFolderData(id);
};

const openCreateFolderModal = () => {
  folderName.value = '';
  showModal.value = true;
};

const handleCreateFolder = async () => {
  const success = await createFolder({ name: folderName.value });
  if (success) showModal.value = false;
};

const handleDeleteFolder = async (folder) => {
  if (confirm(`确定要删除文件夹 "${folder.name}" 及其内容吗？`)) {
    await deleteFolder(folder.id);
  }
};

const handleFileSelect = (e) => {
  const files = Array.from(e.target.files);
  if (files.length) {
    uploadFiles(files);
  }
};

const handleShareFile = (file) => {
    const url = `${window.location.origin}${file.url}`;
    navigator.clipboard.writeText(url).then(() => {
        addToast({ message: '文件链接已复制', type: 'success' });
    }).catch(() => {
        addToast({ message: '复制失败', type: 'error' });
    });
};

// New: State for share modal
const showShareModal = ref(false);

const handleShareFolder = () => {
    // Open modal instead of direct copy
    showShareModal.value = true;
};

const handleShareUpdated = () => {
    loadFolderData(currentFolder.value?.id);
};

const handleMoveFile = (file) => {
    filesToMove.value = [file.id];
    showMoveModal.value = true;
};

const handleMoved = () => {
    // Refresh current folder
    loadFolderData(currentFolder.value?.id);
};

onMounted(() => {
  loadFolderData();
});
</script>
