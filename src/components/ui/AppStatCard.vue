<template>
  <div
    class="group relative overflow-hidden rounded-2xl border p-4 shadow-card transition-all duration-200"
    :data-tone="resolvedTone"
    :class="[
      variantClass,
      clickable
        ? 'cursor-pointer hover:-translate-y-1 hover:shadow-lg active:scale-[0.98]'
        : 'hover:-translate-y-0.5 hover:shadow-md',
      glow ? 'backdrop-blur-md' : '',
    ]"
    @click="clickable && $emit('click')"
  >
    <!-- Background Blob (for glow mode) -->
    <div
      v-if="glow"
      class="absolute -top-6 -right-6 rounded-full p-12 opacity-20 blur-2xl transition-transform group-hover:opacity-40"
      :class="blobClass"
    ></div>
    <template v-if="loading">
      <div class="animate-pulse">
        <div class="mb-2 h-4 w-16 rounded bg-(--border-color)" />
        <div class="h-8 w-24 rounded bg-(--border-color)" />
      </div>
    </template>

    <!-- Content -->
    <template v-else>
      <div class="mb-1 flex items-center gap-2">
        <!-- Icon Slot -->
        <slot name="icon">
          <div v-if="icon" class="size-6" :class="labelClass">
            <component :is="icon" class="size-full" />
          </div>
        </slot>
        <span class="text-sm font-medium" :class="labelClass">
          <slot name="label">{{ label }}</slot>
        </span>
      </div>

      <div
        class="group-hover:text-primary text-2xl font-semibold text-(--text-main) font-mono tabular-nums transition-colors"
      >
        <slot>{{ formattedValue }}</slot>
      </div>

      <!-- Trend/Footer -->
      <div v-if="$slots.footer || trend !== null" class="mt-2 flex items-center gap-1 text-xs">
        <template v-if="trend !== null">
          <span :class="trend > 0 ? 'text-success' : 'text-danger'">
            {{ trend > 0 ? '↑' : '↓' }} {{ Math.abs(trend) }}%
          </span>
          <span class="text-(--text-secondary)">{{ t('dashboard.vsLastPeriod') }}</span>
        </template>
        <slot name="footer" />
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { getToneClasses, normalizeTone } from '@/design-system/toneContract';

const { t } = useI18n();

const props = defineProps({
  label: { type: String, default: '' },
  value: { type: [String, Number], default: '' },
  variant: { type: String, default: 'neutral' },
  clickable: { type: Boolean, default: false },
  loading: { type: Boolean, default: false },
  trend: { type: Number, default: null }, // percentage change
  icon: { type: [Object, Function], default: null },
  glow: { type: Boolean, default: false },
});

defineEmits(['click']);
const resolvedTone = computed(() => normalizeTone(props.variant || 'neutral'));

const formattedValue = computed(() => {
  if (typeof props.value === 'number') {
    return props.value.toLocaleString();
  }
  return props.value;
});

const variantClass = computed(() => {
  return getToneClasses(resolvedTone.value).surface;
});

const blobClass = computed(() => {
  return getToneClasses(resolvedTone.value).blob;
});

const labelClass = computed(() => {
  return getToneClasses(resolvedTone.value).accentText;
});
</script>
