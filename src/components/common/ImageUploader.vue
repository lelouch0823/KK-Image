<template>
  <div class="bg-white rounded-xl border border-gray-200 p-4">
    <label v-if="label" class="block text-sm font-medium text-gray-700 mb-3">
      {{ label }}
    </label>
    
    <div class="grid grid-cols-3 gap-3">
      <!-- 已上传图片 -->
      <div 
        v-for="(file, index) in modelValue" 
        :key="file.id"
        class="relative aspect-square rounded-lg overflow-hidden bg-gray-100 group border border-gray-200"
      >
        <img :src="file.url" class="w-full h-full object-cover">
        
        <!-- 删除按钮 -->
        <button 
          v-if="!readonly"
          type="button"
          @click="removeFile(index)"
          class="absolute top-1 right-1 w-6 h-6 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500"
        >
          <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        </button>

        <!-- 主图标记 -->
        <div v-if="index === 0" class="absolute bottom-1 left-1 px-1.5 py-0.5 bg-primary text-white text-[10px] rounded shadow-sm">
          {{ coverText }}
        </div>
      </div>

      <!-- 上传按钮 -->
      <label 
        v-if="!readonly && modelValue.length < maxFiles"
        class="aspect-square rounded-lg border-2 border-dashed border-gray-300 flex flex-col items-center justify-center cursor-pointer hover:border-primary hover:bg-gray-50 transition-colors group"
      >
        <input 
          type="file" 
          accept="image/*" 
          multiple 
          class="hidden"
          @change="handleFileSelect"
        >
        <svg class="w-6 h-6 text-gray-400 group-hover:text-primary transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
        </svg>
        <span class="text-xs text-secondary mt-1 group-hover:text-primary transition-colors">{{ uploadText }}</span>
      </label>
    </div>
    
    <p v-if="hint" class="text-xs text-secondary mt-3">{{ hint }}</p>
  </div>
</template>

<script setup>
import { useI18n } from '@/composables/useI18n';
import { useToast } from '@/composables/useToast';

const props = defineProps({
  modelValue: { type: Array, default: () => [] },
  label: String,
  hint: String,
  maxFiles: { type: Number, default: 9 },
  readonly: Boolean,
  uploadEndpoint: { type: String, required: true } // '/api/sales/token/upload' or '/api/manage/upload'
});

const emit = defineEmits(['update:modelValue']);

const { t } = useI18n();
const { addToast } = useToast();

const coverText = t('spaceManager.cover');
const uploadText = '添加图片'; // Ideally from i18n

// 压缩图片
const compressImage = (file, maxWidth = 1920, quality = 0.8) => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => resolve(blob),
          'image/jpeg',
          quality
        );
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
};

// 上传图片
const uploadFile = async (file) => {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(props.uploadEndpoint, {
    method: 'POST',
    body: formData,
    credentials: 'include'
  });

  const result = await response.json();
  if (!result.success) {
    throw new Error(result.message);
  }

  return result.data;
};

// 处理选择
const handleFileSelect = async (e) => {
  const files = Array.from(e.target.files);
  if (!files.length) return;

  const newFiles = [...props.modelValue];

  for (const file of files) {
    if (newFiles.length >= props.maxFiles) break;
    
    try {
      const compressed = await compressImage(file);
      const compressedFile = new File([compressed], file.name, { type: 'image/jpeg' });
      
      const uploaded = await uploadFile(compressedFile);
      newFiles.push({
        id: uploaded.id,
        url: `/file/${uploaded.storage_key || uploaded.storageKey}`,
        // Keep other metadata if needed
      });
    } catch (err) {
      console.error(err);
      addToast({ message: t('uploadQueue.uploadFailed'), type: 'error' });
    }
  }

  emit('update:modelValue', newFiles);
  e.target.value = '';
};

const removeFile = (index) => {
  const newFiles = [...props.modelValue];
  newFiles.splice(index, 1);
  emit('update:modelValue', newFiles);
};
</script>
