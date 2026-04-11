import { beforeEach, describe, expect, it, vi } from 'vitest';

type PageDefinition = Record<string, any>;

let registeredPage: PageDefinition | null = null;

function mountPage(definition: PageDefinition): any {
  return {
    ...definition,
    data: {
      ...(definition.data || {}),
    },
    setData(update: Record<string, unknown>) {
      this.data = {
        ...this.data,
        ...update,
      };
    },
  };
}

async function importWithPageCapture(modulePath: string): Promise<any> {
  registeredPage = null;
  vi.resetModules();
  (globalThis as any).Page = vi.fn((definition: PageDefinition) => {
    registeredPage = definition;
  });

  await import(modulePath);

  if (!registeredPage) {
    throw new Error(`Page was not registered for ${modulePath}`);
  }

  return mountPage(registeredPage);
}

describe('spaces detail page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('falls back to the current swiper image when preview event omits a url', async () => {
    vi.doMock('../../../miniprogram/utils/api', () => ({
      getAccessToken: vi.fn(() => 'sales-token'),
    }));
    vi.doMock('../../../miniprogram/services/auth/session', () => ({
      handleMissingAccessToken: vi.fn(),
    }));
    vi.doMock('../../../miniprogram/services/sales/spaces', () => ({
      getSalesSpaceDetail: vi.fn(),
    }));

    const previewImage = vi.fn();
    (globalThis as any).wx.previewImage = previewImage;

    const page = await importWithPageCapture('../../../miniprogram/pages/spaces_detail/detail');
    page.data.space = {
      files: [
        { id: 'file-1', url: '/file/main.jpg', mimeType: 'image/jpeg' },
        { id: 'file-2', url: '/file/detail.jpg', mimeType: 'image/jpeg' },
      ],
    };
    page.data.currentIndex = 1;

    page.handlePreview.call(page, { detail: {} });

    expect(previewImage).toHaveBeenCalledWith({
      current: '/file/detail.jpg',
      urls: ['/file/main.jpg', '/file/detail.jpg'],
    });
  });
});
