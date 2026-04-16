import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const readSource = (relativePath) => readFileSync(resolve(process.cwd(), relativePath), 'utf8');

describe('sharing surfaces design-system migration', () => {
  it('uses wrapped buttons and inputs across sharing dialogs', () => {
    const buttonFiles = [
      'src/components/TagModal.vue',
      'src/components/ShareManagementModal.vue',
    ];
    const inputFiles = [
      'src/components/ShareFolderModal.vue',
      'src/components/ShareFileModal.vue',
    ];

    for (const file of buttonFiles) {
      const source = readSource(file);
      expect(source).toContain("import AppButton from '@/components/ui/AppButton.vue'");
      expect(source).not.toContain('<button');
    }

    for (const file of inputFiles) {
      const source = readSource(file);
      expect(source).toContain("import AppInput from '@/components/ui/AppInput.vue'");
      expect(source).not.toContain('<input');
    }
  });
});
