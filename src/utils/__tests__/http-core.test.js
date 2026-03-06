import { describe, expect, it, vi } from 'vitest'
import { request } from '../http-core'

describe('http-core request', () => {
  it('throws normalized error for non-2xx response', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({ error: '权限不足: products:manage' }),
      statusText: 'Forbidden',
    })

    await expect(request('/api/manage/products')).rejects.toMatchObject({
      status: 403,
      message: '权限不足: products:manage',
    })
  })
})
