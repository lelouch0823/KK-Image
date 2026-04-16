import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('SubspaceList design-system migration', () => {
  it('uses shared buttons for create and row actions', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/components/SubspaceList.vue'), 'utf8');

    expect(source).toContain("import AppButton from '@/components/ui/AppButton.vue'");
    expect(source).not.toContain('<button');
  });
});
