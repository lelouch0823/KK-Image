<template>
  <div class="min-h-screen font-sans antialiased text-[var(--text-main)] bg-[var(--bg-page)]">
    
    <!-- 加载状态 -->
    <div v-if="loading" class="min-h-screen flex items-center justify-center">
      <div class="text-center">
        <div class="w-12 h-12 border-4 border-gray-200 border-t-primary rounded-full animate-spin mx-auto mb-4"></div>
        <p class="text-secondary">{{ t('gallery.loading') }}</p>
      </div>
    </div>

    <!-- 密码验证 -->
    <PasswordGate 
      v-else-if="requiresPassword"
      :title="t('gallery.passwordRequired')"
      :subtitle="t('gallery.passwordProtected')"
      :placeholder="t('gallery.enterPassword')"
      :button-text="t('gallery.confirm')"
      :loading="verifying"
      :error="passwordError"
      @submit="submitPassword"
    />

    <!-- 错误状态 -->
    <div v-else-if="error" class="min-h-screen flex items-center justify-center px-4">
      <div class="text-center">
        <div class="w-20 h-20 mx-auto mb-6 bg-red-50 rounded-full flex items-center justify-center">
          <svg class="w-10 h-10 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
          </svg>
        </div>
        <h2 class="text-xl font-semibold text-primary mb-2">{{ t('gallery.cannotLoad') }}</h2>
        <p class="text-secondary">{{ error }}</p>
      </div>
    </div>

    <!-- 相册内容 -->
    <template v-else-if="album">
      <!-- Header -->
      <header class="sticky top-0 z-40 bg-white/95 backdrop-blur-sm border-b border-[var(--border-color)]">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div>
            <h1 class="text-xl font-semibold text-primary px-1">{{ album.name }}</h1>
            <p class="text-sm text-secondary mt-0.5 px-1">{{ t('gallery.files', { count: album.fileCount }) }}</p>
          </div>
          <div class="flex items-center gap-3">
            <button @click="shareAlbum"
              class="flex items-center gap-2 px-4 py-2 text-sm font-medium text-secondary border border-[var(--border-color)] rounded-lg hover:bg-[var(--bg-muted)] transition-colors">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"></path>
              </svg>
              {{ t('gallery.share') }}
            </button>
          </div>
        </div>
      </header>

      <!-- Description -->
      <div v-if="album.description" class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <p class="text-secondary text-sm bg-gray-50 p-4 rounded-xl border border-[var(--border-color)]">{{ album.description }}</p>
      </div>

      <!-- File Grid -->
      <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-20">
        <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          <div v-for="(file, index) in album.files" :key="file.id" @click="openFile(file, index)"
            class="aspect-square rounded-xl overflow-hidden cursor-pointer group relative bg-gray-100 border border-[var(--border-color)] hover:border-gray-300 transition-colors shadow-sm hover:shadow-md">
            <!-- 图片 -->
            <img v-if="file.type === 'image'" :src="file.thumbnailUrl || file.url" :alt="file.name"
              class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
              loading="lazy" 
              @error="handleImgError">

            <!-- PDF -->
            <div v-else-if="file.type === 'pdf'"
              class="w-full h-full flex flex-col items-center justify-center text-secondary bg-gray-50">
              <svg class="w-12 h-12 mb-2 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
              </svg>
              <span class="text-xs font-medium bg-white px-2 py-1 rounded border border-gray-200 shadow-sm">PDF</span>
            </div>

            <!-- 其他文件 -->
            <div v-else class="w-full h-full flex flex-col items-center justify-center text-secondary bg-gray-50">
              <svg class="w-12 h-12 mb-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path>
              </svg>
              <span class="text-xs font-medium uppercase bg-white px-2 py-1 rounded border border-gray-200 shadow-sm">{{ file.name.split('.').pop() }}</span>
            </div>

            <!-- Hover Overlay -->
            <div class="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3">
              <span class="text-white text-xs font-medium truncate w-full">{{ file.name }}</span>
            </div>
          </div>
        </div>

        <!-- Empty State -->
        <EmptyState 
          v-if="album.files.length === 0"
          icon="image"
          :title="t('gallery.noFiles')"
          :description="t('gallery.noFilesDesc')"
        />
      </main>

      <!-- Footer -->
      <footer class="py-8 text-center text-sm text-secondary border-t border-[var(--border-color)] bg-white">
        <a href="/" class="hover:text-primary transition-colors">{{ t('gallery.poweredBy') }}</a>
      </footer>
    </template>

    <!-- Lightbox 组件 -->
    <Lightbox 
      :visible="lightbox.visible"
      :current-file="lightbox.file"
      :current-index="lightbox.index"
      :total="album?.files?.length || 0"
      @close="closeLightbox"
      @prev="prevFile"
      @next="nextFile"
    />
    
    <!-- Toast -->
    <ToastContainer />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useToast } from '@/composables/useToast';
