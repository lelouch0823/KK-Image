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
  constructor({ sessionStore, getActionAdapter, submitters = {}, slotResolvers = {}, extractActionSlots = () => ({}) }) {
    this.sessionStore = sessionStore;
    this.getActionAdapter = getActionAdapter;
    this.submitters = submitters;
    this.slotResolvers = slotResolvers;
    this.extractActionSlots = extractActionSlots;
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

    const extractedSlots = this.extractActionSlots(adapter.entityType, text);
    const mergedSlots = await this.#applySlotResolvers(adapter.entityType, { ...extractedSlots, ...slots });
    const missingSlots = adapter.requiredSlots.filter((slot) => !this.#hasValue(mergedSlots[slot]));

    const sessionId = buildSessionId();
    await this.sessionStore.createSession({
      id: sessionId,
      userId,
      actionType: adapter.actionType,
      entityType: adapter.entityType,
      slots: mergedSlots,
    });

    if (missingSlots.length > 0) {
      await this.sessionStore.updateSession(sessionId, {
        status: 'collecting',
        slots: mergedSlots,
      });

      return {
        kind: 'slot_request',
        payload: {
          sessionId,
          entityType: adapter.entityType,
          missingSlots,
          prompt: this.#buildPrompt(adapter, missingSlots),
          fields: this.#buildFieldMeta(adapter, missingSlots),
        },
      };
    }

    const preview = this.#buildPreview(adapter, mergedSlots);
    await this.sessionStore.updateSession(sessionId, {
      status: 'awaiting_confirmation',
      slots: mergedSlots,
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
      const extractedSlots = this.extractActionSlots(adapter.entityType, text);
      const nextSlots = { ...slots, ...extractedSlots };
      const normalizedText = String(text || '').trim();
      const missingSlots = adapter.requiredSlots.filter((slot) => !this.#hasValue(nextSlots[slot]));

      if (normalizedText && missingSlots.length > 0 && Object.keys(extractedSlots || {}).length === 0) {
        const targetSlot = missingSlots[0];
        nextSlots[targetSlot] = await this.#resolveSlotValue(adapter.entityType, targetSlot, normalizedText, nextSlots);
      }

      await this.#applySlotResolvers(adapter.entityType, nextSlots);

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
            prompt: this.#buildPrompt(adapter, nextMissingSlots),
            fields: this.#buildFieldMeta(adapter, nextMissingSlots),
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
      title: `${adapter.entityType} 创建预览`,
      summary: { ...slots },
    };
  }

  #buildPrompt(adapter, missingSlots = []) {
    const labels = this.#buildFieldMeta(adapter, missingSlots).map((item) => item.label);
    return labels.length > 0 ? `还需要补充：${labels.join('、')}` : '请继续补充创建所需的信息。';
  }

  #buildFieldMeta(adapter, missingSlots = []) {
    return missingSlots.map((slot) => ({
      key: slot,
      label: adapter.fieldLabels?.[slot] || slot,
      type: Array.isArray(adapter.requiredSlots) && adapter.requiredSlots.includes(slot) ? 'required' : 'optional',
    }));
  }

  #hasValue(value) {
    if (Array.isArray(value)) return value.length > 0;
    return value !== undefined && value !== null && String(value).trim() !== '';
  }

  async #resolveSlotValue(entityType, slotName, rawValue, slots = {}) {
    const resolverGroup = this.slotResolvers?.[entityType];
    const resolver = resolverGroup?.[slotName];
    if (typeof resolver !== 'function') return rawValue;
    return resolver(rawValue, slots);
  }

  async #applySlotResolvers(entityType, slots = {}) {
    const resolverGroup = this.slotResolvers?.[entityType] || {};
    const slotNames = new Set([
      ...Object.keys(slots),
      ...Object.keys(resolverGroup),
    ]);

    for (const slotName of slotNames) {
      slots[slotName] = await this.#resolveSlotValue(entityType, slotName, slots[slotName], slots);
    }

    return slots;
  }
}
