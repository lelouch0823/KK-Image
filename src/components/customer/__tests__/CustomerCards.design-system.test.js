import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('CustomerCards design-system migration', () => {
  it('uses shared buttons for card-level edit actions', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/components/customer/CustomerCards.vue'), 'utf8');

    expect(source).toContain("import AppButton from '@/components/ui/AppButton.vue'");
    expect(source).not.toContain('<button');
  });
});
