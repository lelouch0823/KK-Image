<template>
  <div class="space-y-6">
    <SettingsSection
      :title="t('settings.watermark.title', 'Watermark Settings')"
      :description="t('settings.watermark.description', 'Configure global text watermark applied to uploaded images.')"
      :icon="PhotoIcon"
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
            class="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2 focus:outline-none"
            :class="form.WATERMARK_ENABLED === 'true' ? 'bg-[var(--color-primary)]' : 'bg-[var(--bg-muted)]'"
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
              class="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] px-4 py-2.5 text-sm transition-colors focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)]/10 focus:outline-none dark:bg-[var(--bg-muted)]"
              placeholder="e.g. KK-Image"
            />
          </div>

          <!-- Position -->
          <div class="space-y-2">
            <label class="text-primary text-sm font-medium">{{ t('settings.watermark.position', 'Position') }}</label>
            <select
              v-model="form.WATERMARK_POSITION"
              class="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] px-4 py-2.5 text-sm transition-colors focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)]/10 focus:outline-none dark:bg-[var(--bg-muted)]"
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
                class="w-full accent-[var(--color-primary)]"
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
                class="w-full accent-[var(--color-primary)]"
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
            class="inline-flex items-center gap-2 rounded-lg bg-[var(--color-primary)] px-5 py-2.5 text-sm font-medium text-[var(--text-inverse)] shadow-sm hover:opacity-90 active:scale-95 disabled:opacity-50"
          >
            <svg v-if="saving" class="size-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
            </svg>
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
import { useToast } from '@/composables/useToast';
import { useI18n } from '@/composables/useI18n';
import { useWatermarkSettings } from '@/composables/useWatermarkSettings';

const { t } = useI18n();
const { addToast } = useToast();
const { loadSettings, watermarkSettings } = useWatermarkSettings();

const PhotoIcon = {
  template: `<svg fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" /></svg>`
};

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

    const res = await fetch('/api/manage/settings/batch', {
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
