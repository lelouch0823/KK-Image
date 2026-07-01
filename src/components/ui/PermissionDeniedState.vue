<template>
  <section
    id="permission-denied-state"
    data-testid="permission-denied-state"
    class="mx-auto w-full max-w-3xl rounded-2xl border border-warning/25 bg-(--color-warning-bg) p-6 shadow-card"
    role="alert"
    aria-live="polite"
  >
    <div class="flex items-start gap-4">
      <div
        class="flex size-11 shrink-0 items-center justify-center rounded-xl bg-warning/15 text-warning"
      >
        <AppIcon name="lock-closed" class="size-6" />
      </div>
      <div class="min-w-0 flex-1">
        <h3 class="text-lg font-semibold text-(--color-warning-text)">{{ titleText }}</h3>
        <p class="mt-1 text-sm leading-6 text-(--color-warning-text)">{{ descriptionText }}</p>
        <p
          v-if="reasonText"
          class="mt-2 rounded-lg border border-warning/20 bg-(--bg-card) px-3 py-2 text-xs break-words text-(--color-warning-text)"
        >
          {{ reasonText }}
        </p>
        <div class="mt-4 flex flex-wrap items-center gap-2">
          <AppButton
            v-if="showRetry"
            variant="outline"
            class="border-warning/30 bg-warning text-(--text-inverse) hover:border-warning hover:bg-warning/90 hover:text-(--text-inverse)"
            @click="$emit('retry')"
          >
            {{ t('common.retry', '重新尝试') }}
          </AppButton>
          <RouterLink
            v-if="showHome"
            :to="homeTo"
            class="cursor-pointer rounded-lg border border-warning/25 bg-(--bg-card) px-3 py-1.5 text-sm font-medium text-(--color-warning-text) transition-colors hover:bg-warning/10 focus-visible:ring-2 focus-visible:ring-warning/30 focus-visible:outline-none"
          >
            {{ homeTextValue }}
          </RouterLink>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue';
import { RouterLink } from 'vue-router';
import { useI18n } from '@/composables/useI18n';
import AppButton from '@/components/ui/AppButton.vue';
import AppIcon from '@/components/ui/AppIcon.vue';

const { t } = useI18n();

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
  requiredPermission: {
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
    default: '',
  },
});

defineEmits(['retry']);

const titleText = computed(() => props.title || t('permissionDenied.title', '访问受限'));
const descriptionText = computed(
  () =>
    props.description ||
    t(
      'permissionDenied.description',
      '当前账号缺少访问该资源所需权限，请联系管理员分配权限后重试。'
    )
);
const reasonText = computed(() => {
  if (props.reason) return props.reason;
  if (props.requiredPermission) {
    return `${t('permissionDenied.requiredPermission', '需要权限：')}${props.requiredPermission}`;
  }
  return '';
});
const homeTextValue = computed(
  () => props.homeText || t('permissionDenied.viewPermissionDetails', '查看权限说明')
);
</script>
