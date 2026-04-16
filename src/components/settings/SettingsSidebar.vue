<template>
  <nav class="flex flex-col gap-1">
    <AppButton
      v-for="item in items"
      :key="item.id"
      variant="ghost"
      class="group !flex !h-auto !w-full !justify-start gap-3 !rounded-lg px-3 py-2.5 !text-left text-sm font-medium transition-all duration-200"
      :class="[
        currentTab === item.id
          ? 'text-primary !bg-(--color-primary-bg) shadow-sm ring-1 ring-(--color-primary-light) ring-inset'
          : 'text-(--text-secondary) hover:!bg-(--bg-hover) hover:!text-primary',
      ]"
      @click="$emit('update:currentTab', item.id)"
    >
      <AppIcon
        :name="item.icon"
        class="size-5 shrink-0 transition-colors"
        :class="[currentTab === item.id ? 'text-primary' : 'group-hover:text-primary text-(--text-muted)']"
      />
      <span>{{ item.label }}</span>
      <span
        v-if="item.badge"
        class="ml-auto rounded-full bg-(--color-info-bg) px-2 py-0.5 text-xs font-medium text-(--color-info-text)"
      >
        {{ item.badge }}
      </span>
    </AppButton>
  </nav>
</template>

<script setup>
import AppButton from '@/components/ui/AppButton.vue';
import AppIcon from '@/components/ui/AppIcon.vue';

defineProps({
  items: {
    type: Array,
    required: true,
  },
  currentTab: {
    type: String,
    required: true,
  },
});

defineEmits(['update:currentTab']);
</script>
