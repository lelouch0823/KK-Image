<template>
  <ManagementListShell :title="t('spaceManager.title')" :description="t('spaceManager.subtitle')">
    <template #actions>
      <div v-if="spaces.length > 0 && canManageSpaces" class="flex gap-2">
        <Tooltip :content="t('spaceManager.create')">
          <button
            class="bg-primary flex size-9 items-center justify-center rounded-lg text-(--text-inverse) shadow-sm transition-colors hover:bg-primary-hover dark:text-gray-900"
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
    </template>

    <template #content>
      <div v-if="loading" class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        <div
          v-for="i in 6"
          :key="i"
          class="overflow-hidden rounded-xl border border-(--border-color) bg-(--bg-card)"
        >
          <Skeleton type="custom" custom-class="aspect-video w-full rounded-none" />
          <div class="space-y-3 p-4">
            <Skeleton type="text" width="3/4" />
            <Skeleton type="text" width="1/2" />
            <div class="flex gap-3">
              <Skeleton type="text" width="80px" />
              <Skeleton type="text" width="72px" />
            </div>
            <div class="flex justify-end gap-2 pt-2">
              <Skeleton type="custom" custom-class="h-8 w-20 rounded-lg" />
              <Skeleton type="custom" custom-class="h-8 w-20 rounded-lg" />
            </div>
          </div>
        </div>
      </div>

      <div v-else-if="errorCode === 'FORBIDDEN'" class="py-6">
        <PermissionDeniedState
          :reason="error"
          @retry="loadSpaces()"
        />
      </div>

      <div v-else-if="error" class="py-6">
        <PermissionDeniedState
          title="加载失败"
          description="资源加载失败，请检查网络或稍后重试。"
          :reason="error"
          @retry="loadSpaces()"
        />
      </div>

      <div v-else-if="spaces.length > 0" class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        <div
          v-for="space in spaces"
          :key="space.id"
          class="group cursor-pointer overflow-hidden rounded-xl border border-(--border-color) bg-(--bg-card) transition-all hover:border-(--border-hover) hover:shadow-sm"
          @click="openSpaceDetail(space)"
        >
          <div
            class="relative aspect-video overflow-hidden bg-gradient-to-br from-(--bg-muted) to-(--bg-page)"
          >
            <AppImage
              v-if="space.coverUrl"
              :src="space.coverUrl"
              :alt="space.name"
              class="size-full"
              fit="cover"
              rounded="none"
            />
            <div v-else class="absolute inset-0 flex items-center justify-center">
              <svg
                class="size-12 text-(--text-disabled)"
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

            <span
              class="absolute top-2 left-2 rounded-full bg-(--bg-card)/90 px-2 py-1 text-xs font-medium"
            >
              {{ getTemplateLabel(space.template) }}
            </span>

            <span
              v-if="space.shareMode && space.shareMode !== 'none'"
              class="absolute top-2 right-2 flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium"
              :class="{
                'bg-success text-(--text-inverse)': space.shareMode === 'all',
                'bg-info text-(--text-inverse)': space.shareMode === 'selected',
              }"
            >
              <svg v-if="space.shareMode === 'all'" class="size-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"></path>
              </svg>
              <svg v-else class="size-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path>
              </svg>
              {{ space.shareMode === 'all' ? t('spaceManager.shareMode.all') : t('spaceManager.shareMode.selected') }}
            </span>
            <span
              v-if="space.bindingUsesSnapshot"
              class="absolute bottom-2 left-2 rounded-full bg-amber-500/90 px-2 py-1 text-xs font-medium text-white"
            >
              {{ getBindingStateLabel(space.bindingState) }}
            </span>
            <span
              v-else-if="!space.isPublic"
              class="absolute top-2 right-2 flex items-center gap-1 rounded-full bg-(--text-secondary)/80 px-2 py-1 text-xs font-medium text-(--text-inverse)"
            >
              <svg class="size-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path>
              </svg>
              {{ t('spaceManager.shareMode.none') }}
            </span>
          </div>

          <div class="p-4">
            <h3 class="truncate font-semibold text-(--text-main)">{{ space.name }}</h3>
            <p v-if="space.description" class="mt-1 line-clamp-2 text-sm text-(--text-secondary)">
              {{ space.description }}
            </p>

            <div class="mt-3 flex items-center gap-4 text-xs text-(--text-secondary)">
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

          <div class="flex justify-end gap-2 px-4 pb-4">
            <AppButton
              variant="ghost"
              block
              size="sm"
              :text="canManageSpaces ? t('space.manage') : t('common.view')"
              @click.stop="manageSpace(space)"
            >
              <template #icon-left>
                <svg class="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path>
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                </svg>
              </template>
            </AppButton>
            <AppButton
              v-if="canManageSpaces"
              variant="ghost"
              block
              size="sm"
              class="text-danger hover:bg-danger/10 hover:text-danger"
              :text="t('space.delete')"
              @click.stop="confirmDelete(space)"
            >
              <template #icon-left>
                <svg class="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                </svg>
              </template>
            </AppButton>
          </div>
        </div>
      </div>

      <EmptyState
        v-else
        icon="folder"
        :title="t('spaceManager.emptyTitle')"
        :description="t('spaceManager.createDesc')"
        container-class="py-20"
      >
        <template #action>
          <AppButton
            v-if="canManageSpaces"
            :text="t('space.create')"
            @click="openCreateModal"
          >
            <template #icon-left>
              <svg class="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
              </svg>
            </template>
          </AppButton>
        </template>
      </EmptyState>
    </template>

    <!-- 创建空间弹窗 -->
    <SpaceCreateModal
      v-if="showCreateModal"
      @close="showCreateModal = false"
      @created="onSpaceCreated"
    />

    <!-- 空间详情/编辑器弹窗 -->
    <SpaceProductEditor
      v-if="selectedSpace && selectedSpace.template === 'product' && canManageSpaces"
      :space="selectedSpace"
      @close="selectedSpace = null"
      @updated="loadSpaces"
    />

    <SpaceDetailModal
      v-else-if="selectedSpace"
      :space="selectedSpace"
      :can-manage="canManageSpaces"
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
  </ManagementListShell>
