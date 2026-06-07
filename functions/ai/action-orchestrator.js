import { parseJsonObject } from '../api/utils/json.js';
import { generateId } from '../api/utils/id.js';
import { detectCreateIntent } from './canonicalization.js';

function isCandidateResult(value) {
  return (
    value &&
    typeof value === 'object' &&
    value.kind === 'candidates' &&
    Array.isArray(value.candidates)
  );
}

function buildSubmittedActionPayload(session, adapter, created = {}) {
  return {
    sessionId: session.id,
    entityType: session.entity_type,
    createdEntityId: created.id,
    createdEntityLabel: created.label || created.id,
    purchaseOrderCreated: created.purchaseOrderCreated || null,
    productCreated: created.productCreated || null,
    orderCreated: created.orderCreated || null,
    targetModule: adapter.targetModule,
    successMessage: created.message || '已完成创建，请前往对应模块查看。',
  };
}

export class AIActionOrchestrator {
  constructor({
    sessionStore,
    getActionAdapter,
    submitters = {},
    slotResolvers = {},
    extractActionSlots = () => ({}),
    canAccessAction = async () => true,
  }) {
    this.sessionStore = sessionStore;
    this.getActionAdapter = getActionAdapter;
    this.submitters = submitters;
    this.slotResolvers = slotResolvers;
    this.extractActionSlots = extractActionSlots;
    this.canAccessAction = canAccessAction;
  }

