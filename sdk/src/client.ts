// 自动生成的基础 HTTP 客户端 - 请勿手动修改
// 由 scripts/generate-sdk.js 生成

/** 客户端配置 */
export interface ClientConfig {
  /** API 基础 URL (例如: https://api.example.com/api) */
  baseUrl: string;
  /** 认证 Token (JWT 或 API Key) */
  token?: string;
  /** API Key (用于 X-API-Key 头) */
  apiKey?: string;
  /** 自定义请求头 */
  headers?: Record<string, string>;
  /** 请求超时 (毫秒, 默认 30000) */
  timeout?: number;
}

/** API 错误 */
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public response?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** 请求选项 */
interface RequestOptions {
  body?: unknown;
  query?: Record<string, unknown>;
  headers?: Record<string, string>;
}

/** API 客户端接口 */
export interface ApiClient {
  request(method: string, path: string, options?: RequestOptions): Promise<unknown>;
}

/** HTTP 客户端实现 */
export class HttpClient implements ApiClient {
  private baseUrl: string;
  private defaultHeaders: Record<string, string>;
  private timeout: number;

  constructor(config: ClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/+$/, '');
    this.timeout = config.timeout || 30000;

    this.defaultHeaders = {
      'Content-Type': 'application/json',
      ...config.headers,
    };

    if (config.token) {
      this.defaultHeaders['Authorization'] = `Bearer ${config.token}`;
    }
    if (config.apiKey) {
      this.defaultHeaders['X-API-Key'] = config.apiKey;
    }
  }

  async request(method: string, path: string, options: RequestOptions = {}): Promise<unknown> {
    const url = new URL(`${this.baseUrl}${path}`);

    if (options.query) {
      for (const [key, value] of Object.entries(options.query)) {
        if (value !== undefined && value !== null) {
          url.searchParams.set(key, String(value));
        }
      }
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url.toString(), {
        method: method.toUpperCase(),
        headers: { ...this.defaultHeaders, ...options.headers },
        body: options.body ? JSON.stringify(options.body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        let errorBody;
        try {
          errorBody = await response.json();
        } catch {
          errorBody = await response.text();
        }
        throw new ApiError(`API 请求失败: ${response.status} ${response.statusText}`, response.status, errorBody);
      }

      const contentType = response.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        return response.json();
      }
      return response.text();
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof ApiError) throw error;
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new ApiError(`请求超时 (${this.timeout}ms)`, 408);
      }
      throw error;
    }
  }

  /** 更新认证 Token */
  setToken(token: string): void {
    this.defaultHeaders['Authorization'] = `Bearer ${token}`;
  }

  /** 更新 API Key */
  setApiKey(apiKey: string): void {
    this.defaultHeaders['X-API-Key'] = apiKey;
  }
}
