<template>
  <div class="fixed inset-0 z-50 flex items-end lg:items-center justify-center bg-black/50" @click.self="$emit('close')">
    <!-- 移动端: 全屏底部抽屉 | 桌面端: 居中弹窗 -->
    <div class="bg-white w-full lg:rounded-2xl lg:max-w-5xl lg:mx-4 h-full lg:h-[90vh] flex flex-col lg:flex-row overflow-hidden rounded-t-2xl lg:rounded-t-2xl">
      
      <!-- 移动端: 顶部标签栏 -->
      <div class="lg:hidden flex items-center border-b border-[var(--border-color)] px-4 py-3">
        <button 
          @click="mobileTab = 'info'"
          class="flex-1 py-2 text-sm font-medium text-center border-b-2 transition-colors"
          :class="mobileTab === 'info' ? 'border-primary text-primary' : 'border-transparent text-secondary'"
        >{{ t('spaceManager.productInfo') }}</button>
        <button 
          @click="mobileTab = 'media'"
          class="flex-1 py-2 text-sm font-medium text-center border-b-2 transition-colors"
          :class="mobileTab === 'media' ? 'border-primary text-primary' : 'border-transparent text-secondary'"
        >{{ t('spaceManager.media') }}</button>
        <button 
          @click="$emit('close')"
          class="ml-2 p-2 text-muted hover:text-primary"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        </button>
      </div>

      <!-- 左侧：商品属性编辑器 (桌面端 | 移动端 info 标签) -->
      <div 
        class="flex-1 lg:w-1/3 border-r border-[var(--border-color)] flex flex-col bg-[var(--bg-muted)]"
        :class="{ 'hidden': mobileTab !== 'info' }"
        v-show="mobileTab === 'info' || isDesktop"
      >
        <div class="hidden lg:flex px-6 py-4 border-b border-[var(--border-color)] items-center justify-between">
          <div>
            <div class="flex items-center gap-2">
              <h2 class="text-lg font-semibold text-primary">{{ t('spaceManager.productInfo') }}</h2>
              <span v-if="form.isPublic" class="px-1.5 py-0.5 text-[10px] font-medium bg-[var(--color-success-bg)] text-[var(--color-success)] rounded-full">🌐 {{ t('spaceManager.publicOn') }}</span>
              <span v-else class="px-1.5 py-0.5 text-[10px] font-medium bg-[var(--bg-muted)] text-secondary rounded-full">🔒 {{ t('spaceManager.publicOff') }}</span>
            </div>
            <p class="text-xs text-secondary mt-1">{{ t('spaceManager.editParams') }}</p>
          </div>
        </div>
        
        <div class="flex-1 overflow-y-auto p-6 space-y-4">
          <div>
            <label class="block text-sm font-medium text-primary mb-1">{{ t('spaceManager.productName') }}</label>
            <input v-model="form.name" type="text" 
              class="w-full px-4 py-2 border border-[var(--border-color)] rounded-lg focus:border-primary outline-none">
          </div>
          
          <div>
            <label class="block text-sm font-medium text-primary mb-1">{{ t('spaceManager.brand') }}</label>
            <input v-model="form.templateData.brand" type="text" 
              class="w-full px-4 py-2 border border-[var(--border-color)] rounded-lg focus:border-primary outline-none">
          </div>

          <div>
            <label class="block text-sm font-medium text-primary mb-1">{{ t('spaceManager.series') }}</label>
            <input v-model="form.templateData.series" type="text" 
              class="w-full px-4 py-2 border border-[var(--border-color)] rounded-lg focus:border-primary outline-none">
          </div>
          
          <div class="grid grid-cols-2 gap-3">
             <div>
              <label class="block text-sm font-medium text-primary mb-1">{{ t('spaceManager.price') }}</label>
              <input v-model="form.templateData.price" type="number" 
                class="w-full px-4 py-2 border border-[var(--border-color)] rounded-lg focus:border-primary outline-none">
            </div>
             <div>
              <label class="block text-sm font-medium text-primary mb-1">{{ t('spaceManager.material') }}</label>
              <input v-model="form.templateData.material" type="text" 
                class="w-full px-4 py-2 border border-[var(--border-color)] rounded-lg focus:border-primary outline-none">
            </div>
          </div>

          <div>
            <label class="block text-sm font-medium text-primary mb-1">SKU</label>
            <input v-model="form.templateData.sku" type="text" 
              :placeholder="t('spaceManager.skuPlaceholder')"
              class="w-full px-4 py-2 border border-[var(--border-color)] rounded-lg focus:border-primary outline-none">
          </div>

          <div>
            <label class="block text-sm font-medium text-primary mb-1">{{ t('spaceManager.descLabel') }}</label>
            <textarea v-model="form.description" rows="4" 
              class="w-full px-4 py-2 border border-[var(--border-color)] rounded-lg focus:border-primary outline-none resize-none"></textarea>
          </div>
          
          <!-- SOTA Share Card -->
          <div class="pt-4 border-t border-[var(--border-color)]">
            <div class="bg-white rounded-xl border border-[var(--border-color)] p-4 shadow-sm">
              <div class="flex items-center justify-between mb-3">
                <div class="flex items-center gap-2">
                  <div class="w-8 h-8 rounded-lg" :class="form.isPublic ? 'bg-primary/10 text-primary' : 'bg-[var(--bg-muted)] text-secondary'">
                    <svg class="w-full h-full p-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/>
                    </svg>
                  </div>
                  <div>
                    <h4 class="text-sm font-semibold text-primary">{{ t('spaceManager.shareSettings') }}</h4>
                    <p class="text-[10px]" :class="form.isPublic ? 'text-[var(--color-success)]' : 'text-secondary'">
                      {{ form.isPublic ? t('spaceManager.publicOn') : t('spaceManager.shareCard.notPublic') }}
                    </p>
                  </div>
                </div>
                <!-- Toggle Switch -->
                <label class="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" v-model="form.isPublic" class="sr-only peer">
                  <div class="w-9 h-5 bg-[var(--color-gray-200)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                </label>
              </div>
              
              <!-- Share Information -->
              <div v-if="form.isPublic" class="space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
                <div class="px-3 py-2 bg-[var(--bg-muted)] rounded-lg text-xs font-mono text-primary break-all border border-[var(--border-color)]">
                  {{ shareUrl }}
                </div>
                <button @click.prevent="copyLink" class="w-full py-1.5 text-xs font-medium text-primary bg-primary/5 hover:bg-primary/10 rounded-lg transition-colors flex items-center justify-center gap-1.5">
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"/>
                  </svg>
                  {{ t('common.copy') }}
                </button>
                
                <!-- Password Lock -->
                <div class="border-t border-[var(--border-color)] pt-3">
                  <div class="flex items-center justify-between mb-2">
                    <div class="flex items-center gap-1.5">
                      <svg class="w-3.5 h-3.5 text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
                      </svg>
                      <span class="text-xs font-medium text-primary">{{ t('spaceManager.passwordLock') }}</span>
                    </div>
                    <label class="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" v-model="passwordEnabled" class="sr-only peer">
                      <div class="w-7 h-4 bg-[var(--color-gray-200)] rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-primary"></div>
                    </label>
                  </div>
                  <div v-if="passwordEnabled" class="flex gap-2">
                    <input v-model="form.password" type="text" 
                      class="flex-1 px-3 py-1.5 text-xs border border-[var(--border-color)] rounded-lg focus:border-primary outline-none"
                      :placeholder="t('spaceManager.setPassword')">
                  </div>
                </div>
              </div>
              <div v-else class="text-[10px] text-secondary text-center italic">
                {{ t('spaceManager.shareCard.publishHint') }}
              </div>
            </div>
          </div>
        </div>

        <div class="px-6 py-4 border-t border-[var(--border-color)] flex gap-3">
          <button @click="openPreview" 
            class="px-4 py-2 border border-[var(--border-color)] text-secondary hover:text-primary rounded-lg transition-colors flex items-center gap-1.5">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
            </svg>
            {{ t('spaceManager.preview') }}
          </button>
          <button @click="saveChanges" :disabled="saving"
            class="flex-1 py-2 bg-primary text-white rounded-lg hover:bg-[var(--color-primary-hover)] transition-colors disabled:opacity-50">
            {{ saving ? t('spaceManager.saving') : t('spaceManager.save') }}
          </button>
        </div>
      </div>

      <!-- 右侧：媒体资源管理 + 数据分析 (桌面端 | 移动端 media 标签) -->
      <div 
        class="flex-1 flex flex-col bg-white"
        :class="{ 'hidden lg:flex': mobileTab !== 'media' }"
        v-show="mobileTab === 'media' || isDesktop"
      >
        <!-- 右侧标签头 (桌面端) -->
        <div class="hidden lg:flex px-6 py-3 border-b border-[var(--border-color)] justify-between items-center">
          <div class="flex space-x-4">
            <button @click="activeRightTab = 'media'"
              class="px-1 py-2 text-sm font-medium border-b-2 transition-colors duration-200"
              :class="activeRightTab === 'media' ? 'border-primary text-primary' : 'border-transparent text-secondary hover:text-[var(--text-main)]'">
              {{ t('spaceManager.media') }}
            </button>
            <button @click="activeRightTab = 'analytics'"
              class="px-1 py-2 text-sm font-medium border-b-2 transition-colors duration-200"
              :class="activeRightTab === 'analytics' ? 'border-primary text-primary' : 'border-transparent text-secondary hover:text-[var(--text-main)]'">
              {{ t('spaceManager.tabs.analytics') }}
            </button>
          </div>
          <div class="flex gap-2">
            <Tooltip v-if="activeRightTab === 'media'" :content="t('spaceManager.addFile')">
              <button @click="showFileSelector = true" 
                class="w-8 h-8 flex items-center justify-center bg-[var(--bg-muted)] text-primary hover:bg-[var(--bg-hover)] rounded-lg text-sm font-medium transition-colors">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
                </svg>
              </button>
            </Tooltip>
             <button @click="$emit('close')" 
              class="p-2 text-secondary hover:text-primary rounded-lg hover:bg-[var(--bg-hover)]">
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </button>
          </div>
        </div>
        
        <!-- 移动端顶部操作栏 -->
        <div class="lg:hidden px-4 py-3 border-b border-[var(--border-color)] flex justify-between items-center">
          <span class="text-sm font-medium text-primary">{{ t('spaceManager.media') }}</span>
          <button @click="showFileSelector = true" 
            class="flex items-center gap-1 px-3 py-1.5 bg-primary text-white text-xs rounded-lg">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
            </svg>
            {{ t('spaceManager.addFile') }}
          </button>
        </div>
        
        <!-- 媒体标签内容 -->
        <div v-show="activeRightTab === 'media' || !isDesktop" class="flex-1 overflow-y-auto p-4 lg:p-6">
          <div v-if="files.length > 0" class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 lg:gap-4">
            <div v-for="file in files" :key="file.id" 
              class="group relative aspect-square bg-[var(--bg-muted)] rounded-xl border border-[var(--border-color)] overflow-hidden">
               <img v-if="isImage(file)" :src="file.url" class="w-full h-full object-cover" loading="lazy">
               <div v-else class="w-full h-full flex flex-col items-center justify-center p-4">
                  <span class="text-xs font-bold text-muted uppercase mb-2">{{ file.name?.split('.').pop() }}</span>
                  <span class="text-xs text-center text-secondary line-clamp-2">{{ file.originalName || file.name }}</span>
               </div>
               
               <!-- 操作遮罩 -->
               <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                 <button @click="setCover(file)" :title="t('spaceManager.setCover')"
                   class="p-2 bg-white/90 rounded-full hover:bg-white text-secondary">
                   <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                     <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                   </svg>
                 </button>
                 <button @click="removeFile(file.id)" :title="t('spaceManager.remove')"
                   class="p-2 bg-white/90 rounded-full hover:bg-white text-[var(--color-danger)]">
                   <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                     <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                   </svg>
                 </button>
               </div>
               
               <!-- 封面标记 -->
               <div v-if="form.coverFileId === file.id" 
                 class="absolute top-2 left-2 px-2 py-0.5 bg-primary text-white text-[10px] rounded-full">
                 {{ t('spaceManager.cover') }}
               </div>
            </div>
          </div>
          <div v-else class="h-full flex flex-col items-center justify-center text-secondary">
            <svg class="w-16 h-16 text-[var(--border-color)] mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
            </svg>
            <p>{{ t('spaceManager.emptyMedia') }}</p>
            <button @click="showFileSelector = true" class="mt-4 text-primary text-sm hover:underline">{{ t('spaceManager.addMediaHint') }}</button>
          </div>
        </div>
        
        <!-- 数据分析标签内容 -->
        <div v-show="activeRightTab === 'analytics'" class="flex-1 overflow-y-auto p-6">
          <SpaceAnalytics :spaceId="space.id" />
        </div>
      </div>
    </div>

    <FileSelector v-if="showFileSelector" @close="showFileSelector = false" @select="addFiles" />

    <!-- Confirm Dialog -->
    <ConfirmDialog
      v-model="confirmData.show"
      :title="confirmData.title"
      :message="confirmData.message"
      :type="confirmData.type"
      :loading="confirmData.loading"
      @confirm="confirmData.onConfirm"
    />
  </div>
