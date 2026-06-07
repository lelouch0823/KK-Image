<template>
  <div role="status" :aria-label="t('common.loading')">
    <template v-for="i in count" :key="i">
      <!-- Simple Text/Block Skeleton -->
      <div
        v-if="!template"
        class="skeleton-shimmer rounded bg-(--bg-muted)"
        :class="[widthClass, heightClass, containerClass]"
        :style="customStyle"
      />

      <!-- Avatar Template -->
      <div
        v-else-if="template === 'avatar'"
        class="skeleton-shimmer rounded-full bg-(--bg-muted)"
        :class="avatarSizeClass"
      />

      <!-- Stat Card Template -->
      <div
        v-else-if="template === 'stat-card'"
        class="skeleton-shimmer rounded-2xl border border-(--border-color) bg-(--bg-muted) p-4"
      >
        <div class="mb-2 h-4 w-16 rounded bg-(--border-color)" />
        <div class="h-8 w-24 rounded bg-(--border-color)" />
      </div>

      <!-- List Card Template (for Order/Customer lists) -->
      <div
        v-else-if="template === 'list-card'"
        class="skeleton-shimmer rounded-2xl border border-(--border-color) bg-(--bg-card) p-4"
        :class="{ 'mb-3': i < count }"
      >
        <div class="flex gap-3">
          <div class="size-16 flex-shrink-0 rounded-lg bg-(--bg-muted)" />
          <div class="flex-1 space-y-2">
            <div class="h-4 w-3/4 rounded bg-(--bg-muted)" />
            <div class="h-3 w-1/2 rounded bg-(--bg-muted)" />
            <div class="h-3 w-1/3 rounded bg-(--bg-muted)" />
          </div>
        </div>
      </div>

      <!-- Table Row Template -->
      <div
        v-else-if="template === 'table-row'"
        class="flex gap-4 border-b border-(--border-color) py-4"
      >
        <div
          v-for="c in columns"
          :key="c"
          class="skeleton-shimmer h-4 flex-1 rounded bg-(--bg-muted)"
        ></div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from '@/composables/useI18n';

const { t } = useI18n();

const props = defineProps({
  template: {
    type: String,
    default: null,
    validator: (v) => [null, 'stat-card', 'list-card', 'avatar', 'table-row'].includes(v),
  },
  width: { type: String, default: 'full' },
  height: { type: String, default: '' },
  count: { type: Number, default: 1 },
  columns: { type: Number, default: 4 }, // For table-row
  containerClass: { type: String, default: '' },
});

const widthClass = computed(() => {
  if (['full', '3/4', '2/3', '1/2', '1/3', '1/4'].includes(props.width)) {
    return `w-${props.width}`;
  }
  return '';
});

const customStyle = computed(() => {
  if (!['full', '3/4', '2/3', '1/2', '1/3', '1/4'].includes(props.width)) {
    return { width: props.width };
  }
  return {};
});

const heightClass = computed(() => {
  return props.height ? `h-${props.height}` : 'h-4';
});

const avatarSizeClass = computed(() => {
  return props.height ? `size-${props.height}` : 'size-10';
});
</script>

<style scoped>
.skeleton-shimmer {
  position: relative;
  overflow: hidden;
  background: var(--bg-muted);
}

.skeleton-shimmer::after {
  content: '';
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  transform: translateX(-100%);
  background: linear-gradient(90deg, transparent 0%, var(--shimmer-from) 50%, transparent 100%);
  animation: shimmer 2s infinite;
}

@keyframes shimmer {
  100% {
    transform: translateX(100%);
  }
}

@media (prefers-reduced-motion: reduce) {
  .skeleton-shimmer::after {
    animation: none;
    display: none;
  }
}
</style>
