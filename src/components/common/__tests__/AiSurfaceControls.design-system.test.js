import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const readSource = (relativePath) => readFileSync(resolve(process.cwd(), relativePath), 'utf8');

describe('AI and fallback surface controls design-system migration', () => {
  it('uses shared buttons for AI cards and fallback actions', () => {
    const files = [
      'src/components/common/AppErrorBoundary.vue',
      'src/components/common/ai/SlotQuestionCard.vue',
      'src/components/common/ai/ActionPreviewCard.vue',
      'src/components/common/ai/AISuggestions.vue',
      'src/components/common/ai/ChatMessage.vue',
      'src/components/common/uploader/UploadPreviewItem.vue',
    ];

    for (const file of files) {
      const source = readSource(file);
      expect(source).toContain("import AppButton from '@/components/ui/AppButton.vue'");
      expect(source).not.toContain('<button');
    }
  });
});
