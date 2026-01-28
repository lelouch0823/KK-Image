<template>
  <div
    class="group relative overflow-hidden rounded-2xl border p-4 shadow-sm transition-all duration-200"
    :class="[
      variantClass,
      clickable
        ? 'cursor-pointer hover:-translate-y-1 hover:shadow-lg active:scale-[0.98]'
        : 'hover:-translate-y-0.5 hover:shadow-md',
      glow ? 'backdrop-blur-md' : ''
    ]"
    :style="glow ? { '--shadow-color': shadowColor } : {}"
    @click="clickable && $emit('click')"
  >
    <!-- Background Blob (for glow mode) -->
    <div
      v-if="glow"
      class="absolute -top-6 -right-6 rounded-full p-12 blur-2xl transition-transform opacity-20 group-hover:opacity-40"
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

      <div class="text-2xl font-bold text-(--text-main) tabular-nums transition-colors group-hover:text-primary">
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

const { t } = useI18n();

const props = defineProps({
  label: { type: String, default: '' },
  value: { type: [String, Number], default: '' },
  variant: {
    type: String,
    default: 'default',
    validator: v => ['default', 'info', 'purple', 'success', 'warning', 'danger', 'cyan'].includes(v),
  },
  clickable: { type: Boolean, default: false },
  loading: { type: Boolean, default: false },
  trend: { type: Number, default: null }, // percentage change
  icon: { type: [Object, Function], default: null },
  glow: { type: Boolean, default: false },
});

defineEmits(['click']);

const shadowColor = computed(() => {
  const colors = {
    default: '148, 163, 184',
    info: '59, 130, 246',
    purple: '139, 92, 246',
    success: '16, 185, 129',
    warning: '245, 158, 11',
    danger: '239, 68, 68',
    cyan: '6, 182, 212',
  };
  return colors[props.variant] || colors.default;
});

const formattedValue = computed(() => {
  if (typeof props.value === 'number') {
    return props.value.toLocaleString();
  }
  return props.value;
});

const variantClass = computed(() => {
  const variants = {
    default: 'border-(--border-color) bg-(--bg-card)',
    info: 'border-info/20 bg-info/5 hover:shadow-[0_0_30px_rgba(59,130,246,0.1)]',
    purple: 'border-purple/20 bg-purple/5 hover:shadow-[0_0_30px_rgba(139,92,246,0.1)]',
    success: 'border-success/20 bg-success/5 hover:shadow-[0_0_30px_rgba(16,185,129,0.1)]',
    warning: 'border-warning/20 bg-warning/5 hover:shadow-[0_0_30px_rgba(245,158,11,0.1)]',
    danger: 'border-danger/20 bg-danger/5 hover:shadow-[0_0_30px_rgba(239,68,68,0.1)]',
    cyan: 'border-cyan/20 bg-cyan/5 hover:shadow-[0_0_30px_rgba(6,182,212,0.1)]',
  };
  return variants[props.variant] || variants.default;
});

const blobClass = computed(() => {
  const blobs = {
    info: 'bg-blue-500',
    purple: 'bg-purple-500',
    success: 'bg-emerald-500',
    warning: 'bg-amber-500',
    danger: 'bg-red-500',
    cyan: 'bg-cyan-500',
  };
  return blobs[props.variant] || 'bg-slate-500';
});

const labelClass = computed(() => {
  const labels = {
    default: 'text-(--text-secondary)',
    info: 'text-info',
    purple: 'text-purple',
    success: 'text-success',
    warning: 'text-warning',
    danger: 'text-danger',
    cyan: 'text-cyan',
  };
  return labels[props.variant] || labels.default;
});
</script>
