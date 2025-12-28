type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

interface RequestOptions {
  method?: HttpMethod;
  body?: unknown;
  accessToken?: string | null;
  params?: Record<string, string | number | undefined>;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public data?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

function buildUrl(baseUrl: string, path: string, params?: Record<string, string | number | undefined>): string {
  const url = `${baseUrl}${path}`;
  if (!params) return url;

  const filtered = Object.entries(params).filter(([, v]) => v !== undefined);
  if (filtered.length === 0) return url;

  const query = filtered
    .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
    .join('&');
  return `${url}?${query}`;
}

function buildHeaders(accessToken?: string | null, hasBody?: boolean): Record<string, string> {
  const headers: Record<string, string> = {};
  if (hasBody) {
    headers['Content-Type'] = 'application/json';
  }
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }
  return headers;
}

async function parseErrorResponse(response: Response): Promise<string> {
  try {
    const data = await response.json();
    return data.error || data.message || `Request failed: ${response.status}`;
  } catch {
    return `Request failed: ${response.status}`;
  }
}

export function createApiClient(baseUrl: string) {
  async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const {method = 'GET', body, accessToken, params} = options;

    const url = buildUrl(baseUrl, path, params);
    const headers = buildHeaders(accessToken, body !== undefined);

    const response = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const message = await parseErrorResponse(response);
      throw new ApiError(message, response.status);
    }

    // Handle empty responses (204 No Content)
    const text = await response.text();
    if (!text) return undefined as T;

    return JSON.parse(text);
  }

  return {
    get<T>(path: string, options?: Omit<RequestOptions, 'method' | 'body'>) {
      return request<T>(path, {...options, method: 'GET'});
    },

    post<T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) {
      return request<T>(path, {...options, method: 'POST', body});
    },

    patch<T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) {
      return request<T>(path, {...options, method: 'PATCH', body});
    },

    put<T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) {
      return request<T>(path, {...options, method: 'PUT', body});
    },

    delete<T>(path: string, options?: Omit<RequestOptions, 'method' | 'body'>) {
      return request<T>(path, {...options, method: 'DELETE'});
    },
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
