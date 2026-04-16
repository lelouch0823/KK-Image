import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('AI widget design-system migration', () => {
  it('uses shared controls inside AIChatWidget', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/components/common/AIChatWidget.vue'),
      'utf8'
    );

    expect(source).toContain("import AppButton from '@/components/ui/AppButton.vue'");
    expect(source).toContain("import AppInput from '@/components/ui/AppInput.vue'");
    expect(source).toContain("import AppCard from '@/components/ui/AppCard.vue'");
    expect(source).toContain("import ActionBar from '@/design-system/composed/ActionBar.vue'");
    expect(source).not.toContain('<button');
    expect(source).not.toContain('<svg');
  });

  it('uses shared surface primitives inside AIChart', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/components/common/ai/AIChart.vue'),
      'utf8'
    );

    expect(source).toContain("import AppCard from '@/components/ui/AppCard.vue'");
    expect(source).toContain('indicator="blue"');
    expect(source).not.toContain("'Outfit'");
    expect(source).not.toContain('#3B82F6');
  });
});
