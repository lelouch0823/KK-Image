function createSpanId(index) {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `span-${Date.now()}-${index}`;
}

export function createAITelemetryWriter({ db } = {}) {
  return {
    async writeTrace(trace = {}) {
      if (!db?.prepare) return null;
      await db.prepare(`
        INSERT INTO ai_request_traces (
          request_id, trace_id, user_id, route_type, model, retry_count, tool_rounds,
          quota_decision, safety_decision, final_status, cancellation_reason, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        trace.requestId,
        trace.traceId || trace.requestId,
        trace.userId || null,
        trace.routeType || null,
        trace.model || null,
        Number(trace.retryCount || 0),
        Number(trace.toolRounds || 0),
        trace.quotaDecision || null,
        trace.safetyDecision || null,
        trace.finalStatus || null,
        trace.cancellationReason || null,
        Number(trace.createdAt || Date.now())
      ).run();
      return trace;
    },

    async writeSpans(spans = []) {
      if (!db?.prepare || !Array.isArray(spans) || spans.length === 0) return [];
      for (let index = 0; index < spans.length; index += 1) {
        const span = spans[index];
        await db.prepare(`
          INSERT INTO ai_request_spans (
            id, request_id, span_type, status, detail, duration_ms, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `).bind(
          span.id || createSpanId(index),
          span.requestId,
          span.spanType,
          span.status || null,
          span.detail ? JSON.stringify(span.detail) : null,
          span.durationMs ?? null,
          Number(span.createdAt || Date.now())
        ).run();
      }
      return spans;
    },

    async writeUsageDaily(usage = {}) {
      if (!db?.prepare) return null;
      await db.prepare(`
        INSERT INTO ai_request_usage_daily (
          usage_date, user_id, request_count, estimated_tokens
        ) VALUES (?, ?, ?, ?)
        ON CONFLICT(usage_date, user_id) DO UPDATE SET
          request_count = request_count + excluded.request_count,
          estimated_tokens = estimated_tokens + excluded.estimated_tokens
      `).bind(
        usage.usageDate,
        usage.userId,
        Number(usage.requestCount || 0),
        Number(usage.estimatedTokens || 0)
      ).run();
      return usage;
    },

    async writeAll({ trace = null, spans = [], usageDaily = null } = {}) {
      try {
        if (trace) await this.writeTrace(trace);
        if (spans?.length) await this.writeSpans(spans);
        if (usageDaily) await this.writeUsageDaily(usageDaily);
      } catch (error) {
        console.error('[AI TelemetryWriter] Failed to write telemetry:', error);
      }
    },
  };
}
