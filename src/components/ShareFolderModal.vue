<template>
  <Modal
    :model-value="modelValue"
    :title="t('share.titleFolder')"
    size="md"
    @update:model-value="close"
  >
    <!-- Content -->
    <div>
      <!-- Folder Info -->
      <div
        class="mb-6 flex items-center gap-3 rounded-lg border border-[var(--border-color)] bg-[var(--bg-muted)] p-3"
      >
        <div class="rounded-md bg-white p-2 shadow-sm">
          <svg class="size-6 text-[var(--color-warning)]" fill="currentColor" viewBox="0 0 20 20">
            <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z"></path>
          </svg>
        </div>
        <div>
          <div class="text-primary font-medium">{{ folder?.name }}</div>
          <div class="text-secondary text-xs">
            {{ t('fileManager.totalFiles', { count: folder?.fileCount || 0 }) }}
          </div>
        </div>
      </div>

      <!-- 🔧 NEW: 显示已有分享链接 -->
      <div
        v-if="existingShareUrl && !shareUrl"
        class="mb-6 rounded-lg border border-blue-100 bg-[var(--color-info-bg)] p-4"
      >
        <div class="mb-2 flex items-center justify-between">
          <span class="text-sm font-medium text-[var(--color-info-text)]">{{
            t('share.existingLink')
          }}</span>
          <span class="text-xs text-[var(--color-info)]">{{
            formatExpiry(folder?.shareExpiresAt)
          }}</span>
        </div>
        <div class="flex gap-2">
          <input
            type="text"
            readonly
            :value="existingShareUrl"
            class="input flex-1 bg-white text-sm"
            @click="$event.target.select()"
          />
          <Tooltip :content="t('share.copyLink')">
            <button
              class="text-secondary flex size-9 items-center justify-center rounded-lg border border-[var(--border-color)] bg-white transition-colors hover:bg-gray-50 hover:text-[var(--color-info)]"
              @click="copyExistingLink"
            >
              <svg class="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
        <p v-if="existingCopied" class="mt-2 text-xs text-[var(--color-info)]">
          ✓ {{ t('share.copiedClipboard') }}
        </p>
        <div class="mt-3 flex items-center justify-between border-t border-blue-100 pt-3">
          <span class="text-xs text-[var(--color-info)] opacity-80">{{
            t('share.needUpdateExpiry')
          }}</span>
          <button
            class="text-xs font-medium text-[var(--color-info-text)] hover:underline"
            @click="showExpiryOptions = true"
          >
            {{ t('share.regenerate') }}
          </button>
        </div>
      </div>

      <!-- Expiration Options -->
      <div v-if="!existingShareUrl || showExpiryOptions" class="mb-6">
        <label class="text-primary mb-3 block text-sm font-medium">{{
          t('share.expiration')
        }}</label>
        <div class="grid grid-cols-3 gap-3">
          <button
            v-for="opt in options"
            :key="opt.value"
            class="rounded-lg border px-3 py-2 text-center text-sm transition-all"
            :class="
              expiry === opt.value
                ? 'border-primary text-primary ring-primary bg-[var(--color-primary-bg)] font-medium ring-1'
                : 'text-secondary border-[var(--border-color)] hover:border-gray-300'
            "
            @click="expiry = opt.value"
          >
            {{ opt.label }}
          </button>
        </div>
      </div>

      <!-- Generated Link -->
      <div v-if="shareUrl" class="mb-4">
        <label class="text-primary mb-2 block text-sm font-medium">{{ t('share.generate') }}</label>
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
              class="text-secondary flex size-9 items-center justify-center rounded-lg border border-[var(--border-color)] bg-white transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--color-success)]"
              @click="copyLink"
            >
              <svg class="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
      <button
        v-if="existingShareUrl && !showExpiryOptions && !shareUrl"
        class="btn btn-primary w-full sm:w-auto"
        @click="close"
      >
        {{ t('common.complete') }}
      </button>
      <button
        v-else-if="!shareUrl"
        :disabled="loading"
        class="btn btn-primary w-full sm:w-auto"
        @click="generateLink"
      >
        <span
          v-if="loading"
          class="mr-2 size-4 animate-spin rounded-full border-b-2 border-white"
        ></span>
        {{ existingShareUrl ? t('share.update') : t('share.generate') }}
      </button>
      <button v-else class="btn btn-primary w-full sm:w-auto" @click="close">
        {{ t('common.complete') }}
      </button>
    </template>
  </Modal>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { useToast } from '@/composables/useToast';
import { useAuth } from '@/composables/useAuth';
import { API, ROUTES } from '@/utils/constants';
import { formatExpiry } from '@/utils/formatters';
import { useI18n } from '@/composables/useI18n';
import Tooltip from '@/components/ui/Tooltip.vue';
import Modal from '@/components/ui/Modal.vue';

const props = defineProps({
  modelValue: Boolean,
  folder: Object,
});

const emit = defineEmits(['update:modelValue', 'updated']);

const { success, error } = useToast();
const { getHeaders } = useAuth();
const { t } = useI18n();

const loading = ref(false);
const expiry = ref(7);
const shareUrl = ref('');
const copied = ref(false);
const existingCopied = ref(false);
const showExpiryOptions = ref(false);

const options = computed(() => [
  { label: t('share.days7'), value: 7 },
  { label: t('share.days30'), value: 30 },
  { label: t('share.permanent'), value: 0 },
]);

// 🔧 NEW: 计算已有分享链接
const existingShareUrl = computed(() => {
  if (!props.folder?.shareToken) return '';
  return `${window.location.origin}${ROUTES.GALLERY(props.folder.shareToken)}`;
});

const close = () => {
  emit('update:modelValue', false);
  shareUrl.value = '';
  copied.value = false;
  existingCopied.value = false;
  showExpiryOptions.value = false;
};

const generateLink = async () => {
  if (!props.folder) return;
  loading.value = true;

  try {
    let timestamp = null;
    if (expiry.value > 0) {
      timestamp = Date.now() + expiry.value * 24 * 60 * 60 * 1000;
    }

    const res = await fetch(API.FOLDER_BY_ID(props.folder.id), {
      method: 'PUT',
      headers: getHeaders(true),
      body: JSON.stringify({
        shareExpiresAt: timestamp,
        isPublic: true,
      }),
    }).then((r) => r.json());

    if (res.success) {
      shareUrl.value = window.location.origin + res.data.shareUrl;
      emit('updated');
    } else {
      error(res.message || t('share.generateFailed'));
    }
  } catch (e) {
    error(t('share.networkError') || '网络错误');
  } finally {
    loading.value = false;
  }
};

const copyLink = () => {
  if (!shareUrl.value) return;
  navigator.clipboard.writeText(shareUrl.value).then(() => {
    copied.value = true;
    setTimeout(() => (copied.value = false), 2000);
    success(t('share.linkCopied'));
  });
};

const copyExistingLink = () => {
  if (!existingShareUrl.value) return;
  navigator.clipboard.writeText(existingShareUrl.value).then(() => {
    existingCopied.value = true;
    setTimeout(() => (existingCopied.value = false), 2000);
    success(t('share.linkCopied'));
  });
};

watch(
  () => props.modelValue,
  (val) => {
    if (val) {
      shareUrl.value = '';
      showExpiryOptions.value = false;
    }
  }
);
</script>
