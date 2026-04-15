<template>
  <SurfaceSection :title="title" :body-class="bodyClass">
    <template v-if="$slots.actions" #actions>
      <slot name="actions" />
    </template>

    <div class="relative h-80">
      <slot />
    </div>
  </SurfaceSection>
</template>

<script setup>
import SurfaceSection from '@/design-system/composed/SurfaceSection.vue';

defineProps({
  title: { type: String, required: true },
  bodyClass: { type: String, default: '' },
});
</script>
