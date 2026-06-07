<template>
  <section
    data-testid="space-document-template"
    class="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8"
  >
    <header class="mb-8 space-y-3">
      <div class="flex items-center gap-3">
        <div class="flex size-12 items-center justify-center rounded-2xl bg-(--bg-muted)">
          <AppIcon name="document-text" class="size-6 text-(--text-main)" />
        </div>
        <div>
          <h1 class="text-2xl font-semibold text-(--text-main)">{{ space.name }}</h1>
          <p class="text-sm text-(--text-secondary)">
            {{ fileCountLabel }}
          </p>
        </div>
      </div>
      <p
        v-if="space.description"
        class="max-w-3xl whitespace-pre-line text-sm text-(--text-secondary)"
      >
        {{ space.description }}
      </p>
    </header>

    <div
      v-if="displayFiles.length > 0"
      class="overflow-hidden rounded-2xl border border-(--border-subtle) bg-(--bg-card)"
    >
      <article
        v-for="file in displayFiles"
        :key="file.id || file.url || file.name"
        class="flex flex-col gap-4 border-b border-(--border-subtle) px-5 py-4 last:border-b-0 sm:flex-row sm:items-center sm:justify-between"
      >
        <div class="min-w-0 flex-1">
          <div class="flex items-start gap-3">
            <div
              class="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl bg-(--bg-muted)"
            >
              <AppIcon :name="resolveFileIcon(file)" class="size-5 text-(--text-main)" />
            </div>
            <div class="min-w-0">
              <h2 class="truncate text-sm font-medium text-(--text-main)">
                {{ file.name || t('spacePublic.unnamedFile') }}
              </h2>
              <p class="mt-1 text-xs text-(--text-secondary)">
                {{ resolveFileMeta(file) }}
              </p>
            </div>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <a
            :href="file.url"
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex items-center justify-center rounded-lg border border-(--border-subtle) px-3 py-2 text-xs font-medium text-(--text-main) transition-colors hover:bg-(--bg-muted)"
          >
            {{ t('spacePublic.openPreview') }}
          </a>
          <a
            :href="file.url"
            download
            class="inline-flex items-center justify-center rounded-lg bg-primary px-3 py-2 text-xs font-medium text-(--text-inverse) transition-colors hover:bg-(--color-primary-hover)"
          >
            {{ t('spacePublic.download') }}
          </a>
        </div>
      </article>
    </div>

    <div
      v-else
      class="rounded-2xl border border-dashed border-(--border-subtle) bg-(--bg-muted)/30 px-6 py-14 text-center text-sm text-(--text-secondary)"
    >
      {{ t('spacePublic.noContent') }}
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from '@/composables/useI18n';
import AppIcon from '@/components/ui/AppIcon.vue';

const props = defineProps({
  space: { type: Object, required: true },
});

const { t } = useI18n();

const displayFiles = computed(() =>
  Array.isArray(props.space?.files)
    ? props.space.files.filter((file) => file?.url || file?.name)
    : []
);

const fileCountLabel = computed(() => {
  const count = displayFiles.value.length;
  return `${count} ${t('spacePublic.files')}`;
});

function resolveFileIcon(file) {
  const mimeType = String(file?.mimeType || file?.mime_type || '').toLowerCase();
  if (mimeType.includes('pdf')) return 'document-text';
  if (mimeType.includes('sheet') || mimeType.includes('excel') || mimeType.includes('csv'))
    return 'table-cells';
  if (mimeType.includes('word') || mimeType.includes('document')) return 'document';
  return 'document-text';
}

function resolveFileMeta(file) {
  const parts = [];
  const mimeType = String(file?.mimeType || file?.mime_type || '').trim();
  if (mimeType) parts.push(mimeType);
  if (file?.originalName && file.originalName !== file.name) parts.push(file.originalName);
  return parts.join(' · ') || t('spacePublic.fileReady');
}
</script>
