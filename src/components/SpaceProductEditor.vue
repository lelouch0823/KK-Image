<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50" @click.self="$emit('close')">
    <div class="bg-white rounded-2xl shadow-xl w-full max-w-5xl mx-4 h-[90vh] flex overflow-hidden">
      <!-- 左侧：商品属性编辑器 -->
      <div class="w-1/3 border-r border-gray-100 flex flex-col bg-gray-50">
        <div class="px-6 py-4 border-b border-gray-100">
          <h2 class="text-lg font-semibold text-primary">商品信息</h2>
          <p class="text-xs text-secondary mt-1">编辑商品基本参数</p>
        </div>
        
        <div class="flex-1 overflow-y-auto p-6 space-y-4">
          <div>
            <label class="block text-sm font-medium text-primary mb-1">商品名称</label>
            <input v-model="form.name" type="text" 
              class="w-full px-4 py-2 border border-gray-200 rounded-lg focus:border-primary outline-none">
          </div>
          
          <div>
            <label class="block text-sm font-medium text-primary mb-1">品牌</label>
            <input v-model="form.templateData.brand" type="text" 
              class="w-full px-4 py-2 border border-gray-200 rounded-lg focus:border-primary outline-none">
          </div>

          <div>
            <label class="block text-sm font-medium text-primary mb-1">系列</label>
            <input v-model="form.templateData.series" type="text" 
              class="w-full px-4 py-2 border border-gray-200 rounded-lg focus:border-primary outline-none">
          </div>
          
          <div class="grid grid-cols-2 gap-3">
             <div>
              <label class="block text-sm font-medium text-primary mb-1">价格</label>
              <input v-model="form.templateData.price" type="number" 
                class="w-full px-4 py-2 border border-gray-200 rounded-lg focus:border-primary outline-none">
            </div>
             <div>
              <label class="block text-sm font-medium text-primary mb-1">材质</label>
              <input v-model="form.templateData.material" type="text" 
                class="w-full px-4 py-2 border border-gray-200 rounded-lg focus:border-primary outline-none">
            </div>
          </div>

          <div>
            <label class="block text-sm font-medium text-primary mb-1">描述</label>
            <textarea v-model="form.description" rows="4" 
              class="w-full px-4 py-2 border border-gray-200 rounded-lg focus:border-primary outline-none resize-none"></textarea>
          </div>
          
          <div class="pt-4 border-t border-gray-200">
             <div class="flex items-center justify-between mb-2">
               <span class="text-sm font-medium text-primary">分享状态</span>
               <button @click="togglePublic" 
                 class="px-2 py-1 text-xs rounded border"
                 :class="form.isPublic ? 'bg-green-50 text-green-600 border-green-200' : 'bg-gray-50 text-gray-500 border-gray-200'">
                 {{ form.isPublic ? '已公开' : '私有' }}
               </button>
             </div>
             <div v-if="form.isPublic" class="text-xs text-secondary break-all">
                {{ shareUrl }}
             </div>
          </div>
        </div>

        <div class="px-6 py-4 border-t border-gray-100">
          <button @click="saveChanges" :disabled="saving"
            class="w-full py-2 bg-primary text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50">
            {{ saving ? '保存中...' : '保存更改' }}
          </button>
        </div>
      </div>

      <!-- 右侧：媒体资源管理 -->
      <div class="flex-1 flex flex-col bg-white">
        <div class="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
          <div>
             <h2 class="text-lg font-semibold text-primary">媒体资源</h2>
             <p class="text-xs text-secondary mt-1">管理商品图片和文档</p>
          </div>
          <div class="flex gap-2">
            <button @click="showFileSelector = true" 
              class="px-4 py-2 bg-gray-100 text-primary hover:bg-gray-200 rounded-lg text-sm font-medium transition-colors">
              + 添加文件
            </button>
             <button @click="$emit('close')" 
              class="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </button>
          </div>
        </div>
        
        <div class="flex-1 overflow-y-auto p-6">
          <div v-if="files.length > 0" class="grid grid-cols-4 gap-4">
            <div v-for="file in files" :key="file.id" 
              class="group relative aspect-square bg-gray-50 rounded-xl border border-gray-100 overflow-hidden">
               <img v-if="isImage(file)" :src="file.url" class="w-full h-full object-cover" loading="lazy">
               <div v-else class="w-full h-full flex flex-col items-center justify-center p-4">
                  <span class="text-xs font-bold text-gray-400 uppercase mb-2">{{ file.name?.split('.').pop() }}</span>
                  <span class="text-xs text-center text-gray-500 line-clamp-2">{{ file.originalName || file.name }}</span>
               </div>
               
               <!-- 操作遮罩 -->
               <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                 <button @click="setCover(file)" title="设为封面"
                   class="p-2 bg-white/90 rounded-full hover:bg-white text-gray-600">
                   <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                     <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                   </svg>
                 </button>
                 <button @click="removeFile(file.id)" title="移除"
                   class="p-2 bg-white/90 rounded-full hover:bg-white text-red-500">
                   <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                     <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                   </svg>
                 </button>
               </div>
               
               <!-- 封面标记 -->
               <div v-if="form.coverFileId === file.id" 
                 class="absolute top-2 left-2 px-2 py-0.5 bg-primary text-white text-[10px] rounded-full">
                 封面
               </div>
            </div>
          </div>
          <div v-else class="h-full flex flex-col items-center justify-center text-secondary">
            <svg class="w-16 h-16 text-gray-200 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
            </svg>
            <p>暂无媒体资源</p>
            <button @click="showFileSelector = true" class="mt-4 text-primary text-sm hover:underline">点击添加图片或文档</button>
          </div>
        </div>
      </div>
    </div>

    <FileSelector v-if="showFileSelector" @close="showFileSelector = false" @select="addFiles" />
  </div>
