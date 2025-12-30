<template>
  <Modal 
    :modelValue="modelValue" 
    :title="t('moveFile.title')"
    size="md"
    bodyClass="p-0 flex flex-col h-[60vh] min-h-[300px]"
    @update:modelValue="close"
  >
    <!-- Tree Content -->
    <div class="flex-1 overflow-y-auto p-4">
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
              <span class="font-medium">{{ t('moveFile.root') }}</span>
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
              {{ t('moveFile.empty') }}
          </div>
      </div>
    </div>

    <!-- Footer -->
    <template #footer>
      <button @click="close" class="px-4 py-2 text-secondary hover:bg-gray-100 rounded-lg transition-colors">{{ t('moveFile.cancel') }}</button>
      <button @click="confirmMove" :disabled="!selectedId || moving" 
        class="px-6 py-2 bg-primary text-white font-medium rounded-lg hover:bg-[var(--color-primary-hover)] transition-colors flex items-center gap-2 disabled:opacity-50">
          <span v-if="moving" class="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
          <span>{{ moving ? t('moveFile.moving') : t('moveFile.move') }}</span>
      </button>
    </template>
  </Modal>
</template>

<script setup>
import { ref, watch, computed } from 'vue';
import { useToast } from '@/composables/useToast';
import { useAuth } from '@/composables/useAuth';
import Modal from '@/components/ui/Modal.vue';
import { useI18n } from '@/composables/useI18n';
import { API } from '@/utils/constants';

const props = defineProps({
  modelValue: Boolean,
  filesToMove: { type: Array, default: () => [] } // Array of file IDs
});

const emit = defineEmits(['update:modelValue', 'moved']);

const { addToast } = useToast();
const { getAuthHeader, getHeaders } = useAuth();
const { t } = useI18n();

const loading = ref(false);
const moving = ref(false);
const selectedId = ref(null);
const flattenedFolders = ref([]);
const rootFolder = computed(() => ({ id: 'root', name: t('moveFile.root') }));

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
        addToast({ message: t('moveFile.loadFailed'), type: 'error' });
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
            addToast({ message: t('moveFile.moveSuccess'), type: 'success' });
            emit('moved');
            close();
        } else {
            addToast({ message: res.message || t('moveFile.moveFailed'), type: 'error' });
        }
    } catch (e) {
        addToast({ message: t('moveFile.opFailed'), type: 'error' });
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
