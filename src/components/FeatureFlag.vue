<template>
  <slot v-if="isEnabled" />
</template>

<script setup>
import { computed, toRef } from 'vue';
import { useFeatureFlags } from '@/composables/useFeatureFlag';

const props = defineProps({
  /** 功能开关的 key */
  flag: {
    type: String,
    required: true,
  },
});

// 使用 toRef 保持响应式，确保 props.flag 变化时重新计算
const flagRef = toRef(props, 'flag');

// 使用 useFeatureFlags 获取全局 flagsMap，在 computed 中动态读取
const { flags } = useFeatureFlags();

// 监听 flag 变化，确保动态切换时正确响应
const isEnabled = computed(() => {
  const flag = flags.value.get(flagRef.value);
  return flag?.enabled ?? false;
});
</script>
