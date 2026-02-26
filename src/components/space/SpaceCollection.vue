<template>
  <div class="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
    <div class="mb-12 text-center">
      <div
        class="mx-auto mb-4 flex size-16 items-center justify-center rounded-2xl bg-[var(--color-primary)]/10 text-[var(--color-primary)]"
      >
        <AppIcon name="rectangle-group" class="size-8" />
      </div>
      <h1 class="text-2xl font-bold text-[var(--text-main)]">{{ space.name }}</h1>
      <p class="mt-2 text-[var(--text-secondary)]">{{ space.description || t('spacePublic.noDesc') }}</p>
    </div>

    <!-- Subspaces Grid -->
    <div class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      <a
        v-for="sub in space.subspaces"
        :key="sub.id"
        :href="`/space/${sub.shareToken}`"
        class="group flex items-start gap-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-6 transition-all hover:shadow-lg"
      >
        <div
          class="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[var(--bg-muted)] transition-colors"
          :class="
            sub.coverImage ? 'border border-[var(--border-subtle)]' : 'group-hover:bg-[var(--color-primary)] group-hover:text-[var(--text-inverse)]'
          "
        >
          <AppImage
            v-if="sub.coverImage"
            :src="sub.coverImage"
            class="size-full transition-transform group-hover:scale-110"
            fit="cover"
            rounded="none"
          />
          <AppIcon
            v-else
            name="folder"
            class="size-6 text-[var(--text-muted)] group-hover:text-[var(--text-inverse)]"
          />
        </div>
        <div>
          <h3 class="font-semibold text-[var(--text-main)] group-hover:text-[var(--color-primary)]">{{ sub.name }}</h3>
          <p class="mt-1 text-xs text-[var(--text-secondary)]">{{ sub.fileCount }} items</p>
        </div>
        <div class="ml-auto">
          <AppIcon
            name="chevron-right"
            class="size-5 text-[var(--text-muted)] transition-colors group-hover:text-[var(--color-primary)]"
          />
        </div>
      </a>
    </div>

    <!-- Empty State -->
    <div
      v-if="!space.subspaces || space.subspaces.length === 0"
      class="rounded-xl border border-dashed border-[var(--border-subtle)] bg-[var(--bg-muted)]/30 py-12 text-center text-[var(--text-secondary)]"
    >
      <p>{{ t('spacePublic.noSubspaces') }}</p>
    </div>
  </div>
</template>

<script setup>
import { useI18n } from '@/composables/useI18n';
import AppImage from '@/components/ui/AppImage.vue';
import AppIcon from '@/components/ui/AppIcon.vue';

defineProps({
  space: { type: Object, required: true },
});

const { t } = useI18n();
</script>
