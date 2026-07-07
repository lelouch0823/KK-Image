export const NEW_TAB_FEATURES = 'noopener,noreferrer';

const detachOpener = (openedWindow: Window | null): Window | null => {
  if (openedWindow) {
    openedWindow.opener = null;
  }
  return openedWindow;
};

export const openInNewTab = (url: string): Window | null => {
  return detachOpener(window.open(url, '_blank', NEW_TAB_FEATURES));
};

export const openWritableNewTab = (): Window | null => {
  return detachOpener(window.open('', '_blank', 'popup'));
};
