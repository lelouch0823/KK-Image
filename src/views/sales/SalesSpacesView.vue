<template>
  <div class="space-y-6">
    <!-- Header -->
    <div>
      <h2 class="text-xl font-semibold text-(--text-main)">{{ t('salesSpaces.title') }}</h2>
      <p class="mt-1 text-sm text-(--text-secondary)">{{ t('salesSpaces.subtitle') }}</p>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div
        v-for="i in 4"
        :key="i"
        class="h-48 animate-pulse rounded-2xl bg-(--bg-muted)"
      ></div>
    </div>

    <!-- Empty State -->
    <div
      v-else-if="spaces.length === 0"
      class="flex flex-col items-center justify-center rounded-2xl border border-dashed border-(--border-color) bg-(--bg-muted) px-6 py-16 text-center"
    >
      <div class="mb-4 flex size-16 items-center justify-center rounded-2xl bg-(--bg-card) shadow-sm">
        <svg class="size-8 text-(--text-muted)" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      </div>
      <h3 class="text-base font-semibold text-(--text-main)">{{ t('salesSpaces.empty') }}</h3>
      <p class="mt-1 text-sm text-(--text-secondary)">{{ t('salesSpaces.emptyDesc') }}</p>
    </div>

    <!-- Space Cards Grid -->
    <div v-else class="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <a
        v-for="space in spaces"
        :key="space.id"
        :href="`/space/${space.share_token}`"
        target="_blank"
        rel="noopener noreferrer"
        class="group overflow-hidden rounded-2xl border border-(--border-color) bg-(--bg-card) shadow-sm transition-all hover:-translate-y-[1px] hover:shadow-md active:translate-y-0"
      >
        <!-- Cover Image -->
        <div class="relative aspect-video overflow-hidden bg-(--bg-muted)">
          <AppImage
            v-if="getCoverUrl(space)"
            :src="getCoverUrl(space)"
            fit="cover"
            class="size-full transition-transform duration-300 group-hover:scale-105"
            rounded="none"
          />
          <div v-else class="flex size-full items-center justify-center">
            <svg class="size-12 text-(--text-muted) opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <!-- Template Badge -->
          <span class="absolute top-3 left-3 rounded-full bg-black/50 px-2.5 py-0.5 text-xs font-medium text-white backdrop-blur-sm">
            {{ getTemplateLabel(space.template) }}
          </span>
        </div>

        <!-- Info -->
        <div class="p-4">
          <h3 class="group-hover:text-primary text-sm font-semibold text-(--text-main)">
            {{ space.name }}
          </h3>
          <p v-if="space.description" class="mt-1 line-clamp-2 text-xs text-(--text-secondary)">
            {{ space.description }}
          </p>
          <div class="mt-3 flex items-center justify-between">
            <span class="text-xs text-(--text-muted)">
              {{ t('salesSpaces.fileCount', { count: space.file_count || 0 }) }}
            </span>
            <span class="text-primary flex items-center gap-1 text-xs font-medium opacity-0 transition-opacity group-hover:opacity-100">
              {{ t('salesSpaces.viewSpace') }}
              <svg class="size-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </span>
          </div>
        </div>
      </a>
    </div>
  </div>
</template>

<script setup>
import { ref, inject, onMounted } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { API } from '@/utils/constants';
import AppImage from '@/components/ui/AppImage.vue';

const { t } = useI18n();
const salesContext = inject('salesContext');

const spaces = ref([]);
const loading = ref(true);

const getTemplateLabel = (key) => {
  const labels = {
    gallery: t('spaceManager.templates.gallery'),
    product: t('spaceManager.templates.product'),
    portfolio: t('spaceManager.templates.portfolio'),
    document: t('spaceManager.templates.document'),
    collection: t('spaceManager.templates.collection'),
  };
  return labels[key] || key;
};

const getCoverUrl = (space) => {
  const getUrl = (key) => {
    if (!key) return null;
    return key.startsWith('http') || key.startsWith('//') ? key : `/file/${key}`;
  };

  if (space.cover_storage_key) return getUrl(space.cover_storage_key);
  if (space.p_images) {
    try {
      const images = typeof space.p_images === 'string' ? JSON.parse(space.p_images) : space.p_images;
      if (images && images.length > 0) {
         return images[0].url || getUrl(images[0].storage_key);
      }
    } catch (_err) {
      // Ignore parse error
    }
  }
  return null;
};

const loadSpaces = async () => {
  loading.value = true;
  try {
    const token = salesContext?.accessToken?.value || window.location.pathname.split('/')[2];
    const res = await fetch(API.SALES_SPACES(token), {
      credentials: 'include',
    });
    const data = await res.json();
    if (data.success) {
      spaces.value = data.data || [];
    }
  } catch (_err) {
    // Silent fail - empty state will show
  } finally {
    loading.value = false;
  }
};

onMounted(loadSpaces);
</script>
