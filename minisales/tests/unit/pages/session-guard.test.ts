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

describe('protected page session guards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('redirects detail page to login when access token is missing', async () => {
    const handleMissingAccessToken = vi.fn();
    const get = vi.fn();

    vi.doMock('../../../miniprogram/services/auth/session', () => ({
      handleMissingAccessToken,
    }));
    vi.doMock('../../../miniprogram/utils/api', () => ({
      get,
      post: vi.fn(),
      getAccessToken: vi.fn(() => null),
      getFileUrl: vi.fn((value: string) => value),
    }));

    const page = await importWithPageCapture('../../../miniprogram/pages/detail/detail');

    await page.loadOrder.call(page, 'order-1');

    expect(handleMissingAccessToken).toHaveBeenCalledTimes(1);
    expect(get).not.toHaveBeenCalled();
  });

  it('redirects form uploads to login when access token is missing', async () => {
    const handleMissingAccessToken = vi.fn();
    const uploadFile = vi.fn();

    vi.doMock('../../../miniprogram/services/auth/session', () => ({
      handleMissingAccessToken,
    }));
    vi.doMock('../../../miniprogram/utils/api', () => ({
      post: vi.fn(),
      uploadFile,
      getAccessToken: vi.fn(() => null),
      getFileUrl: vi.fn((value: string) => value),
    }));

    const page = await importWithPageCapture('../../../miniprogram/pages/form/form');

    await page.processUpload.call(page, [{ url: '/tmp/a.png', name: 'A' }]);

    expect(handleMissingAccessToken).toHaveBeenCalledTimes(1);
    expect(uploadFile).not.toHaveBeenCalled();
  });

  it('redirects form submission to login when access token is missing', async () => {
    const handleMissingAccessToken = vi.fn();
    const post = vi.fn();
    const toast = { show: vi.fn() };

    vi.doMock('../../../miniprogram/services/auth/session', () => ({
      handleMissingAccessToken,
    }));
    vi.doMock('../../../miniprogram/utils/api', () => ({
      post,
      uploadFile: vi.fn(),
      getAccessToken: vi.fn(() => null),
      getFileUrl: vi.fn((value: string) => value),
    }));

    const page = await importWithPageCapture('../../../miniprogram/pages/form/form');
    page.selectComponent = vi.fn(() => toast);
    page.data.form = {
      name: '客户A',
      brand: '品牌A',
      series: '',
      size: '',
      color: '',
      material: '',
      remark: '',
      deadline: '',
    };
    page.data.fileList = [];

    await page.handleSubmit.call(page);

    expect(handleMissingAccessToken).toHaveBeenCalledTimes(1);
    expect(post).not.toHaveBeenCalled();
    expect(toast.show).not.toHaveBeenCalledWith(
      expect.objectContaining({ content: '请先登录' })
    );
  });
});
