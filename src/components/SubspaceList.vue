<template>
  <div class="flex min-h-0 flex-1 flex-col overflow-hidden bg-[var(--bg-muted)]/50">
    <!-- Header -->
    <div
      class="flex shrink-0 items-center justify-between border-b border-[var(--border-color)] bg-[var(--bg-card)] p-4"
    >
      <div class="flex items-center gap-3">
        <Tooltip :content="t('spaceManager.createSubspace')">
          <button
            class="bg-primary flex size-8 items-center justify-center rounded-lg text-sm font-medium text-white transition-colors hover:bg-[var(--color-primary-hover)]"
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
          </button>
        </Tooltip>
        <span class="text-secondary text-xs"
          >{{ subspaces.length }} {{ t('spaceManager.subspaces') }}</span
        >
      </div>
    </div>

    <!-- Subspace List -->
    <div class="flex-1 space-y-3 overflow-y-auto p-4">
      <div v-if="loading" class="flex justify-center py-12">
        <div class="border-primary size-8 animate-spin rounded-full border-b-2"></div>
      </div>

      <div
        v-else-if="subspaces.length === 0"
        class="text-secondary flex h-full flex-col items-center justify-center py-12"
      >
        <div class="mx-auto mb-4 flex size-16 items-center justify-center rounded-2xl bg-[var(--bg-muted)]">
          <svg class="text-muted size-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="1.5"
              d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
            ></path>
          </svg>
        </div>
        <p class="text-sm">{{ t('spaceManager.emptySubspaces') }}</p>
        <button
          class="bg-primary mt-4 rounded-lg px-4 py-2 text-sm text-white transition-colors hover:bg-[var(--color-primary-hover)]"
          @click="showCreateModal = true"
        >
          {{ t('spaceManager.createFirst') }}
        </button>
      </div>

      <!-- Subspace Cards -->
      <div v-else class="space-y-3">
        <div
          v-for="sub in subspaces"
          :key="sub.id"
          class="group cursor-pointer rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] p-4 transition-all hover:shadow-md"
          @click="openSubspace(sub)"
        >
          <div class="flex items-start gap-4">
            <!-- Cover Thumbnail -->
            <div
              class="size-16 shrink-0 overflow-hidden rounded-lg border border-[var(--border-color)] bg-[var(--bg-muted)]"
            >
              <img
                v-if="sub.coverUrl"
                :src="sub.coverUrl"
                :alt="sub.name"
                class="size-full object-cover"
              />
              <div v-else class="flex size-full items-center justify-center">
                <svg
                  class="text-muted size-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="1.5"
                    d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                  ></path>
                </svg>
              </div>
            </div>

            <!-- Info -->
            <div class="min-w-0 flex-1">
              <h4
                class="text-primary truncate font-semibold group-hover:text-[var(--color-primary-hover)]"
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
                  class="inline-flex items-center gap-1 rounded-full bg-[var(--color-success-bg)] px-2 py-0.5 text-[10px] font-medium text-[var(--color-success)]"
                >
                  <svg class="size-2.5" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fill-rule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clip-rule="evenodd"
                    />
                  </svg>
                  {{ t('spaceManager.publicOn') }}
                </span>
                <span
                  v-else
                  class="inline-flex items-center gap-1 rounded-full bg-[var(--bg-muted)] px-2 py-0.5 text-[10px] font-medium text-[var(--text-muted)]"
                >
                  <svg class="size-2.5" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fill-rule="evenodd"
                      d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
                      clip-rule="evenodd"
                    />
                  </svg>
                  {{ t('spaceManager.publicOff') }}
                </span>
              </div>
            </div>

            <!-- Actions -->
            <div
              class="flex items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100"
            >
              <Tooltip :content="t('spaceManager.copyLink')">
                <button
                  class="text-secondary flex size-8 items-center justify-center rounded-lg bg-[var(--bg-muted)] transition-colors hover:text-primary hover:bg-[var(--bg-hover)]"
                  @click.stop="copyLink(sub)"
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
                  @click.stop="deleteSubspace(sub)"
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
      </div>
    </div>

    <!-- Create Subspace Modal (reuse SpaceCreateModal with parentId) -->
    <SpaceCreateModal
      v-if="showCreateModal"
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
      @confirm="confirmData.onConfirm"
    />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useSpaces } from '@/composables/useSpaces';
import { useToast } from '@/composables/useToast';
import { useI18n } from '@/composables/useI18n';
import { useClipboard } from '@/composables/useClipboard';
import Tooltip from '@/components/ui/Tooltip.vue';
import SpaceCreateModal from '@/components/SpaceCreateModal.vue';
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue';

const props = defineProps({
  spaceId: { type: String, required: true },
});

const emit = defineEmits(['openSubspace', 'updated']);

const { loadSubspaces, deleteSpace } = useSpaces();
const { addToast } = useToast();
const { t } = useI18n();
const { copyShareLink } = useClipboard();

const subspaces = ref([]);
const loading = ref(false);
const showCreateModal = ref(false);

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

const loadData = async () => {
  loading.value = true;
  subspaces.value = await loadSubspaces(props.spaceId);
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
  confirmData.value = {
    show: true,
    title: t('common.delete'),
    message: t('spaceManager.deleteSpaceConfirm', { name: sub.name }),
    type: 'danger',
    loading: false,
    onConfirm: async () => {
      confirmData.value.loading = true;
      try {
        await deleteSpace(sub.id);
        await loadData();
        emit('updated');
        confirmData.value.show = false;
      } finally {
        confirmData.value.loading = false;
      }
    },
  };
};

const onSubspaceCreated = async () => {
  showCreateModal.value = false;
  await loadData();
  emit('updated');
};

onMounted(() => {
  loadData();
});
</script>
