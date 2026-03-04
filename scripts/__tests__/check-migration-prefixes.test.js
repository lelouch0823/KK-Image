import { describe, expect, it } from 'vitest';
import {
  assertNoDuplicatePrefixes,
  extractPrefix,
  findDuplicatePrefixes,
  normalizeAllowlist,
} from '../check-migration-prefixes.mjs';

describe('check-migration-prefixes', () => {
  it('extracts numeric prefix from migration name', () => {
    expect(extractPrefix('0001_init.sql')).toBe('0001');
    expect(extractPrefix('not-a-migration.sql')).toBe(null);
  });

  it('finds duplicate prefixes with file lists', () => {
    const duplicates = findDuplicatePrefixes([
      '0001_init.sql',
      '0002_a.sql',
      '0002_b.sql',
      '0010_x.sql',
    ]);

    expect(duplicates).toEqual([
      { prefix: '0002', files: ['0002_a.sql', '0002_b.sql'] },
    ]);
  });

  it('throws when duplicate prefixes exist', () => {
    expect(() =>
      assertNoDuplicatePrefixes(['0001_init.sql', '0001_extra.sql', '0002_ok.sql'])
    ).toThrow(/duplicate migration prefixes/i);
  });

  it('does not throw when prefixes are unique', () => {
    expect(() => assertNoDuplicatePrefixes(['0001_init.sql', '0002_next.sql'])).not.toThrow();
  });

  it('accepts historical duplicate prefixes when allowlisted with exact file set', () => {
    const allowlist = normalizeAllowlist({
      '0002': ['0002_spaces.sql', '0002_add_share_expiration.sql'],
    });

    expect(() =>
      assertNoDuplicatePrefixes(
        ['0001_init.sql', '0002_add_share_expiration.sql', '0002_spaces.sql'],
        allowlist
      )
    ).not.toThrow();
  });

  it('throws when duplicate prefix differs from allowlisted file set', () => {
    const allowlist = normalizeAllowlist({
      '0002': ['0002_spaces.sql', '0002_add_share_expiration.sql'],
    });

    expect(() =>
      assertNoDuplicatePrefixes(
        ['0001_init.sql', '0002_add_share_expiration.sql', '0002_spaces.sql', '0002_new.sql'],
        allowlist
      )
    ).toThrow(/allowlist mismatch/i);
  });
});
