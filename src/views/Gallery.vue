<template>
  <div class="min-h-screen bg-(--bg-page) font-sans text-(--text-main) antialiased">
    <!-- 加载状态 -->
    <div v-if="loading" class="flex min-h-[70vh] items-center justify-center">
      <div class="text-center">
        <div
          class="mx-auto mb-4 flex size-10 items-center justify-center rounded-xl bg-(--color-primary-bg)"
        >
          <AppIcon name="photo" class="size-5 text-primary animate-pulse" />
        </div>
        <p class="text-sm text-(--text-muted)">{{ t('gallery.loading') }}</p>
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
    <div v-else-if="error" class="flex min-h-[70vh] items-center justify-center px-4">
      <EmptyState icon="search" :title="t('gallery.cannotLoad')" :description="error" />
    </div>

    <!-- 相册内容 -->
    <template v-else-if="album">
      <PublicViewerShell
        :title="album.name"
        :description="t('gallery.files', { count: album.fileCount })"
      >
        <template #actions>
          <AppButton variant="secondary" size="sm" :text="t('gallery.share')" @click="shareAlbum">
            <template #icon-left>
              <AppIcon name="share" class="size-4" />
            </template>
          </AppButton>
        </template>

        <!-- Description -->
        <div v-if="album.description" class="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <p
            class="rounded-2xl border border-(--border-color) bg-(--bg-muted) p-4 text-sm text-(--text-secondary)"
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
              class="group relative aspect-square cursor-pointer overflow-hidden rounded-2xl border border-(--border-color) bg-(--bg-muted) shadow-sm transition-colors hover:border-(--border-hover) hover:shadow-md"
              @click="openFile(file, index)"
            >
              <!-- 图片 -->
              <AppImage
                v-if="file.type === 'image'"
                :src="file.thumbnailUrl || file.url"
                :alt="file.name"
                class="size-full transition-transform duration-300 ease-out-expo group-hover:scale-105"
                rounded="none"
              />

              <!-- PDF -->
              <div
                v-else-if="file.type === 'pdf'"
                class="flex size-full flex-col items-center justify-center bg-(--bg-muted) text-(--text-secondary)"
              >
                <AppIcon name="document-text" class="text-danger mb-2 size-12" />
                <span
                  class="rounded border border-(--border-color) bg-(--bg-card) px-2 py-1 text-xs font-medium shadow-sm"
                  >PDF</span
                >
              </div>

              <!-- 其他文件 -->
              <div
                v-else
                class="flex size-full flex-col items-center justify-center bg-(--bg-muted) text-(--text-secondary)"
              >
                <AppIcon name="document" class="mb-2 size-12 text-(--text-muted)" />
                <span
                  class="rounded border border-(--border-color) bg-(--bg-card) px-2 py-1 text-xs font-medium uppercase shadow-sm"
                  >{{ file.name.split('.').pop() }}</span
                >
              </div>

              <!-- Hover Overlay -->
              <div
                class="absolute inset-0 flex items-end p-3 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
                style="background: linear-gradient(to top, var(--color-overlay-dim), transparent)"
              >
                <span class="w-full truncate text-xs font-medium text-(--text-inverse)">{{
                  file.name
                }}</span>
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
          class="border-t border-(--border-subtle) bg-(--bg-card) py-6 text-center text-xs text-(--text-muted)"
        >
          <a href="/" class="transition-colors hover:text-(--text-secondary)">{{
            t('gallery.poweredBy')
          }}</a>
        </footer>
      </PublicViewerShell>
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
import { ref, onMounted, onBeforeUnmount, computed, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useI18n } from '@/composables/useI18n';
import { useClipboard } from '@/composables/useClipboard';
import Lightbox from '@/components/ui/Lightbox.vue';
import AppIcon from '@/components/ui/AppIcon.vue';
import PasswordGate from '@/components/common/PasswordGate.vue';
import EmptyState from '@/components/ui/EmptyState.vue';
import AppImage from '@/components/ui/AppImage.vue';
import AppButton from '@/components/ui/AppButton.vue';
import PublicViewerShell from '@/design-system/patterns/PublicViewerShell.vue';
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

const normalizeAlbumData = (data = {}) => {
  const files = Array.isArray(data.files)
    ? data.files.map((f) => {
        const ext = f.name.split('.').pop().toLowerCase();
        return {
          ...f,
          type: isImage(f) ? 'image' : ext === 'pdf' ? 'pdf' : 'other',
          thumbnailUrl: f.url,
        };
      })
    : [];

  return { ...data, files };
};

// 加载相册
const loadAlbum = async () => {
  if (!token.value) {
    error.value = t('gallery.invalidLink');
    loading.value = false;
    return;
  }

  try {
    const response = await fetch(API.PUBLIC_GALLERY(token.value));
    const result = await response.json();
    const needsPassword = Boolean(result?.data?.requiresPassword || result?.requiresPassword);

    if (result.success && !needsPassword) {
      album.value = normalizeAlbumData(result.data);
      document.title = `${result.data.name} | ${APP_NAME}`;
      requiresPassword.value = false;
      error.value = '';
    } else if (needsPassword) {
      album.value = null;
      requiresPassword.value = true;
      error.value = '';
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
  try {
    const response = await fetch(API.PUBLIC_GALLERY(token.value), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: pwd }),
    });
    const result = await response.json();

    if (result.success && result.data) {
      album.value = normalizeAlbumData(result.data);
      document.title = `${result.data.name} | ${APP_NAME}`;
      requiresPassword.value = false;
      passwordError.value = '';
      error.value = '';
    } else {
      requiresPassword.value = true;
      passwordError.value = result.message || t('gallery.passwordError');
    }
  } catch (_e) {
    passwordError.value = t('gallery.networkError');
  } finally {
    verifying.value = false;
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

onBeforeUnmount(() => {
  // 组件卸载时复位 body overflow
  document.body.style.overflow = '';
});
</script>
