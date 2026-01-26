<template>
  <div class="space-y-6">
    <SettingsSection
      :title="t('settings.ai.title', 'AI Configuration')"
      :description="t('settings.ai.description', 'Manage API keys and model preferences for the AI assistant.')"
      :icon="SparklesIcon"
    >
      <form class="space-y-6" @submit.prevent="saveSettings">
        <!-- API Provider URL -->
        <div class="space-y-2">
          <label class="text-primary text-sm font-medium">{{ t('settings.ai.apiUrl', 'API Base URL') }}</label>
          <div class="relative">
            <input
              v-model="form.AI_API_URL"
              type="url"
              placeholder="https://api.openai.com/v1"
              class="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] px-4 py-2.5 text-sm transition-colors focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)]/10 focus:outline-none dark:bg-[var(--bg-muted)]"
            />
          </div>
          <p class="text-secondary text-xs">{{ t('settings.ai.apiUrlDesc', 'The base URL for the OpenAI-compatible API provider.') }}</p>
        </div>

        <!-- API Key -->
        <div class="space-y-2">
          <label class="text-primary text-sm font-medium">{{ t('settings.ai.apiKey', 'API Key') }}</label>
          <div class="relative">
            <input
              v-model="form.AI_API_KEY"
              :type="showKey ? 'text' : 'password'"
              class="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] px-4 py-2.5 pr-10 text-sm transition-colors focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)]/10 focus:outline-none dark:bg-[var(--bg-muted)]"
              placeholder="sk-..."
            />
            <button
              type="button"
              class="absolute top-2.5 right-3 text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors"
              @click="showKey = !showKey"
            >
              <!-- Eye Icon -->
              <svg v-if="!showKey" class="size-5" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <!-- Eye Slash Icon -->
              <svg v-else class="size-5" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
              </svg>
            </button>
          </div>
          <p class="text-secondary text-xs">{{ t('settings.ai.apiKeyDesc', 'Your API key is stored securely in the database.') }}</p>
        </div>

        <!-- Models -->
        <div class="space-y-2">
          <label class="text-primary text-sm font-medium">{{ t('settings.ai.models', 'Model List') }}</label>
          <div class="relative">
             <textarea
              v-model="form.AI_MODELS"
              rows="3"
              class="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] px-4 py-2.5 text-sm transition-colors focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)]/10 focus:outline-none dark:bg-[var(--bg-muted)]"
              placeholder="gpt-4o, gpt-3.5-turbo..."
            ></textarea>
          </div>
          <p class="text-secondary text-xs">{{ t('settings.ai.modelListDesc', 'Comma-separated list of model IDs to attempt in order.') }}</p>
        </div>
        
        <div class="flex justify-end pt-4">
           <button
            type="submit"
            :disabled="saving"
            class="inline-flex items-center gap-2 rounded-lg bg-[var(--color-primary)] px-5 py-2.5 text-sm font-medium text-[var(--text-inverse)] shadow-sm hover:opacity-90 active:scale-95 disabled:opacity-50"
          >
            <!-- Spinner Icon -->
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
import { ref, onMounted, reactive } from 'vue';
import SettingsSection from '../SettingsSection.vue';
import { useToast } from '@/composables/useToast';
import { useI18n } from '@/composables/useI18n';

const { t } = useI18n();
const { addToast } = useToast();

// 内联 SVG 图标组件
const SparklesIcon = {
  template: `<svg fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" /></svg>`
};

const showKey = ref(false);
const loading = ref(true);
const saving = ref(false);

const form = reactive({
  AI_API_URL: '',
  AI_API_KEY: '',
  AI_MODELS: '',
});

const fetchSettings = async () => {
  try {
    loading.value = true;
    const res = await fetch('/api/manage/settings');
    const json = await res.json();
    
    if (json.success && json.data && json.data.ai) {
      const ai = json.data.ai;
      form.AI_API_URL = ai.AI_API_URL || '';
      form.AI_API_KEY = ai.AI_API_KEY || '';
      form.AI_MODELS = ai.AI_MODELS || '';
    }
  } catch (e) {
    addToast({ type: 'error', message: t('settings.ai.loadFailed') });
    console.error(e);
  } finally {
    loading.value = false;
  }
};

const saveSettings = async () => {
  try {
    saving.value = true;
    const settingsToSave = [
      { key: 'AI_API_URL', value: form.AI_API_URL, category: 'ai' },
      { key: 'AI_API_KEY', value: form.AI_API_KEY, category: 'ai' },
      { key: 'AI_MODELS', value: form.AI_MODELS, category: 'ai' },
    ];

    const res = await fetch('/api/manage/settings/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ settings: settingsToSave }),
    });
    
    const json = await res.json();
    if (json.success) {
      addToast({ message: t('order.manage.createSuccess'), type: 'success' });
    } else {
      throw new Error(json.error || t('settings.ai.saveFailed'));
    }
  } catch (e) {
    addToast({ type: 'error', message: e.message });
  } finally {
    saving.value = false;
  }
};

onMounted(() => {
  fetchSettings();
});
</script>