import { useI18n } from '@/composables/useI18n';
import { useClipboard } from '@/composables/useClipboard';
import ToastContainer from '@/components/ui/ToastContainer.vue';
import Lightbox from '@/components/ui/Lightbox.vue';
import PasswordGate from '@/components/common/PasswordGate.vue';
import EmptyState from '@/components/ui/EmptyState.vue';
import { API } from '@/utils/constants';

const { addToast } = useToast();
const { t } = useI18n();
const { copy } = useClipboard();

const loading = ref(true);
const verifying = ref(false);
const error = ref('');
const album = ref(null);
const requiresPassword = ref(false);
const passwordError = ref('');
const lightbox = ref({ visible: false, file: null, index: 0 });

// 从 URL 获取分享令牌
const getShareToken = () => {
  const path = window.location.pathname;
  const match = path.match(/\/gallery\/([^\/]+)/);
  return match ? match[1] : null;
};

// 加载相册
const loadAlbum = async (pwd = null) => {
  const token = getShareToken();
  if (!token) {
    error.value = t('gallery.invalidLink');
    loading.value = false;
    return;
  }

  try {
    let url = API.PUBLIC_GALLERY(token);
    if (pwd) url += `?password=${encodeURIComponent(pwd)}`;

    const response = await fetch(url);
    const result = await response.json();

    if (result.success) {
      // Normalize files
      const files = result.data.files.map(f => {
        const isImg = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(f.name.split('.').pop().toLowerCase());
        const isPdf = f.name.toLowerCase().endsWith('.pdf');
        return {
          ...f,
          type: isImg ? 'image' : (isPdf ? 'pdf' : 'other'),
          thumbnailUrl: f.url
        };
      });
      
      album.value = { ...result.data, files };
      document.title = `${result.data.name} | KK-Image`;
      requiresPassword.value = false;
    } else if (result.requiresPassword) {
      requiresPassword.value = true;
    } else {
      error.value = result.message || t('gallery.loadFailed');
    }
  } catch (e) {
    error.value = t('gallery.networkError');
  } finally {
    loading.value = false;
    verifying.value = false;
  }
};

const submitPassword = async (pwd) => {
  if (!pwd) {
    passwordError.value = t('gallery.enterPasswordFirst');
    return;
  }
  passwordError.value = '';
  verifying.value = true;
  await loadAlbum(pwd);
  if (requiresPassword.value) {
    passwordError.value = t('gallery.passwordError');
  }
};

const openFile = (file, index) => {
  lightbox.value = { visible: true, file, index };
  document.body.style.overflow = 'hidden';
};

const closeLightbox = () => {
  lightbox.value.visible = false;
  document.body.style.overflow = '';
};

const prevFile = () => {
  if (lightbox.value.index > 0) {
    lightbox.value.index--;
    lightbox.value.file = album.value.files[lightbox.value.index];
  }
};

const nextFile = () => {
  if (lightbox.value.index < album.value.files.length - 1) {
    lightbox.value.index++;
    lightbox.value.file = album.value.files[lightbox.value.index];
  }
};

const shareAlbum = async () => {
  await copy(window.location.href, {
    successMessage: t('gallery.linkCopied'),
    errorMessage: t('gallery.copyFailed')
  });
};

const handleImgError = (e) => {
  e.target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIGZpbGw9IiNGMEYwRjAiLz48L3N2Zz4=';
};

onMounted(() => {
  loadAlbum();
});
</script>
