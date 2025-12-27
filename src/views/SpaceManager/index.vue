<template>
  <div class="space-manager">
    <!-- 页面标题 -->
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-xl font-semibold text-primary">共享空间</h1>
        <p class="text-sm text-secondary mt-1">创建和管理您的共享空间</p>
      </div>
      <button v-if="spaces.length === 0" disabled class="invisible px-4 py-2">
        <!-- 占位符保持布局 -->
      </button>
      <div v-else class="flex gap-2">
          <!-- 未来可扩展：导入、归档等按钮 -->
          <button @click="showCreateModal = true"
            class="flex items-center gap-2 px-3 py-2 text-sm font-medium bg-primary text-white rounded-lg hover:bg-gray-800 transition-colors">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
            </svg>
            新建
          </button>
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
            class="absolute top-2 right-2 px-2 py-1 text-xs font-medium bg-green-500 text-white rounded-full">
            已公开
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
              {{ space.fileCount }} 文件
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
        <div class="px-4 pb-4 flex gap-2">
          <button @click.stop="copyShareLink(space)" 
            class="flex-1 px-3 py-2 text-xs font-medium bg-gray-100 text-secondary rounded-lg hover:bg-gray-200 transition-colors">
            复制链接
          </button>
          <button @click.stop="deleteSpaceConfirm(space)"
            class="px-3 py-2 text-xs text-red-500 bg-red-50 rounded-lg hover:bg-red-100 transition-colors">
            删除
          </button>
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
      <h3 class="text-lg font-medium text-primary mb-2">暂无共享空间</h3>
      <p class="text-secondary text-sm mb-6">创建一个空间来整理和分享您的文件</p>
      <button @click="showCreateModal = true"
        class="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-lg hover:bg-gray-800 transition-colors">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
        </svg>
        创建第一个空间
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
import SpaceCreateModal from '@/components/SpaceCreateModal.vue';
import SpaceDetailModal from '@/components/SpaceDetailModal.vue';
import SpaceProductEditor from '@/components/SpaceProductEditor.vue';

const { spaces, loading, loadSpaces, deleteSpace } = useSpaces();
const { addToast } = useToast();

const showCreateModal = ref(false);
const selectedSpace = ref(null);

const templateLabels = {
  gallery: '画廊',
  product: '商品',
  portfolio: '作品集',
  document: '文档库',
  collection: '合集',
  custom: '自定义'
};

const getTemplateLabel = (template) => templateLabels[template] || template;

const openSpaceDetail = (space) => {
  selectedSpace.value = space;
};

const copyShareLink = async (space) => {
  if (!space.shareUrl) {
    addToast({ message: '该空间未公开', type: 'warning' });
    return;
  }
  try {
    const url = `${window.location.origin}${space.shareUrl}`;
    await navigator.clipboard.writeText(url);
    addToast({ message: '链接已复制', type: 'success' });
  } catch {
    addToast({ message: '复制失败', type: 'error' });
  }
};

const deleteSpaceConfirm = async (space) => {
  if (confirm(`确定要删除空间"${space.name}"吗？此操作不会删除实际文件。`)) {
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
