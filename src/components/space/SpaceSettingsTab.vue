<template>
  <div class="flex-1 space-y-5 overflow-y-auto p-6">
    <!-- 销售可见性设置 -->
    <SpaceVisibilitySelector
      v-model="currentShareMode"
      v-model:selected-salespersons="selectedSalespersonIds"
      :class="{ 'pointer-events-none opacity-70': !canManage }"
    >
      <template #footer>
        <!-- 保存按钮 -->
        <AppButton
          v-if="canManage"
          :disabled="publishing || !hasChanges"
          :variant="hasChanges ? 'primary' : 'secondary'"
          class="mt-4 w-full"
          data-testid="save-share-settings"
          @click="saveShareSettings"
        >
          <template v-if="publishing" #icon-left>
            <AppIcon name="spinner" class="size-4 animate-spin" />
          </template>
          {{
            publishing
              ? t('common.saving')
              : hasChanges
                ? t('spaceManager.saveShareSettings')
                : t('spaceManager.shareSettingsSaved')
          }}
        </AppButton>
      </template>
    </SpaceVisibilitySelector>

    <!-- 公开链接区域 -->
    <div v-if="isPublic" class="overflow-hidden rounded-2xl border border-(--border-color) bg-(--bg-card)">
      <div class="flex items-center gap-3 border-b border-(--border-color) px-5 py-4">
        <div class="bg-success/10 flex size-9 items-center justify-center rounded-lg">
          <AppIcon name="link" class="text-success size-4.5" />
        </div>
        <div class="flex-1">
          <h3 class="text-sm font-semibold text-(--text-main)">{{ t('spaceManager.publicLink') || '公开链接' }}</h3>
          <p class="text-xs text-(--text-secondary)">{{ viewCount || 0 }} {{ t('spacePublic.views') }}</p>
        </div>
      </div>

      <div class="space-y-3 p-5">
        <div class="flex min-w-0 gap-2">
          <AppInput
            :model-value="shareUrl"
            size="sm"
            class="min-w-0 flex-1"
            readonly
            :value="shareUrl"
            :title="shareUrl"
          />
          <AppButton
            variant="white"
            size="sm"
            @click="copyLink"
          >
            <template #icon-left>
              <AppIcon name="clipboard" class="size-4" />
            </template>
            {{ t('common.copy') }}
          </AppButton>
        </div>
        <AppButton
          v-if="canManage"
          :disabled="publishing"
          variant="outline"
          class="w-full border-danger/30 text-danger hover:border-danger hover:bg-danger/5 hover:text-danger"
          @click="$emit('unpublish')"
        >
          {{ t('spaceManager.shareCard.unpublish') }}
        </AppButton>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { useClipboard } from '@/composables/useClipboard';
import SpaceVisibilitySelector from '@/components/space/SpaceVisibilitySelector.vue';
import AppButton from '@/components/ui/AppButton.vue';
import AppIcon from '@/components/ui/AppIcon.vue';
import AppInput from '@/components/ui/AppInput.vue';

const props = defineProps({
  isPublic: { type: Boolean, default: false },
  shareUrl: { type: String, default: '' },
  viewCount: { type: Number, default: 0 },
  publishing: { type: Boolean, default: false },
  shareMode: { type: String, default: 'none' },
  sharedSalespersons: { type: Array, default: () => [] },
  canManage: { type: Boolean, default: false },
});

const emit = defineEmits(['publish', 'unpublish', 'update-share-settings']);

const { t } = useI18n();
const { copy } = useClipboard();

const currentShareMode = ref(props.shareMode);
const selectedSalespersonIds = ref(props.sharedSalespersons.map((sp) => sp.id));

// 脏检查 - 判断是否有改动
const initialShareMode = ref(props.shareMode);
const initialSalespersonIds = ref([...props.sharedSalespersons.map((sp) => sp.id)]);

const hasChanges = computed(() => {
  if (currentShareMode.value !== initialShareMode.value) return true;
  if (currentShareMode.value === 'selected') {
    const a = [...selectedSalespersonIds.value].sort();
    const b = [...initialSalespersonIds.value].sort();
    return JSON.stringify(a) !== JSON.stringify(b);
  }
  return false;
});

watch(() => props.shareMode, (val) => {
  currentShareMode.value = val;
  initialShareMode.value = val;
});
watch(() => props.sharedSalespersons, (val) => {
  const ids = val.map((sp) => sp.id);
  selectedSalespersonIds.value = [...ids];
  initialSalespersonIds.value = [...ids];
}, { deep: true });

const saveShareSettings = () => {
  emit('update-share-settings', {
    shareMode: currentShareMode.value,
    sharedSalespersonIds: currentShareMode.value === 'selected' ? selectedSalespersonIds.value : [],
  });
};

const copyLink = async () => {
  if (!props.shareUrl) return;
  await copy(props.shareUrl, {
    successMessage: t('share.linkCopied'),
    errorMessage: t('common.copyFailed'),
  });
};
</script>
