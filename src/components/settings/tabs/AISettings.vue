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
              class="focus:border-primary focus:ring-primary/10 focus:ring-1 focus:outline-none w-full rounded-lg border border-(--border-color) bg-(--bg-card) px-4 py-2.5 text-sm transition-colors dark:bg-(--bg-muted)"
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
              class="focus:border-primary focus:ring-primary/10 focus:ring-1 focus:outline-none w-full rounded-lg border border-(--border-color) bg-(--bg-card) px-4 py-2.5 pr-10 text-sm transition-colors dark:bg-(--bg-muted)"
              placeholder="sk-..."
            />
            <button
              type="button"
              class="absolute top-2.5 right-3 text-(--text-muted) transition-colors hover:text-(--text-main)"
              @click="showKey = !showKey"
            >
              <AppIcon v-if="!showKey" name="eye" class="size-5" />
              <AppIcon v-else name="eye-slash" class="size-5" />
            </button>
          </div>
          <p class="text-secondary text-xs">{{ t('settings.ai.apiKeyDesc', 'Your API key is stored securely in the database.') }}</p>
        </div>

        <div class="space-y-2 rounded-lg border border-(--border-color) bg-(--bg-card) p-3">
          <div class="flex items-start justify-between gap-3">
            <div>
              <p class="text-sm font-medium text-(--text-main)">{{ t('settings.ai.dynamicFallback', 'Dynamic Fallback') }}</p>
              <p class="mt-1 text-xs text-(--text-secondary)">
                {{ t('settings.ai.dynamicFallbackDesc', 'When enabled, fallback models are auto-ranked by recent failure rate and latency window. Primary model remains fixed.') }}
              </p>
            </div>
            <label class="inline-flex cursor-pointer items-center">
              <input
                v-model="dynamicFallbackEnabled"
                type="checkbox"
                class="peer sr-only"
              />
              <span class="peer-checked:bg-primary h-6 w-11 rounded-full bg-(--bg-muted) transition-colors"></span>
            </label>
          </div>

          <div class="pt-2">
            <label class="text-primary text-xs font-medium">{{ t('settings.ai.healthWindow', 'Health Window') }}</label>
            <input
              v-model.number="form.AI_MODEL_HEALTH_WINDOW"
              :disabled="!dynamicFallbackEnabled"
              type="number"
              min="5"
              max="200"
              class="focus:border-primary focus:ring-primary/20 focus:ring-1 focus:outline-none mt-1 w-full rounded-lg border border-(--border-color) bg-(--bg-card) px-3 py-2 text-xs text-(--text-main) disabled:cursor-not-allowed disabled:opacity-50"
            />
            <p class="mt-1 text-xs text-(--text-muted)">{{ t('settings.ai.healthWindowHint', 'Use 5-200 recent requests per model for failure/latency scoring.') }}</p>
          </div>
        </div>

        <!-- Models -->
        <div class="space-y-2">
          <label class="text-primary text-sm font-medium">{{ t('settings.ai.models', 'Model List') }}</label>
          <p class="text-secondary text-xs">{{ t('settings.ai.modelListDesc', 'Select models from fetched list. The first one has highest priority.') }}</p>
          <p class="text-secondary text-xs">
            {{ t('settings.ai.orderHint', 'Sort from top to bottom by priority. If the primary model fails or is rate-limited, AI will automatically fall back to the next model.') }}
          </p>

          <div class="rounded-lg border border-(--border-color) bg-(--bg-card) p-3">
            <p class="mb-2 text-xs font-medium text-(--text-secondary)">{{ t('settings.ai.selectedModels', 'Selected Models') }}</p>
            <div
              v-if="selectedModels.length > 0"
              data-testid="selected-model-grid"
              class="grid gap-2 sm:grid-cols-2 xl:grid-cols-3"
            >
              <div
                v-for="(model, index) in selectedModels"
                :key="`selected-${model}`"
                draggable="true"
                data-testid="selected-model-card"
                class="group rounded-lg border border-(--border-color) bg-(--bg-muted) p-2.5 text-[11px] text-(--text-main) transition-colors hover:border-primary/30 hover:bg-(--bg-hover)"
                @dragstart="onDragStart(index)"
                @dragover.prevent
                @drop.prevent="onDrop(index)"
              >
                <div class="flex items-start justify-between gap-2">
                  <div class="min-w-0 flex-1">
                    <div class="flex min-w-0 items-center gap-2">
                      <span class="cursor-grab text-(--text-muted) active:cursor-grabbing" :title="t('settings.ai.dragToSort', 'Drag to sort')">
                        <AppIcon name="bars-3" class="size-4" />
                      </span>
                      <span class="truncate font-mono text-xs">{{ model }}</span>
                    </div>
                    <div class="mt-2 flex flex-wrap items-center gap-1.5">
                      <span
                        class="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold"
                        :class="index === 0
                          ? 'bg-primary/15 text-primary'
                          : 'bg-(--bg-card) text-(--text-secondary)'"
                      >
                        {{ index === 0 ? t('settings.ai.primaryModel', 'Primary') : t('settings.ai.fallbackModel', { index }) }}
                      </span>
                      <span
                        class="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold"
                        :class="isVisionModel(model)
                          ? 'bg-success/15 text-success'
                          : 'bg-warning/15 text-warning'"
                      >
                        {{ isVisionModel(model)
                          ? t('settings.ai.visionSupported', '支持图片')
                          : t('settings.ai.visionLikelyUnsupported', '可能仅文本') }}
                      </span>
                    </div>
                  </div>
                  <div class="flex shrink-0 items-center gap-1">
                    <button
                      v-if="index > 0"
                      data-testid="set-primary-btn"
                      type="button"
                      class="cursor-pointer rounded px-2 py-1 text-[10px] text-(--text-secondary) transition-colors hover:bg-(--bg-card) hover:text-(--text-main)"
                      @click="setPrimaryModel(model)"
                    >
                      {{ t('settings.ai.setPrimary', 'Set Primary') }}
                    </button>
                    <button
                      type="button"
                      class="cursor-pointer rounded p-0.5 text-(--text-muted) transition-colors hover:bg-(--bg-card) hover:text-(--text-main)"
                      @click="removeSelectedModel(model)"
                    >
                      <AppIcon name="x-mark" class="size-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <p v-else class="text-xs text-(--text-muted)">{{ t('settings.ai.noSelectedModels', 'No model selected yet') }}</p>
          </div>

          <div class="flex flex-wrap items-center gap-2 pt-1">
            <button
              type="button"
              :disabled="modelFetching || !form.AI_API_URL || !form.AI_API_KEY"
              class="inline-flex items-center gap-2 rounded-lg border border-(--border-color) bg-(--bg-card) px-3 py-2 text-xs font-medium text-(--text-main) transition-colors hover:bg-(--bg-hover) disabled:cursor-not-allowed disabled:opacity-50"
              @click="fetchModels"
            >
              <AppIcon v-if="modelFetching" name="spinner" class="size-4 animate-spin" />
              <AppIcon v-else name="magnifying-glass" class="size-4" />
              {{ t('settings.ai.fetchModels', 'Fetch Models') }}
            </button>

            <button
              type="button"
              :disabled="testing || !form.AI_API_URL || !form.AI_API_KEY"
              class="inline-flex items-center gap-2 rounded-lg border border-(--border-color) bg-(--bg-card) px-3 py-2 text-xs font-medium text-(--text-main) transition-colors hover:bg-(--bg-hover) disabled:cursor-not-allowed disabled:opacity-50"
              @click="testConnection"
            >
              <AppIcon v-if="testing" name="spinner" class="size-4 animate-spin" />
              <AppIcon v-else name="check-badge" class="size-4" />
              {{ t('settings.ai.testConnection', 'Test Connectivity') }}
            </button>
          </div>

          <div v-if="availableModels.length > 0" class="rounded-lg border border-(--border-color) bg-(--bg-muted) p-3">
            <p class="mb-2 text-xs font-medium text-(--text-secondary)">
              {{ t('settings.ai.fetchedModels', 'Fetched Models') }} ({{ availableModels.length }})
            </p>

            <div class="mb-3 flex flex-wrap items-center gap-2">
              <div class="min-w-[220px]">
                <AppSelect
                  v-model="selectedFetchedModel"
                  :options="availableModelOptions"
                  :placeholder="t('settings.ai.selectModel', 'Select a model')"
                  size="sm"
                />
              </div>
              <button
                type="button"
                :disabled="!selectedFetchedModel"
                class="inline-flex items-center gap-1.5 rounded-lg border border-(--border-color) bg-(--bg-card) px-3 py-2 text-xs font-medium text-(--text-main) transition-colors hover:bg-(--bg-hover) disabled:cursor-not-allowed disabled:opacity-50"
                @click="appendSelectedModel"
              >
                <AppIcon name="plus" class="size-3.5" />
                {{ t('settings.ai.addModel', 'Add Model') }}
              </button>
            </div>

            <div class="flex flex-wrap gap-1.5">
              <span
                v-for="model in availableModels"
                :key="model"
                class="inline-flex items-center gap-1 rounded bg-(--bg-card) px-2 py-1 font-mono text-[11px] text-(--text-main)"
              >
                <span>{{ model }}</span>
                <span
                  class="rounded px-1 py-0.5 text-[10px] font-semibold"
                  :class="isVisionModel(model)
                    ? 'bg-success/15 text-success'
                    : 'bg-warning/15 text-warning'"
                >
                  {{ isVisionModel(model)
                    ? t('settings.ai.visionSupported', '支持图片')
                    : t('settings.ai.visionLikelyUnsupported', '可能仅文本') }}
                </span>
                <button
                  type="button"
                  class="rounded px-1 text-[10px] text-(--text-secondary) hover:bg-(--bg-hover) hover:text-(--text-main)"
                  @click="pinModelAsPrimary(model)"
                >
                  {{ t('settings.ai.setPrimary', 'Set Primary') }}
                </button>
              </span>
            </div>
          </div>

          <div
            v-if="connectionResult"
            class="rounded-lg border p-3 text-xs"
            :class="connectionResult.ok
              ? 'border-success/30 bg-success/10 text-(--text-main)'
              : 'border-danger/30 bg-danger/10 text-(--text-main)'"
          >
            <p class="font-medium">
              {{ connectionResult.ok ? t('settings.ai.testSuccess', 'Connection successful') : t('settings.ai.testFailed', 'Connection failed') }}
            </p>
            <p v-if="connectionResult.message" class="mt-1">{{ connectionResult.message }}</p>
            <p v-else class="mt-1">
              /models: {{ connectionResult.modelsLatency }}ms
              <template v-if="connectionResult.completionLatency != null">
                · /chat/completions: {{ connectionResult.completionLatency }}ms
              </template>
            </p>
          </div>

          <div class="rounded-lg border border-(--border-color) bg-(--bg-card) p-3">
            <div class="mb-2 flex items-center justify-between gap-2">
              <p class="text-xs font-medium text-(--text-secondary)">{{ t('settings.ai.healthStats', 'Model Health Stats') }}</p>
              <button
                type="button"
                class="inline-flex items-center gap-1 rounded border border-(--border-color) px-2 py-1 text-[11px] text-(--text-main) hover:bg-(--bg-hover)"
                :disabled="healthLoading"
                @click="fetchHealthStats"
              >
                <AppIcon v-if="healthLoading" name="spinner" class="size-3.5 animate-spin" />
                <AppIcon v-else name="arrow-path" class="size-3.5" />
                {{ t('settings.ai.refreshHealth', 'Refresh') }}
              </button>
            </div>
            <div
              v-if="healthStats.length > 0"
              data-testid="health-model-grid"
              class="grid gap-2 sm:grid-cols-2 xl:grid-cols-3"
            >
              <div
                v-for="item in healthStats"
                :key="`health-${item.model}`"
                class="rounded-lg border border-(--border-color) bg-(--bg-muted) px-2.5 py-2 text-[11px]"
              >
                <p class="truncate font-mono text-xs text-(--text-main)">{{ item.model }}</p>
                <div class="mt-2 flex flex-wrap items-center justify-between gap-1 text-(--text-secondary)">
                  <span>{{ t('settings.ai.failureRate', 'Fail') }} {{ item.failureRateLabel }}</span>
                  <span>{{ t('settings.ai.avgLatency', 'Latency') }} {{ item.avgLatencyLabel }}</span>
                </div>
              </div>
            </div>
            <p v-else class="text-xs text-(--text-muted)">{{ t('settings.ai.healthEmpty', 'No health data yet') }}</p>
          </div>
        </div>
        
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
import { ref, onMounted, reactive, computed } from 'vue';
import SettingsSection from '../SettingsSection.vue';
import AppIcon from '@/components/ui/AppIcon.vue';
import AppSelect from '@/components/ui/Select.vue';
import { useToast } from '@/composables/useToast';
import { useI18n } from '@/composables/useI18n';
import { useAuth } from '@/composables/useAuth';
import { inferModelSupportsVision } from '@/utils/ai-model-capabilities';

