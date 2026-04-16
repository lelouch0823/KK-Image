import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('SpaceProductDetail design-system migration', () => {
  it('uses shared action primitives for gallery and download controls', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/components/space/SpaceProductDetail.vue'),
      'utf8'
    );
    const ringVarClass = ['ring-[', 'var('].join('');
    const borderVarClass = ['border-[', 'var('].join('');
    const bgVarClass = ['bg-[', 'var('].join('');
    const shadowVarClass = ['shadow-[', 'var('].join('');

    expect(source).toContain("import AppButton from '@/components/ui/AppButton.vue'");
    expect(source).not.toContain('<button');
    expect(source).not.toContain(ringVarClass);
    expect(source).not.toContain(borderVarClass);
    expect(source).not.toContain(bgVarClass);
    expect(source).not.toContain(shadowVarClass);
  });
});
