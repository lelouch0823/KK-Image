<template>
  <Modal
    v-model="modelValue"
    :title="t('salesperson.title')"
    size="md"
    @close="close"
  >
    <!-- Header -->
    <template #header>
        <div class="flex items-center justify-between w-full">
            <h3 class="text-lg font-semibold text-[var(--text-main)]">{{ t('salesperson.title') }}</h3>
             <button
                type="button"
                class="-mr-1 p-1 text-[var(--text-muted)] transition-colors hover:text-[var(--text-main)]"
                @click="close"
            >
                <svg class="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M6 18L18 6M6 6l12 12"
                    ></path>
                </svg>
            </button>
        </div>
    </template>

    <div v-if="person" class="flex flex-col items-center text-center">
      <!-- Avatar -->
      <div
        class="mb-4 flex size-20 items-center justify-center rounded-full bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-hover)] text-3xl font-semibold text-white shadow-lg shadow-[var(--color-primary)]/20"
      >
        {{ person.name?.charAt(0) || '?' }}
      </div>

      <!-- Name & Status -->
      <h2 class="text-xl font-bold text-[var(--text-main)]">{{ person.name }}</h2>
      <div class="mt-2">
        <StatusBadge :variant="person.isActive ? 'success' : 'default'">
          {{ person.isActive ? t('salesperson.active') : t('salesperson.disabled') }}
        </StatusBadge>
      </div>

      <!-- Info Grid -->
      <div class="mt-6 w-full space-y-4 rounded-xl bg-[var(--bg-muted)]/50 p-4">
        <!-- Store -->
        <div class="flex items-center justify-between">
          <span class="text-sm text-[var(--text-secondary)]">{{ t('salesperson.store') }}</span>
          <span class="font-medium text-[var(--text-main)]">{{ person.store || '-' }}</span>
        </div>

        <!-- Phone -->
        <div class="flex items-center justify-between">
          <span class="text-sm text-[var(--text-secondary)]">{{ t('salesperson.phone') }}</span>
          <span class="font-medium text-[var(--text-main)]">{{ person.phone || '-' }}</span>
        </div>

        <!-- Orders -->
        <div class="flex items-center justify-between">
          <span class="text-sm text-[var(--text-secondary)]">{{ t('salesperson.orderCount') }}</span>
          <StatusBadge variant="info" size="sm">{{ person.orderCount }}</StatusBadge>
        </div>
        <div class="flex items-center justify-between">
          <span class="text-sm text-[var(--text-secondary)]">{{ t('salesperson.orderCount') }}</span>
          <StatusBadge variant="info" size="sm">{{ person.orderCount }}</StatusBadge>
        </div>

        <!-- Last Login -->
        <div v-if="person.last_login_at" class="flex items-center justify-between">
            <span class="text-sm text-[var(--text-secondary)]">{{ t('salesperson.lastLogin') }}</span>
            <span class="font-medium text-[var(--text-main)] text-sm">{{ formatDate(person.last_login_at) }}</span>
        </div>
        
        <!-- Login Device -->
        <div v-if="person.last_login_device" class="flex items-center justify-between">
            <span class="text-sm text-[var(--text-secondary)]">{{ t('salesperson.loginDevice') }}</span>
            <span class="font-medium text-[var(--text-main)] text-xs truncate max-w-[150px]" :title="person.last_login_device">
                {{ person.last_login_device }}
            </span>
        </div>
        
        <!-- Access Token -->
        <div class="pt-2 border-t border-[var(--border-color)]">
             <div class="flex items-center justify-between mb-2">
                <span class="text-sm text-[var(--text-secondary)]">{{ t('salesperson.accessLink') }}</span>
             </div>
             <div class="flex items-center gap-2">
                 <div class="flex-1 truncate rounded bg-[var(--bg-card)] px-2 py-1.5 text-xs text-[var(--text-muted)] font-mono border border-[var(--border-color)]">
                     {{ accessUrl }}
                 </div>
                 <button
                    class="p-1.5 text-[var(--text-secondary)] hover:text-[var(--color-primary)] transition-colors"
                     @click="$emit('copy', person.accessToken)"
                     :title="t('salesperson.copyLink')"
                 >
                     <svg class="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
                     </svg>
                 </button>
             </div>
        </div>
      </div>
    </div>

    <!-- Footer -->
    <template #footer>
      <button
        type="button"
        class="rounded-lg px-4 py-2 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-muted)] transition-colors"
        @click="close"
      >
        {{ t('common.close') }}
      </button>
      <button
        v-if="person && person.orderCount > 0"
        type="button"
        class="inline-flex items-center justify-center rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white shadow-lg shadow-[var(--color-primary)]/20 transition-all hover:bg-[var(--color-primary-hover)] active:scale-95"
        @click="viewOrders"
      >
        {{ t('salesperson.viewOrders') }}
      </button>
    </template>
  </Modal>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from '@/composables/useI18n';
import Modal from '@/components/ui/Modal.vue';
import StatusBadge from '@/components/ui/StatusBadge.vue';

const props = defineProps({
  modelValue: {
    type: Boolean,
    required: true,
  },
  person: {
    type: Object,
    default: null,
  },
});

const emit = defineEmits(['update:modelValue', 'view-orders', 'copy']);

const { t } = useI18n();

const accessUrl = computed(() => {
    if (!props.person?.accessToken) return '';
    return `${window.location.origin}/sales/${props.person.accessToken}`;
});

const close = () => {
  emit('update:modelValue', false);
};

const viewOrders = () => {
  emit('view-orders', props.person);
  close();
};

const formatDate = (timestamp) => {
  if (!timestamp) return '-';
  // Check if timestamp is seconds or milliseconds. Usually Date.now() is ms.
  // If it's small, it might be seconds.
  // DB query `now()` often uses Date.now().
  return new Date(timestamp).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
};
</script>
