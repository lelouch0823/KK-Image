import { describe, expect, it } from 'vitest';
import { CreateApiKeySchema } from '../user.js';

describe('user schema', () => {
  it('defaults api key permissions to empty array', () => {
    const parsed = CreateApiKeySchema.parse({ name: 'k1' });
    expect(parsed.permissions).toEqual([]);
  });
});

