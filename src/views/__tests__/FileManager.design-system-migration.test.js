import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('FileManager design-system migration', () => {
  it('uses the shared management list shell', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/views/FileManager/index.vue'), 'utf8');
    expect(source).toContain('ManagementListShell');
  });

  it('does not wrap the content area in an extra heavy card shell', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/views/FileManager/index.vue'), 'utf8');

    expect(source).not.toContain(
      'relative flex min-h-[calc(100vh-8rem)] flex-col overflow-hidden rounded-xl border border-(--border-color) bg-(--bg-card)'
    );
  });

  it('uses shared buttons in the toolbar action affordances', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/views/FileManager/FileManagerToolbar.vue'),
      'utf8'
    );

    expect(source).toContain("import AppButton from '@/components/ui/AppButton.vue'");
    expect(source).not.toContain('<button');
  });

  it('uses shared buttons for folder grid context affordances', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/views/FileManager/FolderGrid.vue'),
      'utf8'
    );

    expect(source).toContain("import AppButton from '@/components/ui/AppButton.vue'");
    expect(source).not.toContain('<button');
  });
});
