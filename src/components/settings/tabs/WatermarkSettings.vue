<template>
  <div class="space-y-6">
    <SettingsSection
      :title="t('settings.watermark.title', 'Watermark Settings')"
      :description="t('settings.watermark.description', 'Configure global text watermark applied to uploaded images.')"
      icon="photo"
    >
      <form class="space-y-6" @submit.prevent="saveSettings">
        
        <!-- Enable Watermark -->
        <div class="flex items-center justify-between">
          <div>
            <label class="text-primary text-sm font-medium">{{ t('settings.watermark.enable', 'Enable Watermark') }}</label>
            <p class="text-secondary text-xs">{{ t('settings.watermark.enableDesc', 'When enabled, new image uploads will have a watermark applied in the browser.') }}</p>
          </div>
          <button
            type="button"
            role="switch"
            :aria-checked="form.WATERMARK_ENABLED === 'true'"
            class="focus:ring-primary focus:ring-2 focus:ring-offset-2 focus:outline-none relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out"
            :class="form.WATERMARK_ENABLED === 'true' ? 'bg-primary' : 'bg-(--bg-muted)'"
            @click="form.WATERMARK_ENABLED = form.WATERMARK_ENABLED === 'true' ? 'false' : 'true'"
          >
            <span
              aria-hidden="true"
              class="pointer-events-none inline-block size-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"
              :class="form.WATERMARK_ENABLED === 'true' ? 'translate-x-5' : 'translate-x-0'"
            />
          </button>
        </div>

        <template v-if="form.WATERMARK_ENABLED === 'true'">
          <!-- Watermark Text -->
          <div class="space-y-2">
            <label class="text-primary text-sm font-medium">{{ t('settings.watermark.text', 'Watermark Text') }}</label>
            <input
              v-model="form.WATERMARK_TEXT"
              type="text"
              class="focus:border-primary focus:ring-primary/10 focus:ring-1 focus:outline-none w-full rounded-lg border border-(--border-color) bg-(--bg-card) px-4 py-2.5 text-sm transition-colors dark:bg-(--bg-muted)"
              placeholder="e.g. KK-Image"
            />
          </div>

          <!-- Position -->
          <div class="space-y-2">
            <label class="text-primary text-sm font-medium">{{ t('settings.watermark.position', 'Position') }}</label>
            <select
              v-model="form.WATERMARK_POSITION"
              class="focus:border-primary focus:ring-primary/10 focus:ring-1 focus:outline-none w-full rounded-lg border border-(--border-color) bg-(--bg-card) px-4 py-2.5 text-sm transition-colors dark:bg-(--bg-muted)"
            >
              <option value="bottom-right">{{ t('settings.watermark.posBottomRight', 'Bottom Right') }}</option>
              <option value="bottom-left">{{ t('settings.watermark.posBottomLeft', 'Bottom Left') }}</option>
              <option value="top-right">{{ t('settings.watermark.posTopRight', 'Top Right') }}</option>
              <option value="top-left">{{ t('settings.watermark.posTopLeft', 'Top Left') }}</option>
              <option value="center">{{ t('settings.watermark.posCenter', 'Center') }}</option>
            </select>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <!-- Opacity -->
            <div class="space-y-2">
              <label class="text-primary flex justify-between text-sm font-medium">
                <span>{{ t('settings.watermark.opacity', 'Opacity') }}</span>
                <span>{{ Math.round(parseFloat(form.WATERMARK_OPACITY) * 100) }}%</span>
              </label>
              <input
                v-model="form.WATERMARK_OPACITY"
                type="range"
                min="0.1"
                max="1.0"
                step="0.1"
                class="accent-primary w-full"
              />
            </div>

            <!-- Size Ratio -->
            <div class="space-y-2">
              <label class="text-primary flex justify-between text-sm font-medium">
                <span>{{ t('settings.watermark.size', 'Size Ratio') }}</span>
                <span>{{ Math.round(parseFloat(form.WATERMARK_SIZE_RATIO) * 100) }}%</span>
              </label>
              <input
                v-model="form.WATERMARK_SIZE_RATIO"
                type="range"
                min="0.02"
                max="0.2"
                step="0.01"
                class="accent-primary w-full"
              />
              <p class="text-secondary text-xs">{{ t('settings.watermark.sizeDesc', 'Text size relative to image width.') }}</p>
            </div>
          </div>

          <!-- Color -->
          <div class="space-y-2">
            <label class="text-primary text-sm font-medium">{{ t('settings.watermark.color', 'Color') }}</label>
            <div class="flex items-center gap-3">
              <input
                v-model="form.WATERMARK_COLOR"
                type="color"
                class="h-10 w-14 cursor-pointer rounded bg-transparent p-0"
              />
              <span class="text-secondary text-sm">{{ form.WATERMARK_COLOR }}</span>
            </div>
          </div>
        </template>
        
        <div class="flex justify-end pt-4">
           <button
            type="submit"
            :disabled="saving"
            class="bg-primary inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium text-(--text-inverse) shadow-sm hover:opacity-90 active:scale-95 disabled:opacity-50"
          >
            <AppIcon v-if="saving" name="spinner" class="size-4 animate-spin" />
            <span v-if="saving">{{ t('settings.saving', 'Saving...') }}</span>
            <span v-else>{{ t('settings.save', 'Save Changes') }}</span>
          </button>
        </div>
      </form>
    </SettingsSection>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue';
