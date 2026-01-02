<template>
  <Modal
    :model-value="true"
    size="3xl"
    body-class="p-0 flex flex-col h-[85vh]"
    @update:model-value="$emit('close')"
  >
    <!-- Custom Header -->
    <template #header>
      <div class="flex items-center gap-3">
        <div>
          <div class="flex items-center gap-2">
            <h2 class="text-primary text-lg font-semibold">
              {{ spaceData?.name || t('spaceManager.detailTitle') }}
            </h2>
            <!-- Status Badge -->
            <!-- Status Badge -->
            <StatusBadge v-if="spaceData?.isPublic" variant="success" dot>
              {{ t('spaceManager.publicOn') }}
            </StatusBadge>
            <StatusBadge v-else variant="default" dot>
              {{ t('spaceManager.publicOff') }}
            </StatusBadge>
          </div>
          <p class="text-secondary mt-0.5 text-sm">
            {{ getTemplateLabel(spaceData?.template) }} ·
            {{ t('fileManager.totalFiles', { count: spaceData?.files?.length || 0 }) }}
          </p>
        </div>
      </div>
    </template>

    <!-- Content -->
    <div class="flex min-h-0 flex-1 flex-col overflow-hidden">
      <!-- Tabs Header -->
      <div class="shrink-0 border-b border-[var(--border-color)] bg-white px-6">
        <div class="flex space-x-6">
          <button
            class="border-b-2 px-1 py-3 text-sm font-medium transition-colors duration-200"
            :class="
              activeTab === 'files'
                ? 'border-primary text-primary'
                : 'text-secondary border-transparent hover:text-[var(--text-main)]'
            "
            @click="activeTab = 'files'"
          >
            {{
              isCollectionTemplate ? t('spaceManager.tabs.subspaces') : t('spaceManager.tabs.files')
            }}
          </button>
          <button
            class="border-b-2 px-1 py-3 text-sm font-medium transition-colors duration-200"
            :class="
              activeTab === 'settings'
                ? 'border-primary text-primary'
                : 'text-secondary border-transparent hover:text-[var(--text-main)]'
            "
            @click="activeTab = 'settings'"
          >
            {{ t('spaceManager.tabs.settings') }}
          </button>
          <button
            class="border-b-2 px-1 py-3 text-sm font-medium transition-colors duration-200"
            :class="
              activeTab === 'analytics'
                ? 'border-primary text-primary'
                : 'text-secondary border-transparent hover:text-[var(--text-main)]'
            "
            @click="activeTab = 'analytics'"
          >
            {{ t('spaceManager.tabs.analytics') }}
          </button>
        </div>
      </div>

      <!-- CONTENT: SUBSPACES (for collection template) -->
      <SubspaceList
        v-if="activeTab === 'files' && isCollectionTemplate"
        :space-id="props.space.id"
        @open-subspace="openSubspaceDetail"
        @updated="onSubspaceUpdated"
      />

      <!-- CONTENT: FILES (for non-collection templates) -->
      <div
        v-else-if="activeTab === 'files'"
        class="flex min-h-0 flex-1 flex-col overflow-hidden bg-[var(--bg-muted)]/50"
      >
        <div
          class="flex shrink-0 items-center justify-between border-b border-[var(--border-color)] bg-white p-4"
        >
          <div class="flex items-center gap-3">
            <Tooltip :content="t('spaceManager.addFile')">
              <button
                class="bg-primary flex size-8 items-center justify-center rounded-lg text-sm font-medium text-white transition-colors hover:bg-[var(--color-primary-hover)]"
                @click="showFileSelector = true"
              >
                <svg class="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M12 4v16m8-8H4"
                  ></path>
                </svg>
              </button>
            </Tooltip>
            <span class="text-secondary text-xs">{{
              t('fileManager.totalFiles', { count: spaceData?.files?.length || 0 })
            }}</span>
          </div>
          <!-- Cover Indicator (Option C Lite) -->
          <div
            v-if="currentCoverFile"
            class="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5"
          >
            <svg class="size-4 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
              <path
                fill-rule="evenodd"
                d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z"
                clip-rule="evenodd"
              />
            </svg>
            <span class="max-w-[100px] truncate text-xs font-medium text-amber-700">{{
              currentCoverFile.originalName || currentCoverFile.name
            }}</span>
          </div>
        </div>

        <div class="flex-1 overflow-y-auto p-4">
          <div
            v-if="spaceData?.files?.length === 0"
            class="text-secondary flex h-full flex-col items-center justify-center py-12"
          >
            <p>{{ t('spaceManager.emptyFiles') }}</p>
          </div>
          <div v-else class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            <div
              v-for="file in spaceData.files"
              :key="file.id"
              class="group relative aspect-square overflow-hidden rounded-lg border border-[var(--border-color)] bg-[var(--bg-muted)]"
              :class="{ 'ring-2 ring-amber-400': spaceData.coverFileId === file.id }"
            >
              <!-- Cover Badge -->
              <div
                v-if="spaceData.coverFileId === file.id"
                class="absolute top-1.5 left-1.5 z-10 flex items-center gap-0.5 rounded bg-amber-500 px-1.5 py-0.5 text-[10px] font-medium text-white shadow-sm"
              >
                <svg class="size-3" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fill-rule="evenodd"
                    d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z"
                    clip-rule="evenodd"
                  />
                </svg>
                {{ t('spaceManager.cover') }}
              </div>
              <img
                v-if="file.mimeType?.startsWith('image/')"
                :src="file.url"
                class="size-full object-cover"
              />
              <div
                v-else
                class="flex size-full items-center justify-center bg-white text-xs font-bold text-gray-400 uppercase"
              >
                {{ file.name?.split('.').pop() }}
              </div>
              <div
                class="absolute inset-0 flex items-center justify-center gap-2 bg-black/40 opacity-0 transition-opacity group-hover:opacity-100"
              >
                <!-- Set as Cover Button (only for images) -->
                <button
                  v-if="file.mimeType?.startsWith('image/') && spaceData.coverFileId !== file.id"
                  class="rounded-full bg-amber-500 p-1.5 text-white transition-colors hover:bg-amber-600"
                  :title="t('spaceManager.setCover')"
                  @click.stop="setCover(file.id)"
                >
                  <svg class="size-4" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fill-rule="evenodd"
                      d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z"
                      clip-rule="evenodd"
                    />
                  </svg>
                </button>
                <!-- Remove Button -->
                <button
                  class="rounded-full bg-[var(--color-danger)] p-1.5 text-white transition-colors hover:bg-red-600"
                  @click.stop="removeFile(file.id)"
                >
                  <svg class="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    ></path>
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- CONTENT: SETTINGS -->
      <div v-show="activeTab === 'settings'" class="flex-1 space-y-4 overflow-y-auto p-6">
        <!-- 分享设置卡片 -->
        <div
          class="from-primary/5 to-primary/10 border-primary/20 rounded-2xl border bg-gradient-to-br p-5"
        >
          <div class="mb-4 flex items-center gap-3">
            <div class="bg-primary/10 flex size-10 items-center justify-center rounded-xl">
              <svg
                class="text-primary size-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                />
              </svg>
            </div>
            <div class="flex-1">
              <h3 class="text-primary font-semibold">{{ t('spaceManager.shareSettings') }}</h3>
              <p class="text-secondary text-sm">
                {{
                  spaceData?.isPublic
                    ? t('spaceManager.publicStatus')
                    : t('spaceManager.shareCard.notPublic')
                }}
              </p>
            </div>
          </div>

          <!-- 未公开状态 -->
          <div v-if="!spaceData?.isPublic" class="space-y-4">
            <button
              :disabled="publishing"
              class="bg-primary flex w-full items-center justify-center gap-2 rounded-xl py-3 font-medium text-white transition-all hover:bg-[var(--color-primary-hover)] disabled:opacity-50"
              @click="publishSpace"
            >
              <svg
                v-if="!publishing"
                class="size-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                />
              </svg>
              <svg v-else class="size-5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle
                  class="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  stroke-width="4"
                />
                <path
                  class="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              {{ publishing ? t('common.saving') : t('spaceManager.shareCard.publishNow') }}
            </button>
            <p class="text-secondary text-center text-xs">
              {{ t('spaceManager.shareCard.publishHint') }}
            </p>
          </div>

          <!-- 已公开状态 -->
          <div v-else class="space-y-4">
            <!-- 访问统计 -->
            <div class="flex items-center gap-4 text-sm">
              <div class="text-secondary flex items-center gap-1.5">
                <svg class="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                  />
                </svg>
                <span>{{ spaceData?.viewCount || 0 }} {{ t('spacePublic.views') }}</span>
              </div>
            </div>

            <!-- 链接显示 -->
            <div class="flex gap-2">
              <input
                type="text"
                readonly
                :value="shareUrl"
                class="text-primary flex-1 rounded-xl border border-[var(--border-color)] bg-white px-4 py-2.5 font-mono text-sm"
              />
              <button
                class="text-primary flex items-center gap-2 rounded-xl border border-[var(--border-color)] bg-white px-4 py-2.5 transition-colors hover:bg-[var(--bg-hover)]"
                @click="copyLink"
              >
                <svg class="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"
                  />
                </svg>
                {{ t('common.copy') }}
              </button>
            </div>

            <!-- 取消公开 -->
            <button
              :disabled="publishing"
              class="text-secondary w-full rounded-xl border border-[var(--border-color)] py-2.5 text-sm transition-colors hover:border-[var(--color-danger)] hover:text-[var(--color-danger)]"
              @click="unpublishSpace"
            >
              {{ t('spaceManager.shareCard.unpublish') }}
            </button>
          </div>
        </div>
      </div>

      <!-- CONTENT: ANALYTICS -->
      <div v-show="activeTab === 'analytics'" class="flex-1 overflow-y-auto p-6">
        <SpaceAnalytics v-if="activeTab === 'analytics'" :space-id="space.id" />
      </div>
    </div>

    <!-- Footer -->
    <template #footer>
      <button
        class="text-secondary px-4 py-2 text-sm font-medium hover:text-primary"
        @click="$emit('close')"
      >
        {{ t('spaceManager.close') }}
      </button>
      <button
        class="text-primary rounded-lg bg-[var(--bg-muted)] px-4 py-2 text-sm font-medium hover:bg-[var(--bg-hover)]"
        @click="openPreview"
      >
        {{ t('spaceManager.preview') }}
      </button>
    </template>

    <!-- 文件选择器 (放在外面，因为它也是一个 Modal) -->
    <FileSelector v-if="showFileSelector" @close="showFileSelector = false" @select="addFiles" />
  </Modal>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useSpaces } from '@/composables/useSpaces';
