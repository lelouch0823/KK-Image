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
        class="mb-6 flex items-center gap-3 rounded-2xl border border-(--border-color) bg-(--bg-muted) p-3"
      >
        <div class="rounded-md bg-(--bg-card) p-2 shadow-sm">
          <AppIcon name="folder-solid" class="text-warning size-6" />
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
        class="border-info/20 bg-info-bg mb-6 rounded-2xl border p-4"
      >
        <div class="mb-2 flex items-center justify-between">
          <span class="text-info-text text-sm font-medium">{{ t('share.existingLink') }}</span>
          <span class="text-info text-xs">{{ formatExpiry(folder?.shareExpiresAt) }}</span>
        </div>
        <div class="flex gap-2">
          <AppInput :model-value="existingShareUrl" readonly class="flex-1" />
          <Tooltip :content="t('share.copyLink')">
            <AppButton
              variant="secondary"
              size="sm"
              class="!size-9 shrink-0 !p-0"
              :title="t('share.copyLink')"
              @click="copyExistingLink"
            >
              <template #icon-left>
                <AppIcon name="clipboard" class="size-4" />
              </template>
            </AppButton>
          </Tooltip>
        </div>
        <p v-if="existingCopied" class="text-info mt-2 text-xs">
          ✓ {{ t('share.copiedClipboard') }}
        </p>
        <div class="border-info/20 mt-3 flex items-center justify-between border-t pt-3">
          <span class="text-info text-xs opacity-80">{{ t('share.needUpdateExpiry') }}</span>
          <AppButton
            variant="ghost"
            size="sm"
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
        <label class="mb-2 block text-sm font-medium text-(--text-main)">{{
          t('share.generate')
        }}</label>
        <div class="flex gap-2">
          <AppInput :model-value="shareUrl" readonly class="flex-1" />
          <Tooltip :content="t('common.copy')">
            <AppButton
              variant="secondary"
              size="sm"
              class="!size-9 shrink-0 !p-0"
              @click="copyLink"
            >
              <template #icon-left>
                <AppIcon name="clipboard" class="size-4" />
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
import AppIcon from '@/components/ui/AppIcon.vue';
import AppInput from '@/components/ui/AppInput.vue';

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  folder: { type: Object, default: () => ({}) },
});

const emit = defineEmits(['update:modelValue', 'updated']);

const { success, error } = useToast();
const { authFetchJson } = useAuth();
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

    const res = await authFetchJson(API.FOLDER_BY_ID(props.folder.id), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        shareExpiresAt: timestamp,
        isPublic: true,
      }),
    });

    if (res.success) {
      shareUrl.value = window.location.origin + res.data.shareUrl;
      emit('updated');
    } else {
      error(res.message || t('share.generateFailed'));
    }
  } catch (_e) {
    error(t('common.networkError'));
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
