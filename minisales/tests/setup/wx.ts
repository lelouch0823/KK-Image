type MockWx = {
  getStorageSync?: (key: string) => string;
  setStorageSync?: (key: string, value: unknown) => void;
  removeStorageSync?: (key: string) => void;
  request?: (options: Record<string, unknown>) => void;
  showToast?: (options: Record<string, unknown>) => void;
  redirectTo?: (options: Record<string, unknown>) => void;
  showLoading?: (options: Record<string, unknown>) => void;
  hideLoading?: () => void;
};

const defaultWx: Required<MockWx> = {
  getStorageSync: () => '',
  setStorageSync: () => {},
  removeStorageSync: () => {},
  request: () => {
    throw new Error('wx.request mock is not installed');
  },
  showToast: () => {},
  redirectTo: () => {},
  showLoading: () => {},
  hideLoading: () => {},
};

export function installMockWx(overrides: MockWx = {}): void {
  (globalThis as { wx?: Required<MockWx> }).wx = {
    ...defaultWx,
    ...overrides,
  };
}

installMockWx();
