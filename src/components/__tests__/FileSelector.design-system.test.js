import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('FileSelector design-system migration', () => {
  it('uses shared navigation and action primitives instead of raw modal buttons', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/components/FileSelector.vue'), 'utf8');

    expect(source).toContain("import AppButton from '@/components/ui/AppButton.vue'");
    expect(source).toContain("import ActionBar from '@/design-system/composed/ActionBar.vue'");
    expect(source).not.toContain('<button');
    expect(source).not.toContain('animate-spin rounded-full border-b-2');
  });
});
