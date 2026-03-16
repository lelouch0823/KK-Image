const MODEL_COOLDOWNS = new Map();
const MODEL_HEALTH = new Map();

const COOLDOWN_DURATION = 60 * 1000;
const DEFAULT_HEALTH_WINDOW = 20;
const MIN_HEALTH_WINDOW = 5;
const MAX_HEALTH_WINDOW = 200;

export function parseBooleanFlag(value, fallback = false) {
  if (typeof value === 'boolean') return value;
  if (value === undefined || value === null) return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (!normalized) return fallback;
  return ['1', 'true', 'yes', 'on', 'enabled'].includes(normalized);
}

export function parseHealthWindow(value) {
  const n = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(n)) return DEFAULT_HEALTH_WINDOW;
  return Math.min(MAX_HEALTH_WINDOW, Math.max(MIN_HEALTH_WINDOW, n));
}

function ensureModelHealth(modelName) {
  if (!MODEL_HEALTH.has(modelName)) {
    MODEL_HEALTH.set(modelName, { events: [] });
  }
  return MODEL_HEALTH.get(modelName);
}

export function recordModelHealth(modelName, { ok, latencyMs = null }, windowSize = DEFAULT_HEALTH_WINDOW) {
  const store = ensureModelHealth(modelName);
  store.events.push({
    ok: Boolean(ok),
    latencyMs: Number.isFinite(latencyMs) ? latencyMs : null,
    at: Date.now(),
  });

  if (store.events.length > windowSize) {
    store.events.splice(0, store.events.length - windowSize);
  }
}

function getModelMetrics(modelName) {
  const store = MODEL_HEALTH.get(modelName);
  const events = Array.isArray(store?.events) ? store.events : [];
  const requests = events.length;
  const failures = events.filter((item) => !item.ok).length;
  const successfulEvents = events.filter((item) => item.ok && Number.isFinite(item.latencyMs));
  const avgLatencyMs = successfulEvents.length > 0
    ? Math.round(successfulEvents.reduce((acc, item) => acc + item.latencyMs, 0) / successfulEvents.length)
    : null;
  const failureRate = requests > 0 ? failures / requests : 0;
  const lastSuccessAt = [...events].reverse().find((item) => item.ok)?.at || null;
  const lastFailureAt = [...events].reverse().find((item) => !item.ok)?.at || null;
  const latencyScore = Number.isFinite(avgLatencyMs) ? avgLatencyMs : 1000;
  const score = failureRate * 100000 + latencyScore;

  return { requests, failures, failureRate, avgLatencyMs, lastSuccessAt, lastFailureAt, score };
}

function rankFallbackModels(models) {
  if (!Array.isArray(models) || models.length <= 2) return models;
  const primary = models[0];
  const fallbackSorted = [...models.slice(1)].sort((left, right) => {
    const leftMetrics = getModelMetrics(left);
    const rightMetrics = getModelMetrics(right);
    if (leftMetrics.score !== rightMetrics.score) {
      return leftMetrics.score - rightMetrics.score;
    }
    return left.localeCompare(right);
  });
  return [primary, ...fallbackSorted];
}

export function parseModels(modelsEnv) {
  if (!modelsEnv) return [];
  return String(modelsEnv).split(',').map((m) => m.trim()).filter(Boolean);
}

export function resolveModelOrder(models, env) {
  const enabled = parseBooleanFlag(env?.AI_DYNAMIC_FALLBACK_ENABLED, false);
  if (!enabled) return models;
  return rankFallbackModels(models);
}

export function isModelAvailable(modelName) {
  if (!MODEL_COOLDOWNS.has(modelName)) return true;
  const expiry = MODEL_COOLDOWNS.get(modelName);
  if (Date.now() > expiry) {
    MODEL_COOLDOWNS.delete(modelName);
    return true;
  }
  return false;
}

export function markModelRateLimited(modelName) {
  console.warn(`[AI] Marking model ${modelName} as rate-limited for ${COOLDOWN_DURATION / 1000}s`);
  MODEL_COOLDOWNS.set(modelName, Date.now() + COOLDOWN_DURATION);
}

export function getNextAvailableModelIndex(models, currentIndex) {
  for (let i = currentIndex + 1; i < models.length; i += 1) {
    if (isModelAvailable(models[i])) {
      return i;
    }
  }
  return -1;
}

export function getModelHealthSnapshot({ models = [], windowSize = DEFAULT_HEALTH_WINDOW } = {}) {
  const normalizedWindow = parseHealthWindow(windowSize);
  const knownModels = [...new Set([
    ...models.filter(Boolean).map((item) => String(item).trim()),
    ...Array.from(MODEL_HEALTH.keys()),
  ])];

  return {
    windowSize: normalizedWindow,
    models: knownModels.map((model) => ({
      model,
      ...getModelMetrics(model),
    })),
  };
}

export function resetModelHealthStatsForTests() {
  MODEL_COOLDOWNS.clear();
  MODEL_HEALTH.clear();
}