const { t } = useI18n();
const { addToast } = useToast();
const { authFetch } = useAuth();

const showKey = ref(false);
const loading = ref(true);
const saving = ref(false);
const modelFetching = ref(false);
const testing = ref(false);
const availableModels = ref([]);
const connectionResult = ref(null);
const selectedFetchedModel = ref('');
const availableModelOptions = computed(() => [
  { value: '', label: t('settings.ai.selectModel', 'Select a model') },
  ...availableModels.value.map((model) => ({ value: model, label: model })),
]);
const draggingIndex = ref(-1);
const healthLoading = ref(false);
const healthStats = ref([]);

const form = reactive({
  AI_API_URL: '',
  AI_API_KEY: '',
  AI_MODELS: '',
  AI_DYNAMIC_FALLBACK_ENABLED: 'false',
  AI_MODEL_HEALTH_WINDOW: 20,
});

const fetchSettings = async () => {
  try {
    loading.value = true;
    const res = await authFetch('/api/manage/settings');
    const json = await res.json();
    
    if (json.success && json.data && json.data.ai) {
      const ai = json.data.ai;
      form.AI_API_URL = ai.AI_API_URL || '';
      form.AI_API_KEY = ai.AI_API_KEY || '';
      form.AI_MODELS = ai.AI_MODELS || '';
      form.AI_DYNAMIC_FALLBACK_ENABLED = String(ai.AI_DYNAMIC_FALLBACK_ENABLED || 'false');
      form.AI_MODEL_HEALTH_WINDOW = Number(ai.AI_MODEL_HEALTH_WINDOW || 20);
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
      { key: 'AI_DYNAMIC_FALLBACK_ENABLED', value: String(form.AI_DYNAMIC_FALLBACK_ENABLED), category: 'ai' },
      { key: 'AI_MODEL_HEALTH_WINDOW', value: String(form.AI_MODEL_HEALTH_WINDOW), category: 'ai' },
    ];

    const res = await authFetch('/api/manage/settings/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ settings: settingsToSave }),
    });
    
    const json = await res.json();
    if (json.success) {
      addToast({ message: t('settings.ai.saveSuccess', 'AI settings saved'), type: 'success' });
    } else {
      throw new Error(json.error || t('settings.ai.saveFailed'));
    }
  } catch (e) {
    addToast({ type: 'error', message: e.message });
  } finally {
    saving.value = false;
  }
};

