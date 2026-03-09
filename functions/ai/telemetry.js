export function createAIRequestTelemetry(input = {}) {
  return {
    requestId: input.requestId || null,
    userId: input.userId || null,
    sessionId: input.sessionId || null,
    routeType: input.routeType || null,
    visionFirst: Boolean(input.visionFirst),
    selectedModel: input.selectedModel || null,
    modelSwitched: Boolean(input.modelSwitched),
    toolRounds: Number(input.toolRounds || 0),
    executedTools: Array.isArray(input.executedTools) ? input.executedTools : [],
    actionKind: input.actionKind || null,
    entityType: input.entityType || null,
    finalStatus: input.finalStatus || null,
  };
}
