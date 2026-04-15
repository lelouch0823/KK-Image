import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const readSource = (relativePath) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');

describe('product design system migration contract', () => {
  it('routes ProductCreateModal through the shared modal primitives', () => {
    const source = readSource('src/components/product/ProductCreateModal.vue');

    expect(source).toContain("import Modal from '@/components/ui/Modal.vue'");
    expect(source).toContain('<Modal');
    expect(source).not.toContain('font-[Outfit]');
    expect(source).not.toContain('<svg class="size-6"');
  });

  it('renders ProductVariantTable with shared table and input primitives', () => {
    const source = readSource('src/components/product/ProductVariantTable.vue');

    expect(source).toContain("import AppTable from '@/components/ui/AppTable.vue'");
    expect(source).toContain("import AppInput from '@/components/ui/AppInput.vue'");
    expect(source).toContain("import AppButton from '@/components/ui/AppButton.vue'");
    expect(source).toContain("import StatusBadge from '@/components/ui/StatusBadge.vue'");
    expect(source).not.toContain('class="variant-input"');
    expect(source).not.toContain('<table class=');
  });

  it('keeps ProductTable on shared badges and buttons without local raw actions', () => {
    const source = readSource('src/components/product/ProductTable.vue');

    expect(source).toContain("import AppButton from '@/components/ui/AppButton.vue'");
    expect(source).toContain("import StatusBadge from '@/components/ui/StatusBadge.vue'");
    expect(source).not.toContain('<button');
  });

  it('uses shared state and action primitives in ProductDetail', () => {
    const source = readSource('src/components/product/ProductDetail.vue');

    expect(source).toContain("import StatePanel from '@/design-system/composed/StatePanel.vue'");
    expect(source).toContain("import AppButton from '@/components/ui/AppButton.vue'");
    expect(source).toContain('<StatePanel');
    expect(source).toContain('data-testid="associated-spaces-retry"');
  });
});
