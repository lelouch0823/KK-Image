<template>
  <div class="flex-1 overflow-hidden flex flex-col min-h-0 bg-[var(--bg-muted)]/50">
    <!-- Header -->
    <div class="p-4 border-b border-[var(--border-color)] flex items-center justify-between bg-white shrink-0">
      <div class="flex items-center gap-3">
        <Tooltip :content="t('spaceManager.createSubspace')">
          <button @click="showCreateModal = true" 
            class="w-8 h-8 flex items-center justify-center bg-primary text-white hover:bg-[var(--color-primary-hover)] rounded-lg text-sm font-medium transition-colors">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
            </svg>
          </button>
        </Tooltip>
        <span class="text-xs text-secondary">{{ subspaces.length }} {{ t('spaceManager.subspaces') }}</span>
      </div>
    </div>

    <!-- Subspace List -->
    <div class="flex-1 overflow-y-auto p-4 space-y-3">
      <div v-if="loading" class="flex justify-center py-12">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>

      <div v-else-if="subspaces.length === 0" class="h-full flex flex-col items-center justify-center text-secondary py-12">
        <div class="w-16 h-16 mx-auto mb-4 bg-gray-50 rounded-2xl flex items-center justify-center">
          <svg class="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" 
              d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path>
          </svg>
        </div>
        <p class="text-sm">{{ t('spaceManager.emptySubspaces') }}</p>
        <button @click="showCreateModal = true" 
          class="mt-4 px-4 py-2 bg-primary text-white text-sm rounded-lg hover:bg-[var(--color-primary-hover)] transition-colors">
          {{ t('spaceManager.createFirst') }}
        </button>
      </div>

      <!-- Subspace Cards -->
      <div v-else class="space-y-3">
        <div v-for="sub in subspaces" :key="sub.id"
          class="bg-white border border-[var(--border-color)] rounded-xl p-4 hover:shadow-md transition-all group cursor-pointer"
          @click="openSubspace(sub)">
          <div class="flex items-start gap-4">
            <!-- Cover Thumbnail -->
            <div class="w-16 h-16 rounded-lg overflow-hidden bg-gray-100 shrink-0 border border-[var(--border-color)]">
              <img v-if="sub.coverUrl" :src="sub.coverUrl" :alt="sub.name" class="w-full h-full object-cover">
              <div v-else class="w-full h-full flex items-center justify-center">
                <svg class="w-6 h-6 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"></path>
                </svg>
              </div>
            </div>

            <!-- Info -->
            <div class="flex-1 min-w-0">
              <h4 class="font-semibold text-primary truncate group-hover:text-[var(--color-primary-hover)]">{{ sub.name }}</h4>
              <p class="text-xs text-secondary mt-1">
                {{ getTemplateLabel(sub.template) }} · {{ sub.fileCount }} {{ t('spacePublic.files') }}
              </p>
              <div class="flex items-center gap-2 mt-2">
                <span v-if="sub.isPublic" class="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium bg-[var(--color-success-bg)] text-[var(--color-success)] rounded-full">
                  <svg class="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg>
                  {{ t('spaceManager.publicOn') }}
                </span>
                <span v-else class="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium bg-gray-100 text-gray-500 rounded-full">
                  <svg class="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clip-rule="evenodd"/></svg>
                  {{ t('spaceManager.publicOff') }}
                </span>
              </div>
            </div>

            <!-- Actions -->
            <div class="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <Tooltip :content="t('spaceManager.copyLink')">
                <button @click.stop="copyLink(sub)" class="w-8 h-8 flex items-center justify-center text-secondary hover:text-primary bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"></path>
                  </svg>
                </button>
              </Tooltip>
              <Tooltip :content="t('spaceManager.deleteSpace')">
                <button @click.stop="deleteSubspace(sub)" class="w-8 h-8 flex items-center justify-center text-[var(--color-danger)] bg-[var(--color-danger-bg)] hover:bg-red-100 rounded-lg transition-colors">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                  </svg>
                </button>
              </Tooltip>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Create Subspace Modal (reuse SpaceCreateModal with parentId) -->
      :parentId="spaceId" 
      @close="showCreateModal = false" 
      @created="onSubspaceCreated" />

    <!-- Confirm Dialog -->
    <ConfirmDialog
      v-model="confirmData.show"
      :title="confirmData.title"
      :message="confirmData.message"
      :type="confirmData.type"
      @confirm="confirmData.onConfirm"
    />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useSpaces } from '@/composables/useSpaces';
import { useToast } from '@/composables/useToast';
import { useI18n } from '@/composables/useI18n';
import Tooltip from '@/components/ui/Tooltip.vue';
import SpaceCreateModal from '@/components/SpaceCreateModal.vue';
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue';

const props = defineProps({
  spaceId: { type: String, required: true }
});

const emit = defineEmits(['openSubspace', 'updated']);

const { loadSubspaces, deleteSpace } = useSpaces();
const { addToast } = useToast();
const { t } = useI18n();

const subspaces = ref([]);
const loading = ref(false);
const showCreateModal = ref(false);

// 确认弹窗状态
const confirmData = ref({
  show: false,
  title: '',
  message: '',
  type: 'primary',
  onConfirm: () => {}
});

const getTemplateLabel = (template) => t(`spaceManager.templates.${template || 'custom'}`) || template;

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
  try {
    const url = `${window.location.origin}${sub.shareUrl}`;
    await navigator.clipboard.writeText(url);
    addToast({ message: t('common.copied'), type: 'success' });
  } catch {
    addToast({ message: t('common.copyFailed'), type: 'error' });
  }
};

const deleteSubspace = (sub) => {
  confirmData.value = {
    show: true,
    title: t('common.delete'),
    message: t('spaceManager.deleteSpaceConfirm', { name: sub.name }),
    type: 'danger',
    onConfirm: async () => {
      await deleteSpace(sub.id);
      await loadData();
      emit('updated');
    }
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
