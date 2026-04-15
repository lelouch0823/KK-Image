import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('SpaceProductEditor design-system migration', () => {
  it('uses shared modal and control primitives instead of local shell controls', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/components/SpaceProductEditor.vue'),
      'utf8'
    );

    expect(source).toContain("import Modal from '@/components/ui/Modal.vue'");
    expect(source).toContain("import AppButton from '@/components/ui/AppButton.vue'");
    expect(source).toContain("import AppInput from '@/components/ui/AppInput.vue'");
    expect(source).toContain("import AppIcon from '@/components/ui/AppIcon.vue'");
    expect(source).toContain("import AppCard from '@/components/ui/AppCard.vue'");
    expect(source).toContain("import ActionBar from '@/design-system/composed/ActionBar.vue'");
    expect(source).not.toContain('<button');
    expect(source).not.toContain('<svg');
  });
});
