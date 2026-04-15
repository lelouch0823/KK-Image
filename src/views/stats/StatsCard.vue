<template>
  <AppStatCard :label="title" :value="value" :variant="tone" :glow="glow">
    <template v-if="$slots.icon" #icon>
      <slot name="icon" />
    </template>
    <template v-if="$slots.footer" #footer>
      <slot name="footer" />
    </template>
  </AppStatCard>
</template>

<script setup>
import AppStatCard from '@/components/ui/AppStatCard.vue';

defineProps({
  title: { type: String, required: true },
  value: { type: [String, Number], required: true },
  tone: { type: String, default: 'info' },
  glow: { type: Boolean, default: true },
});
</script>
