import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('Customer detail overlay design-system migration', () => {
  it('uses shared modal shell for the mobile detail panel', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/components/customer/CustomerDetailPanel.vue'),
      'utf8'
    );

    expect(source).toContain("import Modal from '@/components/ui/Modal.vue'");
    expect(source).toContain('<Modal');
    expect(source).not.toContain('fixed inset-0 z-50 overflow-hidden');
  });

  it('uses shared actions and surfaces inside customer detail content', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/components/customer/CustomerDetailContent.vue'),
      'utf8'
    );

    expect(source).toContain("import ActionBar from '@/design-system/composed/ActionBar.vue'");
    expect(source).toContain("import AppButton from '@/components/ui/AppButton.vue'");
    expect(source).toContain("import AppCard from '@/components/ui/AppCard.vue'");
    expect(source).toContain("import EmptyState from '@/components/ui/EmptyState.vue'");
    expect(source).not.toContain('<button');
  });
});
