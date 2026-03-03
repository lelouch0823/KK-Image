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
      <!-- Toggle Switch -->
      <label class="relative inline-flex cursor-pointer items-center">
        <input
          :checked="isPublic"
          type="checkbox"
          class="peer sr-only"
          @change="$emit('update:isPublic', $event.target.checked)"
        />
        <div
          class="peer h-5 w-9 rounded-full bg-(--border-strong) transition-all peer-checked:bg-primary peer-focus:outline-none after:absolute after:top-[2px] after:left-[2px] after:h-4 after:w-4 after:rounded-full after:bg-(--bg-card) after:transition-all after:content-[''] peer-checked:after:translate-x-full"
        ></div>
      </label>
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
      <button
        class="bg-primary/5 text-primary flex w-full items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-medium transition-colors hover:bg-primary/10"
        @click.prevent="copyLink"
      >
        <AppIcon name="clipboard" class="size-3.5" />
        {{ t('common.copy') }}
      </button>

      <!-- Password Lock -->
      <div class="border-t border-(--border-color) pt-3">
        <div class="mb-2 flex items-center justify-between">
          <div class="flex items-center gap-1.5">
            <AppIcon name="lock-closed" class="size-3.5 text-(--text-secondary)" />
            <span class="text-xs font-medium text-(--text-main)">{{
              t('spaceManager.passwordLock')
            }}</span>
          </div>
          <label class="relative inline-flex cursor-pointer items-center">
            <input
              :checked="passwordEnabled"
              type="checkbox"
              class="peer sr-only"
              @change="$emit('update:passwordEnabled', $event.target.checked)"
            />
            <div
              class="peer h-4 w-7 rounded-full bg-(--color-gray-200) peer-checked:bg-primary after:absolute after:top-[2px] after:left-[2px] after:h-3 after:w-3 after:rounded-full after:bg-(--bg-card) after:transition-all after:content-[''] peer-checked:after:translate-x-full"
            ></div>
          </label>
        </div>
        <div v-if="passwordEnabled" class="flex gap-2">
          <input
            :value="password"
            type="text"
            class="focus:border-primary flex-1 rounded-lg border border-(--border-color) bg-(--bg-card) px-3 py-1.5 text-sm text-(--text-main) transition-all outline-none"
            :placeholder="t('spaceManager.setPassword')"
            @input="$emit('update:password', $event.target.value)"
          />
        </div>
      </div>
    </div>
    <div v-else class="text-center text-[10px] text-(--text-secondary) italic">>
      {{ t('spaceManager.shareCard.publishHint') }}
    </div>
  </div>
</template>

<script setup>
import { useI18n } from '@/composables/useI18n';
import { useClipboard } from '@/composables/useClipboard';
import AppIcon from '@/components/ui/AppIcon.vue';

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
