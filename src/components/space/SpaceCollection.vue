<template>
  <div class="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
    <div class="mb-12 text-center">
      <div
        class="bg-primary/10 text-primary mx-auto mb-4 flex size-16 items-center justify-center rounded-2xl"
      >
        <AppIcon name="rectangle-group" class="size-8" />
      </div>
      <h1 class="text-2xl font-bold text-(--text-main)">{{ space.name }}</h1>
      <p class="mt-2 text-(--text-secondary)">{{ space.description || t('spacePublic.noDesc') }}</p>
    </div>

    <!-- Subspaces Grid -->
    <div class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      <a
        v-for="sub in space.subspaces"
        :key="sub.id"
        :href="getSubspaceHref(sub)"
        class="group flex items-start gap-4 rounded-xl border border-(--border-subtle) bg-(--bg-card) p-6 transition-all hover:shadow-lg"
      >
        <div
          class="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-(--bg-muted) transition-colors"
          :class="
            getSubspaceCover(sub) ? 'border border-(--border-subtle)' : 'group-hover:bg-primary group-hover:text-(--text-inverse)'
          "
        >
          <AppImage
            v-if="getSubspaceCover(sub)"
            :src="getSubspaceCover(sub)"
            class="size-full transition-transform group-hover:scale-110"
            fit="cover"
            rounded="none"
          />
          <AppIcon
            v-else
            name="folder"
            class="size-6 text-(--text-muted) group-hover:text-(--text-inverse)"
          />
        </div>
        <div>
          <h3 class="group-hover:text-primary font-semibold text-(--text-main)">{{ sub.name }}</h3>
          <p class="mt-1 text-xs text-(--text-secondary)">{{ sub.fileCount }} items</p>
        </div>
        <div class="ml-auto">
          <AppIcon
            name="chevron-right"
            class="group-hover:text-primary size-5 text-(--text-muted) transition-colors"
          />
        </div>
      </a>
    </div>

    <!-- Empty State -->
    <div
      v-if="!space.subspaces || space.subspaces.length === 0"
      class="rounded-xl border border-dashed border-(--border-subtle) bg-(--bg-muted)/30 py-12 text-center text-(--text-secondary)"
    >
      <p>{{ t('spacePublic.noSubspaces') }}</p>
    </div>
  </div>
</template>

<script setup>
import { useI18n } from '@/composables/useI18n';
import AppImage from '@/components/ui/AppImage.vue';
import AppIcon from '@/components/ui/AppIcon.vue';

const props = defineProps({
  space: { type: Object, required: true },
  getSubspaceHref: {
    type: Function,
    default: (subspace) => subspace?.shareUrl || (subspace?.shareToken ? `/space/${subspace.shareToken}` : '#'),
  },
});

const { t } = useI18n();

const getSubspaceCover = (subspace) => subspace?.coverImage || subspace?.coverUrl || '';
</script>
