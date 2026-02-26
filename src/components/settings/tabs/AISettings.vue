<template>
  <div class="space-y-6">
    <SettingsSection
      :title="t('settings.ai.title', 'AI Configuration')"
      :description="t('settings.ai.description', 'Manage API keys and model preferences for the AI assistant.')"
      icon="sparkles"
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
              class="absolute top-2.5 right-3 text-[var(--text-muted)] transition-colors hover:text-[var(--text-main)]"
              @click="showKey = !showKey"
            >
              <AppIcon v-if="!showKey" name="eye" class="size-5" />
              <AppIcon v-else name="eye-slash" class="size-5" />
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
import { ref, onMounted, reactive } from 'vue';
import SettingsSection from '../SettingsSection.vue';
import AppIcon from '@/components/ui/AppIcon.vue';
import { useToast } from '@/composables/useToast';
import { useI18n } from '@/composables/useI18n';

const { t } = useI18n();
const { addToast } = useToast();

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
