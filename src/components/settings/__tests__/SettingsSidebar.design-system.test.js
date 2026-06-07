import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('SettingsSidebar design-system migration', () => {
  it('uses shared button primitives for tab navigation items', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/components/settings/SettingsSidebar.vue'),
      'utf8'
    );

    expect(source).toContain("import AppButton from '@/components/ui/AppButton.vue'");
    expect(source).not.toContain('<button');
  });
});
