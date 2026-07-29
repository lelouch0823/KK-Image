<template>
  <div class="flex min-h-0 flex-1 flex-col overflow-hidden bg-(--bg-muted)/50">
    <!-- Header -->
    <div
      class="flex shrink-0 items-center justify-between border-b border-(--border-color) bg-(--bg-card) p-4"
    >
      <div class="flex items-center gap-3">
        <Tooltip v-if="props.canManage" :content="t('spaceManager.createSubspace')">
          <AppButton
            variant="primary"
            size="sm"
            class="size-8 !px-0"
            @click="showCreateModal = true"
          >
            <template #icon-left>
              <AppIcon name="plus" class="size-5" />
            </template>
          </AppButton>
        </Tooltip>
        <span class="text-secondary text-xs"
          >{{ subspaces.length }} {{ t('spaceManager.subspaces') }}</span
        >
      </div>
    </div>

    <!-- Subspace List -->
    <div class="flex-1 space-y-3 overflow-y-auto p-4">
      <div v-if="loading" class="flex justify-center py-12">
        <AppIcon name="spinner" class="text-primary size-8 animate-spin" />
      </div>

      <div
        v-else-if="subspaces.length === 0"
        class="text-secondary flex h-full flex-col items-center justify-center py-16 text-center"
      >
        <div
          class="mx-auto mb-4 flex size-16 items-center justify-center rounded-full border-2 border-dashed border-(--border-color) bg-(--bg-muted)"
        >
          <AppIcon name="rectangle-group" class="text-muted size-8" />
        </div>
        <p class="mb-5 text-sm">{{ t('spaceManager.emptySubspaces') }}</p>
        <AppButton
          v-if="props.canManage"
          size="sm"
          :text="t('spaceManager.createFirst')"
          @click="showCreateModal = true"
        >
          <template #icon-left>
            <AppIcon name="plus" class="size-4" />
          </template>
        </AppButton>
      </div>

      <!-- Subspace Cards -->
      <div v-else class="space-y-3">
        <div
          v-for="sub in subspaces"
          :key="sub.id"
          class="group cursor-pointer rounded-xl border border-(--border-color) bg-(--bg-card) p-4 transition-all hover:shadow-md"
          @click="openSubspace(sub)"
        >
          <div class="flex items-start gap-4">
            <!-- Cover Thumbnail -->
            <div
              class="size-16 shrink-0 overflow-hidden rounded-lg border border-(--border-color) bg-(--bg-muted)"
            >
              <AppImage
                v-if="sub.coverUrl"
                :src="sub.coverUrl"
                :alt="sub.name"
                class="size-full"
                fit="cover"
                rounded="none"
              />
              <div v-else class="flex size-full items-center justify-center">
                <AppIcon name="folder" class="text-muted size-6" />
              </div>
            </div>

            <!-- Info -->
            <div class="min-w-0 flex-1">
              <h4
                class="text-primary truncate font-semibold group-hover:text-(--color-primary-hover)"
              >
                {{ sub.name }}
              </h4>
              <p class="text-secondary mt-1 text-xs">
                {{ getTemplateLabel(sub.template) }} · {{ sub.fileCount }}
                {{ t('spacePublic.files') }}
              </p>
              <div class="mt-2 flex items-center gap-2">
                <span
                  v-if="sub.isPublic"
                  class="text-success inline-flex items-center gap-1 rounded-full bg-(--color-success-bg) px-2 py-0.5 text-xs font-medium"
                >
                  <AppIcon name="check-circle" class="size-3" />
                  {{ t('spaceManager.publicOn') }}
                </span>
                <span
                  v-else
                  class="inline-flex items-center gap-1 rounded-full bg-(--bg-muted) px-2 py-0.5 text-xs font-medium text-(--text-muted)"
                >
                  <AppIcon name="lock-closed" class="size-3" />
                  {{ t('spaceManager.publicOff') }}
                </span>
              </div>
            </div>

            <!-- Actions (Always visible on mobile, hover on desktop) -->
            <div
              class="flex items-center gap-2 transition-opacity sm:opacity-0 sm:group-hover:opacity-100"
            >
              <Tooltip :content="t('spaceManager.copyLink')">
                <AppButton
                  variant="ghost"
                  size="sm"
                  class="size-8 !px-0 bg-(--bg-muted) text-(--text-secondary) hover:text-primary"
                  @click.stop="copyLink(sub)"
                >
                  <template #icon-left>
                    <AppIcon name="clipboard" class="size-4" />
                  </template>
                </AppButton>
              </Tooltip>
              <Tooltip v-if="props.canManage" :content="t('spaceManager.deleteSpace')">
                <AppButton
                  variant="ghost"
                  size="sm"
                  class="size-8 !px-0 bg-(--color-danger-bg) text-danger hover:bg-(--color-danger-bg) hover:text-danger"
                  @click.stop="deleteSubspace(sub)"
                >
                  <template #icon-left>
                    <AppIcon name="trash" class="size-4" />
                  </template>
                </AppButton>
              </Tooltip>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Create Subspace Modal (reuse SpaceCreateModal with parentId) -->
    <SpaceCreateModal
      v-if="showCreateModal && props.canManage"
      :parent-id="spaceId"
      @close="showCreateModal = false"
      @created="onSubspaceCreated"
    />

    <!-- Confirm Dialog -->
    <ConfirmDialog
      v-model="confirmData.show"
      :title="confirmData.title"
      :message="confirmData.message"
      :type="confirmData.type"
      :loading="confirmData.loading"
      @confirm="handleConfirm"
    />
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue';
import { useSpaces } from '@/composables/useSpaces';
import { useToast } from '@/composables/useToast';
import { useI18n } from '@/composables/useI18n';
import { useClipboard } from '@/composables/useClipboard';
import Tooltip from '@/components/ui/Tooltip.vue';
import SpaceCreateModal from '@/components/SpaceCreateModal.vue';
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue';
import AppIcon from '@/components/ui/AppIcon.vue';
import AppImage from '@/components/ui/AppImage.vue';
import AppButton from '@/components/ui/AppButton.vue';
import { formatReadableLabel } from '@/utils/event-display';
import { useConfirmDialog } from '@/composables/useConfirmDialog';

