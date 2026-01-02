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
        class="mb-6 flex items-center gap-3 rounded-lg border border-[var(--border-color)] bg-[var(--bg-muted)] p-3"
      >
        <div class="rounded-md border border-[var(--border-color)] bg-white p-2 shadow-sm">
          <img v-if="fileIsImage" :src="file?.url" class="size-8 rounded object-cover" />
          <div
            v-else
            class="text-secondary flex size-8 items-center justify-center rounded bg-[var(--bg-muted)] text-xs font-bold"
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
          <input
            type="text"
            readonly
            :value="shareUrl"
            class="input flex-1 bg-[var(--bg-muted)] text-sm"
            @click="$event.target.select()"
          />
          <Tooltip :content="t('common.copy')">
            <button
              class="text-secondary flex size-10 items-center justify-center rounded-lg border border-[var(--border-color)] bg-white transition-colors hover:text-primary hover:bg-[var(--bg-hover)]"
              @click="copyLink"
            >
              <svg class="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"
                ></path>
              </svg>
            </button>
          </Tooltip>
        </div>
        <p v-if="copied" class="mt-2 flex items-center text-xs text-[var(--color-success)]">
          <svg class="mr-1 size-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M5 13l4 4L19 7"
            ></path>
          </svg>
          {{ t('share.copiedClipboard') }}
        </p>
      </div>
    </div>

    <!-- Footer -->
    <template #footer>
      <button class="btn btn-primary w-full sm:w-auto" @click="close">
        {{ t('common.complete') }}
      </button>
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
import { ROUTES } from '@/utils/constants';

const props = defineProps({
  modelValue: Boolean,
  file: Object,
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