</template>

<script setup>
import { ref, watch, onMounted, computed } from 'vue';
import { useSpaces } from '@/composables/useSpaces';
import { useToast } from '@/composables/useToast';
import { useI18n } from '@/composables/useI18n';
import { isImage } from '@/utils/formatters';
import { ROUTES } from '@/utils/constants';
import FileSelector from '@/components/FileSelector.vue';
import Tooltip from '@/components/ui/Tooltip.vue';
import SpaceAnalytics from './SpaceAnalytics.vue';
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue';

const props = defineProps({
  space: { type: Object, required: true }
});

const emit = defineEmits(['close', 'updated']);

const { updateSpace, addFilesToSpace, removeFilesFromSpace, loadSpace } = useSpaces();
const { addToast } = useToast();
const { t } = useI18n();

const showFileSelector = ref(false);
const saving = ref(false);
const files = ref([]);
const activeRightTab = ref('media');
const passwordEnabled = ref(false);
const mobileTab = ref('info');
const isDesktop = ref(window.innerWidth >= 1024);

// 确认弹窗状态
const confirmData = ref({
  show: false,
  title: '',
  message: '',
  type: 'primary',
  loading: false,
  onConfirm: () => {}
});

const form = ref({
  name: '',
  description: '',
  isPublic: false,
  coverFileId: null,
  password: '',
  templateData: {
    brand: '',
    series: '',
    price: '',
    material: '',
    sku: ''
  }
});

