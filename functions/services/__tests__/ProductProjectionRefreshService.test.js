import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockProjectionRepo = {
  refreshByProductId: vi.fn(),
  refreshByProductIds: vi.fn(),
  refreshByVariantIds: vi.fn(),
  refreshAll: vi.fn(),
};

vi.mock('../../repositories/ProductProjectionRepository.js', () => ({
  ProductProjectionRepository: class {
    refreshByProductId(...args) {
      return mockProjectionRepo.refreshByProductId(...args);
    }
    refreshByProductIds(...args) {
      return mockProjectionRepo.refreshByProductIds(...args);
    }
    refreshByVariantIds(...args) {
      return mockProjectionRepo.refreshByVariantIds(...args);
    }
    refreshAll(...args) {
      return mockProjectionRepo.refreshAll(...args);
    }
  },
}));

import { ProductProjectionRefreshService } from '../ProductProjectionRefreshService.js';

describe('ProductProjectionRefreshService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mockProjectionRepo.refreshByProductId.mockResolvedValue([]);
    mockProjectionRepo.refreshByProductIds.mockResolvedValue([]);
    mockProjectionRepo.refreshByVariantIds.mockResolvedValue([]);
    mockProjectionRepo.refreshAll.mockResolvedValue([]);
  });

  it('keeps best-effort refresh compatible by logging repository failures', async () => {
    const error = new Error('projection failed');
    mockProjectionRepo.refreshByProductId.mockRejectedValueOnce(error);
    const waitUntil = vi.fn();
    const service = new ProductProjectionRefreshService({});

    await expect(service.refreshByProductId('prod-1', { waitUntil })).resolves.toBeUndefined();

    expect(waitUntil).toHaveBeenCalledTimes(1);
    expect(console.error).toHaveBeenCalledWith(
      '[ProductProjectionRefresh] Failed for product prod-1:',
      'projection failed'
    );
  });

  it('rejects strict product refresh failures so cache publication can be blocked', async () => {
    const error = new Error('projection failed');
    mockProjectionRepo.refreshByProductId.mockRejectedValueOnce(error);
    const waitUntil = vi.fn();
    const service = new ProductProjectionRefreshService({});

    await expect(
      service.refreshByProductId('prod-1', { waitUntil }, { strict: true })
    ).rejects.toThrow('projection failed');

    expect(waitUntil).not.toHaveBeenCalled();
  });
});
