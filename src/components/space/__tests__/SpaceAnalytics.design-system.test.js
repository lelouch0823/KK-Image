import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('SpaceAnalytics design-system migration', () => {
  it('uses shared buttons for time range controls', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/components/SpaceAnalytics.vue'), 'utf8');

    expect(source).toContain("import AppButton from '@/components/ui/AppButton.vue'");
    expect(source).not.toContain('<button');
  });
});
