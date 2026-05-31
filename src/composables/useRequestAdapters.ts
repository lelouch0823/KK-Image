import { request } from '@/utils/http-core'

interface RequestOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: string | FormData | ReadableStream;
  credentials?: RequestCredentials;
  signal?: AbortSignal;
  token?: string;
  [key: string]: unknown;
}

export function useRequestAdapters() {
  const requestAuth = (url: string, options: RequestOptions = {}) =>
    request(url, {
      ...options,
      credentials: 'include',
    })

  const requestPublic = (url: string, options: RequestOptions = {}) => request(url, options)

  const requestSales = (url: string, options: RequestOptions = {}) => {
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
