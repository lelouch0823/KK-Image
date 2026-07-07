<template>
  <div class="space-y-6">
    <SettingsSection
      :title="t('settings.watermark.title', 'Watermark Settings')"
      :description="
        t(
          'settings.watermark.description',
          'Configure global text watermark applied to uploaded images.'
        )
      "
      icon="photo"
    >
      <form class="space-y-6" @submit.prevent="saveSettings">
        <!-- Enable Watermark -->
        <AppCard padding="p-4" class="space-y-4">
          <div class="flex items-center justify-between gap-4">
            <div>
              <label class="text-primary text-sm font-medium">{{
                t('settings.watermark.enable', 'Enable Watermark')
              }}</label>
              <p class="text-secondary text-xs">
                {{
                  t(
                    'settings.watermark.enableDesc',
                    'When enabled, new image uploads will have a watermark applied in the browser.'
                  )
                }}
              </p>
            </div>
            <AppButton
              type="button"
              size="sm"
              :variant="form.WATERMARK_ENABLED === 'true' ? 'primary' : 'secondary'"
              :text="
                form.WATERMARK_ENABLED === 'true'
                  ? t('common.enabled', 'Enabled')
                  : t('common.disabled', 'Disabled')
              "
              @click="toggleWatermarkEnabled"
            />
          </div>
        </AppCard>

        <template v-if="form.WATERMARK_ENABLED === 'true'">
          <AppCard padding="p-4" class="space-y-5">
            <!-- Watermark Text -->
            <div class="space-y-2">
              <label class="text-primary text-sm font-medium">{{
                t('settings.watermark.text', 'Watermark Text')
              }}</label>
              <AppInput v-model="form.WATERMARK_TEXT" type="text" placeholder="e.g. KK-Image" />
            </div>

            <!-- Position -->
            <div class="space-y-2">
              <label class="text-primary text-sm font-medium">{{
                t('settings.watermark.position', 'Position')
              }}</label>
              <AppSelect
                v-model="form.WATERMARK_POSITION"
                :options="positionOptions"
                :placeholder="t('settings.watermark.posBottomRight', 'Bottom Right')"
              />
            </div>

            <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
              <AppSlider
                v-model="form.WATERMARK_OPACITY"
                :label="t('settings.watermark.opacity', 'Opacity')"
                :value-text="`${Math.round(parseFloat(form.WATERMARK_OPACITY) * 100)}%`"
                min="0.1"
                max="1.0"
                step="0.1"
              />

              <AppSlider
                v-model="form.WATERMARK_SIZE_RATIO"
                :label="t('settings.watermark.size', 'Size Ratio')"
                :value-text="`${Math.round(parseFloat(form.WATERMARK_SIZE_RATIO) * 100)}%`"
                :hint="t('settings.watermark.sizeDesc', 'Text size relative to image width.')"
                min="0.02"
                max="0.2"
                step="0.01"
              />
            </div>

            <AppColorInput
              v-model="form.WATERMARK_COLOR"
              :label="t('settings.watermark.color', 'Color')"
              :hint="t('settings.watermark.colorHint', 'Choose the exported watermark color.')"
            />
          </AppCard>
        </template>

        <ActionBar class="border-none bg-transparent px-0 py-0 shadow-none">
          <AppButton
            type="submit"
            variant="primary"
            :loading="saving"
            :text="saving ? t('settings.saving', 'Saving...') : t('settings.save', 'Save Changes')"
          >
            <template v-if="!saving" #icon-left>
              <AppIcon name="check-badge" class="size-4" />
            </template>
          </AppButton>
        </ActionBar>
      </form>
    </SettingsSection>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue';
import SettingsSection from '../SettingsSection.vue';
import AppIcon from '@/components/ui/AppIcon.vue';
import AppButton from '@/components/ui/AppButton.vue';
import AppCard from '@/components/ui/AppCard.vue';
import AppColorInput from '@/components/ui/AppColorInput.vue';
import AppInput from '@/components/ui/AppInput.vue';
import AppSlider from '@/components/ui/AppSlider.vue';
import AppSelect from '@/components/ui/Select.vue';
import ActionBar from '@/design-system/composed/ActionBar.vue';
import { useI18n } from '@/composables/useI18n';
import { useWatermarkSettings } from '@/composables/useWatermarkSettings';
import { useSettingsBatchSave } from '@/composables/useSettingsBatchSave';

const { t } = useI18n();
const { loadSettings, watermarkSettings } = useWatermarkSettings();
const { saving, saveSettings: batchSave } = useSettingsBatchSave(() => {
  Object.assign(watermarkSettings.value, form);
});

const form = reactive({
  WATERMARK_ENABLED: 'false',
  WATERMARK_TEXT: 'KK-Image',
  WATERMARK_POSITION: 'bottom-right',
  WATERMARK_OPACITY: '0.4',
  WATERMARK_COLOR: '#ffffff',
  WATERMARK_SIZE_RATIO: '0.05',
});

const positionOptions = [
  { value: 'bottom-right', label: t('settings.watermark.posBottomRight', 'Bottom Right') },
  { value: 'bottom-left', label: t('settings.watermark.posBottomLeft', 'Bottom Left') },
  { value: 'top-right', label: t('settings.watermark.posTopRight', 'Top Right') },
  { value: 'top-left', label: t('settings.watermark.posTopLeft', 'Top Left') },
  { value: 'center', label: t('settings.watermark.posCenter', 'Center') },
];

const toggleWatermarkEnabled = () => {
  form.WATERMARK_ENABLED = form.WATERMARK_ENABLED === 'true' ? 'false' : 'true';
};

const loadCurrentSettings = async () => {
  await loadSettings(true); // reload from server
  form.WATERMARK_ENABLED = watermarkSettings.value.WATERMARK_ENABLED;
  form.WATERMARK_TEXT = watermarkSettings.value.WATERMARK_TEXT;
  form.WATERMARK_POSITION = watermarkSettings.value.WATERMARK_POSITION;
  form.WATERMARK_OPACITY = watermarkSettings.value.WATERMARK_OPACITY;
  form.WATERMARK_COLOR = watermarkSettings.value.WATERMARK_COLOR;
  form.WATERMARK_SIZE_RATIO = watermarkSettings.value.WATERMARK_SIZE_RATIO;
};

const saveSettings = () =>
  batchSave([
    { key: 'WATERMARK_ENABLED', value: form.WATERMARK_ENABLED, category: 'watermark' },
    { key: 'WATERMARK_TEXT', value: form.WATERMARK_TEXT, category: 'watermark' },
    { key: 'WATERMARK_POSITION', value: form.WATERMARK_POSITION, category: 'watermark' },
    { key: 'WATERMARK_OPACITY', value: String(form.WATERMARK_OPACITY), category: 'watermark' },
    { key: 'WATERMARK_COLOR', value: form.WATERMARK_COLOR, category: 'watermark' },
    { key: 'WATERMARK_SIZE_RATIO', value: String(form.WATERMARK_SIZE_RATIO), category: 'watermark' },
  ]);

onMounted(() => {
  loadCurrentSettings();
});
</script>
