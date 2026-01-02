<template>
  <div class="space-manager">
    <!-- 页面标题 -->
    <div class="mb-6 flex items-center justify-between">
      <div>
        <h1 class="text-primary text-xl font-semibold">{{ t('spaceManager.title') }}</h1>
        <p class="text-secondary mt-1 text-sm">{{ t('spaceManager.subtitle') }}</p>
      </div>
      <button v-if="spaces.length === 0" disabled class="invisible px-4 py-2">
        <!-- 占位符保持布局 -->
      </button>
      <div v-else class="flex gap-2">
        <!-- 未来可扩展：导入、归档等按钮 -->
        <Tooltip :content="t('spaceManager.create')">
          <button
            class="bg-primary flex size-9 items-center justify-center rounded-lg text-white shadow-sm transition-colors hover:bg-[var(--color-primary-hover)]"
            @click="showCreateModal = true"
          >
            <svg class="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 4v16m8-8H4"
              ></path>
            </svg>
          </button>
        </Tooltip>
      </div>
    </div>

    <!-- 加载状态 -->
    <div v-if="loading" class="flex justify-center py-20">
      <div class="border-primary size-8 animate-spin rounded-full border-b-2"></div>
    </div>

    <!-- 空间列表 -->
    <div v-else-if="spaces.length > 0" class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      <div
        v-for="space in spaces"
        :key="space.id"
        class="group cursor-pointer overflow-hidden rounded-xl border border-[var(--border-color)] bg-white transition-all hover:shadow-lg"
        @click="openSpaceDetail(space)"
      >
        <!-- 封面图 -->
        <div
          class="relative aspect-video overflow-hidden bg-gradient-to-br from-gray-100 to-gray-200"
        >
          <!-- 实际封面图 -->
          <img
            v-if="space.coverUrl"
            :src="space.coverUrl"
            :alt="space.name"
            class="size-full object-cover"
          />
          <!-- 占位图 -->
          <div v-else class="absolute inset-0 flex items-center justify-center">
            <svg
              class="size-12 text-gray-300"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="1.5"
                d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
              ></path>
            </svg>
          </div>

          <!-- 模版标签 -->
          <span
            class="absolute top-2 left-2 rounded-full bg-white/90 px-2 py-1 text-xs font-medium"
          >
            {{ getTemplateLabel(space.template) }}
          </span>

          <!-- 分享状态 -->
          <span
            v-if="space.isPublic"
            class="absolute top-2 right-2 rounded-full bg-[var(--color-success)] px-2 py-1 text-xs font-medium text-white"
          >
            {{ t('spaceManager.public') }}
          </span>
        </div>

        <!-- 信息 -->
        <div class="p-4">
          <h3 class="text-primary truncate font-semibold">{{ space.name }}</h3>
          <p v-if="space.description" class="text-secondary mt-1 line-clamp-2 text-sm">
            {{ space.description }}
          </p>

          <div class="text-secondary mt-3 flex items-center gap-4 text-xs">
            <span class="flex items-center gap-1">
              <svg class="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                ></path>
              </svg>
              {{ t('fileManager.totalFiles', { count: space.fileCount }) }}
            </span>
            <span class="flex items-center gap-1">
              <svg class="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                ></path>
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                ></path>
              </svg>
              {{ space.viewCount }} {{ t('spacePublic.views') }}
            </span>
          </div>
        </div>

        <!-- 操作菜单 -->
        <div class="flex justify-end gap-2 px-4 pb-4">
          <Tooltip :content="t('spaceManager.copyLink')">
            <button
              class="text-secondary flex size-8 items-center justify-center rounded-lg bg-gray-100 transition-colors hover:text-primary hover:bg-gray-200"
              @click.stop="copyShareLink(space)"
            >
              <svg class="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                ></path>
              </svg>
            </button>
          </Tooltip>
          <Tooltip :content="t('spaceManager.deleteSpace')">
            <button
              class="flex size-8 items-center justify-center rounded-lg bg-[var(--color-danger-bg)] text-[var(--color-danger)] transition-colors hover:bg-red-100"
              @click.stop="deleteSpaceConfirm(space)"
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
          </Tooltip>
        </div>
      </div>
    </div>

    <!-- 空状态 -->
    <div v-else class="py-20 text-center">
      <div
        class="mx-auto mb-6 flex size-20 items-center justify-center rounded-full border-2 border-dashed border-gray-200 bg-gray-50"
      >
        <svg class="size-10 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="1.5"
            d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
          ></path>
        </svg>
      </div>
      <h3 class="text-primary mb-2 text-lg font-medium">{{ t('spaceManager.emptyTitle') }}</h3>
      <p class="text-secondary mb-6 text-sm">{{ t('spaceManager.createDesc') }}</p>
      <button
        class="bg-primary inline-flex items-center gap-2 rounded-lg px-6 py-3 text-white transition-colors hover:bg-[var(--color-primary-hover)]"
        @click="showCreateModal = true"
      >
        <svg class="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M12 4v16m8-8H4"
          ></path>
        </svg>
        {{ t('spaceManager.createFirst') }}
      </button>
    </div>

    <!-- 创建空间弹窗 -->
    <SpaceCreateModal
      v-if="showCreateModal"
      @close="showCreateModal = false"
      @created="onSpaceCreated"
    />

    <!-- 空间详情/编辑器弹窗 -->
    <SpaceProductEditor
      v-if="selectedSpace && selectedSpace.template === 'product'"
      :space="selectedSpace"
      @close="selectedSpace = null"
      @updated="loadSpaces"
    />

    <SpaceDetailModal
      v-else-if="selectedSpace"
      :space="selectedSpace"
      @close="selectedSpace = null"
      @updated="loadSpaces"
      @open-subspace="onOpenSubspace"
    />

    <!-- Confirm Dialog -->
    <ConfirmDialog
      v-model="confirmData.show"
      :title="confirmData.title"
      :message="confirmData.message"
      :type="confirmData.type"
      :loading="confirmData.loading"
      @confirm="confirmData.onConfirm"
    />
  </div>
