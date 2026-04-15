import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('SpaceProductDetail design-system migration', () => {
  it('uses shared action primitives for gallery and download controls', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/components/space/SpaceProductDetail.vue'),
      'utf8'
    );

    expect(source).toContain("import AppButton from '@/components/ui/AppButton.vue'");
    expect(source).not.toContain('<button');
  });
});
