import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('SpaceProductEditor design-system migration', () => {
  it('uses shared modal and control primitives instead of local shell controls', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/components/SpaceProductEditor.vue'),
      'utf8'
    );

    expect(source).toContain("import Modal from '@/components/ui/Modal.vue'");
    expect(source).toContain("import AppButton from '@/components/ui/AppButton.vue'");
    expect(source).toContain("import AppInput from '@/components/ui/AppInput.vue'");
    expect(source).toContain("import AppIcon from '@/components/ui/AppIcon.vue'");
    expect(source).toContain("import ActionBar from '@/design-system/composed/ActionBar.vue'");
    expect(source).toContain(
      "import CalloutPanel from '@/design-system/composed/CalloutPanel.vue'"
    );
    expect(source).not.toContain('<button');
    expect(source).not.toContain('<svg');
  });

  it('keeps nested space share and file controls on shared primitives', () => {
    const filesTab = readFileSync(
      resolve(process.cwd(), 'src/components/space/SpaceFilesTab.vue'),
      'utf8'
    );
    const shareCard = readFileSync(
      resolve(process.cwd(), 'src/components/space/SpaceShareCard.vue'),
      'utf8'
    );
    const settingsTab = readFileSync(
      resolve(process.cwd(), 'src/components/space/SpaceSettingsTab.vue'),
      'utf8'
    );
    const visibilitySelector = readFileSync(
      resolve(process.cwd(), 'src/components/space/SpaceVisibilitySelector.vue'),
      'utf8'
    );
    const mediaGrid = readFileSync(
      resolve(process.cwd(), 'src/components/space/SpaceMediaGrid.vue'),
      'utf8'
    );

    expect(filesTab).toContain("import AppButton from '@/components/ui/AppButton.vue'");
    expect(filesTab).not.toContain('<button');
    expect(filesTab).not.toContain('hover:bg-red-600');

    expect(shareCard).toContain("import AppButton from '@/components/ui/AppButton.vue'");
    expect(shareCard).toContain("import AppInput from '@/components/ui/AppInput.vue'");
    expect(shareCard).not.toContain('<button');
    expect(shareCard).not.toContain('<input');

    expect(settingsTab).toContain("import AppButton from '@/components/ui/AppButton.vue'");
    expect(settingsTab).toContain("import AppInput from '@/components/ui/AppInput.vue'");
    expect(settingsTab).not.toContain('<button');
    expect(settingsTab).not.toContain('<input');

    expect(visibilitySelector).toContain("import AppCard from '@/components/ui/AppCard.vue'");
    expect(visibilitySelector).not.toContain('<button');

    expect(mediaGrid).toContain("import AppButton from '@/components/ui/AppButton.vue'");
    expect(mediaGrid).not.toContain('<button');
    expect(mediaGrid).not.toContain('bg-blue-500/90');
  });
});
