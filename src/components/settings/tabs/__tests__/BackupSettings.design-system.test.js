import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('BackupSettings design-system migration', () => {
  it('uses shared action buttons for backup creation and downloads', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/components/settings/tabs/BackupSettings.vue'),
      'utf8'
    );

    expect(source).toContain("import AppButton from '@/components/ui/AppButton.vue'");
    expect(source).not.toContain('<button');
  });
});