const splitModels = (value) =>
  String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

const isVisionModel = (modelName) => inferModelSupportsVision(modelName);

const selectedModels = computed(() => splitModels(form.AI_MODELS));
const dynamicFallbackEnabled = computed({
  get: () => String(form.AI_DYNAMIC_FALLBACK_ENABLED) === 'true',
  set: (checked) => {
    form.AI_DYNAMIC_FALLBACK_ENABLED = checked ? 'true' : 'false';
  },
});

const appendSelectedModel = () => {
  const model = String(selectedFetchedModel.value || '').trim();
  if (!model) return;

  const current = splitModels(form.AI_MODELS);
  if (current.includes(model)) {
    addToast({ type: 'info', message: t('settings.ai.modelExists', 'Model already exists in list') });
    return;
  }

  current.push(model);
  form.AI_MODELS = current.join(', ');
  addToast({ type: 'success', message: t('settings.ai.addModelSuccess', 'Model added') });
};

const removeSelectedModel = (modelToRemove) => {
  const next = splitModels(form.AI_MODELS).filter((item) => item !== modelToRemove);
  form.AI_MODELS = next.join(', ');
};

const setPrimaryModel = (targetModel) => {
  const models = splitModels(form.AI_MODELS).filter((item) => item !== targetModel);
  models.unshift(targetModel);
  form.AI_MODELS = [...new Set(models)].join(', ');
};