</template>

<script setup>
import { ref, onMounted, onActivated } from 'vue';
import { useSpaces } from '@/composables/useSpaces';
import { useI18n } from '@/composables/useI18n';
import { useAccessControl } from '@/composables/useAccessControl';
import SpaceCreateModal from '@/components/SpaceCreateModal.vue';
import SpaceDetailModal from '@/components/SpaceDetailModal.vue';
import SpaceProductEditor from '@/components/SpaceProductEditor.vue';
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue';
import Skeleton from '@/components/ui/Skeleton.vue';
import AppImage from '@/components/ui/AppImage.vue';
import AppButton from '@/components/ui/AppButton.vue';
import EmptyState from '@/components/ui/EmptyState.vue';
import PermissionDeniedState from '@/components/ui/PermissionDeniedState.vue';
import ManagementListShell from '@/design-system/patterns/ManagementListShell.vue';

const { spaces, loading, error, errorCode, loadSpaces, deleteSpace } = useSpaces();
const { t } = useI18n();
const { hasPermission, loadPermissions } = useAccessControl();


const showCreateModal = ref(false);
const selectedSpace = ref(null);
const canManageSpaces = ref(false);

// 确认弹窗状态
const confirmData = ref({
  show: false,
  title: '',
  message: '',
  type: 'primary',
  loading: false,
  onConfirm: () => {},
});

const openCreateModal = () => {
  if (!canManageSpaces.value) return;
  showCreateModal.value = true;
};

const getTemplateLabel = (template) =>
  t(`spaceManager.templates.${template || 'custom'}`) || template;

const getBindingStateLabel = (bindingState) => {
  const mapping = {
    archived_product: t('spaceManager.bindingIssues.badges.archivedProduct') || '商品已归档',
    archived_variant: t('spaceManager.bindingIssues.badges.archivedVariant') || '规格已归档',
    missing_product: t('spaceManager.bindingIssues.badges.missingProduct') || '商品已失效',
    missing_variant: t('spaceManager.bindingIssues.badges.missingVariant') || '规格已失效',
  };
  return mapping[bindingState] || (t('spaceManager.bindingIssues.badges.snapshot') || '绑定快照');
};

const openSpaceDetail = (space) => {
  selectedSpace.value = space;
};

const manageSpace = (space) => {
  openSpaceDetail(space);
};

const confirmDelete = (space) => {
  if (!canManageSpaces.value) return;
  confirmData.value = {
    show: true,
    title: t('common.delete'),
    message: t('spaceManager.deleteSpaceConfirm', { name: space.name }),
    type: 'danger',
    loading: false,
    onConfirm: async () => {
      confirmData.value.loading = true;
      try {
        const deleted = await deleteSpace(space.id);
        if (!deleted) return;
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
  loadPermissions().then(() => {
    canManageSpaces.value = hasPermission('spaces:manage');
  });
  loadSpaces();
});

onActivated(() => {
  loadPermissions().then(() => {
    canManageSpaces.value = hasPermission('spaces:manage');
  });
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
