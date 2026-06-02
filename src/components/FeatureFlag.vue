<template>
  <slot v-if="isEnabled" />
</template>

<script setup>
import { useFeatureFlag } from '@/composables/useFeatureFlag';

const props = defineProps({
  /** 功能开关的 key */
  flag: {
    type: String,
    required: true,
  },
});

const { isEnabled } = useFeatureFlag(props.flag);
</script>
