<template>
  <div>
    <!-- Create Folder Modal -->
    <Modal v-model="showCreateFolder" :title="t('fileManager.newFolder')" size="sm">
      <form @submit.prevent="handleCreateFolder">
        <div class="mb-4">
          <label class="text-primary mb-1 block text-sm font-medium">{{ t('fileManager.table.name') }}</label>
          <input
            v-model="newFolderName"
            type="text"
            required
            class="input w-full"
            :placeholder="t('fileManager.folderNamePlaceholder')"
            autofocus
          />
        </div>
      </form>
      <template #footer>
        <button type="button" class="btn btn-secondary" @click="showCreateFolder = false">
          {{ t('common.cancel') }}
        </button>
        <button class="btn btn-primary" @click="handleCreateFolder">
          {{ t('common.confirm') }}
        </button>
      </template>
    </Modal>

    <!-- Rename Modal -->
    <Modal v-model="showRename" :title="t('fileManager.contextMenu.rename')" size="sm">
      <form @submit.prevent="handleRename">
        <div class="mb-4">
          <label class="text-primary mb-1 block text-sm font-medium">{{ t('fileManager.table.name') }}</label>
          <input
            v-model="renameName"
            type="text"
            required
            class="input w-full"
            autofocus
          />
        </div>
      </form>
      <template #footer>
        <button type="button" class="btn btn-secondary" @click="showRename = false">
          {{ t('common.cancel') }}
        </button>
        <button class="btn btn-primary" @click="handleRename">
          {{ t('common.save') }}
        </button>
      </template>
    </Modal>

    <!-- Move Item Modal -->
    <MoveItemModal v-model="showMove" :items-to-move="itemsToMove" @moved="$emit('moved')" />

    <!-- Share Folder Modal -->
    <ShareFolderModal
      v-model="showShareFolder"
      :folder="shareFolderTarget || currentFolder"
      @updated="$emit('share-updated')"
    />

    <!-- Share File Modal -->
    <ShareFileModal v-model="showShareFile" :file="shareFile" />
  </div>
</template>

<script setup>
import { ref, watch } from 'vue';
import { useI18n } from '@/composables/useI18n';
import Modal from '@/components/ui/Modal.vue';
import MoveItemModal from '@/components/MoveItemModal.vue';
import ShareFolderModal from '@/components/ShareFolderModal.vue';
import ShareFileModal from '@/components/ShareFileModal.vue';

const props = defineProps({
  currentFolder: Object,
  itemsToMove: Array,
  shareFile: Object,
});

const emit = defineEmits([
  'create-folder',
  'rename',
  'moved',
  'share-updated'
]);

const { t } = useI18n();

// Internal State exposed via v-model or methods
const showCreateFolder = ref(false);
const newFolderName = ref('');

const showRename = ref(false);
const renameName = ref('');
const renameTarget = ref(null);

const showMove = ref(false);
const showShareFolder = ref(false);
const showShareFile = ref(false);

// Methods to be called by parent
const openCreateFolder = () => {
  newFolderName.value = '';
  showCreateFolder.value = true;
};

const openRename = (target) => { // target: { id, type, name }
  renameTarget.value = target;
  renameName.value = target.name;
  showRename.value = true;
};

const openMove = () => {
  showMove.value = true;
};

const shareFolderTarget = ref(null);

const openShareFolder = (folder = null) => {
  shareFolderTarget.value = folder;
  showShareFolder.value = true;
};

const openShareFile = () => {
  showShareFile.value = true;
};

const handleCreateFolder = () => {
  emit('create-folder', newFolderName.value);
  showCreateFolder.value = false;
};

const handleRename = () => {
  if (renameTarget.value) {
    emit('rename', { ...renameTarget.value, newName: renameName.value });
    showRename.value = false;
  }
};

defineExpose({
  openCreateFolder,
  openRename,
  openMove,
  openShareFolder,
  openShareFile
});
</script>
