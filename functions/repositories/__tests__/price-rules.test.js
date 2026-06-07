import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PriceRuleRepository } from '../PriceRuleRepository.js';

function createMockDb() {
  const db = {
    prepare: vi.fn(),
    batch: vi.fn(async () => []),
  };
  return db;
}

function createMockStatement(mockFirst = null, mockAll = null, mockRun = null) {
  const stmt = {
    bind: vi.fn(() => stmt),
    first: vi.fn().mockResolvedValue(mockFirst),
    all: vi.fn().mockResolvedValue(mockAll || { results: [] }),
    run: vi.fn().mockResolvedValue(mockRun || { meta: { changes: 1 } }),
  };
  return stmt;
}

describe('PriceRuleRepository', () => {
  let db;
  let repo;

  beforeEach(() => {
    db = createMockDb();
    repo = new PriceRuleRepository(db);
  });

  describe('findByVariant', () => {
    it('returns all price rules for a variant', async () => {
      const mockRules = [
        { id: 'rule_1', variant_id: 'v1', price_type: 'retail', price: 100 },
        { id: 'rule_2', variant_id: 'v1', price_type: 'wholesale', price: 80 },
      ];
      const stmt = createMockStatement(null, { results: mockRules });
      db.prepare.mockReturnValue(stmt);

      const result = await repo.findByVariant('v1');

      expect(result).toEqual(mockRules);
      expect(stmt.bind).toHaveBeenCalledWith('v1');
    });

    it('returns empty array when no rules exist', async () => {
      const stmt = createMockStatement(null, { results: [] });
      db.prepare.mockReturnValue(stmt);

      const result = await repo.findByVariant('v1');

      expect(result).toEqual([]);
    });
  });

  describe('findByVariantIds', () => {
    it('returns map of variant id to price rules', async () => {
      const mockRules = [
        { variant_id: 'v1', price_type: 'retail', price: 100 },
        { variant_id: 'v1', price_type: 'wholesale', price: 80 },
        { variant_id: 'v2', price_type: 'retail', price: 200 },
      ];
      const stmt = createMockStatement(null, { results: mockRules });
      db.prepare.mockReturnValue(stmt);

      const result = await repo.findByVariantIds(['v1', 'v2']);

      expect(result.size).toBe(2);
      expect(result.get('v1')).toHaveLength(2);
      expect(result.get('v2')).toHaveLength(1);
    });

    it('returns empty map for empty input', async () => {
      const result = await repo.findByVariantIds([]);

      expect(result.size).toBe(0);
    });
  });

  describe('findActiveByType', () => {
    it('returns active price rule for variant and type', async () => {
      const mockRule = { id: 'rule_1', variant_id: 'v1', price_type: 'retail', price: 100 };
      const stmt = createMockStatement(mockRule);
      db.prepare.mockReturnValue(stmt);

      const result = await repo.findActiveByType('v1', 'retail');

      expect(result).toEqual(mockRule);
    });

    it('returns null when no active rule exists', async () => {
      const stmt = createMockStatement(null);
      db.prepare.mockReturnValue(stmt);

      const result = await repo.findActiveByType('v1', 'retail');

      expect(result).toBeNull();
    });
  });

  describe('getActivePrice', () => {
    it('returns price from active rule', async () => {
      const mockRule = { id: 'rule_1', variant_id: 'v1', price_type: 'retail', price: 100 };
      const stmt = createMockStatement(mockRule);
      db.prepare.mockReturnValue(stmt);

      const result = await repo.getActivePrice('v1', 'retail', 90);

      expect(result).toBe(100);
    });

    it('falls back to retail price for non-retail types', async () => {
      const retailRule = { id: 'rule_1', variant_id: 'v1', price_type: 'retail', price: 100 };
      const stmt1 = createMockStatement(null); // wholesale not found
      const stmt2 = createMockStatement(retailRule); // retail found
      db.prepare.mockReturnValueOnce(stmt1).mockReturnValueOnce(stmt2);

      const result = await repo.getActivePrice('v1', 'wholesale', 90);

      expect(result).toBe(100);
    });

    it('falls back to base price when no rules exist', async () => {
      const stmt1 = createMockStatement(null);
      const stmt2 = createMockStatement(null);
      db.prepare.mockReturnValueOnce(stmt1).mockReturnValueOnce(stmt2);

      const result = await repo.getActivePrice('v1', 'retail', 90);

      expect(result).toBe(90);
    });
  });

  describe('upsert', () => {
    it('creates or updates a price rule', async () => {
      const stmt = createMockStatement(null, null, { meta: { changes: 1 } });
      db.prepare.mockReturnValue(stmt);

      const result = await repo.upsert('v1', 'retail', 100, null, null);

      expect(result.variant_id).toBe('v1');
      expect(result.price_type).toBe('retail');
      expect(result.price).toBe(100);
    });
  });

  describe('upsertBatch', () => {
    it('batch creates/updates price rules', async () => {
      const stmt = createMockStatement(null, null, { meta: { changes: 1 } });
      db.prepare.mockReturnValue(stmt);
      db.batch.mockResolvedValue([]);

      const rules = [
        { variantId: 'v1', priceType: 'retail', price: 100 },
        { variantId: 'v1', priceType: 'wholesale', price: 80 },
      ];

      const result = await repo.upsertBatch(rules);

      expect(result).toHaveLength(2);
      expect(db.batch).toHaveBeenCalled();
    });

    it('returns empty array for empty input', async () => {
      const result = await repo.upsertBatch([]);

      expect(result).toEqual([]);
    });
  });

  describe('delete', () => {
    it('deletes a price rule by id', async () => {
      const stmt = createMockStatement(null, null, { meta: { changes: 1 } });
      db.prepare.mockReturnValue(stmt);

      const result = await repo.delete('rule_1');

      expect(result).toBe(true);
      expect(stmt.bind).toHaveBeenCalledWith('rule_1');
    });

    it('returns false when rule not found', async () => {
      const stmt = createMockStatement(null, null, { meta: { changes: 0 } });
      db.prepare.mockReturnValue(stmt);

      const result = await repo.delete('nonexistent');

      expect(result).toBe(false);
    });
  });

  describe('deleteByVariant', () => {
    it('deletes all price rules for a variant', async () => {
      const stmt = createMockStatement(null, null, { meta: { changes: 3 } });
      db.prepare.mockReturnValue(stmt);

      const result = await repo.deleteByVariant('v1');

      expect(result).toBe(3);
      expect(stmt.bind).toHaveBeenCalledWith('v1');
    });
  });

  describe('findByProductId', () => {
    it('returns price rules grouped by variant id', async () => {
      const mockRules = [
        { variant_id: 'v1', price_type: 'retail', price: 100 },
        { variant_id: 'v1', price_type: 'wholesale', price: 80 },
        { variant_id: 'v2', price_type: 'retail', price: 200 },
      ];
      const stmt = createMockStatement(null, { results: mockRules });
      db.prepare.mockReturnValue(stmt);

      const result = await repo.findByProductId('prod_1');

      expect(result.size).toBe(2);
      expect(result.get('v1')).toHaveLength(2);
      expect(result.get('v2')).toHaveLength(1);
      expect(stmt.bind).toHaveBeenCalledWith('prod_1');
    });
  });
});
