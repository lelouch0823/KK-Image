import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('SpaceMasonry design-system migration', () => {
  it('uses shared action primitives for download and lightbox controls', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/components/space/SpaceMasonry.vue'),
      'utf8'
    );

    expect(source).toContain("import AppButton from '@/components/ui/AppButton.vue'");
    expect(source).not.toContain('<button');
  });
});
