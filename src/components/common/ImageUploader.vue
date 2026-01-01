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
        v-if="!readonly && modelValue.length < maxFiles && !isProcessing"
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

      <!-- 处理中状态 -->
      <div 
        v-if="isProcessing"
        class="aspect-square rounded-lg border-2 border-dashed border-[var(--color-upload-compressing)] bg-[var(--color-upload-compressing)]/5 flex flex-col items-center justify-center animate-pulse"
      >
        <svg class="w-6 h-6 text-[var(--color-upload-compressing)] animate-spin" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <span class="text-[10px] text-[var(--color-upload-compressing)] mt-1 font-medium">{{ processingStatus }}</span>
      </div>
    </div>
    
    <p v-if="hint" class="text-xs text-secondary mt-3">{{ hint }}</p>
  </div>
</template>

<script setup>
import { ref, toRef } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { useToast } from '@/composables/useToast';
import { useDragSort } from '@/composables/useDragSort';
import { useImageCompression } from '@/composables/useImageCompression';
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

// 处理状态
const isProcessing = ref(false);
const processingStatus = ref('');

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

// 使用 SOTA 图片压缩 composable
const { compressImage, getFileHash } = useImageCompression();

/**
 * 预检查原始文件 hash 是否已存在
 * @param {string} originalHash - 原始文件的 SHA-256
 * @returns {Promise<{exists: boolean, file?: object}>}
 */
const checkOriginalHash = async (originalHash) => {
  try {
    const response = await fetch(API.CHECK_HASH, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ original_hash: originalHash }),
      credentials: 'include'
    });
    const result = await response.json();
    return result.success ? result.data : { exists: false };
  } catch (e) {
    console.warn('[ImageUploader] Pre-check failed, will proceed with upload:', e);
    return { exists: false };
  }
};

