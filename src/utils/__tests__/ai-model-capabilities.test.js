import { describe, expect, it } from 'vitest';
import { inferModelSupportsVision } from '../ai-model-capabilities';

describe('inferModelSupportsVision', () => {
  it('returns true for common vision model keywords', () => {
    expect(inferModelSupportsVision('gpt-4o')).toBe(true);
    expect(inferModelSupportsVision('qwen2.5-vl-72b-instruct')).toBe(true);
    expect(inferModelSupportsVision('claude-3-5-sonnet')).toBe(true);
    expect(inferModelSupportsVision('gemini-2.0-flash')).toBe(true);
    expect(inferModelSupportsVision('my-vision-model')).toBe(true);
    expect(inferModelSupportsVision('gpt-5')).toBe(true);
    expect(inferModelSupportsVision('gpt-5.1-codex-mini')).toBe(true);
    expect(inferModelSupportsVision('gpt-5.3-codex-spark')).toBe(true);
    expect(inferModelSupportsVision('qwen3-vl-plus')).toBe(true);
  });

  it('returns false for text-only looking models', () => {
    expect(inferModelSupportsVision('gpt-3.5-turbo')).toBe(false);
    expect(inferModelSupportsVision('deepseek-chat')).toBe(false);
    expect(inferModelSupportsVision('deepseek-r1')).toBe(false);
    expect(inferModelSupportsVision('deepseek-v3.2')).toBe(false);
    expect(inferModelSupportsVision('qwen3-max-preview')).toBe(false);
    expect(inferModelSupportsVision('qwen3-coder-plus')).toBe(false);
    expect(inferModelSupportsVision('glm-4.6')).toBe(false);
    expect(inferModelSupportsVision('kimi-k2')).toBe(false);
    expect(inferModelSupportsVision('')).toBe(false);
  });
});
