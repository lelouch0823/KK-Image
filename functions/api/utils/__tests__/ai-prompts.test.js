import { describe, it, expect } from 'vitest';
import { AI_TOOLS, SYSTEM_PROMPT } from '../ai-prompts.js';

describe('ai-prompts variant support', () => {
  it('exposes variant-related tools', () => {
    const names = AI_TOOLS.map((tool) => tool?.function?.name).filter(Boolean);
    expect(names).toContain('searchVariants');
    expect(names).toContain('getVariantDetail');
  });

  it('mentions product variant capabilities in system prompt', () => {
    const prompt = SYSTEM_PROMPT('2026-02-28', { path: '/products' });
    expect(prompt).toContain('商品主档（含变体）');
    expect(prompt).toContain('searchVariants');
    expect(prompt).toContain('getVariantDetail');
  });

  it('includes selected type context and typed tool routing hints', () => {
    const prompt = SYSTEM_PROMPT('2026-02-28', {
      path: '/products',
      selectedId: 'var-1',
      selectedType: 'variant',
    });
    expect(prompt).toContain('当前关联实体类型: variant');
    expect(prompt).toContain('variant -> `getVariantDetail`');
  });
});
