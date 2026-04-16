import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (file) => readFileSync(resolve(process.cwd(), file), 'utf8');

describe('salesperson design-system contracts', () => {
  it('uses shared cards and buttons across list/detail surfaces', () => {
    const cardsSource = read('src/components/salesperson/SalespersonCards.vue');
    const tableSource = read('src/components/salesperson/SalespersonTable.vue');
    const detailSource = read('src/components/salesperson/SalespersonDetailModal.vue');

    expect(cardsSource).toContain("import AppCard from '@/components/ui/AppCard.vue'");
    expect(cardsSource).toContain("import AppButton from '@/components/ui/AppButton.vue'");
    expect(cardsSource).not.toContain('<button');
    expect(tableSource).toContain("import AppButton from '@/components/ui/AppButton.vue'");
    expect(tableSource).not.toContain('<button');
    expect(detailSource).toContain("import AppButton from '@/components/ui/AppButton.vue'");
    expect(detailSource).toContain("import ActionBar from '@/design-system/composed/ActionBar.vue'");
    expect(detailSource).not.toContain('<button');
  });

  it('uses shared controls in the salesperson form', () => {
    const formSource = read('src/components/salesperson/SalespersonForm.vue');

    expect(formSource).toContain("import AppCheckbox from '@/components/ui/AppCheckbox.vue'");
    expect(formSource).toContain("import ActionBar from '@/design-system/composed/ActionBar.vue'");
    expect(formSource).not.toContain('<button');
    expect(formSource).not.toContain('<input');
  });
});
