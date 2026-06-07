<template>
  <div>
    <!-- Create Folder Modal -->
    <Modal v-model="showCreateFolder" :title="t('fileManager.newFolder')" size="sm">
      <form @submit.prevent="handleCreateFolder">
        <AppInput
          v-model="newFolderName"
          v-focus
          :placeholder="t('fileManager.folderNamePlaceholder')"
          class="mb-6"
          required
        />
        <div class="flex justify-end gap-3">
          <AppButton
            variant="secondary"
            :text="t('common.cancel')"
            @click="showCreateFolder = false"
          />
          <AppButton
            type="submit"
            variant="primary"
            :text="t('common.create')"
            :disabled="!newFolderName.trim()"
          />
        </div>
      </form>
    </Modal>

    <!-- Rename Modal -->
    <Modal v-model="showRename" :title="t('fileManager.contextMenu.rename')" size="sm">
      <form @submit.prevent="handleRename">
        <AppInput v-model="renameName" v-focus class="mb-6" required />
        <div class="flex justify-end gap-3">
          <AppButton variant="secondary" :text="t('common.cancel')" @click="showRename = false" />
          <AppButton
            type="submit"
            variant="primary"
            :text="t('common.save')"
            :disabled="!renameName.trim()"
          />
        </div>
      </form>
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

    <!-- Tag Modal -->
    <TagModal v-model="showTag" :items="itemsToTag" @tagged="$emit('tagged')" />
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useI18n } from '@/composables/useI18n';
import Modal from '@/components/ui/Modal.vue';
import AppButton from '@/components/ui/AppButton.vue';
import AppInput from '@/components/ui/AppInput.vue';
import MoveItemModal from '@/components/MoveItemModal.vue';
import ShareFolderModal from '@/components/ShareFolderModal.vue';
import ShareFileModal from '@/components/ShareFileModal.vue';
import TagModal from '@/components/TagModal.vue';

defineProps({
  currentFolder: { type: Object, default: null },
  itemsToMove: { type: Array, default: () => [] },
  itemsToTag: { type: Array, default: () => [] },
  shareFile: { type: Object, default: null },
});

const emit = defineEmits(['create-folder', 'rename', 'moved', 'tagged', 'share-updated']);

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
const showTag = ref(false);

// Methods to be called by parent
const openCreateFolder = () => {
  newFolderName.value = '';
  showCreateFolder.value = true;
};

const openRename = (target) => {
  // target: { id, type, name }
  renameTarget.value = target;
  renameName.value = target.name;
  showRename.value = true;
};

const openMove = () => {
  showMove.value = true;
};

const openTag = () => {
  showTag.value = true;
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
  openShareFile,
  openTag,
});
</script>
