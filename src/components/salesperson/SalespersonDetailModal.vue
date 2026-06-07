<template>
  <Modal
    :model-value="modelValue"
    :title="t('salesperson.title')"
    size="md"
    @update:model-value="emit('update:modelValue', $event)"
    @close="close"
  >
    <!-- Header -->
    <template #header>
      <div class="flex w-full items-center justify-between">
        <h3 class="text-lg font-semibold text-(--text-main)">{{ t('salesperson.title') }}</h3>
      </div>
    </template>

    <div v-if="person" class="flex flex-col items-center text-center">
      <!-- Avatar -->
      <div
        class="from-primary shadow-primary/20 mb-4 flex size-20 items-center justify-center rounded-full bg-gradient-to-br to-(--color-primary-hover) text-3xl font-semibold text-(--text-inverse) shadow-lg"
      >
        {{ person.name?.charAt(0) || '?' }}
      </div>

      <!-- Name & Status -->
      <h2
        class="max-w-full truncate text-xl font-bold text-(--text-main)"
        :title="person.name || '-'"
      >
        {{ person.name || '-' }}
      </h2>
      <div class="mt-2">
        <StatusBadge :variant="person.isActive ? 'success' : 'default'">
          {{ person.isActive ? t('salesperson.active') : t('salesperson.disabled') }}
        </StatusBadge>
      </div>

      <!-- Info Grid -->
      <div class="mt-6 w-full space-y-4 rounded-xl bg-(--bg-muted)/50 p-4">
        <!-- Store -->
        <div class="flex min-w-0 items-center justify-between gap-3">
          <span class="text-sm text-(--text-secondary)">{{ t('salesperson.store') }}</span>
          <span
            class="max-w-[60%] truncate text-right font-medium text-(--text-main)"
            :title="person.store || '-'"
            >{{ person.store || '-' }}</span
          >
        </div>

        <!-- Phone -->
        <div class="flex min-w-0 items-center justify-between gap-3">
          <span class="text-sm text-(--text-secondary)">{{ t('salesperson.phone') }}</span>
          <span
            class="max-w-[60%] truncate text-right font-medium text-(--text-main)"
            :title="person.phone || '-'"
            >{{ person.phone || '-' }}</span
          >
        </div>

        <!-- Orders -->
        <div class="flex items-center justify-between">
          <span class="text-sm text-(--text-secondary)">{{ t('salesperson.orderCount') }}</span>
          <StatusBadge variant="info" size="sm">{{ person.orderCount }}</StatusBadge>
        </div>

        <!-- Last Login -->
        <div v-if="person.last_login_at" class="flex items-center justify-between">
          <span class="text-sm text-(--text-secondary)">{{ t('salesperson.lastLogin') }}</span>
          <span class="text-sm font-medium text-(--text-main)">{{
            formatDate(person.last_login_at)
          }}</span>
        </div>

        <!-- Login Device -->
        <div v-if="person.last_login_device" class="flex items-center justify-between">
          <span class="text-sm text-(--text-secondary)">{{ t('salesperson.loginDevice') }}</span>
          <span
            class="max-w-[150px] truncate text-xs font-medium text-(--text-main)"
            :title="person.last_login_device"
          >
            {{ person.last_login_device }}
          </span>
        </div>

        <!-- Access Token -->
        <div class="border-t border-(--border-color) pt-2">
          <div class="mb-2 flex items-center justify-between">
            <span class="text-sm text-(--text-secondary)">{{ t('salesperson.accessLink') }}</span>
          </div>
          <div class="flex min-w-0 items-center gap-2">
            <div
              class="flex-1 rounded border border-(--border-color) bg-(--bg-card) px-2 py-1.5 font-mono text-xs break-all text-(--text-muted)"
              :title="accessUrl"
            >
              {{ accessUrl }}
            </div>
            <AppButton
              variant="ghost"
              size="sm"
              class="!h-8 !w-8 !px-0 hover:text-primary"
              :title="t('salesperson.copyLink')"
              @click="$emit('copy', person.accessToken)"
            >
              <template #icon-left>
                <AppIcon name="clipboard" class="size-4" />
              </template>
            </AppButton>
          </div>
        </div>
      </div>
    </div>

    <!-- Footer -->
    <template #footer>
      <ActionBar class="w-full border-none bg-transparent px-0 py-0 shadow-none">
        <AppButton variant="secondary" :text="t('common.close')" @click="close" />
        <AppButton
          v-if="person && person.orderCount > 0"
          variant="primary"
          :text="t('salesperson.viewOrders')"
          @click="viewOrders"
        />
      </ActionBar>
    </template>
  </Modal>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from '@/composables/useI18n';
import Modal from '@/components/ui/Modal.vue';
import AppButton from '@/components/ui/AppButton.vue';
import AppIcon from '@/components/ui/AppIcon.vue';
import StatusBadge from '@/components/ui/StatusBadge.vue';
import ActionBar from '@/design-system/composed/ActionBar.vue';
import { formatDate } from '@/utils/formatters';

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
</script>
