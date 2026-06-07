import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('SalespersonPicker design-system migration', () => {
  it('uses shared buttons for chip removal and modal trigger', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/components/SalespersonPicker.vue'),
      'utf8'
    );

    expect(source).toContain("import AppButton from '@/components/ui/AppButton.vue'");
    expect(source).not.toContain('<button');
  });
});
