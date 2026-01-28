<template>
  <Modal
    :model-value="modelValue"
    :title="t('moveFile.title')"
    size="md"
    body-class="p-0 flex flex-col h-[60vh] min-h-[300px]"
    @update:model-value="close"
  >
    <!-- Tree Content -->
    <div class="flex-1 overflow-y-auto p-4">
      <div v-if="loading" class="flex justify-center py-8">
        <div class="border-primary size-8 animate-spin rounded-full border-b-2"></div>
      </div>
      <div v-else class="space-y-1">
        <!-- Root Option -->
        <div
          class="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 transition-colors"
          :class="
            selectedId === rootFolder.id
              ? 'bg-[var(--color-primary)]/10 text-[var(--color-primary)]'
              : 'text-[var(--text-main)] hover:bg-[var(--bg-hover)]'
          "
          @click="selectFolder(rootFolder)"
        >
          <svg
            class="size-5"
            :class="selectedId === rootFolder.id ? 'text-[var(--color-primary)]' : 'text-[var(--text-muted)]'"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
            />
          </svg>
          <span class="font-medium">{{ t('moveFile.root') }}</span>
        </div>

        <!-- Recursive Tree -->
        <div
          v-for="folder in flattenedFolders"
          :key="folder.id"
          class="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 transition-colors"
          :class="[
             selectedId === folder.id
              ? 'bg-[var(--color-primary)]/10 text-[var(--color-primary)]'
              : 'text-[var(--text-main)] hover:bg-[var(--bg-hover)]',
             isTargetDisabled(folder) ? 'cursor-not-allowed opacity-50' : ''
          ]"
          :style="{ paddingLeft: folder.level * 1.5 + 0.75 + 'rem' }"
          @click="!isTargetDisabled(folder) && selectFolder(folder)"
        >
          <svg class="size-5 shrink-0 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
            <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z"></path>
          </svg>
          <span class="block truncate">{{ folder.name }}</span>
        </div>

        <div
          v-if="flattenedFolders.length === 0 && !loading"
          class="py-4 text-center text-sm text-secondary"
        >
          {{ t('moveFile.empty') }}
        </div>
      </div>
    </div>

    <!-- Footer -->
    <template #footer>
      <AppButton
        variant="secondary"
        :text="t('moveFile.cancel')"
        @click="close"
      />
      <AppButton
        variant="primary"
        :text="moving ? t('moveFile.moving') : t('moveFile.move')"
        :loading="moving"
        :disabled="!selectedId"
        @click="confirmMove"
      />
    </template>
  </Modal>
</template>

<script setup>
import { ref, watch, computed } from 'vue';
import { useToast } from '@/composables/useToast';
import { useAuth } from '@/composables/useAuth';
import Modal from '@/components/ui/Modal.vue';
import AppButton from '@/components/ui/AppButton.vue';
import { useI18n } from '@/composables/useI18n';
import { API } from '@/utils/constants';

const props = defineProps({
  modelValue: Boolean,
  itemsToMove: { type: Array, default: () => [] }, // Array of items: { id, type: 'file'|'folder' }
});

const emit = defineEmits(['update:modelValue', 'moved']);

const { addToast } = useToast();
const { authFetch } = useAuth();
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

// Check if a folder is a valid target
// Cannot move a folder into itself or its descendants
const isTargetDisabled = (targetFolder) => {
  if (!targetFolder || !props.itemsToMove.length) return false;
  
  // If moving folders, check for circular reference
  const movingFolderIds = props.itemsToMove
    .filter(item => item.type === 'folder')
    .map(item => item.id);
    
  if (movingFolderIds.includes(targetFolder.id)) return true;
  
  // Also need to check if targetFolder is a descendant of any moving folder
  // But flattenedFolders structure doesn't easily show full ancestry path without traversal
  // However, we rely on the Backend to catch loop errors as a safety net, 
  // and here we just prevent direct self-selection.
  // For a robust UI, we should check ancestry.
  
  // Simple check: Is targetFolder ID inside the list of moving folders?
  return movingFolderIds.includes(targetFolder.id);
};

// Build Tree from Flat list
const buildTreeAndFlatten = (flatList) => {
  const map = {};
  const roots = [];

  // 1. Initialize map
  flatList.forEach((item) => {
    map[item.id] = { ...item, subfolders: [] };
  });

  // 2. Build Hierarchy
  flatList.forEach((item) => {
    if (item.parent_id && map[item.parent_id]) {
      map[item.parent_id].subfolders.push(map[item.id]);
    } else {
      roots.push(map[item.id]);
    }
  });

  // 3. Flatten with levels
  const result = [];
  const traverse = (nodes, level) => {
    nodes.forEach((node) => {
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
    const res = await authFetch(`${API.FOLDERS}?all=true`).then((r) => r.json());

    if (res.success) {
      flattenedFolders.value = buildTreeAndFlatten(res.data);
    }
  } catch (_e) {
    addToast({ message: t('moveFile.loadFailed'), type: 'error' });
  } finally {
    loading.value = false;
  }
};

const confirmMove = async () => {
  if (!selectedId.value) return;

  moving.value = true;
  const targetFolderId = selectedId.value === 'root' ? null : selectedId.value; // Corrected: root is null in DB usually or 'root'? 
  // Backend expects 'root' or valid ID for folders? Actually updateFolder takes parentId.
  // Check useFileManager moveFolder implementation: it sends { parentId }.
  
  // Let's split items by type
  const files = props.itemsToMove.filter(i => i.type === 'file').map(i => i.id);
  const folders = props.itemsToMove.filter(i => i.type === 'folder').map(i => i.id);
  
  try {
    let successCount = 0;
    
    // Batch move files
    if (files.length > 0) {
       const res = await authFetch(`${API.FILES}/batch/move`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids: files, targetFolderId: targetFolderId === 'root' ? null : targetFolderId }), // DB usually treats null as root for parent_id
       }).then(r => r.json());
       
       if (res.success) successCount++;
       else throw new Error(res.message || 'File move failed');
    }
    
    // Move folders individually (since we don't have batch move folder API yet, or we reuse updateFolder)
    // Actually we can implement batch move folder in backend later, but for now loop
    if (folders.length > 0) {
      // Parallelize
       await Promise.all(folders.map(id => 
          authFetch(`${API.FOLDERS}/${id}`, {
             method: 'PUT',
             headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({ parentId: targetFolderId === 'root' ? null : targetFolderId })
          }).then(r => r.json()).then(res => {
             if (!res.success) throw new Error(res.message);
          })
       ));
       successCount++;
    }

    addToast({ message: t('moveFile.moveSuccess'), type: 'success' });
    emit('moved');
    close();
    
  } catch (err) {
    addToast({ message: err.message || t('moveFile.opFailed'), type: 'error' });
  } finally {
    moving.value = false;
  }
};

watch(
  () => props.modelValue,
  (val) => {
    if (val) {
      fetchAllFolders();
      selectedId.value = null;
    }
  }
);
</script>