// 上传图片 (支持 CAS + 原始 Hash 去重)
const uploadFile = async (file, hash, originalHash) => {
  const formData = new FormData();
  formData.append('file', file);

  // 构建 URL，附加 contentHash 和 originalHash 参数
  let uploadUrl = props.uploadEndpoint;
  const params = [];
  if (hash) params.push(`contentHash=${hash}`);
  if (originalHash) params.push(`originalHash=${originalHash}`);
  if (params.length) {
    const separator = uploadUrl.includes('?') ? '&' : '?';
    uploadUrl = `${uploadUrl}${separator}${params.join('&')}`;
  }

  const response = await fetch(uploadUrl, {
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
  let instantCount = 0;

  for (const file of files) {
    if (newFiles.length >= props.maxFiles) break;
    
    isProcessing.value = true;
    processingStatus.value = t('upload.checkingDuplicate');
    
    // ⚡ SOTA: 先计算原始文件 hash 并预检查
    let originalHash;
    try {
      originalHash = await getFileHash(file);

      
      // 预检查：如果原始文件已存在，直接秒传
      const checkResult = await checkOriginalHash(originalHash);
      if (checkResult.exists && checkResult.file) {

        instantCount++;
        newFiles.push({
          id: checkResult.file.id,
          url: checkResult.file.url,
          hash: null,
          originalHash,
          instantUpload: true
        });
        addToast({ message: t('upload.instantUploadSuccess'), type: 'success' });
        continue; // 跳过压缩和上传
      }
    } catch (e) {
      console.warn('[ImageUploader] Pre-check error:', e);
    }
    
    // 预检查未命中，继续压缩流程
    processingStatus.value = t('upload.compressing');

    
    let compressedFile, hash;
    
    // 压缩步骤
    try {
      const result = await compressImage(file, (progress) => {
        processingStatus.value = `${t('upload.compressing')} ${progress}%`;
      });
      compressedFile = result.file;
      hash = result.hash;
      originalHash = result.originalHash; // 压缩时已计算的原始 hash

    } catch (compressErr) {
      console.error('[ImageUploader] Compression failed:', compressErr);
      addToast({ message: `压缩失败: ${compressErr.message}`, type: 'error' });
      isProcessing.value = false;
      processingStatus.value = '';
      continue;
    }
    
    // 上传步骤
    try {
      if (props.deferred) {

        const blobUrl = URL.createObjectURL(compressedFile);
        newFiles.push({
          id: generateRandomId('local'),
          url: blobUrl,
          file: compressedFile,
          hash,
          originalHash,
          isLocal: true
        });
      } else {
        processingStatus.value = t('upload.uploading');

        
        const uploaded = await uploadFile(compressedFile, hash, originalHash);

        
        if (uploaded.instantUpload) {
          instantCount++;
        }
        
        newFiles.push({
          id: uploaded.id,
          url: `/file/${uploaded.storage_key || uploaded.storageKey}`,
          hash,
          originalHash,
          instantUpload: uploaded.instantUpload
        });
      }
    } catch (uploadErr) {
      console.error('[ImageUploader] Upload failed:', uploadErr);
      addToast({ message: `上传失败: ${uploadErr.message}`, type: 'error' });
    }
  }


  isProcessing.value = false;
  processingStatus.value = '';
  
  if (instantCount > 0) {
    addToast({ 
      message: `⚡ ${instantCount} ${t('upload.instantUpload')}`, 
      type: 'success',
      duration: 2000
    });
  }

  emit('update:modelValue', newFiles);
  e.target.value = '';
};

const removeFile = async (index) => {
  const file = props.modelValue[index];
  
  // 在非延迟模式下，且文件已上传，才物理删除
  if (!props.deferred && file.id && !file.isLocal) {
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
    const { file: compressedFile, hash } = await compressImage(file);
    
    let newFileData;
    
    if (props.deferred) {
      const blobUrl = URL.createObjectURL(compressedFile);
      newFileData = {
        id: generateRandomId('local'),
        url: blobUrl,
        file: compressedFile,
        hash,
        isLocal: true
      };
    } else {
      const uploaded = await uploadFile(compressedFile, hash);
      newFileData = {
        id: uploaded.id,
        url: `/file/${uploaded.storage_key || uploaded.storageKey}`,
        hash,
        instantUpload: uploaded.instantUpload
      };
      
      // 非延迟模式下才物理删除旧文件
      if (!props.deferred && oldFile.id && !oldFile.isLocal) {
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
// 批量上传待处理文件 (供父组件调用)
const uploadPendingFiles = async () => {
  const pendingFiles = items.value.filter(f => f.isLocal && f.file);
  if (pendingFiles.length === 0) return true;

  isProcessing.value = true;
  let successCount = 0;
  
  try {
    const newFiles = [...items.value];
    
    for (let i = 0; i < newFiles.length; i++) {
      const fileObj = newFiles[i];
      if (fileObj.isLocal && fileObj.file) {
        processingStatus.value = `${t('upload.uploading')} ${i + 1}/${newFiles.length}`;
        try {
          const uploaded = await uploadFile(fileObj.file, fileObj.hash);
          
          if (fileObj.url.startsWith('blob:')) {
            URL.revokeObjectURL(fileObj.url);
          }
          
          newFiles[i] = {
            id: uploaded.id,
            url: `/file/${uploaded.storage_key || uploaded.storageKey}`,
            hash: fileObj.hash,
            instantUpload: uploaded.instantUpload
          };
          successCount++;
        } catch (e) {
          console.error(`Upload failed for file index ${i}`, e);
          throw new Error(`${fileObj.file.name} ${t('uploadQueue.uploadFailed')}`);
        }
      }
    }
    
    emit('update:modelValue', newFiles);
    return true;
  } catch (err) {
    addToast({ message: err.message, type: 'error' });
    return false;
  } finally {
    isProcessing.value = false;
    processingStatus.value = '';
  }
};

defineExpose({
  uploadPendingFiles
});
</script>