import { useToast } from '@/composables/useToast';
import { useI18n } from '@/composables/useI18n';
import { useClipboard } from '@/composables/useClipboard';
import { formatSize as _formatSize } from '@/utils/formatters';
import FileSelector from '@/components/FileSelector.vue';
import SpaceAnalytics from './SpaceAnalytics.vue';
import Tooltip from '@/components/ui/Tooltip.vue';
import SubspaceList from '@/components/SubspaceList.vue';
import Modal from '@/components/ui/Modal.vue';
import StatusBadge from '@/components/ui/StatusBadge.vue';

const props = defineProps({
  space: { type: Object, required: true },
});

const emit = defineEmits(['close', 'updated', 'openSubspace']);

const { loadSpace, updateSpace, addFilesToSpace, removeFilesFromSpace } = useSpaces();
const { addToast } = useToast();
const { t } = useI18n();
const { copy } = useClipboard();

const spaceData = ref(null);
const isPublic = ref(false);
const showFileSelector = ref(false);
const activeTab = ref('files');
const customPassword = ref('');
const hasPassword = ref(false);
const publishing = ref(false);

const getTemplateLabel = (key) => {
  const labels = {
    gallery: t('spaceManager.templates.gallery'),
    product: t('spaceManager.templates.product'),
    portfolio: t('spaceManager.templates.portfolio'),
    document: t('spaceManager.templates.document'),
    collection: t('spaceManager.templates.collection'),
    custom: t('spaceManager.templates.custom'),
  };
  return labels[key] || key;
};

