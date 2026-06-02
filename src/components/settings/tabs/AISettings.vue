<template>
  <div class="space-y-6">
    <SettingsSection
      :title="t('settings.ai.title', 'AI Configuration')"
      :description="
        t('settings.ai.description', 'Manage API keys and model preferences for the AI assistant.')
      "
      icon="sparkles"
    >
      <form class="space-y-6" @submit.prevent="saveSettings">
        <!-- API Provider URL -->
        <div class="space-y-2">
          <label class="text-primary text-sm font-medium">{{
            t('settings.ai.apiUrl', 'API Base URL')
          }}</label>
          <div class="relative">
            <AppInput
              v-model="form.AI_API_URL"
              type="url"
              placeholder="https://api.openai.com/v1"
            />
          </div>
          <p class="text-secondary text-xs">
            {{
              t('settings.ai.apiUrlDesc', 'The base URL for the OpenAI-compatible API provider.')
            }}
          </p>
        </div>

        <!-- API Key -->
        <div class="space-y-2">
          <label class="text-primary text-sm font-medium">{{
            t('settings.ai.apiKey', 'API Key')
          }}</label>
          <div class="relative">
            <AppInput
              v-model="form.AI_API_KEY"
              :type="showKey ? 'text' : 'password'"
              class="pr-10"
              placeholder="sk-..."
            />
            <AppButton
              type="button"
              variant="ghost"
              size="sm"
              class="absolute top-1.5 right-2 !h-7 !w-7 !px-0"
              @click="showKey = !showKey"
            >
              <template #icon-left>
                <AppIcon v-if="!showKey" name="eye" class="size-5" />
                <AppIcon v-else name="eye-slash" class="size-5" />
              </template>
            </AppButton>
          </div>
          <p class="text-secondary text-xs">
            {{ t('settings.ai.apiKeyDesc', 'Your API key is stored securely in the database.') }}
          </p>
        </div>

        <AppCard padding="p-3" class="space-y-2">
          <div class="flex items-start justify-between gap-3">
            <div>
              <p class="text-sm font-medium text-(--text-main)">
                {{ t('settings.ai.dynamicFallback', 'Dynamic Fallback') }}
              </p>
              <p class="mt-1 text-xs text-(--text-secondary)">
                {{
                  t(
                    'settings.ai.dynamicFallbackDesc',
                    'When enabled, fallback models are auto-ranked by recent failure rate and latency window. Primary model remains fixed.'
                  )
                }}
              </p>
            </div>
            <AppButton
              type="button"
              :variant="dynamicFallbackEnabled ? 'primary' : 'secondary'"
              size="sm"
              :text="
                dynamicFallbackEnabled
                  ? t('common.enabled', 'Enabled')
                  : t('common.disabled', 'Disabled')
              "
              @click="dynamicFallbackEnabled = !dynamicFallbackEnabled"
            />
          </div>

          <div class="pt-2">
            <label class="text-primary text-xs font-medium">{{
              t('settings.ai.healthWindow', 'Health Window')
            }}</label>
            <AppInput
              v-model.number="form.AI_MODEL_HEALTH_WINDOW"
              :disabled="!dynamicFallbackEnabled"
              type="number"
              min="5"
              max="200"
              size="sm"
              class="mt-1"
            />
            <p class="mt-1 text-xs text-(--text-muted)">
              {{
                t(
                  'settings.ai.healthWindowHint',
                  'Use 5-200 recent requests per model for failure/latency scoring.'
                )
              }}
            </p>
          </div>
        </AppCard>

        <!-- Models -->
        <div class="space-y-2">
          <label class="text-primary text-sm font-medium">{{
            t('settings.ai.models', 'Model List')
          }}</label>
          <p class="text-secondary text-xs">
            {{
              t(
                'settings.ai.modelListDesc',
                'Select models from fetched list. The first one has highest priority.'
              )
            }}
          </p>
          <p class="text-secondary text-xs">
            {{
              t(
                'settings.ai.orderHint',
                'Sort from top to bottom by priority. If the primary model fails or is rate-limited, AI will automatically fall back to the next model.'
              )
            }}
          </p>

          <AppCard padding="p-3">
            <p class="mb-2 text-xs font-medium text-(--text-secondary)">
              {{ t('settings.ai.selectedModels', 'Selected Models') }}
            </p>
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
                      <span
                        class="cursor-grab text-(--text-muted) active:cursor-grabbing"
                        :title="t('settings.ai.dragToSort', 'Drag to sort')"
                      >
                        <AppIcon name="bars-3" class="size-4" />
                      </span>
                      <span class="truncate font-mono text-xs">{{ model }}</span>
                    </div>
                    <div class="mt-2 flex flex-wrap items-center gap-1.5">
                      <span
                        class="shrink-0 rounded px-1.5 py-0.5 text-xs font-semibold"
                        :class="
                          index === 0
                            ? 'bg-primary/15 text-primary'
                            : 'bg-(--bg-card) text-(--text-secondary)'
                        "
                      >
                        {{
                          index === 0
                            ? t('settings.ai.primaryModel', 'Primary')
                            : t('settings.ai.fallbackModel', { index })
                        }}
                      </span>
                      <span
                        class="shrink-0 rounded px-1.5 py-0.5 text-xs font-semibold"
                        :class="
                          isVisionModel(model)
                            ? 'bg-success/15 text-success'
                            : 'bg-warning/15 text-warning'
                        "
                      >
                        {{
                          isVisionModel(model)
                            ? t('settings.ai.visionSupported', '支持图片')
                            : t('settings.ai.visionLikelyUnsupported', '可能仅文本')
                        }}
                      </span>
                    </div>
                  </div>
                  <div class="flex shrink-0 items-center gap-1">
                    <AppButton
                      v-if="index > 0"
                      data-testid="set-primary-btn"
                      type="button"
                      variant="ghost"
                      size="sm"
                      class="!h-6 !px-2 text-xs"
                      :text="t('settings.ai.setPrimary', 'Set Primary')"
                      @click="setPrimaryModel(model)"
                    />
                    <AppButton
                      type="button"
                      variant="ghost"
                      size="sm"
                      class="!h-6 !w-6 !px-0"
                      @click="removeSelectedModel(model)"
                    >
                      <template #icon-left>
                        <AppIcon name="x-mark" class="size-3.5" />
                      </template>
                    </AppButton>
                  </div>
                </div>
              </div>
            </div>
            <p v-else class="text-xs text-(--text-muted)">
              {{ t('settings.ai.noSelectedModels', 'No model selected yet') }}
            </p>
          </AppCard>

          <ActionBar class="border-none bg-transparent px-0 py-0 shadow-none">
            <AppButton
              type="button"
              :disabled="modelFetching || !form.AI_API_URL || !form.AI_API_KEY"
              variant="white"
              size="sm"
              :loading="modelFetching"
              :text="t('settings.ai.fetchModels', 'Fetch Models')"
              @click="fetchModels"
            >
              <template v-if="!modelFetching" #icon-left>
                <AppIcon name="magnifying-glass" class="size-4" />
              </template>
            </AppButton>

            <AppButton
              type="button"
              :disabled="testing || !form.AI_API_URL || !form.AI_API_KEY"
              variant="white"
              size="sm"
              :loading="testing"
              :text="t('settings.ai.testConnection', 'Test Connectivity')"
              @click="testConnection"
            >
              <template v-if="!testing" #icon-left>
                <AppIcon name="check-badge" class="size-4" />
              </template>
            </AppButton>
          </ActionBar>

          <AppCard v-if="availableModels.length > 0" padding="p-3" class="bg-(--bg-muted)">
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
              <AppButton
                type="button"
                :disabled="!selectedFetchedModel"
                variant="white"
                size="sm"
                :text="t('settings.ai.addModel', 'Add Model')"
                @click="appendSelectedModel"
              >
                <template #icon-left>
                  <AppIcon name="plus" class="size-3.5" />
                </template>
              </AppButton>
            </div>

            <div class="flex flex-wrap gap-1.5">
              <span
                v-for="model in availableModels"
                :key="model"
                class="inline-flex items-center gap-1 rounded bg-(--bg-card) px-2 py-1 font-mono text-[11px] text-(--text-main)"
              >
                <span>{{ model }}</span>
                <span
                  class="rounded px-1 py-0.5 text-xs font-semibold"
                  :class="
                    isVisionModel(model)
                      ? 'bg-success/15 text-success'
                      : 'bg-warning/15 text-warning'
                  "
                >
                  {{
                    isVisionModel(model)
                      ? t('settings.ai.visionSupported', '支持图片')
                      : t('settings.ai.visionLikelyUnsupported', '可能仅文本')
                  }}
                </span>
                <AppButton
                  type="button"
                  variant="link"
                  size="sm"
                  class="!h-auto !px-1 text-xs"
                  :text="t('settings.ai.setPrimary', 'Set Primary')"
                  @click="pinModelAsPrimary(model)"
                />
              </span>
            </div>
          </AppCard>

          <div
            v-if="connectionResult"
            class="rounded-lg border p-3 text-xs"
            :class="
              connectionResult.ok
                ? 'border-success/30 bg-success/10 text-(--text-main)'
                : 'border-danger/30 bg-danger/10 text-(--text-main)'
            "
          >
            <p class="font-medium">
              {{
                connectionResult.ok
                  ? t('settings.ai.testSuccess', 'Connection successful')
                  : t('settings.ai.testFailed', 'Connection failed')
              }}
            </p>
            <p v-if="connectionResult.message" class="mt-1">{{ connectionResult.message }}</p>
            <p v-else class="mt-1">
              /models: {{ connectionResult.modelsLatency }}ms
              <template v-if="connectionResult.completionLatency != null">
                · /chat/completions: {{ connectionResult.completionLatency }}ms
              </template>
            </p>
          </div>

          <AppCard padding="p-3">
            <div class="mb-2 flex items-center justify-between gap-2">
              <p class="text-xs font-medium text-(--text-secondary)">
                {{ t('settings.ai.healthStats', 'Model Health Stats') }}
              </p>
              <AppButton
                type="button"
                :disabled="healthLoading"
                :loading="healthLoading"
                variant="white"
                size="sm"
                :text="t('settings.ai.refreshHealth', 'Refresh')"
                @click="fetchHealthStats"
              >
                <template v-if="!healthLoading" #icon-left>
                  <AppIcon name="arrow-path" class="size-3.5" />
                </template>
              </AppButton>
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
                <div
                  class="mt-2 flex flex-wrap items-center justify-between gap-1 text-(--text-secondary)"
                >
                  <span
                    >{{ t('settings.ai.failureRate', 'Fail') }} {{ item.failureRateLabel }}</span
                  >
                  <span
                    >{{ t('settings.ai.avgLatency', 'Latency') }} {{ item.avgLatencyLabel }}</span
                  >
                </div>
              </div>
            </div>
            <p v-else class="text-xs text-(--text-muted)">
              {{ t('settings.ai.healthEmpty', 'No health data yet') }}
            </p>
          </AppCard>
        </div>

        <div class="flex justify-end pt-4">
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
        </div>
      </form>
    </SettingsSection>
  </div>
