import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('TrashModal design-system migration', () => {
  it('uses AppTable without an extra card wrapper inside the modal body', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/views/FileManager/TrashModal.vue'), 'utf8');

    expect(source).toContain('AppTable');
    expect(source).not.toContain('h-full overflow-hidden rounded-xl border border-(--border-color) bg-(--bg-card) shadow-sm');
  });
});