const shareUrl = computed(() => {
  if (!spaceData.value?.shareToken) return '';
  return `${window.location.origin}/space/${spaceData.value.shareToken}`;
});

// 判断是否为 Collection 模板
const isCollectionTemplate = computed(() => spaceData.value?.template === 'collection');

// 打开子空间详情 (用于 SubspaceList 组件)
const openSubspaceDetail = (subspace) => {
  // 将子空间传递给父组件处理，由父组件打开对应的编辑器
  emit('openSubspace', subspace);
};

// 子空间更新回调
const onSubspaceUpdated = () => {
  emit('updated');
};

// 当前封面文件 (Option C Lite indicator)
const currentCoverFile = computed(() => {
  if (!spaceData.value?.coverFileId || !spaceData.value?.files) return null;
  return spaceData.value.files.find((f) => f.id === spaceData.value.coverFileId);
});

// 设置封面
const setCover = async (fileId) => {
  await updateSpace(props.space.id, { coverFileId: fileId });
  await loadData();
  addToast({ message: t('spaceManager.coverSet'), type: 'success' });
  emit('updated');
};

const loadData = async () => {
  const data = await loadSpace(props.space.id);
  if (data) {
    spaceData.value = data;
    spaceData.value = data;
    isPublic.value = data.isPublic;
    if (data.password) {
      hasPassword.value = true;
      customPassword.value = data.password;
    } else {
      hasPassword.value = false;
      customPassword.value = '';
    }
  }
};