</template>

<script setup>
import { ref, watch, onMounted, computed } from 'vue';
import { useSpaces } from '@/composables/useSpaces';
import { useToast } from '@/composables/useToast';
import { isImage } from '@/utils/formatters';
import FileSelector from '@/components/FileSelector.vue';

const props = defineProps({
  space: { type: Object, required: true }
});

const emit = defineEmits(['close', 'updated']);

const { updateSpace, addFilesToSpace, removeFilesFromSpace, loadSpace } = useSpaces();
const { addToast } = useToast();

const showFileSelector = ref(false);
const saving = ref(false);
const files = ref([]);

const form = ref({
  name: '',
  description: '',
  isPublic: false,
  coverFileId: null,
  templateData: {
    brand: '',
    series: '',
    price: '',
    material: ''
  }
});

const shareUrl = computed(() => {
  if (!props.space.shareToken) return '保存并公开后生成链接';
  return `${window.location.origin}/space/${props.space.shareToken}`;
});

const initData = async () => {
  const data = await loadSpace(props.space.id);
  if (data) {
    form.value.name = data.name;
    form.value.description = data.description;
    form.value.isPublic = data.isPublic;
    form.value.coverFileId = data.coverFileId;
    form.value.templateData = { ...form.value.templateData, ...(data.templateData || {}) };
    files.value = data.files || [];
  }
};

const saveChanges = async () => {
  saving.value = true;
  await updateSpace(props.space.id, {
    name: form.value.name,
    description: form.value.description,
    isPublic: form.value.isPublic,
    coverFileId: form.value.coverFileId,
    templateData: form.value.templateData
  });
  saving.value = false;
  addToast({ message: '保存成功', type: 'success' });
  emit('updated');
};

const togglePublic = () => {
  form.value.isPublic = !form.value.isPublic;
};

const addFiles = async (fileIds) => {
  showFileSelector.value = false;
  await addFilesToSpace(props.space.id, fileIds);
  await initData();
  emit('updated');
};

const removeFile = async (fileId) => {
  if(confirm('确定移除该文件？')) {
    await removeFilesFromSpace(props.space.id, [fileId]);
    await initData();
    emit('updated');
  }
};

const setCover = (file) => {
  form.value.coverFileId = file.id;
  addToast({ message: '已设为封面，请点击保存生效', type: 'success' });
};

onMounted(initData);
</script>
