<template>
  <div class="rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] p-4">
    <label v-if="label" class="text-secondary mb-3 block text-sm font-medium">
      {{ label }}
    </label>

    <div class="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
      <!-- 已上传图片 (可拖拽) -->
      <UploadPreviewItem
        v-for="(file, index) in modelValue"
        :key="file.id"
        :file="file"
        :index="index"
        :drag-class="getDragClass(index)"
        :readonly="readonly"
        :is-cover="index === 0"
        :cover-text="coverText"
        @drag-start="handleDragStart(index, $event)"
        @drag-end="handleDragEnd"
        @drag-over="handleDragOver(index)"
        @drag-leave="handleDragLeave"
        @drop="handleDrop(index)"
        @touch-start="handleTouchStart(index, $event)"
        @touch-move="handleTouchMove"
        @touch-end="handleTouchEnd"
        @replace="(e) => replaceFile(index, e)"
        @remove="removeFile(index)"
      />

      <!-- 上传按钮 -->
      <UploadButton
        v-if="!readonly && modelValue.length < maxFiles && !isProcessing"
        :text="uploadText"
        @select="handleFileSelect"
      />

      <!-- 处理中状态 -->
      <UploadProcessingIndicator
        v-if="isProcessing"
        :status="processingStatus"
      />
    </div>

    <p v-if="hint" class="text-secondary mt-3 text-xs">{{ hint }}</p>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { useToast } from '@/composables/useToast';
import { useDragSort } from '@/composables/useDragSort';
import { useImageCompression } from '@/composables/useImageCompression';
import { API } from '@/utils/constants';
import { generateRandomId } from '@/utils/common';
import UploadPreviewItem from './uploader/UploadPreviewItem.vue';
import UploadProcessingIndicator from './uploader/UploadProcessingIndicator.vue';
import UploadButton from './uploader/UploadButton.vue';


const props = defineProps({
  modelValue: { type: Array, default: () => [] },
  label: { type: String, default: '' },
  hint: { type: String, default: '' },
  maxFiles: { type: Number, default: 9 },
  readonly: Boolean,
  uploadEndpoint: { type: String, default: '' },
  deferred: { type: Boolean, default: false },
  context: { type: String, default: '' }, // e.g. 'product', 'order'
});

const emit = defineEmits(['update:modelValue']);

const { t } = useI18n();
const { addToast } = useToast();

// 处理状态
const isProcessing = ref(false);
const processingStatus = ref('');

const coverText = t('spaceManager.cover');
const uploadText = t('common.addImage');

// 使用 computed 确保响应式同步
const items = computed(() => props.modelValue);
const {
  getDragClass,
  handleDragStart,
  handleDragEnd,
  handleDragOver,
  handleDragLeave,
  handleDrop: originalHandleDrop,
  handleTouchStart,
  handleTouchMove,
  handleTouchEnd,
} = useDragSort(items, {
  onReorder: (newItems) => {
    emit('update:modelValue', newItems);
  },
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
      credentials: 'include',
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
    // Add context if prop provided
    if (props.context) params.push(`context=${props.context}`);
    uploadUrl = `${uploadUrl}${separator}${params.join('&')}`;
  } else if (props.context) {
    const separator = uploadUrl.includes('?') ? '&' : '?';
    uploadUrl = `${uploadUrl}${separator}context=${props.context}`;
  }

  const response = await fetch(uploadUrl, {
    method: 'POST',
    body: formData,
    credentials: 'include',
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
          instantUpload: true,
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
      addToast({ message: t('upload.compressFailed', { message: compressErr.message }), type: 'error' });
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
          isLocal: true,
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
          instantUpload: uploaded.instantUpload,
        });
      }
    } catch (uploadErr) {
      console.error('[ImageUploader] Upload failed:', uploadErr);
      addToast({ message: t('upload.failed', { message: uploadErr.message }), type: 'error' });
    }
  }

  isProcessing.value = false;
  processingStatus.value = '';

  if (instantCount > 0) {
    addToast({
      message: `⚡ ${instantCount} ${t('upload.instantUpload')}`,
      type: 'success',
      duration: 2000,
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
        credentials: 'include',
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
        isLocal: true,
      };
    } else {
      const uploaded = await uploadFile(compressedFile, hash);
      newFileData = {
        id: uploaded.id,
        url: `/file/${uploaded.storage_key || uploaded.storageKey}`,
        hash,
        instantUpload: uploaded.instantUpload,
      };

      // 非延迟模式下才物理删除旧文件
      if (!props.deferred && oldFile.id && !oldFile.isLocal) {
        try {
          await fetch(`${API.FILES}/${oldFile.id}`, {
            method: 'DELETE',
            credentials: 'include',
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
// 批量上传待处理文件 (供父组件调用) - 并发优化版 SOTA
const uploadPendingFiles = async () => {
  // 直接从 props 获取最新值，确保响应式同步
  const currentFiles = props.modelValue || [];
  const pendingIndices = [];

  // 记录需要上传的文件索引
  currentFiles.forEach((f, index) => {
    if (f.isLocal && f.file) {
      pendingIndices.push(index);
    }
  });



  if (pendingIndices.length === 0) return true;

  isProcessing.value = true;

  // 创建工作副本
  let workingList = [...currentFiles];

  try {
    // 顺序上传每个待处理文件（避免并发时的状态问题）
    for (let i = 0; i < pendingIndices.length; i++) {
      const originalIndex = pendingIndices[i];
      const fileObj = currentFiles[originalIndex];

      processingStatus.value = `${t('upload.uploading')} ${i + 1}/${pendingIndices.length}`;

      try {
        const uploaded = await uploadFile(fileObj.file, fileObj.hash);

        if (fileObj.url && fileObj.url.startsWith('blob:')) {
          URL.revokeObjectURL(fileObj.url);
        }

        // 更新工作副本中的对应项
        workingList[originalIndex] = {
          id: uploaded.id,
          url: `/file/${uploaded.storage_key || uploaded.storageKey}`,
          hash: fileObj.hash,
          instantUpload: uploaded.instantUpload,
        };


      } catch (e) {
        console.error(`Upload failed for file at index ${originalIndex}`, e);
        throw new Error(`${fileObj.file.name} ${t('uploadQueue.uploadFailed')}`);
      }
    }

    // 所有上传完成后，一次性发送更新

    emit('update:modelValue', workingList);

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
  uploadPendingFiles,
});
</script>
