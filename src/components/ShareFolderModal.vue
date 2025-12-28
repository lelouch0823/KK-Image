<template>
  <div v-if="modelValue" class="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
    <div class="bg-white rounded-xl shadow-xl w-full max-w-md flex flex-col animate-in fade-in zoom-in duration-200">
      
      <!-- Header -->
      <div class="px-6 py-4 border-b border-[var(--border-color)] flex items-center justify-between">
        <h3 class="text-lg font-semibold text-primary">{{ t('share.titleFolder') }}</h3>
        <button @click="close" class="text-secondary hover:text-primary transition-colors">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        </button>
      </div>

      <!-- Content -->
      <div class="p-6">
         <!-- Folder Info -->
         <div class="flex items-center gap-3 mb-6 p-3 bg-[var(--bg-muted)] rounded-lg border border-[var(--border-color)]">
             <div class="p-2 bg-white rounded-md shadow-sm">
                 <svg class="w-6 h-6 text-[var(--color-warning)]" fill="currentColor" viewBox="0 0 20 20">
                     <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z"></path>
                 </svg>
             </div>
             <div>
                 <div class="font-medium text-primary">{{ folder?.name }}</div>
                 <div class="text-xs text-secondary">{{ t('fileManager.totalFiles', { count: folder?.fileCount || 0 }) }}</div>
             </div>
         </div>

         <!-- 🔧 NEW: 显示已有分享链接 -->
         <div v-if="existingShareUrl && !shareUrl" class="mb-6 p-4 bg-[var(--color-info-bg)] rounded-lg border border-blue-100">
             <div class="flex items-center justify-between mb-2">
                 <span class="text-sm font-medium text-[var(--color-info-text)]">{{ t('share.existingLink') }}</span>
                 <span class="text-xs text-[var(--color-info)]">{{ formatExpiry(folder?.shareExpiresAt) }}</span>
             </div>
             <div class="flex gap-2">
                 <input type="text" readonly :value="existingShareUrl" class="input flex-1 text-sm bg-white" @click="$event.target.select()">
                 <Tooltip :content="t('share.copyLink')">
                     <button @click="copyExistingLink" class="w-9 h-9 flex items-center justify-center bg-white border border-[var(--border-color)] rounded-lg hover:bg-gray-50 text-secondary hover:text-[var(--color-info)] transition-colors">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"></path></svg>
                     </button>
                 </Tooltip>
             </div>
             <p class="text-xs text-[var(--color-info)] mt-2" v-if="existingCopied">✓ {{ t('share.copiedClipboard') }}</p>
             <div class="mt-3 pt-3 border-t border-blue-100 flex justify-between items-center">
                 <span class="text-xs text-[var(--color-info)] opacity-80">{{ t('share.needUpdateExpiry') }}</span>
                 <button @click="showExpiryOptions = true" class="text-xs text-[var(--color-info-text)] hover:underline font-medium">{{ t('share.regenerate') }}</button>
             </div>
         </div>

         <!-- Expiration Options -->
         <div v-if="!existingShareUrl || showExpiryOptions" class="mb-6">
             <label class="text-sm font-medium text-primary mb-3 block">{{ t('share.expiration') }}</label>
             <div class="grid grid-cols-3 gap-3">
                 <button 
                    v-for="opt in options" :key="opt.value"
                    @click="expiry = opt.value"
                    class="px-3 py-2 text-sm border rounded-lg transition-all text-center"
                    :class="expiry === opt.value ? 'border-primary bg-[var(--color-primary-bg)] text-primary font-medium ring-1 ring-primary' : 'border-[var(--border-color)] text-secondary hover:border-gray-300'"
                 >
                    {{ opt.label }}
                 </button>
             </div>
         </div>

         <!-- Generated Link -->
         <div v-if="shareUrl" class="mb-4">
             <label class="text-sm font-medium text-primary mb-2 block">{{ t('share.generate') }}</label>
             <div class="flex gap-2">
                 <input type="text" readonly :value="shareUrl" class="input flex-1 text-sm bg-[var(--bg-muted)]" @click="$event.target.select()">
                 <Tooltip :content="t('common.copy')">
                     <button @click="copyLink" class="w-9 h-9 flex items-center justify-center bg-white border border-[var(--border-color)] rounded-lg hover:bg-[var(--bg-hover)] text-secondary hover:text-[var(--color-success)] transition-colors">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"></path></svg>
                     </button>
                 </Tooltip>
             </div>
             <p class="text-xs text-[var(--color-success)] mt-2 flex items-center" v-if="copied">
                 <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
                 {{ t('share.copiedClipboard') }}
             </p>
         </div>
      </div>

      <!-- Footer -->
      <div class="px-6 py-4 border-t border-[var(--border-color)] flex justify-end bg-[var(--bg-muted)] rounded-b-xl gap-3">
        <button v-if="existingShareUrl && !showExpiryOptions && !shareUrl" @click="close" class="btn btn-primary w-full sm:w-auto">{{ t('common.complete') }}</button>
        <button v-else-if="!shareUrl" @click="generateLink" :disabled="loading" class="btn btn-primary w-full sm:w-auto">
            <span v-if="loading" class="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></span>
            {{ existingShareUrl ? t('share.update') : t('share.generate') }}
        </button>
        <button v-else @click="close" class="btn btn-primary w-full sm:w-auto">{{ t('common.complete') }}</button>
      </div>

    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { useToast } from '@/composables/useToast';
