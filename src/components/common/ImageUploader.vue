<template>
  <div class="bg-white rounded-xl border border-[var(--border-color)] p-4">
    <label v-if="label" class="block text-sm font-medium text-secondary mb-3">
      {{ label }}
    </label>
    
    <div class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
      <!-- 已上传图片 (可拖拽) -->
      <div 
        v-for="(file, index) in modelValue" 
        :key="file.id"
        class="relative aspect-square rounded-lg overflow-hidden bg-[var(--bg-muted)] group border-2 transition-all cursor-move"
        :class="getDragClass(index)"
        :data-sortable-index="index"
        draggable="true"
        @dragstart="handleDragStart(index, $event)"
        @dragend="handleDragEnd"
        @dragover.prevent="handleDragOver(index)"
        @dragleave="handleDragLeave"
        @drop.prevent="handleDrop(index)"
        @touchstart="handleTouchStart(index, $event)"
        @touchmove="handleTouchMove"
        @touchend="handleTouchEnd"
      >
        <img :src="file.url" class="w-full h-full object-cover pointer-events-none">
        
        <!-- 操作遮罩层 -->
        <div 
          v-if="!readonly"
          class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2"
        >
          <!-- 替换按钮 -->
          <label class="w-8 h-8 bg-white/90 rounded-full flex items-center justify-center cursor-pointer hover:bg-white transition-colors">
            <input 
              type="file" 
              accept="image/*" 
              class="hidden"
              @change="(e) => replaceFile(index, e)"
            >
            <svg class="w-4 h-4 text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
            </svg>
          </label>
          <!-- 删除按钮 -->
          <button 
            type="button"
            @click="removeFile(index)"
            class="w-8 h-8 bg-danger rounded-full flex items-center justify-center hover:bg-danger/90 transition-colors"
          >
            <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
            </svg>
          </button>
        </div>

        <!-- 主图/封面标记 -->
        <div v-if="index === 0" class="absolute bottom-1 left-1 px-1.5 py-0.5 bg-primary text-white text-[10px] rounded shadow-sm">
          {{ coverText }}
        </div>
        
        <!-- 拖拽序号 -->
        <div class="absolute top-1 right-1 w-5 h-5 bg-black/50 text-white text-[10px] rounded-full flex items-center justify-center">
          {{ index + 1 }}
        </div>
      </div>

      <!-- 上传按钮 -->
      <label 
        v-if="!readonly && modelValue.length < maxFiles"
        class="aspect-square rounded-lg border-2 border-dashed border-[var(--border-color)] flex flex-col items-center justify-center cursor-pointer hover:border-primary hover:bg-[var(--bg-hover)] transition-colors group"
      >
        <input 
          type="file" 
          accept="image/*" 
          multiple 
          class="hidden"
          @change="handleFileSelect"
        >
        <svg class="w-6 h-6 text-muted group-hover:text-primary transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
        </svg>
        <span class="text-xs text-secondary mt-1 group-hover:text-primary transition-colors">{{ uploadText }}</span>
      </label>
    </div>
    
    <p v-if="hint" class="text-xs text-secondary mt-3">{{ hint }}</p>
  </div>
</template>

<script setup>
import { ref, toRef } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { useToast } from '@/composables/useToast';
import { useDragSort } from '@/composables/useDragSort';
import { API } from '@/utils/constants';
import { generateRandomId } from '@/utils/common';

const props = defineProps({
  modelValue: { type: Array, default: () => [] },
  label: String,
  hint: String,
  maxFiles: { type: Number, default: 9 },
  readonly: Boolean,
  uploadEndpoint: { type: String, default: '' },
  deferred: { type: Boolean, default: false }
});

const emit = defineEmits(['update:modelValue']);

const { t } = useI18n();
const { addToast } = useToast();

const coverText = t('spaceManager.cover');
const uploadText = t('common.addImage');

// 使用拖拽排序 composable
const items = toRef(props, 'modelValue');
const {
  getDragClass,
  handleDragStart,
  handleDragEnd,
  handleDragOver,
  handleDragLeave,
  handleDrop: originalHandleDrop,
  handleTouchStart,
  handleTouchMove,
  handleTouchEnd
} = useDragSort(items, {
  onReorder: (newItems) => {
    emit('update:modelValue', newItems);
  }
});

// 包装 handleDrop 以更新数据
const handleDrop = (targetIndex) => {
  originalHandleDrop(targetIndex);
};

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
      
      if (props.deferred) {
        const blobUrl = URL.createObjectURL(compressed);
        newFiles.push({
          id: generateRandomId('local'),
          url: blobUrl,
          file: compressedFile,
          isLocal: true
        });
      } else {
        const uploaded = await uploadFile(compressedFile);
        newFiles.push({
          id: uploaded.id,
          url: `/file/${uploaded.storage_key || uploaded.storageKey}`,
        });
      }
    } catch (err) {
      console.error(err);
      addToast({ message: t('uploadQueue.uploadFailed'), type: 'error' });
    }
  }

  emit('update:modelValue', newFiles);
  e.target.value = '';
};

const removeFile = async (index) => {
  const file = props.modelValue[index];
  
  if (file.id && !file.isLocal) {
    try {
      await fetch(`${API.FILES}/${file.id}`, {
        method: 'DELETE',
        credentials: 'include'
      });
    } catch (e) {
      console.warn('Failed to delete file from server', e);
    }
  }
  
  if (file.isLocal && file.url.startsWith('blob:')) {
    URL.revokeObjectURL(file.url);
  }
  
  const newFiles = [...props.modelValue];
  newFiles.splice(index, 1);
  emit('update:modelValue', newFiles);
};

// 替换文件
const replaceFile = async (index, e) => {
  const file = e.target.files[0];
  if (!file) return;
  e.target.value = '';

  const oldFile = props.modelValue[index];

  try {
    const compressed = await compressImage(file);
    const compressedFile = new File([compressed], file.name, { type: 'image/jpeg' });
    
    let newFileData;
    
    if (props.deferred) {
      const blobUrl = URL.createObjectURL(compressed);
      newFileData = {
        id: generateRandomId('local'),
        url: blobUrl,
        file: compressedFile,
        isLocal: true
      };
    } else {
      const uploaded = await uploadFile(compressedFile);
      newFileData = {
        id: uploaded.id,
        url: `/file/${uploaded.storage_key || uploaded.storageKey}`
      };
      
      if (oldFile.id && !oldFile.isLocal) {
        try {
          await fetch(`${API.FILES}/${oldFile.id}`, {
            method: 'DELETE',
            credentials: 'include'
          });
        } catch (e) {
          console.warn('Failed to delete old file', e);
        }
      }
    }
    
    if (oldFile.isLocal && oldFile.url.startsWith('blob:')) {
      URL.revokeObjectURL(oldFile.url);
    }

    const newFiles = [...props.modelValue];
    newFiles[index] = newFileData;
    emit('update:modelValue', newFiles);
  } catch (err) {
    console.error(err);
    addToast({ message: t('uploadQueue.uploadFailed'), type: 'error' });
  }
};
</script>
