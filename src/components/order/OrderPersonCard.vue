<template>
  <div class="rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] p-4 shadow-sm">
    <h3 class="mb-3 text-xs font-medium uppercase tracking-wider text-[var(--text-secondary)]">
      {{ title }}
    </h3>
    <div class="flex items-start gap-3">
      <div
        class="flex size-10 items-center justify-center rounded-full text-sm font-bold"
        :class="avatarClass"
      >
        {{ name.charAt(0) }}
      </div>
      <div class="min-w-0 flex-1">
        <p class="truncate text-sm font-medium text-[var(--text-main)]">
          {{ name }}
        </p>
        <p class="truncate text-xs text-[var(--text-secondary)]">{{ subtitle || '-' }}</p>
        <p v-if="phone" class="mt-1 text-xs text-[var(--text-secondary)]">
          {{ phone }}
        </p>
      </div>
      <a
        v-if="phone"
        :href="`tel:${phone}`"
        class="rounded-full p-2 text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--color-primary)]"
      >
        <svg class="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
          />
        </svg>
      </a>
    </div>
  </div>
</template>

<script setup>
defineProps({
  title: {
    type: String,
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  subtitle: {
    type: String,
    default: '',
  },
  phone: {
    type: String,
    default: '',
  },
  avatarClass: {
    type: String,
    default: 'bg-blue-50 text-blue-600',
  },
});
</script>
