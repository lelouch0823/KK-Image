<template>
  <Modal
    :model-value="true"
    size="3xl"
    body-class="p-0 flex flex-col h-[85vh]"
    @update:model-value="$emit('close')"
  >
    <!-- Custom Header -->
    <template #header>
      <div class="flex min-w-0 items-center gap-3">
        <div class="min-w-0">
          <div class="flex items-center gap-2">
            <h2
              class="max-w-[16rem] truncate text-lg font-semibold text-(--text-main) sm:max-w-[26rem]"
              :title="spaceData?.name || t('spaceManager.detailTitle')"
            >
              {{ spaceData?.name || t('spaceManager.detailTitle') }}
            </h2>
            <StatusBadge v-if="spaceData?.isPublic" variant="success" dot>
              {{ t('spaceManager.publicOn') }}
            </StatusBadge>
            <StatusBadge v-else variant="default" dot>
              {{ t('spaceManager.publicOff') }}
            </StatusBadge>
          </div>
          <p class="mt-0.5 text-sm text-(--text-secondary)">
            {{ getTemplateLabel(spaceData?.template) }} ·
            {{ t('fileManager.totalFiles', { count: spaceData?.files?.length || 0 }) }}
          </p>
        </div>
      </div>
    </template>

    <!-- Content -->
    <div class="flex min-h-0 flex-1 flex-col overflow-hidden">
      <!-- Tabs Header -->
      <div class="shrink-0 border-b border-(--border-color) bg-(--bg-card) px-6">
        <div class="flex space-x-6">
          <AppButton
            variant="link"
            size="sm"
            class="rounded-none border-b-2 !px-1 !py-3 text-sm font-medium transition-colors duration-200"
            :class="
              activeTab === 'files'
                ? 'border-primary text-primary'
                : 'border-transparent text-(--text-secondary) hover:text-(--text-main)'
            "
            @click="activeTab = 'files'"
          >
            {{
              isCollectionTemplate ? t('spaceManager.tabs.subspaces') : t('spaceManager.tabs.files')
            }}
          </AppButton>
          <AppButton
            variant="link"
            size="sm"
            class="rounded-none border-b-2 !px-1 !py-3 text-sm font-medium transition-colors duration-200"
            :class="
              activeTab === 'settings'
                ? 'border-primary text-primary'
                : 'border-transparent text-(--text-secondary) hover:text-(--text-main)'
            "
            @click="activeTab = 'settings'"
          >
            {{ t('spaceManager.tabs.settings') }}
          </AppButton>
          <AppButton
            variant="link"
            size="sm"
            class="rounded-none border-b-2 !px-1 !py-3 text-sm font-medium transition-colors duration-200"
            :class="
              activeTab === 'analytics'
                ? 'border-primary text-primary'
                : 'border-transparent text-(--text-secondary) hover:text-(--text-main)'
            "
            @click="activeTab = 'analytics'"
          >
            {{ t('spaceManager.tabs.analytics') }}
          </AppButton>
        </div>
      </div>

      <!-- CONTENT: SUBSPACES (for collection template) -->
      <SubspaceList
        v-if="activeTab === 'files' && isCollectionTemplate"
        :space-id="props.space.id"
        :can-manage="props.canManage"
        @open-subspace="openSubspaceDetail"
        @updated="onSubspaceUpdated"
      />

      <!-- CONTENT: FILES (for non-collection templates) -->
      <SpaceFilesTab
        v-else-if="activeTab === 'files'"
        :files="spaceData?.files"
        :cover-file-id="spaceData?.coverFileId"
        :can-manage="props.canManage"
        @add-files="showFileSelector = true"
        @set-cover="setCover"
        @remove="removeFile"
      />

      <!-- CONTENT: SETTINGS -->
      <SpaceSettingsTab
        v-show="activeTab === 'settings'"
        :is-public="spaceData?.isPublic"
        :share-url="shareUrl"
        :view-count="spaceData?.viewCount"
        :publishing="publishing"
        :share-mode="spaceData?.shareMode || 'none'"
        :shared-salespersons="spaceData?.sharedSalespersons || []"
        :can-manage="props.canManage"
        @publish="publishSpace"
        @unpublish="unpublishSpace"
        @update-share-settings="handleUpdateShareSettings"
      />

      <!-- CONTENT: ANALYTICS -->
      <div v-show="activeTab === 'analytics'" class="flex-1 overflow-y-auto p-6">
        <SpaceAnalytics v-if="activeTab === 'analytics'" :space-id="space.id" />
      </div>
    </div>

    <!-- Footer -->
    <template #footer>
      <AppButton variant="secondary" @click="$emit('close')">
        {{ t('spaceManager.close') }}
      </AppButton>
      <AppButton variant="white" class="text-primary hover:text-primary" @click="openPreview">
        {{ t('spaceManager.preview') }}
      </AppButton>
    </template>

    <!-- 文件选择器 -->
    <FileSelector
      v-if="showFileSelector && props.canManage"
      @close="showFileSelector = false"
      @select="addFiles"
    />
  </Modal>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { useSpaces } from '@/composables/useSpaces';