import { useAuth } from '@/composables/useAuth';
import { API, ROUTES } from '@/utils/constants';
import { formatExpiry } from '@/utils/formatters';
import { useI18n } from '@/composables/useI18n';
import Tooltip from '@/components/ui/Tooltip.vue';

const props = defineProps({
  modelValue: Boolean,
  folder: Object
});

const emit = defineEmits(['update:modelValue', 'updated']);

const { success, error } = useToast();
const { getHeaders } = useAuth();
const { t } = useI18n();

const loading = ref(false);
const expiry = ref(7);
const shareUrl = ref('');
const copied = ref(false);
const existingCopied = ref(false);
const showExpiryOptions = ref(false);

const options = computed(() => [
    { label: t('share.days7'), value: 7 },
    { label: t('share.days30'), value: 30 },
    { label: t('share.permanent'), value: 0 }
]);

// 🔧 NEW: 计算已有分享链接
const existingShareUrl = computed(() => {
    if (!props.folder?.shareToken) return '';
    return `${window.location.origin}${ROUTES.GALLERY(props.folder.shareToken)}`;
});

const close = () => {
    emit('update:modelValue', false);
    shareUrl.value = '';
    copied.value = false;
    existingCopied.value = false;
    showExpiryOptions.value = false;
};

const generateLink = async () => {
    if (!props.folder) return;
    loading.value = true;
    
    try {
        let timestamp = null;
        if (expiry.value > 0) {
            timestamp = Date.now() + (expiry.value * 24 * 60 * 60 * 1000);
        }

        const res = await fetch(API.FOLDER_BY_ID(props.folder.id), {
            method: 'PUT',
            headers: getHeaders(true),
            body: JSON.stringify({
                shareExpiresAt: timestamp,
                isPublic: true
            })
        }).then(r => r.json());

        if (res.success) {
            shareUrl.value = window.location.origin + res.data.shareUrl;
            emit('updated');
        } else {
            error(res.message || t('share.generateFailed'));
        }
    } catch (e) {
        error(t('share.networkError') || '网络错误');
    } finally {
        loading.value = false;
    }
};

const copyLink = () => {
    if (!shareUrl.value) return;
    navigator.clipboard.writeText(shareUrl.value).then(() => {
        copied.value = true;
        setTimeout(() => copied.value = false, 2000);
        success(t('share.linkCopied'));
    });
};

const copyExistingLink = () => {
    if (!existingShareUrl.value) return;
    navigator.clipboard.writeText(existingShareUrl.value).then(() => {
        existingCopied.value = true;
        setTimeout(() => existingCopied.value = false, 2000);
        success(t('share.linkCopied'));
    });
};

watch(() => props.modelValue, (val) => {
    if (val) {
        shareUrl.value = '';
        showExpiryOptions.value = false;
    }
});
</script>
