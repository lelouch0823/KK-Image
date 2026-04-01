import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

const checkAuthMock = vi.fn()
const canMock = vi.fn()
const clearPermissionsMock = vi.fn()
const isAuthenticated = ref(true)

vi.mock('nprogress', () => ({
  default: {
    configure: vi.fn(),
    start: vi.fn(),
    done: vi.fn(),
  },
}))

vi.mock('@/composables/useI18n', () => ({
  useI18n: () => ({
    t: (key) => key,
  }),
}))

vi.mock('@/composables/useAuth', () => ({
  useAuth: () => ({
    checkAuth: checkAuthMock,
    isAuthenticated,
  }),
}))

vi.mock('@/composables/useAccessControl', () => ({
  useAccessControl: () => ({
    can: canMock,
    clearPermissions: clearPermissionsMock,
  }),
}))

describe('forbidden flow', () => {
  beforeEach(() => {
    vi.resetModules()
    checkAuthMock.mockReset().mockResolvedValue(true)
    canMock.mockReset()
    clearPermissionsMock.mockReset()
    isAuthenticated.value = true
  })

  it('navigates to unified forbidden page when route permission fails', async () => {
    canMock.mockResolvedValue(false)
    const { default: router } = await import('@/router/index.js')

    await router.push('/admin/files')
    await router.isReady()

    expect(router.currentRoute.value.name).toBe('Forbidden')
    expect(router.currentRoute.value.query.permission).toBe('files:read')
  })

  it('keeps original route when permission check passes', async () => {
    canMock.mockResolvedValue(true)
    const { default: router } = await import('@/router/index.js')

    await router.push('/admin/files')
    await router.isReady()

    expect(router.currentRoute.value.name).toBe('Files')
  })

  it('falls back to the first allowed admin route when dashboard is not permitted', async () => {
    canMock.mockImplementation(async (permission) => permission !== 'stats:read')
    const { default: router } = await import('@/router/index.js')

    await router.push('/admin/dashboard')
    await router.isReady()

    expect(router.currentRoute.value.name).toBe('Files')
  })
})
