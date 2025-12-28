<template>
  <div class="space-manager">
    <!-- 页面标题 -->
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-xl font-semibold text-primary">{{ t('spaceManager.title') }}</h1>
        <p class="text-sm text-secondary mt-1">{{ t('spaceManager.subtitle') }}</p>
      </div>
      <button v-if="spaces.length === 0" disabled class="invisible px-4 py-2">
        <!-- 占位符保持布局 -->
      </button>
      <div v-else class="flex gap-2">
          <!-- 未来可扩展：导入、归档等按钮 -->
          <Tooltip :content="t('spaceManager.create')">
            <button @click="showCreateModal = true"
                class="w-9 h-9 flex items-center justify-center bg-primary text-white rounded-lg hover:bg-[var(--color-primary-hover)] transition-colors shadow-sm">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
                </svg>
            </button>
          </Tooltip>
      </div>
    </div>

    <!-- 加载状态 -->
    <div v-if="loading" class="flex justify-center py-20">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>

    <!-- 空间列表 -->
    <div v-else-if="spaces.length > 0" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <div v-for="space in spaces" :key="space.id"
        class="group bg-white border border-[var(--border-color)] rounded-xl hover:shadow-lg transition-all overflow-hidden cursor-pointer"
        @click="openSpaceDetail(space)">
        
        <!-- 封面图 -->
        <div class="aspect-video bg-gradient-to-br from-gray-100 to-gray-200 relative overflow-hidden">
          <div class="absolute inset-0 flex items-center justify-center">
            <svg class="w-12 h-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" 
                d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path>
            </svg>
          </div>
          
          <!-- 模版标签 -->
          <span class="absolute top-2 left-2 px-2 py-1 text-xs font-medium bg-white/90 rounded-full">
            {{ getTemplateLabel(space.template) }}
          </span>
          
          <!-- 分享状态 -->
          <span v-if="space.isPublic" 
            class="absolute top-2 right-2 px-2 py-1 text-xs font-medium bg-[var(--color-success)] text-white rounded-full">
            {{ t('spaceManager.public') }}
          </span>
        </div>

        <!-- 信息 -->
        <div class="p-4">
          <h3 class="font-semibold text-primary truncate">{{ space.name }}</h3>
          <p v-if="space.description" class="text-sm text-secondary mt-1 line-clamp-2">{{ space.description }}</p>
          
          <div class="flex items-center gap-4 mt-3 text-xs text-secondary">
            <span class="flex items-center gap-1">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
              </svg>
              {{ t('fileManager.totalFiles', { count: space.fileCount }) }}
            </span>
            <span class="flex items-center gap-1">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
              </svg>
              {{ space.viewCount }} 访问
            </span>
          </div>
        </div>

        <!-- 操作菜单 -->
        <div class="px-4 pb-4 flex justify-end gap-2">
          <Tooltip :content="t('spaceManager.copyLink')">
            <button @click.stop="copyShareLink(space)" 
                class="w-8 h-8 flex items-center justify-center bg-gray-100 text-secondary rounded-lg hover:bg-gray-200 transition-colors hover:text-primary">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"></path>
                </svg>
            </button>
          </Tooltip>
          <Tooltip :content="t('spaceManager.deleteSpace')">
            <button @click.stop="deleteSpaceConfirm(space)"
                class="w-8 h-8 flex items-center justify-center text-[var(--color-danger)] bg-[var(--color-danger-bg)] rounded-lg hover:bg-red-100 transition-colors">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                </svg>
            </button>
          </Tooltip>
        </div>
      </div>
    </div>

    <!-- 空状态 -->
    <div v-else class="text-center py-20">
      <div class="w-20 h-20 mx-auto mb-6 bg-gray-50 rounded-full flex items-center justify-center border-2 border-dashed border-gray-200">
        <svg class="w-10 h-10 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" 
            d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path>
        </svg>
      </div>
      <h3 class="text-lg font-medium text-primary mb-2">{{ t('spaceManager.emptyTitle') }}</h3>
      <p class="text-secondary text-sm mb-6">{{ t('spaceManager.createDesc') }}</p>
      <button @click="showCreateModal = true"
        class="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-lg hover:bg-[var(--color-primary-hover)] transition-colors">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
        </svg>
        {{ t('spaceManager.createFirst') }}
      </button>
    </div>

    <!-- 创建空间弹窗 -->
    <SpaceCreateModal v-if="showCreateModal" @close="showCreateModal = false" @created="onSpaceCreated" />
    
    <!-- 空间详情/编辑器弹窗 -->
    <SpaceProductEditor v-if="selectedSpace && selectedSpace.template === 'product'" 
      :space="selectedSpace" @close="selectedSpace = null" @updated="loadSpaces" />
      
    <SpaceDetailModal v-else-if="selectedSpace" 
      :space="selectedSpace" @close="selectedSpace = null" @updated="loadSpaces" />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useSpaces } from '@/composables/useSpaces';
import { useToast } from '@/composables/useToast';
import { useI18n } from '@/composables/useI18n';
import SpaceCreateModal from '@/components/SpaceCreateModal.vue';
import SpaceDetailModal from '@/components/SpaceDetailModal.vue';
import SpaceProductEditor from '@/components/SpaceProductEditor.vue';
import Tooltip from '@/components/ui/Tooltip.vue';

const { spaces, loading, loadSpaces, deleteSpace } = useSpaces();
const { addToast } = useToast();
const { t } = useI18n();

const showCreateModal = ref(false);
const selectedSpace = ref(null);

const getTemplateLabel = (template) => t(`spaceManager.templates.${template}`) || template;

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

const deleteSpaceConfirm = async (space) => {
  if (confirm(t('spaceManager.deleteSpaceConfirm', { name: space.name }))) {
    await deleteSpace(space.id);
  }
};

const onSpaceCreated = () => {
  showCreateModal.value = false;
  loadSpaces();
};

onMounted(() => {
  loadSpaces();
});
</script>

<style scoped>
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