import { useToast } from '@/composables/useToast';
import { useI18n } from '@/composables/useI18n';

// Components
import FileSelector from '@/components/FileSelector.vue';
import SpaceAnalytics from './SpaceAnalytics.vue';
import SubspaceList from '@/components/SubspaceList.vue';
import AppButton from '@/components/ui/AppButton.vue';
import Modal from '@/components/ui/Modal.vue';
import StatusBadge from '@/components/ui/StatusBadge.vue';
import SpaceFilesTab from './space/SpaceFilesTab.vue';
import SpaceSettingsTab from './space/SpaceSettingsTab.vue';
import { openInNewTab } from '@/utils/browser';
import { formatReadableLabel } from '@/utils/event-display';

const props = defineProps({
  space: { type: Object, required: true },
  canManage: { type: Boolean, default: false },
});

const emit = defineEmits(['close', 'updated', 'openSubspace']);

const { loadSpace, updateSpace, addFilesToSpace, removeFilesFromSpace } = useSpaces();
const { addToast } = useToast();
const { t } = useI18n();

const spaceData = ref(null);
const showFileSelector = ref(false);
const activeTab = ref('files');
const publishing = ref(false);
let loadRequestId = 0;

const getTemplateLabel = (key) => {
  const labels = {
    gallery: t('spaceManager.templates.gallery'),
    product: t('spaceManager.templates.product'),
    portfolio: t('spaceManager.templates.portfolio'),
    document: t('spaceManager.templates.document'),
    collection: t('spaceManager.templates.collection'),
    custom: t('spaceManager.templates.custom'),
  };
  return labels[key] || formatReadableLabel(key);
};

const shareUrl = computed(() => {
  if (!spaceData.value?.shareToken) return '';
  return `${window.location.origin}/space/${spaceData.value.shareToken}`;
});

const isCollectionTemplate = computed(() => spaceData.value?.template === 'collection');

const openSubspaceDetail = (subspace) => {
  emit('openSubspace', subspace);
};

const onSubspaceUpdated = () => {
  emit('updated');
};

const setCover = async (fileId) => {
  if (!props.canManage) return;
  const updated = await updateSpace(props.space.id, { coverFileId: fileId });
  if (!updated) return;
  await loadData();
  addToast({ message: t('spaceManager.coverSet'), type: 'success' });
  emit('updated');
};

const loadData = async () => {
  const spaceId = props.space.id;
  const requestId = ++loadRequestId;
  if (spaceData.value?.id !== spaceId) {
    spaceData.value = null;
  }
  const data = await loadSpace(spaceId);
  if (requestId !== loadRequestId || props.space.id !== spaceId) return;
  spaceData.value = data || null;
};

const publishSpace = async () => {
  if (!props.canManage) return;
  publishing.value = true;
  try {
    const updated = await updateSpace(props.space.id, { isPublic: true });
    if (!updated) return;
    await loadData();
    addToast({ message: t('spaceManager.shareCard.publishSuccess'), type: 'success' });
    emit('updated');
  } finally {
    publishing.value = false;
  }
};

const unpublishSpace = async () => {
  if (!props.canManage) return;
  publishing.value = true;
  try {
    const updated = await updateSpace(props.space.id, { isPublic: false });
    if (!updated) return;
    await loadData();
    addToast({ message: t('spaceManager.shareCard.unpublishSuccess'), type: 'success' });
    emit('updated');
  } finally {
    publishing.value = false;
  }
};

const handleUpdateShareSettings = async (settings) => {
  if (!props.canManage) return;
  publishing.value = true;
  try {
    const updated = await updateSpace(props.space.id, settings);
    if (!updated) return;
    await loadData();
    addToast({ message: t('common.saveSuccess'), type: 'success' });
    emit('updated');
  } finally {
    publishing.value = false;
  }
};

const addFiles = async (payload) => {
  if (!props.canManage) return;
  showFileSelector.value = false;
  const added = await addFilesToSpace(props.space.id, payload);
  if (!added) return;
  await loadData();
  emit('updated');
};

const removeFile = async (fileId) => {
  if (!props.canManage) return;
  const removed = await removeFilesFromSpace(props.space.id, [fileId]);
  if (!removed) return;
  await loadData();
  emit('updated');
};

const openPreview = () => {
  if (spaceData.value?.shareToken) {
    openInNewTab(`/space/${spaceData.value.shareToken}`);
  } else {
    addToast({ message: t('spaceManager.pleasePublicFirst'), type: 'warning' });
  }
};

onMounted(loadData);
watch(
  () => props.space.id,
  () => {
    activeTab.value = 'files';
    showFileSelector.value = false;
    loadData();
  }
);
onUnmounted(() => {
  loadRequestId += 1;
});
</script>
