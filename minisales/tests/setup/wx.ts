type MockWx = {
  getStorageSync?: (key: string) => string;
  setStorageSync?: (key: string, value: unknown) => void;
  removeStorageSync?: (key: string) => void;
  request?: (options: Record<string, unknown>) => void;
};

const defaultWx: Required<MockWx> = {
  getStorageSync: () => '',
  setStorageSync: () => {},
  removeStorageSync: () => {},
  request: () => {
    throw new Error('wx.request mock is not installed');
  },
};

export function installMockWx(overrides: MockWx = {}): void {
  (globalThis as { wx?: Required<MockWx> }).wx = {
    ...defaultWx,
    ...overrides,
  };
}

installMockWx();
