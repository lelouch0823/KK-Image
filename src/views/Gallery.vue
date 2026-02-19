<template>
  <div class="min-h-screen bg-[var(--bg-page)] font-sans text-[var(--text-main)] antialiased">
    <!-- 加载状态 -->
    <div v-if="loading" class="flex min-h-screen items-center justify-center">
      <div class="text-center">
        <div
          class="mx-auto mb-4 size-12 animate-spin rounded-full border-4 border-[var(--border-color)] border-t-[var(--color-primary)]"
        ></div>
        <p class="text-[var(--text-secondary)]">{{ t('gallery.loading') }}</p>
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
    <div v-else-if="error" class="flex min-h-screen items-center justify-center px-4">
      <EmptyState
        icon="search"
        :title="t('gallery.cannotLoad')"
        :description="error"
      />
    </div>

    <!-- 相册内容 -->
    <template v-else-if="album">
      <!-- Header -->
      <header
        class="sticky top-0 z-40 border-b border-[var(--border-color)] bg-[var(--bg-card)]/95 backdrop-blur-sm"
      >
        <div class="mx-auto flex max-w-7xl items-center justify-between p-4 sm:px-6 lg:px-8">
          <div>
            <h1 class="px-1 text-xl font-semibold text-[var(--text-main)]">{{ album.name }}</h1>
            <p class="mt-0.5 px-1 text-sm text-[var(--text-secondary)]">
              {{ t('gallery.files', { count: album.fileCount }) }}
            </p>
          </div>
          <div class="flex items-center gap-3">
            <AppButton
              variant="secondary"
              size="sm"
              :text="t('gallery.share')"
              @click="shareAlbum"
            >
              <template #icon-left>
                <svg class="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"></path></svg>
              </template>
            </AppButton>
          </div>
        </div>
      </header>

      <!-- Description -->
      <div v-if="album.description" class="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <p
          class="rounded-xl border border-[var(--border-color)] bg-[var(--bg-muted)] p-4 text-sm text-[var(--text-secondary)]"
        >
          {{ album.description }}
        </p>
      </div>

      <!-- File Grid -->
      <main class="mx-auto max-w-7xl px-4 py-6 pb-20 sm:px-6 lg:px-8">
        <div
          class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
        >
          <div
            v-for="(file, index) in album.files"
            :key="file.id"
            class="group relative aspect-square cursor-pointer overflow-hidden rounded-xl border border-[var(--border-color)] bg-[var(--bg-muted)] shadow-sm transition-colors hover:border-[var(--border-hover)] hover:shadow-md"
            @click="openFile(file, index)"
          >
            <!-- 图片 -->
            <AppImage
              v-if="file.type === 'image'"
              :src="file.thumbnailUrl || file.url"
              :alt="file.name"
              class="size-full transition-transform duration-500 group-hover:scale-110"
              rounded="none"
            />

            <!-- PDF -->
            <div
              v-else-if="file.type === 'pdf'"
              class="flex size-full flex-col items-center justify-center bg-[var(--bg-muted)] text-[var(--text-secondary)]"
            >
              <svg
                class="mb-2 size-12 text-[var(--color-danger)]"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="1.5"
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                ></path>
              </svg>
              <span
                class="rounded border border-[var(--border-color)] bg-[var(--bg-card)] px-2 py-1 text-xs font-medium shadow-sm"
                >PDF</span
              >
            </div>

            <!-- 其他文件 -->
            <div
              v-else
              class="flex size-full flex-col items-center justify-center bg-[var(--bg-muted)] text-[var(--text-secondary)]"
            >
              <svg
                class="mb-2 size-12 text-[var(--text-muted)]"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="1.5"
                  d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                ></path>
              </svg>
              <span
                class="rounded border border-[var(--border-color)] bg-[var(--bg-card)] px-2 py-1 text-xs font-medium uppercase shadow-sm"
                >{{ file.name.split('.').pop() }}</span
              >
            </div>

            <!-- Hover Overlay -->
            <div
              class="absolute inset-0 flex items-end bg-gradient-to-t from-black/60 via-transparent to-transparent p-3 opacity-0 transition-opacity group-hover:opacity-100"
            >
              <span class="w-full truncate text-xs font-medium text-white">{{ file.name }}</span>
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
      <footer
        class="border-t border-[var(--border-color)] bg-[var(--bg-card)] py-8 text-center text-sm text-[var(--text-secondary)]"
      >
        <a href="/" class="transition-colors hover:text-[var(--color-primary)]">{{ t('gallery.poweredBy') }}</a>
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
  </div>
</template>

<script setup>
import { ref, onMounted, computed, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useI18n } from '@/composables/useI18n';
import { useClipboard } from '@/composables/useClipboard';
import Lightbox from '@/components/ui/Lightbox.vue';
import PasswordGate from '@/components/common/PasswordGate.vue';
import EmptyState from '@/components/ui/EmptyState.vue';
import AppImage from '@/components/ui/AppImage.vue';
import { API, APP_NAME } from '@/utils/constants';
import { isImage } from '@/utils/formatters';

const { t } = useI18n();
const { copy } = useClipboard();
const route = useRoute();

const loading = ref(true);
const verifying = ref(false);
const error = ref('');
const album = ref(null);
const requiresPassword = ref(false);
const passwordError = ref('');
const lightbox = ref({ visible: false, file: null, index: 0 });

// 从路由获取 Token
const token = computed(() => route.params.token);

// 加载相册
const loadAlbum = async (pwd = null) => {
  if (!token.value) {
    error.value = t('gallery.invalidLink');
    loading.value = false;
    return;
  }

  try {
    let url = API.PUBLIC_GALLERY(token.value);
    if (pwd) url += `?password=${encodeURIComponent(pwd)}`;

    const response = await fetch(url);
    const result = await response.json();

    if (result.success) {
      // 使用工具函数规范化文件类型
      const files = result.data.files.map((f) => {
        const ext = f.name.split('.').pop().toLowerCase();
        return {
          ...f,
          type: isImage(f) ? 'image' : ext === 'pdf' ? 'pdf' : 'other',
          thumbnailUrl: f.url,
        };
      });

      album.value = { ...result.data, files };
      document.title = `${result.data.name} | ${APP_NAME}`;
      requiresPassword.value = false;
    } else if (result.requiresPassword) {
      requiresPassword.value = true;
    } else {
      error.value = result.message || t('gallery.loadFailed');
    }
  } catch (_e) {
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
    errorMessage: t('gallery.copyFailed'),
  });
};

// const handleImgError - Removed as handled by AppImage

// 监听 Token 变化 (处理 SPA 同组件跳转)
watch(token, () => {
  loading.value = true;
  album.value = null;
  loadAlbum();
});

onMounted(() => {
  loadAlbum();
});
</script>
