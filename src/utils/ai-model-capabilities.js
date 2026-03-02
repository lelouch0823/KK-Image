const VISION_HINT_PATTERNS = [
  /\bvision\b/i,
  /\bmultimodal\b/i,
  /\b4o\b/i,
  /\bomni\b/i,
  /\bgemini\b/i,
  /\bclaude[-_. ]?3(?:[-_. ]?\d+)?\b/i,
  /\bclaude[-_. ]?sonnet[-_. ]?4\b/i,
  /\bqwen\d*(?:\.\d+)?[-_. ]?vl\b/i,
  /\bglm[-_. ]?4v\b/i,
  /\binternvl\b/i,
  /\bminicpm[-_. ]?v\b/i,
  /\bllava\b/i,
  /\bpixtral\b/i,
  /\bgpt[-_. ]?4(?:\.\d+)?[-_. ]?o\b/i,
  /\bgpt[-_. ]?4\.1\b/i,
  /\bgpt[-_. ]?5(?:\.\d+)?(?:[-_. ]?codex(?:[-_. ]?(?:mini|max|spark))?)?\b/i,
];

export function inferModelSupportsVision(modelName = '') {
  const normalized = String(modelName || '').trim();
  if (!normalized) return false;
  return VISION_HINT_PATTERNS.some((pattern) => pattern.test(normalized));
}

export const __INTERNAL__ = {
  VISION_HINT_PATTERNS,
};
