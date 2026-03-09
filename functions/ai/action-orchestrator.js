import { detectCreateIntent } from './canonicalization.js';

function parseJsonObject(value, fallback = {}) {
  if (!value) return fallback;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function buildSessionId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `act-${Date.now()}`;
}

export class AIActionOrchestrator {
  constructor({ sessionStore, getActionAdapter, submitters = {} }) {
    this.sessionStore = sessionStore;
    this.getActionAdapter = getActionAdapter;
    this.submitters = submitters;
  }

  async advance({ userId, text = '', slots = {}, confirmation = false }) {
    const activeSession = await this.sessionStore.getLatestActiveSession(userId);
    if (activeSession) {
      return this.#resumeSession({ session: activeSession, text, confirmation });
    }

    const intent = detectCreateIntent(text);
    if (!intent) return null;

    const adapter = this.getActionAdapter(intent.entityType);
    if (!adapter) return null;

    const missingSlots = adapter.requiredSlots.filter((slot) => !this.#hasValue(slots[slot]));

    const sessionId = buildSessionId();
    await this.sessionStore.createSession({
      id: sessionId,
      userId,
      actionType: adapter.actionType,
      entityType: adapter.entityType,
      slots,
    });

    if (missingSlots.length > 0) {
      await this.sessionStore.updateSession(sessionId, {
        status: 'collecting',
        slots,
      });

      return {
        kind: 'slot_request',
        payload: {
          sessionId,
          entityType: adapter.entityType,
          missingSlots,
        },
      };
    }

    const preview = this.#buildPreview(adapter, slots);
    await this.sessionStore.updateSession(sessionId, {
      status: 'awaiting_confirmation',
      slots,
      preview,
    });

    return {
      kind: 'action_preview',
      payload: {
        sessionId,
        entityType: adapter.entityType,
        title: preview.title,
        summary: preview.summary,
      },
    };
  }

  async #resumeSession({ session, text, confirmation }) {
    const adapter = this.getActionAdapter(session.entity_type);
    if (!adapter) {
      throw new Error(`Missing action adapter for ${session.entity_type}`);
    }
    const slots = parseJsonObject(session.slots_json, {});

    if (session.status === 'collecting' && !confirmation) {
      const nextSlots = { ...slots };
      const normalizedText = String(text || '').trim();
      const missingSlots = adapter.requiredSlots.filter((slot) => !this.#hasValue(nextSlots[slot]));

      if (normalizedText && missingSlots.length > 0) {
        nextSlots[missingSlots[0]] = normalizedText;
      }

      const nextMissingSlots = adapter.requiredSlots.filter((slot) => !this.#hasValue(nextSlots[slot]));
      if (nextMissingSlots.length > 0) {
        await this.sessionStore.updateSession(session.id, {
          status: 'collecting',
          slots: nextSlots,
        });
        return {
          kind: 'slot_request',
          payload: {
            sessionId: session.id,
            entityType: session.entity_type,
            missingSlots: nextMissingSlots,
          },
        };
      }

      const preview = this.#buildPreview(adapter, nextSlots);
      await this.sessionStore.updateSession(session.id, {
        status: 'awaiting_confirmation',
        slots: nextSlots,
        preview,
      });

      return {
        kind: 'action_preview',
        payload: {
          sessionId: session.id,
          entityType: adapter.entityType,
          title: preview.title,
          summary: preview.summary,
        },
      };
    }

    if (!confirmation || session.status !== 'awaiting_confirmation') {
      return null;
    }
    const submitter = this.submitters[session.action_type];
    if (typeof submitter !== 'function') {
      throw new Error(`Missing submitter for ${session.action_type}`);
    }

    const created = await submitter(slots);
    await this.sessionStore.updateSession(session.id, {
      status: 'completed',
      slots,
      preview: parseJsonObject(session.preview_json, {}),
    });

    return {
      kind: 'action_submitted',
      payload: {
        sessionId: session.id,
        entityType: session.entity_type,
        createdEntityId: created.id,
        createdEntityLabel: created.label || created.id,
        targetModule: adapter.targetModule,
        successMessage: created.message || '已完成创建，请前往对应模块查看。',
      },
    };
  }

  #buildPreview(adapter, slots) {
    return {
      title: `${adapter.entityType} create preview`,
      summary: { ...slots },
    };
  }

  #hasValue(value) {
    if (Array.isArray(value)) return value.length > 0;
    return value !== undefined && value !== null && String(value).trim() !== '';
  }
}
