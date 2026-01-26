<template>
  <div class="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
    <div class="mb-12 text-center">
      <div
        class="mx-auto mb-4 flex size-16 items-center justify-center rounded-2xl bg-[var(--color-primary)]/10 text-[var(--color-primary)]"
      >
        <svg class="size-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
          ></path>
        </svg>
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
          <img
            v-if="sub.coverImage"
            :src="sub.coverImage"
            class="size-full object-cover transition-transform group-hover:scale-110"
            alt="Cover"
          />
          <svg
            v-else
            class="size-6 text-[var(--text-muted)] group-hover:text-[var(--text-inverse)]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
            ></path>
          </svg>
        </div>
        <div>
          <h3 class="font-semibold text-[var(--text-main)] group-hover:text-[var(--color-primary)]">{{ sub.name }}</h3>
          <p class="mt-1 text-xs text-[var(--text-secondary)]">{{ sub.fileCount }} items</p>
        </div>
        <div class="ml-auto">
          <svg
            class="size-5 text-[var(--text-muted)] transition-colors group-hover:text-[var(--color-primary)]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M9 5l7 7-7 7"
            ></path>
          </svg>
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

defineProps({
  space: { type: Object, required: true },
});

const { t } = useI18n();
</script>
