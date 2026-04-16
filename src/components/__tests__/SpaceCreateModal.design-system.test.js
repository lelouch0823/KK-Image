import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('SpaceCreateModal design-system migration', () => {
  it('uses shared cards, inputs, and buttons for modal actions', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/components/SpaceCreateModal.vue'), 'utf8');

    expect(source).toContain("import AppButton from '@/components/ui/AppButton.vue'");
    expect(source).toContain("import AppCard from '@/components/ui/AppCard.vue'");
    expect(source).toContain("import AppInput from '@/components/ui/AppInput.vue'");
    expect(source).not.toContain('<button');
    expect(source).not.toContain('<input');
    expect(source).not.toContain('<textarea');
  });
});
