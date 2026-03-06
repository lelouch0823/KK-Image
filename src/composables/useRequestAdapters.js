import { request } from '@/utils/http-core'

export function useRequestAdapters() {
  const requestAuth = (url, options = {}) =>
    request(url, {
      ...options,
      credentials: 'include',
    })

  const requestPublic = (url, options = {}) => request(url, options)

  const requestSales = (url, options = {}) => {
    const { token = '', headers = {}, ...rest } = options

    return request(url, {
      ...rest,
      headers: {
        ...headers,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    })
  }

  return {
    requestAuth,
    requestPublic,
    requestSales,
  }
}
