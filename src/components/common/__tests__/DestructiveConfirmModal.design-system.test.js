import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('DestructiveConfirmModal design-system migration', () => {
  it('uses shared modal primitives instead of local controls', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/components/common/DestructiveConfirmModal.vue'),
      'utf8'
    );

    expect(source).toContain("import Modal from '@/components/ui/Modal.vue'");
    expect(source).toContain("import ActionBar from '@/design-system/composed/ActionBar.vue'");
    expect(source).toContain("import AppButton from '@/components/ui/AppButton.vue'");
    expect(source).toContain("import AppInput from '@/components/ui/AppInput.vue'");
    expect(source).toContain("import AppIcon from '@/components/ui/AppIcon.vue'");
    expect(source).not.toContain('<button');
    expect(source).not.toContain('<input');
    expect(source).not.toContain('<svg');
  });
});
