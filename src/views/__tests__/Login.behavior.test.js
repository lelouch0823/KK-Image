import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import Login from '../Login.vue';

const mocks = vi.hoisted(() => ({
  addToast: vi.fn(),
  routerPush: vi.fn(),
  currentRoute: { value: { query: {} } },
}));

vi.mock('@/composables/useToast', () => ({
  useToast: () => ({ addToast: mocks.addToast }),
}));

vi.mock('@/composables/useI18n', () => ({
  useI18n: () => ({
    t: (key) => {
      const map = {
        'auth.welcome': 'Welcome back',
        'auth.subtitle': 'Sign in to continue',
        'auth.username': 'Username',
        'auth.password': 'Password',
        'auth.usernamePlaceholder': 'Enter username',
        'auth.passwordPlaceholder': 'Enter password',
        'auth.loginButton': 'Sign in',
        'auth.loggingIn': 'Signing in',
        'auth.verifying': 'Verifying...',
        'auth.loginSuccess': 'Login success',
        'auth.preparingWorkspace': 'Preparing workspace',
        'auth.inputRequired': 'Username and password are required',
        'auth.loginFailed': 'Login failed',
        'common.invalidCredentials': 'Invalid credentials',
      };
      return map[key] || key;
    },
  }),
}));

vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: mocks.routerPush,
    currentRoute: mocks.currentRoute,
  }),
}));

describe('Login view behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mocks.currentRoute.value = { query: {} };
    document.documentElement.className = '';
    delete window.turnstile;
    delete window.onTurnstileSuccess;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    delete window.turnstile;
    delete window.onTurnstileSuccess;
  });

  function createWrapper() {
    return mount(Login, {
      global: {
        stubs: {
          transition: false,
          AppIcon: {
            props: ['name'],
            template: '<i :data-icon="name" />',
          },
          AppButton: {
            props: ['type', 'text', 'disabled', 'loading', 'variant', 'block', 'size'],
            emits: ['click'],
            template: `
              <button :type="type || 'button'" :disabled="disabled" @click="$emit('click')">
                {{ text }}<slot name="icon-left" /><slot />
              </button>
            `,
          },
          AppInput: {
            props: ['modelValue', 'label', 'type', 'required', 'autocomplete', 'placeholder'],
            emits: ['update:modelValue', 'keyup.enter'],
            template: `
              <label>
                <span>{{ label }}</span>
                <slot name="prepend" />
                <input
                  :data-label="label"
                  :type="type || 'text'"
                  :autocomplete="autocomplete"
                  :placeholder="placeholder"
                  :value="modelValue"
                  @input="$emit('update:modelValue', $event.target.value)"
                  @keyup.enter="$emit('keyup.enter')"
                />
                <slot name="append" />
              </label>
            `,
          },
        },
      },
    });
  }

  it('blocks submission when username or password is missing', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      json: async () => ({ success: true, data: { enabled: false } }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const wrapper = createWrapper();
    await flushPromises();

    await wrapper.find('form').trigger('submit.prevent');
    await flushPromises();

    expect(mocks.addToast).toHaveBeenCalledWith({
      message: 'Username and password are required',
      type: 'warning',
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('submits credentials and redirects to the requested page on success', async () => {
    mocks.currentRoute.value = { query: { redirect: '/orders' } };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        json: async () => ({ success: true, data: { enabled: false } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });
    vi.stubGlobal('fetch', fetchMock);

    const wrapper = createWrapper();
    await flushPromises();

    const inputs = wrapper.findAll('input');
    await inputs[0].setValue('admin');
    await inputs[1].setValue('secret');
    await wrapper.find('form').trigger('submit.prevent');
    await flushPromises();

    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/v1/auth/login',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      })
    );
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({
      username: 'admin',
      password: 'secret',
      turnstileToken: '',
    });
    expect(mocks.addToast).toHaveBeenCalledWith({ message: 'Login success', type: 'success' });

    await vi.advanceTimersByTimeAsync(800);

    expect(mocks.routerPush).toHaveBeenCalledWith('/orders');
  });

  it('resets turnstile and shows an error toast when login fails', async () => {
    const turnstile = {
      render: vi.fn(),
      reset: vi.fn(),
    };
    window.turnstile = turnstile;

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        json: async () => ({ success: true, data: { enabled: true, siteKey: 'site-key-1' } }),
      })
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({ success: false, message: 'Bad credentials' }),
      });
    vi.stubGlobal('fetch', fetchMock);

    const wrapper = createWrapper();
    await flushPromises();

    window.onTurnstileSuccess('token-123');

    const inputs = wrapper.findAll('input');
    await inputs[0].setValue('admin');
    await inputs[1].setValue('wrong');
    await wrapper.find('form').trigger('submit.prevent');
    await flushPromises();

    expect(turnstile.reset).toHaveBeenCalled();
    expect(mocks.addToast).toHaveBeenCalledWith({ message: 'Bad credentials', type: 'error' });
    expect(mocks.routerPush).not.toHaveBeenCalled();
  });

  it('loads turnstile config, detects dark theme, and renders the widget', async () => {
    document.documentElement.classList.add('dark');
    const turnstile = {
      render: vi.fn(),
      reset: vi.fn(),
    };
    window.turnstile = turnstile;

    const fetchMock = vi.fn().mockResolvedValue({
      json: async () => ({ success: true, data: { enabled: true, siteKey: 'site-key-2' } }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const wrapper = createWrapper();
    await flushPromises();
    await vi.advanceTimersByTimeAsync(100);
    await flushPromises();

    expect(wrapper.find('.cf-turnstile').exists()).toBe(true);
    expect(wrapper.find('.cf-turnstile').attributes('data-theme')).toBe('dark');
    expect(turnstile.render).toHaveBeenCalledWith(
      expect.any(HTMLDivElement),
      expect.objectContaining({
        sitekey: 'site-key-2',
        callback: expect.any(Function),
      })
    );
  });
});