const props = defineProps({
  spaceId: { type: String, required: true },
  canManage: { type: Boolean, default: false },
});

const emit = defineEmits(['openSubspace', 'updated']);

const { loadSubspaces, deleteSpace } = useSpaces();
const { addToast } = useToast();
const { t } = useI18n();
const { copyShareLink } = useClipboard();

const subspaces = ref([]);
const loading = ref(false);
const showCreateModal = ref(false);
let loadRequestId = 0;

// 确认弹窗状态
const { confirmData, askConfirm, handleConfirm } = useConfirmDialog();

const getTemplateLabel = (template) =>
  t(`spaceManager.templates.${template || 'custom'}`, formatReadableLabel(template || 'custom'));

const loadData = async () => {
  const spaceId = props.spaceId;
  const requestId = ++loadRequestId;
  loading.value = true;
  const data = await loadSubspaces(spaceId);
  if (requestId !== loadRequestId || props.spaceId !== spaceId) return;
  subspaces.value = data;
  loading.value = false;
};

const openSubspace = (sub) => {
  emit('openSubspace', sub);
};

const copyLink = async (sub) => {
  if (!sub.shareUrl) {
    addToast({ message: t('spaceManager.pleasePublicFirst'), type: 'warning' });
    return;
  }
  await copyShareLink(sub.shareUrl);
};

const deleteSubspace = (sub) => {
  if (!props.canManage) return;
  askConfirm({
    title: t('common.delete'),
    message: t('spaceManager.deleteSpaceConfirm', { name: sub.name }),
    type: 'danger',
    onConfirm: async () => {
      const deleted = await deleteSpace(sub.id);
      if (!deleted) return;
      await loadData();
      emit('updated');
    },
  });
};

const onSubspaceCreated = async () => {
  showCreateModal.value = false;
  await loadData();
  emit('updated');
};

onMounted(() => {
  loadData();
});
watch(
  () => props.spaceId,
  () => {
    loadData();
  }
);
onUnmounted(() => {
  loadRequestId += 1;
});
</script>
