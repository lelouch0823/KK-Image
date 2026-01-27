<template>
  <div
    class="group rounded-2xl border p-4 shadow-sm transition-all duration-200"
    :class="[
      variantClass,
      clickable
        ? 'cursor-pointer hover:-translate-y-1 hover:shadow-lg active:scale-[0.98]'
        : 'hover:-translate-y-0.5 hover:shadow-md'
    ]"
    @click="clickable && $emit('click')"
  >
    <!-- Loading State -->
    <template v-if="loading">
      <div class="animate-pulse">
        <div class="mb-2 h-4 w-16 rounded bg-[var(--border-color)]" />
        <div class="h-8 w-24 rounded bg-[var(--border-color)]" />
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

      <div class="text-2xl font-bold tabular-nums text-[var(--text-main)]">
        <slot>{{ formattedValue }}</slot>
      </div>

      <!-- Trend/Footer -->
      <div v-if="$slots.footer || trend !== null" class="mt-2 flex items-center gap-1 text-xs">
        <template v-if="trend !== null">
          <span :class="trend > 0 ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'">
            {{ trend > 0 ? '↑' : '↓' }} {{ Math.abs(trend) }}%
          </span>
          <span class="text-[var(--text-secondary)]">{{ t('dashboard.vsLastPeriod') }}</span>
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
});

defineEmits(['click']);

const formattedValue = computed(() => {
  if (typeof props.value === 'number') {
    return props.value.toLocaleString();
  }
  return props.value;
});

const variantClass = computed(() => {
  const variants = {
    default: 'border-[var(--border-color)] bg-[var(--bg-card)]',
    info: 'border-[var(--color-info)]/20 bg-[var(--color-info)]/5',
    purple: 'border-[var(--color-purple)]/20 bg-[var(--color-purple)]/5',
    success: 'border-[var(--color-success)]/20 bg-[var(--color-success)]/5',
    warning: 'border-[var(--color-warning)]/20 bg-[var(--color-warning)]/5',
    danger: 'border-[var(--color-danger)]/20 bg-[var(--color-danger)]/5',
    cyan: 'border-[var(--color-cyan)]/20 bg-[var(--color-cyan)]/5',
  };
  return variants[props.variant] || variants.default;
});

const labelClass = computed(() => {
  const labels = {
    default: 'text-[var(--text-secondary)]',
    info: 'text-[var(--color-info)]',
    purple: 'text-[var(--color-purple)]',
    success: 'text-[var(--color-success)]',
    warning: 'text-[var(--color-warning)]',
    danger: 'text-[var(--color-danger)]',
    cyan: 'text-[var(--color-cyan)]',
  };
  return labels[props.variant] || labels.default;
});
</script>
