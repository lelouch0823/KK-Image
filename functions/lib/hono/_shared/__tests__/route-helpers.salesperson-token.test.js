import { describe, it, expect, vi } from 'vitest';
import { getSalespersonAccessTokens } from '../route-helpers.js';

describe('getSalespersonAccessTokens', () => {
  it('dedupes ids and builds dynamic placeholders', async () => {
    const all = vi.fn(async () => ({
      results: [
        { access_token: 'token-a' },
        { access_token: 'token-a' },
        { access_token: 'token-b' },
      ],
    }));
    const bind = vi.fn(() => ({ all }));
    const prepare = vi.fn(() => ({ bind }));
    const db = { prepare };

    const result = await getSalespersonAccessTokens(db, ['sp-1', 'sp-1', 'sp-2', null, 'sp-3']);

    expect(prepare).toHaveBeenCalledWith(
      'SELECT access_token FROM salespersons WHERE id IN (?,?,?) AND access_token IS NOT NULL'
    );
    expect(bind).toHaveBeenCalledWith('sp-1', 'sp-2', 'sp-3');
    expect(result).toEqual(['token-a', 'token-b']);
  });

  it('returns empty array for empty ids', async () => {
    const prepare = vi.fn();
    const result = await getSalespersonAccessTokens({ prepare }, []);
    expect(result).toEqual([]);
    expect(prepare).not.toHaveBeenCalled();
  });
});
