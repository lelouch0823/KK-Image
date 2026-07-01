<template>
  <Modal
    :model-value="modelValue"
    :title="t('share.titleFile')"
    size="md"
    @update:model-value="close"
  >
    <!-- Content -->
    <div>
      <!-- File Info -->
      <div
        class="mb-6 flex items-center gap-3 rounded-2xl border border-(--border-color) bg-(--bg-muted) p-3"
      >
        <div class="rounded-md border border-(--border-color) bg-(--bg-card) p-2 shadow-sm">
          <AppImage
            v-if="fileIsImage"
            :src="file?.url"
            :alt="file?.name"
            :blurhash="file?.blurhash"
            class="size-8"
            fit="cover"
            rounded="sm"
          />
          <div
            v-else
            class="text-secondary flex size-8 items-center justify-center rounded bg-(--bg-muted) text-xs font-bold"
          >
            {{ fileExtension }}
          </div>
        </div>
        <div class="overflow-hidden">
          <div class="text-primary truncate font-medium" :title="file?.name">
            {{ file?.name || file?.originalName || t('share.unknownFile') }}
          </div>
          <div class="text-secondary text-xs">{{ formattedSize }}</div>
        </div>
      </div>

      <!-- Link Section -->
      <div class="mb-4">
        <label class="text-primary mb-2 block text-sm font-medium">{{
          t('share.directLink')
        }}</label>
        <div class="flex gap-2">
          <AppInput :model-value="shareUrl" readonly class="flex-1" />
          <Tooltip :content="t('common.copy')">
            <AppButton
              variant="secondary"
              size="sm"
              class="!size-10 shrink-0 !p-0"
              @click="copyLink"
            >
              <template #icon-left>
                <AppIcon name="clipboard" class="size-5" />
              </template>
            </AppButton>
          </Tooltip>
        </div>
        <p v-if="copied" class="text-success mt-2 flex items-center text-xs">
          <AppIcon name="check" class="mr-1 size-3" />
          {{ t('share.copiedClipboard') }}
        </p>
      </div>
    </div>

    <!-- Footer -->
    <template #footer>
      <AppButton
        variant="primary"
        :text="t('common.complete')"
        class="w-full sm:w-auto"
        @click="close"
      />
    </template>
  </Modal>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useToast } from '@/composables/useToast';
import { useI18n } from '@/composables/useI18n';
import { useClipboard } from '@/composables/useClipboard';
import { formatSize, getFileExtension, isImage } from '@/utils/formatters';
import Tooltip from '@/components/ui/Tooltip.vue';
import Modal from '@/components/ui/Modal.vue';
import AppButton from '@/components/ui/AppButton.vue';
import AppImage from '@/components/ui/AppImage.vue';
import AppIcon from '@/components/ui/AppIcon.vue';
import AppInput from '@/components/ui/AppInput.vue';
import { ROUTES } from '@/utils/constants';

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  file: { type: Object, default: () => ({}) },
});

const emit = defineEmits(['update:modelValue']);
const { success } = useToast();
const { t } = useI18n();
const { copy: clipboardCopy } = useClipboard();

const copied = ref(false);

// 🔧 FIX: 使用 computed 确保响应式 + 空值安全
const shareUrl = computed(() => {
  if (props.file?.storageKey) {
    return `${window.location.origin}${ROUTES.FILE(props.file.storageKey)}`;
  }
  // Fallback if storageKey is not present (e.g. legacy or simple URL)
  if (!props.file?.url) return '';
  if (props.file.url.startsWith('http')) return props.file.url;
  return `${window.location.origin}${props.file.url}`;
});

const fileIsImage = computed(() => isImage(props.file));

const fileExtension = computed(() => {
  const name = props.file?.name || props.file?.originalName || '';
  return getFileExtension(name);
});

const formattedSize = computed(() => formatSize(props.file?.size || 0));

const close = () => {
  emit('update:modelValue', false);
  copied.value = false;
};

const copyLink = async () => {
  if (!shareUrl.value) return;
  const ok = await clipboardCopy(shareUrl.value, { showToast: false });
  if (ok) {
    copied.value = true;
    setTimeout(() => (copied.value = false), 2000);
    success(t('share.linkCopied'));
  }
};
</script>
