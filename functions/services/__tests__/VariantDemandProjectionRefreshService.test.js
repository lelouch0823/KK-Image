import { describe, expect, it, vi } from 'vitest';
import { VariantDemandProjectionRefreshService } from '../VariantDemandProjectionRefreshService.js';

describe('VariantDemandProjectionRefreshService', () => {
  it('deduplicates variant ids before delegating to the projection repository', async () => {
    const variantDemandProjectionRepo = {
      refreshByVariantIds: vi.fn(async () => {}),
    };
    const service = new VariantDemandProjectionRefreshService(null, {
      variantDemandProjectionRepo,
    });

    const refreshedIds = await service.refreshByVariantIds(['var-2', 'var-1', 'var-2', '']);

    expect(refreshedIds).toEqual(['var-2', 'var-1']);
    expect(variantDemandProjectionRepo.refreshByVariantIds).toHaveBeenCalledWith([
      'var-2',
      'var-1',
    ]);
  });

  it('skips repository refresh when there are no effective variant ids', async () => {
    const variantDemandProjectionRepo = {
      refreshByVariantIds: vi.fn(async () => {}),
    };
    const service = new VariantDemandProjectionRefreshService(null, {
      variantDemandProjectionRepo,
    });

    const refreshedIds = await service.refreshByVariantIds([null, '', undefined]);

    expect(refreshedIds).toEqual([]);
    expect(variantDemandProjectionRepo.refreshByVariantIds).not.toHaveBeenCalled();
  });
});
