import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('SalespersonManager design-system migration', () => {
  it('uses the shared management list shell for the page title and filters', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/components/SalespersonManager.vue'), 'utf8');

    expect(source).toContain('ManagementListShell');
    expect(source).toContain("import AppButton from '@/components/ui/AppButton.vue'");
    expect(source).not.toContain("<h2 class=\"text-lg font-semibold text-(--text-main)\">{{ t('salesperson.title') }}</h2>");
    expect(source).not.toContain('<button');
  });
});
