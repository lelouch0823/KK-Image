<template>
  <ManagementListShell :title="t('spaceManager.title')" :description="t('spaceManager.subtitle')">
    <template #actions>
      <div v-if="spaces.length > 0 && canManageSpaces" class="flex gap-2">
        <Tooltip :content="t('spaceManager.create')">
          <AppButton
            variant="primary"
            size="sm"
            :text="t('spaceManager.create')"
            @click="showCreateModal = true"
          >
            <template #icon-left>
              <AppIcon name="plus" class="size-4" />
            </template>
          </AppButton>
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
          <Skeleton container-class="aspect-video w-full rounded-none" />
          <div class="space-y-3 p-4">
            <Skeleton width="3/4" />
            <Skeleton width="1/2" />
            <div class="flex gap-3">
              <Skeleton width="80px" />
              <Skeleton width="72px" />
            </div>
            <div class="flex justify-end gap-2 pt-2">
              <Skeleton container-class="h-8 w-20 rounded-lg" />
              <Skeleton container-class="h-8 w-20 rounded-lg" />
            </div>
          </div>
        </div>
      </div>

      <div v-else-if="errorCode === ErrorCode.FORBIDDEN" class="py-6">
        <PermissionDeniedState :reason="error" @retry="loadSpaces()" />
      </div>

      <div v-else-if="error" class="py-6">
        <PermissionDeniedState
          :title="t('spaceManager.loadFailed')"
          :description="t('spaceManager.loadFailedDesc')"
          :reason="error"
          @retry="loadSpaces()"
        />
      </div>

      <div
        v-else-if="spaces.length > 0"
        class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3"
      >
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
              <AppIcon name="folder" class="size-12 text-(--text-disabled)" />
            </div>

            <span
              class="absolute top-2 left-2 rounded-full bg-(--bg-card)/90 px-2 py-1 text-xs font-medium"
            >
              {{ getTemplateLabel(space.template) }}
            </span>

            <StatusBadge
              v-if="space.shareMode && space.shareMode !== 'none'"
              class="absolute top-2 right-2"
              :class="{
                'bg-success text-(--text-inverse) border-success/20': space.shareMode === 'all',
                'bg-info text-(--text-inverse) border-info/20': space.shareMode === 'selected',
              }"
            >
              <AppIcon :name="space.shareMode === 'all' ? 'share' : 'users'" class="size-3" />
              {{
                space.shareMode === 'all'
                  ? t('spaceManager.shareMode.all')
                  : t('spaceManager.shareMode.selected')
              }}
            </StatusBadge>
            <StatusBadge
              v-if="space.bindingUsesSnapshot"
              variant="warning"
              class="absolute bottom-2 left-2"
            >
              {{ getBindingStateLabel(space.bindingState) }}
            </StatusBadge>
            <StatusBadge
              v-else-if="!space.isPublic"
              variant="neutral"
              class="absolute top-2 right-2"
            >
              <AppIcon name="lock-closed" class="size-3" />
              {{ t('spaceManager.shareMode.none') }}
            </StatusBadge>
          </div>

          <div class="p-4">
            <h3 class="truncate font-semibold text-(--text-main)">{{ space.name }}</h3>
            <p v-if="space.description" class="mt-1 line-clamp-2 text-sm text-(--text-secondary)">
              {{ space.description }}
            </p>

            <div class="mt-3 flex items-center gap-4 text-xs text-(--text-secondary)">
              <span class="flex items-center gap-1">
                <AppIcon name="document-text" class="size-4" />
                {{ t('fileManager.totalFiles', { count: space.fileCount }) }}
              </span>
              <span class="flex items-center gap-1">
                <AppIcon name="eye" class="size-4" />
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
                <AppIcon name="eye" class="size-4" />
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
                <AppIcon name="trash" class="size-4" />
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
          <AppButton v-if="canManageSpaces" :text="t('space.create')" @click="openCreateModal">
            <template #icon-left>
              <AppIcon name="plus" class="size-4" />
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
import { ref, onMounted, onActivated, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
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
import AppIcon from '@/components/ui/AppIcon.vue';
import EmptyState from '@/components/ui/EmptyState.vue';
import PermissionDeniedState from '@/components/ui/PermissionDeniedState.vue';
import StatusBadge from '@/components/ui/StatusBadge.vue';
import Tooltip from '@/components/ui/Tooltip.vue';
import ManagementListShell from '@/design-system/patterns/ManagementListShell.vue';
import { ErrorCode } from '@/utils/error-codes';

const { spaces, loading, error, errorCode, loadSpaces, deleteSpace } = useSpaces();
const { t } = useI18n();
const { hasPermission, loadPermissions } = useAccessControl();
const route = useRoute();
const router = useRouter();

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
  return mapping[bindingState] || t('spaceManager.bindingIssues.badges.snapshot') || '绑定快照';
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

watch(
  [() => String(route.query.id || '').trim(), spaces],
  ([targetId, currentSpaces]) => {
    if (!targetId) return;
    if (selectedSpace.value?.id === targetId) return;
    const matchedSpace = (currentSpaces || []).find((space) => String(space.id) === targetId);
    if (matchedSpace) {
      selectedSpace.value = matchedSpace;
    }
  },
  { immediate: true }
);

watch(selectedSpace, (space) => {
  if (space || !route.query.id) return;
  const newQuery = { ...route.query };
  delete newQuery.id;
  router.replace({ path: route.path, query: newQuery });
});

onMounted(() => {
  loadPermissions().then(() => {
    canManageSpaces.value = hasPermission('spaces:manage');
  }).catch(console.error);
  loadSpaces();
});

onActivated(() => {
  loadPermissions().then(() => {
    canManageSpaces.value = hasPermission('spaces:manage');
  }).catch(console.error);
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
