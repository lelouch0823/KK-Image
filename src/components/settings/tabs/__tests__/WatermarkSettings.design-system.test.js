import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('WatermarkSettings design-system migration', () => {
  it('uses shared cards and wrapped controls for the settings form shell', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/components/settings/tabs/WatermarkSettings.vue'),
      'utf8'
    );

    expect(source).toContain("import AppButton from '@/components/ui/AppButton.vue'");
    expect(source).toContain("import AppCard from '@/components/ui/AppCard.vue'");
    expect(source).toContain("import ActionBar from '@/design-system/composed/ActionBar.vue'");
    expect(source).toContain("import AppSlider from '@/components/ui/AppSlider.vue'");
    expect(source).toContain("import AppColorInput from '@/components/ui/AppColorInput.vue'");
    expect(source).not.toContain('<button');
    expect(source).not.toContain('<input');
  });
});
