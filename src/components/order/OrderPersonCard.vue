<template>
  <div class="rounded-xl border border-(--border-color) bg-(--bg-card) p-4 shadow-sm">
    <h3 class="mb-3 text-xs font-medium tracking-wider text-(--text-secondary) uppercase">
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
        <p class="truncate text-sm font-medium text-(--text-main)">
          {{ name }}
        </p>
        <p class="truncate text-xs text-(--text-secondary)">{{ subtitle || '-' }}</p>
        <p v-if="phone" class="mt-1 text-xs text-(--text-secondary)">
          {{ phone }}
        </p>
      </div>
      <a
        v-if="phone"
        :href="`tel:${phone}`"
        class="hover:text-primary hover:bg-(--bg-hover) rounded-full p-2 text-(--text-secondary) transition-colors"
      >
        <AppIcon name="phone" class="size-4" />
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
    default: 'bg-info-bg text-info',
  },
});
</script>
