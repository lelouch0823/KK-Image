import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const readSource = (relativePath) => readFileSync(resolve(process.cwd(), relativePath), 'utf8');

describe('common surface controls design-system migration', () => {
  it('uses shared buttons in async, password, reload, and notification surfaces', () => {
    const files = [
      'src/components/common/AsyncStatePanel.vue',
      'src/components/common/PasswordGate.vue',
      'src/components/ReloadPrompt.vue',
      'src/components/common/NotificationList.vue',
    ];

    for (const file of files) {
      const source = readSource(file);
      expect(source).toContain("import AppButton from '@/components/ui/AppButton.vue'");
      expect(source).not.toContain('<button');
    }
  });
});
