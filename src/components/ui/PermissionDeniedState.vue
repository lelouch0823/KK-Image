<template>
  <section
    id="permission-denied-state"
    data-testid="permission-denied-state"
    class="mx-auto w-full max-w-3xl rounded-2xl border border-amber-200/70 bg-gradient-to-br from-amber-50 via-(--bg-card) to-orange-50 p-6 shadow-sm dark:border-amber-700/40 dark:from-amber-950/30 dark:via-(--bg-card) dark:to-orange-950/25"
    role="alert"
    aria-live="polite"
  >
    <div class="flex items-start gap-4">
      <div class="flex size-11 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300">
        <AppIcon name="lock-closed" class="size-6" />
      </div>
      <div class="min-w-0 flex-1">
        <h3 class="text-lg font-semibold text-amber-900 dark:text-amber-200">{{ titleText }}</h3>
        <p class="mt-1 text-sm leading-6 text-amber-800/90 dark:text-amber-100/90">{{ descriptionText }}</p>
        <p v-if="reason" class="mt-2 break-words rounded-lg bg-amber-100/80 px-3 py-2 text-xs text-amber-900 dark:bg-amber-500/15 dark:text-amber-100">
          {{ reason }}
        </p>
        <div class="mt-4 flex flex-wrap items-center gap-2">
          <button
            v-if="showRetry"
            class="cursor-pointer rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-amber-700 focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:outline-none dark:bg-amber-500 dark:text-amber-950 dark:hover:bg-amber-400"
            @click="$emit('retry')"
          >
            重新尝试
          </button>
          <RouterLink
            v-if="showHome"
            :to="homeTo"
            class="cursor-pointer rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-sm font-medium text-amber-800 transition-colors hover:bg-amber-50 focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:outline-none dark:border-amber-600/60 dark:bg-amber-950/20 dark:text-amber-200 dark:hover:bg-amber-900/30"
          >
            {{ homeText }}
          </RouterLink>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue';
import { RouterLink } from 'vue-router';
import AppIcon from '@/components/ui/AppIcon.vue';

const props = defineProps({
  title: {
    type: String,
    default: '',
  },
  description: {
    type: String,
    default: '',
  },
  reason: {
    type: String,
    default: '',
  },
  showRetry: {
    type: Boolean,
    default: true,
  },
  showHome: {
    type: Boolean,
    default: true,
  },
  homeTo: {
    type: String,
    default: '/admin/forbidden',
  },
  homeText: {
    type: String,
    default: '查看权限说明',
  },
});

defineEmits(['retry']);

const titleText = computed(() => props.title || '访问受限');
const descriptionText = computed(
  () => props.description || '当前账号缺少访问该资源所需权限，请联系管理员分配权限后重试。'
);
</script>
