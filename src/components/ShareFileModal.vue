
<template>
  <div v-if="modelValue" class="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
    <div class="bg-white rounded-xl shadow-xl w-full max-w-md flex flex-col animate-in fade-in zoom-in duration-200">
      
      <!-- Header -->
      <div class="px-6 py-4 border-b border-[var(--border-color)] flex items-center justify-between">
        <h3 class="text-lg font-semibold text-primary">分享文件</h3>
        <button @click="close" class="text-secondary hover:text-primary transition-colors">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        </button>
      </div>

      <!-- Content -->
      <div class="p-6">
         <!-- File Info -->
         <div class="flex items-center gap-3 mb-6 p-3 bg-gray-50 rounded-lg border border-[var(--border-color)]">
             <div class="p-2 bg-white rounded-md shadow-sm border border-gray-100">
                 <!-- Image Preview if applicable -->
                 <img v-if="isImage(file)" :src="file.url" class="w-8 h-8 object-cover rounded" />
                 <div v-else class="w-8 h-8 flex items-center justify-center bg-gray-100 rounded text-xs font-bold text-gray-500">
                    {{ getFileExtension(file?.name) }}
                 </div>
             </div>
             <div class="overflow-hidden">
                 <div class="font-medium text-primary truncate" :title="file?.name">{{ file?.name }}</div>
                 <div class="text-xs text-secondary">{{ formatSize(file?.size) }}</div>
             </div>
         </div>

         <!-- Link Section -->
         <div class="mb-4">
             <label class="text-sm font-medium text-primary mb-2 block">文件直链 (永久有效)</label>
             <div class="flex gap-2">
                 <input type="text" readonly :value="shareUrl" class="input flex-1 text-sm bg-gray-50" @click="$event.target.select()">
                 <button @click="copyLink" class="btn btn-secondary whitespace-nowrap">
                     <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"></path></svg>
                     复制
                 </button>
             </div>
             <p class="text-xs text-green-600 mt-2 flex items-center" v-if="copied">
                 <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
                 已复制到剪贴板
             </p>
         </div>
      </div>

      <!-- Footer -->
      <div class="px-6 py-4 border-t border-[var(--border-color)] flex justify-end bg-gray-50 rounded-b-xl">
        <button @click="close" class="btn btn-primary w-full sm:w-auto">完成</button>
      </div>

    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { useToast } from '@/composables/useToast';
import { formatSize, getFileExtension } from '@/utils/formatters';
import { IMAGE_EXTENSIONS } from '@/utils/constants';

const props = defineProps({
  modelValue: Boolean,
  file: Object
});

const emit = defineEmits(['update:modelValue']);
const { success } = useToast();

const copied = ref(false);

const shareUrl = computed(() => {
    if (!props.file) return '';
    return `${window.location.origin}${props.file.url}`;
});

const isImage = (file) => {
    if (!file) return false;
    const ext = getFileExtension(file.name).toLowerCase();
    return IMAGE_EXTENSIONS.includes(ext);
};

const close = () => {
    emit('update:modelValue', false);
    copied.value = false;
};

const copyLink = () => {
    if (!shareUrl.value) return;
    navigator.clipboard.writeText(shareUrl.value).then(() => {
        copied.value = true;
        setTimeout(() => copied.value = false, 2000);
        success('链接已复制');
    });
};
</script>
