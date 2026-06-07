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
    expect(source).not.toContain('<button');
  });

  it('keeps ProductExportModal on shared action and input primitives', () => {
    const source = readSource('src/components/product/ProductExportModal.vue');

    expect(source).toContain("import AppButton from '@/components/ui/AppButton.vue'");
    expect(source).toContain("import AppCard from '@/components/ui/AppCard.vue'");
    expect(source).not.toContain('<button');
    expect(source).not.toContain('<input');
    expect(source).not.toContain('btn btn-primary');
    expect(source).not.toContain('btn btn-ghost');
  });

  it('keeps product workflow helpers on shared action and input primitives', () => {
    const workflowModal = readSource('src/components/product/ProductWorkflowModal.vue');
    const valueArchiveModal = readSource('src/components/product/ValueArchiveModal.vue');
    const dimensionArchiveModal = readSource('src/components/product/DimensionArchiveModal.vue');
    const productSelect = readSource('src/components/product/ProductSelect.vue');

    expect(workflowModal).toContain("import AppButton from '@/components/ui/AppButton.vue'");
    expect(workflowModal).not.toContain('<button');

    expect(valueArchiveModal).toContain("import AppButton from '@/components/ui/AppButton.vue'");
    expect(valueArchiveModal).not.toContain('<button');

    expect(dimensionArchiveModal).toContain(
      "import AppButton from '@/components/ui/AppButton.vue'"
    );
    expect(dimensionArchiveModal).not.toContain('<button');
    expect(dimensionArchiveModal).not.toContain('<input');

    expect(productSelect).toContain("import AppButton from '@/components/ui/AppButton.vue'");
    expect(productSelect).toContain("import AppInput from '@/components/ui/AppInput.vue'");
    expect(productSelect).not.toContain('<button');
    expect(productSelect).not.toContain('<input');
  });

  it('keeps product import workflow on shared action and field primitives', () => {
    const importModal = readSource('src/components/product/ProductImportModal.vue');
    const importUploadStep = readSource('src/components/product/import/ImportUploadStep.vue');
    const importMappingStep = readSource('src/components/product/import/ImportMappingStep.vue');
    const importPreviewStep = readSource('src/components/product/import/ImportPreviewStep.vue');

    expect(importModal).toContain("import AppButton from '@/components/ui/AppButton.vue'");
    expect(importModal).not.toContain('btn btn-primary');
    expect(importModal).not.toContain('btn btn-ghost');

    expect(importUploadStep).toContain("import AppButton from '@/components/ui/AppButton.vue'");
    expect(importUploadStep).not.toContain('<button');

    expect(importMappingStep).toContain("import AppButton from '@/components/ui/AppButton.vue'");
    expect(importMappingStep).toContain("import AppCard from '@/components/ui/AppCard.vue'");
    expect(importMappingStep).toContain("import AppInput from '@/components/ui/AppInput.vue'");
    expect(importMappingStep).not.toContain('<button');
    expect(importMappingStep).not.toContain('<input');

    expect(importPreviewStep).toContain("import AppButton from '@/components/ui/AppButton.vue'");
    expect(importPreviewStep).toContain("import AppInput from '@/components/ui/AppInput.vue'");
    expect(importPreviewStep).not.toContain('<button');
    expect(importPreviewStep).not.toContain('<input');
    expect(importPreviewStep).not.toContain('<select');
  });

  it('keeps remaining product surfaces on shared cards, buttons, and selects', () => {
    const basicInfoSection = readSource('src/components/product/ProductBasicInfoSection.vue');
    const productGrid = readSource('src/components/product/ProductGrid.vue');
    const optionsBuilder = readSource('src/components/product/ProductOptionsBuilder.vue');
    const variantImageManager = readSource('src/components/product/VariantImageManagerModal.vue');

    expect(basicInfoSection).toContain("import Select from '@/components/ui/Select.vue'");
    expect(basicInfoSection).not.toContain('<select');

    expect(productGrid).toContain("import AppButton from '@/components/ui/AppButton.vue'");
    expect(productGrid).not.toContain('<button');

    expect(optionsBuilder).toContain("import AppButton from '@/components/ui/AppButton.vue'");
    expect(optionsBuilder).not.toContain('<button');

    expect(variantImageManager).toContain("import AppButton from '@/components/ui/AppButton.vue'");
    expect(variantImageManager).toContain("import AppCard from '@/components/ui/AppCard.vue'");
    expect(variantImageManager).not.toContain('<button');
  });
});