const pinModelAsPrimary = (targetModel) => {
  if (!targetModel) return;
  const models = splitModels(form.AI_MODELS).filter((item) => item !== targetModel);
  models.unshift(targetModel);
  form.AI_MODELS = [...new Set(models)].join(', ');
  addToast({ type: 'success', message: t('settings.ai.primarySetSuccess', 'Primary model updated') });
};

const onDragStart = (index) => {
  draggingIndex.value = index;
};

const onDrop = (targetIndex) => {
  const from = draggingIndex.value;
  if (from < 0 || from === targetIndex) {
    draggingIndex.value = -1;
    return;
  }

  const next = [...selectedModels.value];
  const [moved] = next.splice(from, 1);
  next.splice(targetIndex, 0, moved);
  form.AI_MODELS = next.join(', ');
  draggingIndex.value = -1;
};

const fetchModels = async () => {
  try {
    modelFetching.value = true;
    const res = await authFetch('/api/manage/settings/ai/models', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apiUrl: form.AI_API_URL,
        apiKey: form.AI_API_KEY,
      }),
    });

    const json = await res.json();
    if (!json.success) {
      throw new Error(json.error || t('settings.ai.fetchModelsFailed', 'Failed to fetch models'));
    }

    const models = Array.isArray(json.data?.models) ? json.data.models : [];
    availableModels.value = models;
    selectedFetchedModel.value = models[0] || '';
    if (models.length > 0 && selectedModels.value.length === 0) {
      form.AI_MODELS = models.join(', ');
    }
    addToast({ type: 'success', message: t('settings.ai.fetchModelsSuccess', 'Models fetched successfully') });
    fetchHealthStats();
  } catch (e) {
    addToast({ type: 'error', message: e.message || t('settings.ai.fetchModelsFailed', 'Failed to fetch models') });
  } finally {
    modelFetching.value = false;
  }
};