const publishSpace = async () => {
  publishing.value = true;
  await updateSpace(props.space.id, { isPublic: true });
  await loadData();
  publishing.value = false;
  addToast({ message: t('spaceManager.shareCard.publishSuccess'), type: 'success' });
  emit('updated');
};

const unpublishSpace = async () => {
  publishing.value = true;
  await updateSpace(props.space.id, { isPublic: false });
  await loadData();
  publishing.value = false;
  addToast({ message: t('spaceManager.shareCard.unpublishSuccess'), type: 'success' });
  emit('updated');
};

const _togglePublic = async () => {
  await updateSpace(props.space.id, { isPublic: isPublic.value });
  await loadData();
  emit('updated');
};

const copyLink = async () => {
  await copy(shareUrl.value, {
    successMessage: t('share.linkCopied'),
    errorMessage: t('common.copyFailed'),
  });
};

const addFiles = async (payload) => {
  showFileSelector.value = false;
  await addFilesToSpace(props.space.id, payload);
  await loadData();
  emit('updated');
};

const _updateSpacePassword = async () => {
  if (!customPassword.value) return;
  await updateSpace(props.space.id, { password: customPassword.value });
};

const _togglePassword = async () => {
  if (!customPassword.value) return;
  await updateSpace(props.space.id, { password: customPassword.value });
  addToast({ message: t('spaceManager.passwordUpdated'), type: 'success' });
  await loadData();
  emit('updated');
};

const removeFile = async (fileId) => {
  await removeFilesFromSpace(props.space.id, [fileId]);
  await loadData();
  emit('updated');
};

const openPreview = () => {
  if (spaceData.value?.shareToken) {
    window.open(`/space/${spaceData.value.shareToken}`, '_blank');
  } else {
    addToast({ message: t('spaceManager.pleasePublicFirst'), type: 'warning' });
  }
};

onMounted(loadData);
watch(() => props.space.id, loadData);
</script>
