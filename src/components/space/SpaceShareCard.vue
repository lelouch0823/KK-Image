<template>
  <div class="rounded-xl border border-(--border-color) bg-(--bg-card) p-4 shadow-sm">
    <div class="mb-3 flex items-center justify-between">
      <div class="flex items-center gap-2">
        <div
          class="size-8 rounded-lg"
          :class="
            isPublic
              ? 'bg-primary/10 text-primary'
              : 'bg-(--bg-muted) text-(--text-secondary)'
          "
        >
          <AppIcon name="link" class="size-full p-1.5" />
        </div>
        <div>
          <h4 class="text-sm font-semibold text-(--text-main)">
            {{ t('spaceManager.shareSettings') }}
          </h4>
          <p
            class="text-[10px]"
            :class="isPublic ? 'text-success' : 'text-secondary'"
          >
            {{
              isPublic
                ? t('spaceManager.publicOn')
                : t('spaceManager.shareCard.notPublic')
            }}
          </p>
        </div>
      </div>
      <AppButton
        :variant="isPublic ? 'primary' : 'white'"
        size="sm"
        @click="$emit('update:isPublic', !isPublic)"
      >
        {{ isPublic ? t('common.enabled', '已开启') : t('common.enable', '开启') }}
      </AppButton>
    </div>

    <!-- Share Information -->
    <div
      v-if="isPublic"
      class="animate-in fade-in slide-in-from-top-1 space-y-3 duration-200"
    >
      <div
        class="rounded-lg border border-(--border-color) bg-(--bg-muted) px-3 py-2 font-mono text-xs break-all text-(--text-main)"
      >
        {{ shareUrl }}
      </div>
      <AppButton
        variant="outline"
        size="sm"
        class="w-full justify-center"
        @click.prevent="copyLink"
      >
        <template #icon-left>
          <AppIcon name="clipboard" class="size-3.5" />
        </template>
        {{ t('common.copy') }}
      </AppButton>

      <!-- Password Lock -->
      <div class="border-t border-(--border-color) pt-3">
        <div class="mb-2 flex items-center justify-between">
          <div class="flex items-center gap-1.5">
            <AppIcon name="lock-closed" class="size-3.5 text-(--text-secondary)" />
            <span class="text-xs font-medium text-(--text-main)">{{
              t('spaceManager.passwordLock')
            }}</span>
          </div>
          <AppButton
            :variant="passwordEnabled ? 'primary' : 'white'"
            size="sm"
            @click="$emit('update:passwordEnabled', !passwordEnabled)"
          >
            {{
              passwordEnabled
                ? t('common.enabled', '已开启')
                : t('common.enable', '开启')
            }}
          </AppButton>
        </div>
        <div v-if="passwordEnabled" class="flex gap-2">
          <AppInput
            :model-value="password"
            type="text"
            size="sm"
            :placeholder="t('spaceManager.setPassword')"
            @update:model-value="$emit('update:password', $event)"
          />
        </div>
      </div>
    </div>
    <div v-else class="text-center text-[10px] text-(--text-secondary) italic">
      {{ t('spaceManager.shareCard.publishHint') }}
    </div>
  </div>
</template>

<script setup>
import { useI18n } from '@/composables/useI18n';
import { useClipboard } from '@/composables/useClipboard';
import AppButton from '@/components/ui/AppButton.vue';
import AppIcon from '@/components/ui/AppIcon.vue';
import AppInput from '@/components/ui/AppInput.vue';

const props = defineProps({
  isPublic: {
    type: Boolean,
    default: false,
  },
  shareUrl: {
    type: String,
    default: '',
  },
  passwordEnabled: {
    type: Boolean,
    default: false,
  },
  password: {
    type: String,
    default: '',
  },
});

defineEmits(['update:isPublic', 'update:passwordEnabled', 'update:password']);

const { t } = useI18n();
const { copy } = useClipboard();

const copyLink = async () => {
  if (!props.shareUrl) return;
  await copy(props.shareUrl, {
    successMessage: t('common.copied'),
    errorMessage: t('common.copyFailed'),
  });
};
</script>