</template>

<script setup>
import { ref, onMounted, reactive, computed } from 'vue';
import SettingsSection from '../SettingsSection.vue';
import AppIcon from '@/components/ui/AppIcon.vue';
import AppInput from '@/components/ui/AppInput.vue';
import AppButton from '@/components/ui/AppButton.vue';
import AppCard from '@/components/ui/AppCard.vue';
import AppSelect from '@/components/ui/Select.vue';
import ActionBar from '@/design-system/composed/ActionBar.vue';
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
      {
        key: 'AI_DYNAMIC_FALLBACK_ENABLED',
        value: String(form.AI_DYNAMIC_FALLBACK_ENABLED),
        category: 'ai',
      },
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
    addToast({
      type: 'info',
      message: t('settings.ai.modelExists', 'Model already exists in list'),
    });
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
  addToast({
    type: 'success',
    message: t('settings.ai.primarySetSuccess', 'Primary model updated'),
  });
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
    addToast({
      type: 'success',
      message: t('settings.ai.fetchModelsSuccess', 'Models fetched successfully'),
    });
    fetchHealthStats();
  } catch (e) {
    addToast({
      type: 'error',
      message: e.message || t('settings.ai.fetchModelsFailed', 'Failed to fetch models'),
    });
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
      throw new Error(
        json.error || t('settings.ai.healthLoadFailed', 'Failed to load health stats')
      );
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
    addToast({
      type: 'error',
      message: e.message || t('settings.ai.healthLoadFailed', 'Failed to load health stats'),
    });
  } finally {
    healthLoading.value = false;
  }
};

onMounted(() => {
  fetchSettings().then(() => fetchHealthStats()).catch(console.error);
});
</script>