</template>

<script setup>
import { ref, onMounted, onActivated } from 'vue';
import { useSpaces } from '@/composables/useSpaces';
import { useToast } from '@/composables/useToast';
import { useI18n } from '@/composables/useI18n';
import SpaceCreateModal from '@/components/SpaceCreateModal.vue';
import SpaceDetailModal from '@/components/SpaceDetailModal.vue';
import SpaceProductEditor from '@/components/SpaceProductEditor.vue';
import Tooltip from '@/components/ui/Tooltip.vue';
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue';

const { spaces, loading, loadSpaces, deleteSpace } = useSpaces();
const { addToast } = useToast();
const { t } = useI18n();

const showCreateModal = ref(false);
const selectedSpace = ref(null);

// 确认弹窗状态
const confirmData = ref({
  show: false,
  title: '',
  message: '',
  type: 'primary',
  loading: false,
  onConfirm: () => {},
});

const getTemplateLabel = (template) =>
  t(`spaceManager.templates.${template || 'custom'}`) || template;

const openSpaceDetail = (space) => {
  selectedSpace.value = space;
};

const copyShareLink = async (space) => {
  if (!space.shareUrl) {
    addToast({ message: t('spaceManager.pleasePublicFirst'), type: 'warning' });
    return;
  }
  try {
    const url = `${window.location.origin}${space.shareUrl}`;
    await navigator.clipboard.writeText(url);
    addToast({ message: t('common.copied'), type: 'success' });
  } catch {
    addToast({ message: t('common.copyFailed'), type: 'error' });
  }
};

const deleteSpaceConfirm = (space) => {
  confirmData.value = {
    show: true,
    title: t('common.delete'),
    message: t('spaceManager.deleteSpaceConfirm', { name: space.name }),
    type: 'danger',
    loading: false,
    onConfirm: async () => {
      confirmData.value.loading = true;
      try {
        await deleteSpace(space.id);
        confirmData.value.show = false;
      } finally {
        confirmData.value.loading = false;
      }
    },
  };
};

const onSpaceCreated = () => {
  showCreateModal.value = false;
  loadSpaces();
};

// 打开子空间编辑器
const onOpenSubspace = (subspace) => {
  // 切换到子空间的编辑器
  selectedSpace.value = subspace;
};

onMounted(() => {
  loadSpaces();
});

onActivated(() => {
  loadSpaces();
});
</script>

<style scoped>
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
