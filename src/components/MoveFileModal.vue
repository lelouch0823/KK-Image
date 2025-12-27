<template>
  <div v-if="modelValue" class="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
    <div class="bg-white rounded-xl shadow-xl w-full max-w-md flex flex-col max-h-[80vh] animate-in fade-in zoom-in duration-200">
      
      <!-- Header -->
      <div class="px-6 py-4 border-b border-[var(--border-color)] flex items-center justify-between">
        <h3 class="text-lg font-semibold text-primary">移动到...</h3>
        <button @click="close" class="text-secondary hover:text-primary transition-colors">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        </button>
      </div>

      <!-- Tree Content -->
      <div class="flex-1 overflow-y-auto p-4 min-h-[300px]">
        <div v-if="loading" class="flex justify-center py-8">
            <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
        <div v-else class="space-y-1">
            <!-- Root Option -->
            <div 
                @click="selectFolder(rootFolder)"
                class="flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors"
                :class="selectedId === rootFolder.id ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-gray-50 text-gray-700'"
            >
                <svg class="w-5 h-5 text-gray-400" :class="selectedId === rootFolder.id ? 'text-indigo-500' : ''" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
                <span class="font-medium">根目录</span>
            </div>

            <!-- Recursive Tree -->
            <div v-for="folder in flattenedFolders" :key="folder.id"
                @click="selectFolder(folder)"
                class="flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors"
                :class="selectedId === folder.id ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-gray-50 text-gray-700'"
                :style="{ paddingLeft: (folder.level * 1.5 + 0.75) + 'rem' }"
            >
                 <svg class="w-5 h-5 text-yellow-400 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z"></path>
                 </svg>
                 <span class="truncate block">{{ folder.name }}</span>
            </div>
            
             <div v-if="flattenedFolders.length === 0 && !loading" class="text-center text-sm text-secondary py-4">
                暂无其他文件夹
            </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="px-6 py-4 border-t border-[var(--border-color)] flex justify-end gap-3 bg-gray-50 rounded-b-xl">
        <button @click="close" class="btn btn-secondary">取消</button>
        <button @click="confirmMove" :disabled="!selectedId || moving" class="btn btn-primary gap-2">
            <span v-if="moving" class="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
            <span>{{ moving ? '移动中...' : '移动' }}</span>
        </button>
      </div>

    </div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted } from 'vue';
import { useToast } from '@/composables/useToast';
import { useAuth } from '@/composables/useAuth';
import { API } from '@/utils/constants';

const props = defineProps({
  modelValue: Boolean,
  filesToMove: { type: Array, default: () => [] } // Array of file IDs
});

const emit = defineEmits(['update:modelValue', 'moved']);

const { addToast } = useToast();
const { getAuthHeader, getHeaders } = useAuth();

const loading = ref(false);
const moving = ref(false);
const selectedId = ref(null);
const flattenedFolders = ref([]);
const rootFolder = { id: 'root', name: '根目录' };

const close = () => {
    emit('update:modelValue', false);
    selectedId.value = null;
    flattenedFolders.value = [];
};

const selectFolder = (folder) => {
    selectedId.value = folder.id;
};

// Build Tree from Flat list
const buildTreeAndFlatten = (flatList) => {
    const map = {};
    const roots = [];
    
    // 1. Initialize map
    flatList.forEach(item => {
        map[item.id] = { ...item, subfolders: [] };
    });
    
    // 2. Build Hierarchy
    flatList.forEach(item => {
        if (item.parent_id && map[item.parent_id]) {
            map[item.parent_id].subfolders.push(map[item.id]);
        } else {
            roots.push(map[item.id]);
        }
    });

    // 3. Flatten with levels
    const result = [];
    const traverse = (nodes, level) => {
        nodes.forEach(node => {
            result.push({ ...node, level });
            if (node.subfolders && node.subfolders.length) {
                traverse(node.subfolders, level + 1);
            }
        });
    };
    
    traverse(roots, 0);
    return result;
};

const fetchAllFolders = async () => {
    loading.value = true;
    try {
        const res = await fetch(`${API.FOLDERS}?all=true`, {
            headers: getAuthHeader()
        }).then(r => r.json());
        
        if (res.success) {
            flattenedFolders.value = buildTreeAndFlatten(res.data);
        }
    } catch (e) {
        addToast({ message: '加载文件夹列表失败', type: 'error' });
    } finally {
        loading.value = false;
    }
};

const confirmMove = async () => {
    if (!selectedId.value) return;
    
    moving.value = true;
    try {
        const res = await fetch(API.MOVE, {
            method: 'POST',
            headers: getHeaders(true),
            body: JSON.stringify({
                fileIds: props.filesToMove,
                folderId: selectedId.value === 'root' ? 'root' : selectedId.value
            })
        }).then(r => r.json());

        if (res.success) {
            addToast({ message: '文件移动成功', type: 'success' });
            emit('moved');
            close();
        } else {
            addToast({ message: res.message || '移动失败', type: 'error' });
        }
    } catch (e) {
        addToast({ message: '操作失败', type: 'error' });
    } finally {
        moving.value = false;
    }
};

watch(() => props.modelValue, (val) => {
    if (val) {
        fetchAllFolders();
        selectedId.value = null;
    }
});
</script>
