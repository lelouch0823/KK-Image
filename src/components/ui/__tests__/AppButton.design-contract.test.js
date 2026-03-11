import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('AppButton design contract', () => {
  it('does not hardcode white or gray utility colors in shared variants', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/components/ui/AppButton.vue'), 'utf8');

    expect(source).not.toContain('bg-white');
    expect(source).not.toContain('text-gray-');
    expect(source).not.toContain('border-gray-');
    expect(source).not.toContain('focus:ring-gray-');
  });
});
