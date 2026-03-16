export function createAIRequestTelemetry(input = {}) {
  return {
    requestId: input.requestId || null,
    userId: input.userId || null,
    sessionId: input.sessionId || null,
    routeType: input.routeType || null,
    visionFirst: Boolean(input.visionFirst),
    selectedModel: input.selectedModel || null,
    modelSwitched: Boolean(input.modelSwitched),
    retryCount: Number(input.retryCount || 0),
    toolRounds: Number(input.toolRounds || 0),
    executedTools: Array.isArray(input.executedTools) ? input.executedTools : [],
    actionKind: input.actionKind || null,
    entityType: input.entityType || null,
    cancellationReason: input.cancellationReason || null,
    finalStatus: input.finalStatus || null,
  };
}

export function createAITraceRecord(input = {}) {
  return {
    requestId: input.requestId || null,
    traceId: input.traceId || input.requestId || null,
    userId: input.userId || null,
    routeType: input.routeType || null,
    model: input.selectedModel || input.model || null,
    retryCount: Number(input.retryCount || 0),
    toolRounds: Number(input.toolRounds || 0),
    quotaDecision: input.quotaDecision || null,
    safetyDecision: input.safetyDecision || null,
    finalStatus: input.finalStatus || null,
    cancellationReason: input.cancellationReason || null,
    createdAt: Number(input.createdAt || Date.now()),
  };
}

export function createAISpanRecord(input = {}) {
  return {
    id: input.id || null,
    requestId: input.requestId || null,
    spanType: input.spanType || null,
    status: input.status || null,
    detail: input.detail || null,
    durationMs: input.durationMs ?? null,
    createdAt: Number(input.createdAt || Date.now()),
  };
}

export function createAIUsageDailyRecord(input = {}) {
  return {
    usageDate: input.usageDate || new Date().toISOString().slice(0, 10),
    userId: input.userId || 'anonymous',
    requestCount: Number(input.requestCount || 0),
    estimatedTokens: Number(input.estimatedTokens || 0),
  };
}
