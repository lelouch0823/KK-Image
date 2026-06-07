import { describe, expect, it } from 'vitest';
import basicFixture from './fixtures/basic-chat.json';
import multimodalFixture from './fixtures/multimodal-chat.json';
import quotaRejectFixture from './fixtures/quota-reject.json';
import safetyDegradeFixture from './fixtures/safety-degrade.json';
import { prepareConversationRequest } from '../conversation-service.js';
import { validateAIRequest } from '../input-validator.js';

describe('ai regression fixtures', () => {
  it('keeps baseline behavior for normal, multimodal, quota-rejected and safety-degraded requests', async () => {
    const basic = await prepareConversationRequest({
      history: basicFixture.history,
      channel: 'chat',
      basePrompt: 'base',
    });
    expect(basic.visionFirst).toBe(basicFixture.expected.visionFirst);
    expect(
      validateAIRequest({
        history: basicFixture.history,
        limits: { maxInputLength: 1000, maxImageCount: 4, maxImageUrlLength: 1000 },
      }).decision
    ).toBe(basicFixture.expected.decision);

    const multimodal = await prepareConversationRequest({
      history: multimodalFixture.history,
      channel: 'stream',
      basePrompt: 'base',
    });
    expect(multimodal.visionFirst).toBe(multimodalFixture.expected.visionFirst);

    expect(quotaRejectFixture.quotaResult.reason).toBe(quotaRejectFixture.expected.quotaDecision);

    const degraded = validateAIRequest({
      history: safetyDegradeFixture.history,
      limits: { maxInputLength: 1000, maxImageCount: 4, maxImageUrlLength: 1000 },
      userSignals: safetyDegradeFixture.signals,
    });
    expect(degraded.decision).toBe(safetyDegradeFixture.expected.decision);
    expect(degraded.disableTools).toBe(safetyDegradeFixture.expected.disableTools);
  });
});
