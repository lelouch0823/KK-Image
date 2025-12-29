<template>
  <div class="space-y-6">
    <!-- 标题 -->
    <div class="text-center">
      <h2 class="text-xl font-bold text-primary">{{ t('order.portal.newOrder') }}</h2>
      <p class="text-sm text-secondary mt-1">{{ t('order.portal.subtitle') }}</p>
    </div>

    <form @submit.prevent="handleSubmit" class="space-y-4">
      <!-- 图片上传 -->
      <div class="bg-white rounded-xl border border-[var(--border-color)] p-4">
        <label class="block text-sm font-medium text-primary mb-3">
          {{ t('order.form.uploadImages') }}
        </label>
        
        <div class="grid grid-cols-3 gap-3">
          <!-- 已上传图片 -->
          <div 
            v-for="(file, index) in uploadedFiles" 
            :key="file.id"
            class="relative aspect-square rounded-lg overflow-hidden bg-gray-100 group"
          >
            <img :src="file.url" class="w-full h-full object-cover">
            <button 
              type="button"
              @click="removeFile(index)"
              class="absolute top-1 right-1 w-6 h-6 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </button>
            <!-- 主图标记 -->
            <div v-if="index === 0" class="absolute bottom-1 left-1 px-1.5 py-0.5 bg-primary text-white text-[10px] rounded">
              {{ t('spaceManager.cover') }}
            </div>
          </div>

          <!-- 上传按钮 -->
          <label 
            v-if="uploadedFiles.length < 9"
            class="aspect-square rounded-lg border-2 border-dashed border-gray-200 flex flex-col items-center justify-center cursor-pointer hover:border-primary hover:bg-gray-50 transition-colors"
          >
            <input 
              type="file" 
              accept="image/*" 
              multiple 
              class="hidden"
              @change="handleFileSelect"
            >
            <svg class="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
            </svg>
            <span class="text-xs text-secondary mt-1">{{ t('upload.uploading', { count: '' }).replace('正在上传 个文件', '添加图片') }}</span>
          </label>
        </div>
        
        <p class="text-xs text-secondary mt-3">{{ t('order.form.uploadHint') }}</p>
      </div>

      <!-- 商品信息 -->
      <div class="bg-white rounded-xl border border-[var(--border-color)] p-4 space-y-4">
        <!-- 商品名称 -->
        <div>
          <label class="block text-sm font-medium text-primary mb-2">
            {{ t('order.form.productName') }} <span class="text-red-500">*</span>
          </label>
          <input 
            v-model="form.name"
            type="text"
            :placeholder="t('order.form.productNamePlaceholder')"
            class="w-full h-11 px-4 text-sm border border-[var(--border-color)] rounded-lg focus:border-primary focus:outline-none transition-colors"
            required
          >
        </div>

        <!-- 规格尺寸 -->
        <div>
          <label class="block text-sm font-medium text-primary mb-2">
            {{ t('order.form.size') }}
          </label>
          <input 
            v-model="form.size"
            type="text"
            :placeholder="t('order.form.sizePlaceholder')"
            class="w-full h-11 px-4 text-sm border border-[var(--border-color)] rounded-lg focus:border-primary focus:outline-none transition-colors"
          >
        </div>

        <!-- 颜色材质 -->
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-sm font-medium text-primary mb-2">
              {{ t('order.form.color') }}
            </label>
            <input 
              v-model="form.color"
              type="text"
              :placeholder="t('order.form.colorPlaceholder')"
              class="w-full h-11 px-4 text-sm border border-[var(--border-color)] rounded-lg focus:border-primary focus:outline-none transition-colors"
            >
          </div>
          <div>
            <label class="block text-sm font-medium text-primary mb-2">
              {{ t('order.form.material') }}
            </label>
            <input 
              v-model="form.material"
              type="text"
              :placeholder="t('order.form.materialPlaceholder')"
              class="w-full h-11 px-4 text-sm border border-[var(--border-color)] rounded-lg focus:border-primary focus:outline-none transition-colors"
            >
          </div>
        </div>

        <!-- 备注 -->
        <div>
          <label class="block text-sm font-medium text-primary mb-2">
            {{ t('order.form.remark') }}
          </label>
          <textarea 
            v-model="form.remark"
            rows="3"
            :placeholder="t('order.form.remarkPlaceholder')"
            class="w-full px-4 py-3 text-sm border border-[var(--border-color)] rounded-lg focus:border-primary focus:outline-none resize-none transition-colors"
          ></textarea>
        </div>

        <!-- 截止时间 -->
        <div>
          <label class="block text-sm font-medium text-primary mb-2">
            {{ t('order.form.deadline') }}
          </label>
          <input 
            v-model="form.deadline"
            type="date"
            class="w-full h-11 px-4 text-sm border border-[var(--border-color)] rounded-lg focus:border-primary focus:outline-none transition-colors"
          >
        </div>
      </div>

      <!-- 操作按钮 -->
      <div class="flex gap-3">
        <button 
          type="button"
          @click="$emit('cancel')"
          class="flex-1 h-12 border border-[var(--border-color)] text-secondary font-medium rounded-xl hover:bg-gray-50 transition-colors"
        >
          {{ t('common.cancel') }}
        </button>
        <button 
          type="submit"
          :disabled="!form.name || uploadedFiles.length === 0 || isSubmitting"
          class="flex-1 h-12 bg-primary text-white font-medium rounded-xl hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
        >
          <svg v-if="isSubmitting" class="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
          </svg>
          {{ isSubmitting ? t('order.form.submitting') : t('order.form.submit') }}
        </button>
      </div>
    </form>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { useToast } from '@/composables/useToast';

const emit = defineEmits(['submit', 'cancel']);

const { t } = useI18n();
const { addToast } = useToast();

const form = reactive({
  name: '',
  size: '',
  color: '',
  material: '',
  remark: '',
  deadline: ''
});

const uploadedFiles = ref([]);
const isSubmitting = ref(false);

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

// 上传图片到服务器
const uploadFile = async (file) => {
  const formData = new FormData();
  formData.append('file', file);

  // 从 URL 获取访问令牌
  const path = window.location.pathname;
  const match = path.match(/\/sales\/([^\/]+)/);
  const accessToken = match ? match[1] : '';

  const response = await fetch(`/api/sales/${accessToken}/upload`, {
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

// 选择文件
const handleFileSelect = async (e) => {
  const files = Array.from(e.target.files);
  if (!files.length) return;

  for (const file of files) {
    if (uploadedFiles.value.length >= 9) break;
    
    try {
      // 压缩图片
      const compressed = await compressImage(file);
      const compressedFile = new File([compressed], file.name, { type: 'image/jpeg' });
      
      // 上传
      const uploaded = await uploadFile(compressedFile);
      uploadedFiles.value.push({
        id: uploaded.id,
        id: uploaded.id,
        url: `/file/${uploaded.storage_key || uploaded.storageKey}`
      });
    } catch (err) {
      addToast({ message: t('uploadQueue.uploadFailed'), type: 'error' });
    }
  }

  // 清空 input
  e.target.value = '';
};

// 移除文件
const removeFile = (index) => {
  uploadedFiles.value.splice(index, 1);
};

// 提交表单
const handleSubmit = async () => {
  if (!form.name || uploadedFiles.value.length === 0 || isSubmitting.value) return;

  isSubmitting.value = true;
  try {
    await emit('submit', {
      ...form,
      fileIds: uploadedFiles.value.map(f => f.id)
    });
  } finally {
    isSubmitting.value = false;
  }
};
</script>
