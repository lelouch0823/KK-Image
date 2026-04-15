import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('AIChart design-system contract', () => {
  it('avoids legacy chart palette fallbacks and typography exceptions', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/components/common/ai/AIChart.vue'),
      'utf8'
    );

    expect(source).not.toContain("'Outfit'");
    expect(source).not.toContain('rgb(59, 130, 246)');
    expect(source).not.toContain('rgb(139, 92, 246)');
  });
});
