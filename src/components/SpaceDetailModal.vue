<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50" @click.self="$emit('close')">
    <div class="bg-white rounded-2xl shadow-xl w-full max-w-3xl mx-4 max-h-[90vh] flex flex-col overflow-hidden">
      <!-- Header -->
      <div class="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
        <div>
          <h2 class="text-lg font-semibold text-primary">{{ spaceData?.name || '空间详情' }}</h2>
          <p class="text-sm text-secondary mt-0.5">{{ getTemplateLabel(spaceData?.template) }} · {{ spaceData?.files?.length || 0 }} 文件</p>
        </div>
        <button @click="$emit('close')" class="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        </button>
      </div>

      <!-- Content -->
      <div class="flex-1 overflow-hidden flex flex-col min-h-0">
        <!-- Tabs Header -->
        <div class="px-6 border-b border-gray-100 bg-white shrink-0">
          <div class="flex space-x-6">
            <button @click="activeTab = 'files'"
              class="px-1 py-3 text-sm font-medium border-b-2 transition-colors duration-200"
              :class="activeTab === 'files' ? 'border-primary text-primary' : 'border-transparent text-secondary hover:text-gray-900'">
              文件列表
            </button>
            <button @click="activeTab = 'settings'"
              class="px-1 py-3 text-sm font-medium border-b-2 transition-colors duration-200"
              :class="activeTab === 'settings' ? 'border-primary text-primary' : 'border-transparent text-secondary hover:text-gray-900'">
              设置
            </button>
            <button @click="activeTab = 'analytics'"
              class="px-1 py-3 text-sm font-medium border-b-2 transition-colors duration-200"
              :class="activeTab === 'analytics' ? 'border-primary text-primary' : 'border-transparent text-secondary hover:text-gray-900'">
              数据分析
            </button>
          </div>
        </div>

        <!-- CONTENT: FILES -->
        <div v-show="activeTab === 'files'" class="flex-1 overflow-hidden flex flex-col min-h-0 bg-gray-50/50">
            <div class="p-4 border-b border-gray-100 flex items-center justify-between bg-white shrink-0">
              <div class="flex items-center gap-3">
                 <button @click="showFileSelector = true" class="btn-primary flex items-center gap-2 text-sm px-3 py-1.5 h-8">
                     <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>
                     添加文件
                 </button>
                 <span class="text-xs text-secondary">{{ spaceData?.files?.length || 0 }} 个文件</span>
              </div>
            </div>
            
            <div class="flex-1 overflow-y-auto p-4">
                <div v-if="spaceData?.files?.length === 0" class="h-full flex flex-col items-center justify-center text-secondary py-12">
                    <p>暂无文件，点击上方按钮添加</p>
                </div>
                <div v-else class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    <div v-for="file in spaceData.files" :key="file.id" class="group relative aspect-square bg-gray-100 rounded-lg overflow-hidden border border-gray-200">
                        <img v-if="file.mimeType?.startsWith('image/')" :src="file.url" class="w-full h-full object-cover">
                        <div v-else class="w-full h-full flex items-center justify-center text-gray-400 font-bold bg-white text-xs uppercase">{{ file.name?.split('.').pop() }}</div>
                        <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <button @click.stop="removeFile(file.id)" class="p-1.5 bg-red-500 rounded-full text-white hover:bg-red-600 transition-colors">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- CONTENT: SETTINGS -->
        <div v-show="activeTab === 'settings'" class="flex-1 p-6 overflow-y-auto">
          <!-- 分享设置 -->
          <div class="bg-gray-50 rounded-xl p-4">
            <div class="flex items-center justify-between">
              <div>
                <div class="font-medium text-primary">分享设置</div>
                <div class="text-sm text-secondary mt-1">
                  {{ spaceData?.isPublic ? '已公开分享' : '未公开' }}
                </div>
              </div>
              <label class="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" v-model="isPublic" @change="togglePublic" class="sr-only peer">
                <div class="w-11 h-6 bg-gray-200 peer-focus:ring-2 peer-focus:ring-primary/20 rounded-full peer peer-checked:bg-primary transition-colors after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-5"></div>
              </label>
            </div>
            
            <!-- 分享链接 -->
            <div v-if="spaceData?.isPublic" class="mt-4 flex gap-2">
              <input type="text" readonly :value="shareUrl" 
                class="flex-1 px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg">
              <button @click="copyLink" class="px-4 py-2 text-sm font-medium bg-primary text-white rounded-lg hover:bg-800">
                复制
              </button>
            </div>
          </div>
        </div>
        
        <!-- CONTENT: ANALYTICS -->
        <div v-show="activeTab === 'analytics'" class="flex-1 p-6 overflow-y-auto">
             <SpaceAnalytics v-if="activeTab === 'analytics'" :spaceId="space.id" />
        </div>
      </div>

      <!-- Footer -->
      <div class="px-6 py-4 border-t border-gray-100 flex justify-end gap-3 shrink-0">
        <button @click="$emit('close')" class="px-4 py-2 text-sm font-medium text-secondary hover:text-primary">
          关闭
        </button>
        <button @click="openPreview" class="px-4 py-2 text-sm font-medium bg-gray-100 text-primary rounded-lg hover:bg-gray-200">
          预览
        </button>
      </div>
    </div>
    
    <!-- 文件选择器 -->
    <FileSelector v-if="showFileSelector" @close="showFileSelector = false" @select="addFiles" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useSpaces } from '@/composables/useSpaces';
import { useToast } from '@/composables/useToast';
import { formatSize } from '@/utils/formatters';
import FileSelector from '@/components/FileSelector.vue';
import SpaceAnalytics from './SpaceAnalytics.vue';

const props = defineProps({
  space: { type: Object, required: true }
});

const emit = defineEmits(['close', 'updated']);

const { loadSpace, updateSpace, addFilesToSpace, removeFilesFromSpace } = useSpaces();
const { addToast } = useToast();

const spaceData = ref(null);
const isPublic = ref(false);
const showFileSelector = ref(false);
const activeTab = ref('files');

const templateLabels = {
  gallery: '画廊',
  product: '商品',
  portfolio: '作品集',
  document: '文档库',
  custom: '自定义'
};

const getTemplateLabel = (t) => templateLabels[t] || t;

const shareUrl = computed(() => {
  if (!spaceData.value?.shareToken) return '';
  return `${window.location.origin}/space/${spaceData.value.shareToken}`;
});

const loadData = async () => {
  const data = await loadSpace(props.space.id);
  if (data) {
    spaceData.value = data;
    isPublic.value = data.isPublic;
  }
};

const togglePublic = async () => {
  await updateSpace(props.space.id, { isPublic: isPublic.value });
  await loadData();
  emit('updated');
};

const copyLink = async () => {
  try {
    await navigator.clipboard.writeText(shareUrl.value);
    addToast({ message: '链接已复制', type: 'success' });
  } catch {
    addToast({ message: '复制失败', type: 'error' });
  }
};

const addFiles = async (fileIds) => {
  showFileSelector.value = false;
  await addFilesToSpace(props.space.id, fileIds);
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
    addToast({ message: '请先公开空间', type: 'warning' });
  }
};

onMounted(loadData);
watch(() => props.space.id, loadData);
</script>
