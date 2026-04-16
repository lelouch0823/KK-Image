import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const source = fs.readFileSync(
  path.resolve(process.cwd(), 'src/components/OrderStatusChanger.vue'),
  'utf8'
);

describe('OrderStatusChanger design system contract', () => {
  it('uses shared modal and control primitives instead of local shell controls', () => {
    expect(source).toContain("import Modal from '@/components/ui/Modal.vue'");
    expect(source).toContain("import AppInput from '@/components/ui/AppInput.vue'");
    expect(source).toContain("import AppCheckbox from '@/components/ui/AppCheckbox.vue'");
    expect(source).toContain("import AppButton from '@/components/ui/AppButton.vue'");
    expect(source).toContain("import StatusBadge from '@/components/ui/StatusBadge.vue'");
    expect(source).toContain("import ActionBar from '@/design-system/composed/ActionBar.vue'");
    expect(source).not.toContain('<Teleport');
    expect(source).not.toContain('<input');
  });
});
