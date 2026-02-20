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
        class="mb-6 flex items-center gap-3 rounded-lg border border-(--border-color) bg-(--bg-muted) p-3"
      >
        <div class="rounded-md bg-(--bg-card) p-2 shadow-sm">
          <svg class="text-warning size-6" fill="currentColor" viewBox="0 0 20 20">
            <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z"></path>
          </svg>
        </div>
        <div>
          <div class="font-medium text-(--text-main)">{{ folder?.name }}</div>
          <div class="text-xs text-(--text-secondary)">
            {{ t('fileManager.totalFiles', { count: folder?.fileCount || 0 }) }}
          </div>
        </div>
      </div>

      <!-- 🔧 NEW: 显示已有分享链接 -->
      <div
        v-if="existingShareUrl && !shareUrl"
        class="border-info/20 bg-info-bg mb-6 rounded-lg border p-4"
      >
        <div class="mb-2 flex items-center justify-between">
          <span class="text-info-text text-sm font-medium">{{
            t('share.existingLink')
          }}</span>
          <span class="text-info text-xs">{{
            formatExpiry(folder?.shareExpiresAt)
          }}</span>
        </div>
        <div class="flex gap-2">
          <input
            type="text"
            readonly
            :value="existingShareUrl"
            class="input flex-1 bg-(--bg-card) text-sm"
            @click="$event.target.select()"
          />
          <Tooltip :content="t('share.copyLink')">
            <AppButton
              variant="secondary"
              size="sm"
              class="!size-9  shrink-0 !p-0"
              :title="t('share.copyLink')"
              @click="copyExistingLink"
            >
              <template #icon-left>
                <svg class="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"></path></svg>
              </template>
            </AppButton>
          </Tooltip>
        </div>
        <p v-if="existingCopied" class="text-info mt-2 text-xs">
          ✓ {{ t('share.copiedClipboard') }}
        </p>
        <div class="border-info/20 mt-3 flex items-center justify-between border-t pt-3">
          <span class="text-info text-xs opacity-80">{{
            t('share.needUpdateExpiry')
          }}</span>
          <AppButton
            variant="ghost"
            size="xs"
            class="text-info-text h-auto !p-0 text-xs font-medium hover:text-info-text/80 hover:bg-transparent"
            :text="t('share.regenerate')"
            @click="showExpiryOptions = true"
          />
        </div>
      </div>

      <!-- Expiration Options -->
      <div v-if="!existingShareUrl || showExpiryOptions" class="mb-6">
        <label class="mb-3 block text-sm font-medium text-(--text-main)">{{
          t('share.expiration')
        }}</label>
        <div class="grid grid-cols-3 gap-3">
          <AppButton
            v-for="opt in options"
            :key="opt.value"
            :variant="expiry === opt.value ? 'primary' : 'secondary'"
            :text="opt.label"
            class="w-full text-sm"
            @click="expiry = opt.value"
          />
        </div>
      </div>

      <!-- Generated Link -->
      <div v-if="shareUrl" class="mb-4">
        <label class="mb-2 block text-sm font-medium text-(--text-main)">{{ t('share.generate') }}</label>
        <div class="flex gap-2">
          <input
            type="text"
            readonly
            :value="shareUrl"
            class="input flex-1 bg-(--bg-muted) text-sm"
            @click="$event.target.select()"
          />
          <Tooltip :content="t('common.copy')">
            <AppButton
              variant="secondary"
              size="sm"
              class="!size-9  shrink-0 !p-0"
              @click="copyLink"
            >
              <template #icon-left>
                <svg class="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"></path></svg>
              </template>
            </AppButton>
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
      <AppButton
        v-if="existingShareUrl && !showExpiryOptions && !shareUrl"
        variant="primary"
        :text="t('common.complete')"
        class="w-full sm:w-auto"
        @click="close"
      />
      <AppButton
        v-else-if="!shareUrl"
        variant="primary"
        :text="existingShareUrl ? t('share.update') : t('share.generate')"
        :loading="loading"
        class="w-full sm:w-auto"
        @click="generateLink"
      />
      <AppButton
        v-else
        variant="primary"
        :text="t('common.complete')"
        class="w-full sm:w-auto"
        @click="close"
      />
    </template>
  </Modal>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { useToast } from '@/composables/useToast';
import { useAuth } from '@/composables/useAuth';
import { useClipboard } from '@/composables/useClipboard';
import { API, ROUTES } from '@/utils/constants';
import { formatExpiry } from '@/utils/formatters';
import { useI18n } from '@/composables/useI18n';
import Tooltip from '@/components/ui/Tooltip.vue';
import Modal from '@/components/ui/Modal.vue';
import AppButton from '@/components/ui/AppButton.vue';

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  folder: { type: Object, default: () => ({}) },
});

const emit = defineEmits(['update:modelValue', 'updated']);

const { success, error } = useToast();
const { getHeaders } = useAuth();
const { t } = useI18n();
const { copy: clipboardCopy } = useClipboard();

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
  } catch (_e) {
    error(t('common.networkError') || '网络错误');
  } finally {
    loading.value = false;
  }
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

const copyExistingLink = async () => {
  if (!existingShareUrl.value) return;
  const ok = await clipboardCopy(existingShareUrl.value, { showToast: false });
  if (ok) {
    existingCopied.value = true;
    setTimeout(() => (existingCopied.value = false), 2000);
    success(t('share.linkCopied'));
  }
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