  async advance({ userId, user = null, text = '', slots = {}, confirmation = false }) {
    const activeSession = await this.sessionStore.getLatestActiveSession(userId);
    if (activeSession) {
      return this.#resumeSession({ session: activeSession, user, text, confirmation });
    }

    const intent = detectCreateIntent(text);
    if (!intent) return null;

    const adapter = this.getActionAdapter(intent.entityType);
    if (!adapter) return null;
    if (!(await this.canAccessAction(user, adapter))) {
      return {
        kind: 'action_denied',
        payload: {
          entityType: adapter.entityType,
          requiredPermission: adapter.requiredPermission || null,
        },
      };
    }

    const extractedSlots = this.extractActionSlots(adapter.entityType, text);
    const mergedSlots = await this.#applySlotResolvers(adapter.entityType, {
      ...extractedSlots,
      ...slots,
    });
    const missingSlots = this.#getMissingSlots(adapter, mergedSlots);

    const sessionId = generateId();
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
          prompt: this.#buildPrompt(adapter, missingSlots, mergedSlots),
          fields: this.#buildFieldMeta(adapter, missingSlots, mergedSlots),
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

  async #resumeSession({ session, user, text, confirmation }) {
    const adapter = this.getActionAdapter(session.entity_type);
    if (!adapter) {
      throw new Error(`Missing action adapter for ${session.entity_type}`);
    }
    if (!(await this.canAccessAction(user, adapter))) {
      return {
        kind: 'action_denied',
        payload: {
          entityType: adapter.entityType,
          requiredPermission: adapter.requiredPermission || null,
        },
      };
    }
    const slots = parseJsonObject(session.slots_json, {});
    const preview = parseJsonObject(session.preview_json, {});

    if (session.status === 'submitted_pending_effects' && preview?.submittedPayload) {
      return {
        kind: 'action_submitted',
        payload: preview.submittedPayload,
      };
    }

    if (session.status === 'collecting' && !confirmation) {
      const extractedSlots = this.extractActionSlots(adapter.entityType, text);
      const nextSlots = this.#mergeCollectedSlots(adapter.entityType, slots, extractedSlots);
      const normalizedText = String(text || '').trim();
      this.#applyCandidateChoiceFromText(nextSlots, normalizedText);
      const missingSlots = this.#getMissingSlots(adapter, nextSlots);

      if (
        normalizedText &&
        missingSlots.length > 0 &&
        Object.keys(extractedSlots || {}).length === 0
      ) {
        const targetSlot = missingSlots[0];
        if (!this.#hasValue(nextSlots[targetSlot])) {
          nextSlots[targetSlot] = await this.#resolveSlotValue(
            adapter.entityType,
            targetSlot,
            normalizedText,
            nextSlots
          );
        }
      }

      await this.#applySlotResolvers(adapter.entityType, nextSlots);

      const nextMissingSlots = this.#getMissingSlots(adapter, nextSlots);
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
            prompt: this.#buildPrompt(adapter, nextMissingSlots, nextSlots),
            fields: this.#buildFieldMeta(adapter, nextMissingSlots, nextSlots),
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
    const submittedPayload = buildSubmittedActionPayload(session, adapter, created);

    if (created?.purchaseOrderCreated || created?.productCreated || created?.orderCreated) {
      await this.sessionStore.updateSession(session.id, {
        status: 'submitted_pending_effects',
        slots,
        preview: {
          ...preview,
          submittedPayload,
        },
      });
    } else {
      await this.sessionStore.updateSession(session.id, {
        status: 'completed',
        slots,
        preview,
      });
    }

    return {
      kind: 'action_submitted',
      payload: submittedPayload,
    };
  }

  #buildPreview(adapter, slots) {
    return {
      title: `${adapter.entityType} 创建预览`,
      summary: { ...slots },
    };
  }

  #buildPrompt(adapter, missingSlots = [], slots = {}) {
    const labels = this.#buildFieldMeta(adapter, missingSlots, slots).map((item) => item.label);
    return labels.length > 0 ? `还需要补充：${labels.join('、')}` : '请继续补充创建所需的信息。';
  }

  #buildFieldMeta(adapter, missingSlots = [], slots = {}) {
    const requiredSlots = this.#getRequiredSlots(adapter, slots);
    return missingSlots.map((slot) => ({
      key: slot,
      label: adapter.fieldLabels?.[slot] || slot,
      type: requiredSlots.includes(slot) ? 'required' : 'optional',
      candidates: this.#getCandidateChoicesForField(slots, slot),
    }));
  }

  #getRequiredSlots(adapter, slots = {}) {
    if (typeof adapter?.getRequiredSlots === 'function') {
      return adapter.getRequiredSlots(slots);
    }
    return Array.isArray(adapter?.requiredSlots) ? adapter.requiredSlots : [];
  }

  #getMissingSlots(adapter, slots = {}) {
    if (typeof adapter?.getMissingSlots === 'function') {
      return adapter.getMissingSlots(slots);
    }
    const requiredSlots = this.#getRequiredSlots(adapter, slots);
    return requiredSlots.filter((slot) => !this.#hasValue(slots[slot]));
  }

  #mergeCollectedSlots(entityType, currentSlots = {}, extractedSlots = {}) {
    const merged = { ...currentSlots, ...extractedSlots };

    if (
      entityType === 'purchase_order' &&
      String(merged.mode || currentSlots.mode || '').trim() === 'manual' &&
      Array.isArray(currentSlots.items) &&
      Array.isArray(extractedSlots.items)
    ) {
      const resolvedExistingItems = currentSlots.items.filter(
        (item) => item?.product_id && item?.variant_id
      );
      merged.items = [...resolvedExistingItems, ...extractedSlots.items];
    }

    return merged;
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
    const slotNames = new Set([...Object.keys(slots), ...Object.keys(resolverGroup)]);

    for (const slotName of slotNames) {
      const resolvedValue = await this.#resolveSlotValue(
        entityType,
        slotName,
        slots[slotName],
        slots
      );
      if (isCandidateResult(resolvedValue)) {
        if (!slots.__candidateChoices || typeof slots.__candidateChoices !== 'object') {
          slots.__candidateChoices = {};
        }
        slots.__candidateChoices[slotName] = resolvedValue.candidates;
        slots[slotName] = '';
        continue;
      }
      if (
        slots.__candidateChoices &&
        Object.prototype.hasOwnProperty.call(slots.__candidateChoices, slotName)
      ) {
        delete slots.__candidateChoices[slotName];
      }
      slots[slotName] = resolvedValue;
    }

    return slots;
  }

  #applyCandidateChoiceFromText(slots = {}, text = '') {
    const pending = slots.__candidateChoices;
    if (!pending || typeof pending !== 'object') return;
    const normalizedText = String(text || '').trim();
    if (!normalizedText) return;

    const entries = Object.entries(pending);
    if (entries.length !== 1) return;

    const [slotName, candidates] = entries[0];
    if (!Array.isArray(candidates) || candidates.length === 0) return;

    let matched = null;
    const numeric = Number.parseInt(normalizedText, 10);
    if (Number.isFinite(numeric) && numeric >= 1 && numeric <= candidates.length) {
      matched = candidates[numeric - 1];
    } else {
      const comparable = normalizedText.toLowerCase();
      matched =
        candidates.find((candidate) => {
          const label = String(candidate?.label || '').toLowerCase();
          const value = String(candidate?.value || '').toLowerCase();
          return comparable === label || comparable === value;
        }) || null;
    }

    if (!matched) return;

    slots[slotName] = matched.value;
    delete slots.__candidateChoices[slotName];
    if (Object.keys(slots.__candidateChoices).length === 0) {
      delete slots.__candidateChoices;
    }
  }

  #getCandidateChoicesForField(slots = {}, slotName) {
    const pending = slots.__candidateChoices;
    if (!pending || typeof pending !== 'object') return undefined;
    return Array.isArray(pending[slotName]) ? pending[slotName] : undefined;
  }
}
