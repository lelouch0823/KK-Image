const normalizeString = (value) => String(value ?? '').trim();

const buildOptionsSignature = (optionsValues = {}) => {
  const normalized = Object.entries(optionsValues || {})
    .map(([key, value]) => [normalizeString(key), normalizeString(value)])
    .filter(([key, value]) => key && value)
    .sort(([a], [b]) => a.localeCompare(b));
  return normalized.length ? JSON.stringify(Object.fromEntries(normalized)) : '';
};

const hasImagePayload = (variant) => Array.isArray(variant?.images);

const scoreCandidate = ({ inputVariant, inputIndex, candidate, candidateIndex }) => {
  let baseScore = 0;
  const inputId = normalizeString(inputVariant?.id);
  const inputSku = normalizeString(inputVariant?.sku);
  const inputSignature = buildOptionsSignature(inputVariant?.options_values || {});

  if (inputId && inputId === normalizeString(candidate?.id)) baseScore += 100;
  if (inputSku && inputSku === normalizeString(candidate?.sku)) baseScore += 40;

  const candidateSignature = buildOptionsSignature(candidate?.options_values || {});
  if (inputSignature && inputSignature === candidateSignature) baseScore += 20;
  const indexScore = inputIndex === candidateIndex ? 5 : 0;

  return {
    totalScore: baseScore + indexScore,
    baseScore,
  };
};

export const resolveVariantImageSyncPlan = ({ inputVariants = [], persistedVariants = [] }) => {
  const tasks = [];
  const unresolved = [];
  const usedVariantIds = new Set();

  for (let inputIndex = 0; inputIndex < inputVariants.length; inputIndex++) {
    const inputVariant = inputVariants[inputIndex];
    if (!hasImagePayload(inputVariant)) continue;

    const candidates = [];
    for (let candidateIndex = 0; candidateIndex < persistedVariants.length; candidateIndex++) {
      const candidate = persistedVariants[candidateIndex];
      const candidateId = normalizeString(candidate?.id);
      if (!candidateId || usedVariantIds.has(candidateId)) continue;
      const score = scoreCandidate({
        inputVariant,
        inputIndex,
        candidate,
        candidateIndex,
      });
      if (score.totalScore > 0) {
        candidates.push({ candidate, ...score });
      }
    }

    if (candidates.length === 0) {
      unresolved.push({
        index: inputIndex,
        reason: 'no_match',
        sku: normalizeString(inputVariant?.sku) || null,
        id: normalizeString(inputVariant?.id) || null,
      });
      continue;
    }

    candidates.sort((a, b) => b.totalScore - a.totalScore);
    const [best, second] = candidates;
    if (
      second &&
      (best.totalScore === second.totalScore ||
        (best.baseScore > 0 && best.baseScore === second.baseScore))
    ) {
      unresolved.push({
        index: inputIndex,
        reason: 'ambiguous_match',
        sku: normalizeString(inputVariant?.sku) || null,
        id: normalizeString(inputVariant?.id) || null,
      });
      continue;
    }

    const targetVariantId = normalizeString(best.candidate?.id);
    usedVariantIds.add(targetVariantId);
    tasks.push({
      variantId: targetVariantId,
      images: Array.isArray(inputVariant.images) ? inputVariant.images : [],
    });
  }

  return { tasks, unresolved };
};
