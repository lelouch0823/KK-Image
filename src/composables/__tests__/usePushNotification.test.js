import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  t: vi.fn((key) => key),
}));

vi.mock('../useI18n', () => ({
  useI18n: () => ({
    t: mocks.t,
  }),
}));

import { usePushNotification } from '../usePushNotification';

describe('usePushNotification', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mocks.t.mockImplementation((key) => key);
    window.focus = vi.fn();
  });

  it('reports unsupported notifications and refuses permission requests', async () => {
    const originalNotification = globalThis.Notification;
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    Reflect.deleteProperty(globalThis, 'Notification');

    const notification = usePushNotification();

    expect(notification.isSupported.value).toBe(false);
    expect(notification.permission.value).toBe('denied');
    await expect(notification.requestPermission()).resolves.toBe(false);
    expect(notification.showNotification('hello')).toBeNull();
    expect(warnSpy).toHaveBeenCalledWith('Notifications not supported');

    globalThis.Notification = originalNotification;
  });

  it('requests notification permission and handles granted, denied, and errors', async () => {
    class GrantedNotification {}
    GrantedNotification.permission = 'default';
    GrantedNotification.requestPermission = vi.fn().mockResolvedValue('granted');
    globalThis.Notification = GrantedNotification;

    const notification = usePushNotification();
    await expect(notification.requestPermission()).resolves.toBe(true);
    expect(notification.permission.value).toBe('granted');

    await expect(notification.requestPermission()).resolves.toBe(true);
    expect(GrantedNotification.requestPermission).toHaveBeenCalledTimes(1);

    class DeniedNotification {}
    DeniedNotification.permission = 'default';
    DeniedNotification.requestPermission = vi.fn().mockResolvedValue('denied');
    globalThis.Notification = DeniedNotification;

    const denied = usePushNotification();
    await expect(denied.requestPermission()).resolves.toBe(false);

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    class ErrorNotification {}
    ErrorNotification.permission = 'default';
    ErrorNotification.requestPermission = vi.fn().mockRejectedValue(new Error('blocked'));
    globalThis.Notification = ErrorNotification;

    const failed = usePushNotification();
    await expect(failed.requestPermission()).resolves.toBe(false);
    expect(warnSpy).toHaveBeenCalledWith('Notification permission request failed:', expect.any(Error));
  });

  it('shows notifications, wires click callbacks, and closes after click', () => {
    const created = [];
    class MockNotification {
      static permission = 'granted';
      static requestPermission = vi.fn();

      constructor(title, options) {
        this.title = title;
        this.options = options;
        this.close = vi.fn();
        this.onclick = null;
        created.push(this);
      }
    }
    globalThis.Notification = MockNotification;

    const notification = usePushNotification();
    const onClick = vi.fn();
    const instance = notification.showNotification('New message', {
      body: 'hello',
      tag: 'msg-1',
      onClick,
    });

    expect(instance.title).toBe('New message');
    expect(instance.options).toEqual({
      icon: '/favicon.ico',
      body: 'hello',
      tag: 'msg-1',
    });

    const event = { preventDefault: vi.fn() };
    instance.onclick(event);

    expect(event.preventDefault).toHaveBeenCalled();
    expect(window.focus).toHaveBeenCalled();
    expect(onClick).toHaveBeenCalledWith(event);
    expect(instance.close).toHaveBeenCalled();
    expect(created).toHaveLength(1);
  });

  it('rejects showNotification when permission is missing or constructor throws', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    class DeniedNotification {
      static permission = 'denied';
      static requestPermission = vi.fn();
    }
    globalThis.Notification = DeniedNotification;

    const denied = usePushNotification();
    expect(denied.showNotification('blocked')).toBeNull();
    expect(warnSpy).toHaveBeenCalledWith('Notification permission not granted');

    class ThrowingNotification {
      static permission = 'granted';
      static requestPermission = vi.fn();

      constructor() {
        throw new Error('constructor failed');
      }
    }
    globalThis.Notification = ThrowingNotification;

    const throwing = usePushNotification();
    expect(throwing.showNotification('boom')).toBeNull();
    expect(warnSpy).toHaveBeenCalledWith('Failed to show notification:', expect.any(Error));
  });

  it('formats order feedback notifications through i18n and delegated notification creation', () => {
    const created = [];
    class MockNotification {
      static permission = 'granted';
      static requestPermission = vi.fn();

      constructor(title, options) {
        this.title = title;
        this.options = options;
        created.push(this);
      }
    }
    globalThis.Notification = MockNotification;

    const notification = usePushNotification();
    const onClick = vi.fn();

    notification.showOrderFeedbackNotification({ id: 'order-1', orderNo: 'SO-001' }, onClick);

    expect(created).toHaveLength(1);
    expect(created[0].title).toBe('notification.newFeedback');
    expect(created[0].options).toEqual({
      icon: '/favicon.ico',
      body: 'order.orderNo: SO-001',
      tag: 'order-feedback-order-1',
    });
  });
});