const shareUrl = computed(() => {
  if (!props.space.shareToken) return t('spaceManager.saveToGenerate');
  return `${window.location.origin}${ROUTES.SPACE(props.space.shareToken)}`;
});

const initData = async () => {
  const data = await loadSpace(props.space.id);
  // ... (rest of initData)
};

// ...

const openPreview = () => {
  if (props.space.shareToken) {
    window.open(ROUTES.SPACE(props.space.shareToken), '_blank');
  } else {
    addToast({ message: t('spaceManager.saveFirst'), type: 'warning' });
  }
};

const addFiles = async (fileIds) => {
  showFileSelector.value = false;
  await addFilesToSpace(props.space.id, fileIds);
  await initData();
  emit('updated');
};

const removeFile = (fileId) => {
  confirmData.value = {
    show: true,
    title: t('common.confirm'),
    message: t('spaceManager.removeFileConfirm'),
    type: 'danger',
    loading: false,
    onConfirm: async () => {
      confirmData.value.loading = true;
      try {
        await removeFilesFromSpace(props.space.id, [fileId]);
        await initData();
        emit('updated');
        confirmData.value.show = false;
      } finally {
        confirmData.value.loading = false;
      }
    }
  };
};

const setCover = (file) => {
  form.value.coverFileId = file.id;
  addToast({ message: t('spaceManager.coverSet'), type: 'success' });
};

onMounted(initData);
</script>