import SettingsSection from '../SettingsSection.vue';
import AppIcon from '@/components/ui/AppIcon.vue';
import { useToast } from '@/composables/useToast';
import { useI18n } from '@/composables/useI18n';
import { useAuth } from '@/composables/useAuth';
import { useWatermarkSettings } from '@/composables/useWatermarkSettings';

const { t } = useI18n();
const { addToast } = useToast();
const { authFetch } = useAuth();
const { loadSettings, watermarkSettings } = useWatermarkSettings();

const saving = ref(false);

const form = reactive({
  WATERMARK_ENABLED: 'false',
  WATERMARK_TEXT: 'KK-Image',
  WATERMARK_POSITION: 'bottom-right',
  WATERMARK_OPACITY: '0.4',
  WATERMARK_COLOR: '#ffffff',
  WATERMARK_SIZE_RATIO: '0.05'
});

const loadCurrentSettings = async () => {
  await loadSettings(true); // reload from server
  form.WATERMARK_ENABLED = watermarkSettings.value.WATERMARK_ENABLED;
  form.WATERMARK_TEXT = watermarkSettings.value.WATERMARK_TEXT;
  form.WATERMARK_POSITION = watermarkSettings.value.WATERMARK_POSITION;
  form.WATERMARK_OPACITY = watermarkSettings.value.WATERMARK_OPACITY;
  form.WATERMARK_COLOR = watermarkSettings.value.WATERMARK_COLOR;
  form.WATERMARK_SIZE_RATIO = watermarkSettings.value.WATERMARK_SIZE_RATIO;
};

const saveSettings = async () => {
  try {
    saving.value = true;
    const settingsToSave = [
      { key: 'WATERMARK_ENABLED', value: form.WATERMARK_ENABLED, category: 'watermark' },
      { key: 'WATERMARK_TEXT', value: form.WATERMARK_TEXT, category: 'watermark' },
      { key: 'WATERMARK_POSITION', value: form.WATERMARK_POSITION, category: 'watermark' },
      { key: 'WATERMARK_OPACITY', value: String(form.WATERMARK_OPACITY), category: 'watermark' },
      { key: 'WATERMARK_COLOR', value: form.WATERMARK_COLOR, category: 'watermark' },
      { key: 'WATERMARK_SIZE_RATIO', value: String(form.WATERMARK_SIZE_RATIO), category: 'watermark' },
    ];

    const res = await authFetch('/api/manage/settings/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ settings: settingsToSave }),
    });
    
    const json = await res.json();
    if (json.success) {
      addToast({ message: t('settings.success', 'Settings saved successfully'), type: 'success' });
      // update local memory immediately
      Object.assign(watermarkSettings.value, form);
    } else {
      throw new Error(json.error || t('settings.saveFailed', 'Save failed'));
    }
  } catch (e) {
    addToast({ type: 'error', message: e.message });
  } finally {
    saving.value = false;
  }
};

onMounted(() => {
  loadCurrentSettings();
});
</script>
