import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('AuditLogs design-system migration', () => {
  it('uses the shared management list shell and keeps named slots as direct shell children', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/views/AuditLogs.vue'), 'utf8');

    expect(source).toContain('ManagementListShell');
    expect(source).not.toContain('<AppFilterBar');
    expect(source).toContain('no-border');
    expect(source).not.toContain('<template v-else>\n    <template #filters>');
  });
});