const testConnection = async () => {
  try {
    testing.value = true;
    connectionResult.value = null;

    const candidateModels = splitModels(form.AI_MODELS);
    const res = await authFetch('/api/manage/settings/ai/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apiUrl: form.AI_API_URL,
        apiKey: form.AI_API_KEY,
        model: candidateModels[0] || '',
      }),
    });
    const json = await res.json();

    if (!json.success) {
      throw new Error(json.error || t('settings.ai.testFailed', 'Connection failed'));
    }

    const latency = json.data?.latencyMs || {};
    connectionResult.value = {
      ok: true,
      message: '',
      modelsLatency: latency.models ?? null,
      completionLatency: latency.completion ?? null,
    };
    addToast({ type: 'success', message: t('settings.ai.testSuccess', 'Connection successful') });
  } catch (e) {
    connectionResult.value = {
      ok: false,
      message: e.message || t('settings.ai.testFailed', 'Connection failed'),
      modelsLatency: null,
      completionLatency: null,
    };
    addToast({ type: 'error', message: connectionResult.value.message });
  } finally {
    testing.value = false;
  }
};

const fetchHealthStats = async () => {
  try {
    healthLoading.value = true;
    const models = selectedModels.value.length > 0 ? selectedModels.value : availableModels.value;
    const query = models.length > 0 ? `?models=${encodeURIComponent(models.join(','))}` : '';
    const res = await authFetch(`/api/manage/settings/ai/health${query}`);
    const json = await res.json();
    if (!json.success) {
      throw new Error(json.error || t('settings.ai.healthLoadFailed', 'Failed to load health stats'));
    }

    const rows = Array.isArray(json.data?.models) ? json.data.models : [];
    healthStats.value = rows.map((item) => {
      const failureRate = Number(item.failureRate || 0);
      const avgLatencyMs = Number(item.avgLatencyMs || 0);
      return {
        model: item.model,
        failureRateLabel: `${(failureRate * 100).toFixed(1)}%`,
        avgLatencyLabel: avgLatencyMs > 0 ? `${avgLatencyMs}ms` : '-',
      };
    });
  } catch (e) {
    addToast({ type: 'error', message: e.message || t('settings.ai.healthLoadFailed', 'Failed to load health stats') });
  } finally {
    healthLoading.value = false;
  }
};

onMounted(() => {
  fetchSettings().then(() => fetchHealthStats());
});
</script>
