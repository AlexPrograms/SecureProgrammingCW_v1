const BASE_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:8000';

export class ApiClientError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = 'ApiClientError';
    this.code = code;
    this.status = status;
  }
}

interface ErrorEnvelope {
  error?: {
    code?: string;
    message?: string;
  };
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
}

const stateChangingMethods = new Set(['POST', 'PUT', 'DELETE']);

const readCookie = (name: string): string | null => {
  const cookies = document.cookie ? document.cookie.split(';') : [];

  for (const item of cookies) {
    const [rawKey, ...rest] = item.trim().split('=');
    if (rawKey !== name) {
      continue;
    }

    return decodeURIComponent(rest.join('='));
  }

  return null;
};

const buildHeaders = (method: string, body: unknown, headers?: Record<string, string>): Headers => {
  const merged = new Headers(headers);

  if (!(body instanceof FormData) && !merged.has('Content-Type')) {
    merged.set('Content-Type', 'application/json');
  }

  if (!merged.has('Accept')) {
    merged.set('Accept', 'application/json');
  }

  if (stateChangingMethods.has(method.toUpperCase())) {
    const csrf = readCookie('csrf_token');
    if (csrf) {
      merged.set('X-CSRF-Token', csrf);
    }
  }

  return merged;
};

const safeError = (status: number, payload: unknown): ApiClientError => {
  const envelope = payload as ErrorEnvelope;
  const code = envelope?.error?.code ?? 'REQUEST_FAILED';
  const message = envelope?.error?.message ?? 'Request failed.';
  return new ApiClientError(code, message, status);
};

export const isApiClientError = (value: unknown): value is ApiClientError => value instanceof ApiClientError;

export async function apiRequest<T>(path: string, options?: RequestOptions): Promise<T> {
  const method = options?.method ?? 'GET';
  const body = options?.body;

  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    credentials: 'include',
    headers: buildHeaders(method, body, options?.headers),
    body: body instanceof FormData ? body : body !== undefined ? JSON.stringify(body) : undefined
  });

  const contentType = response.headers.get('content-type') ?? '';

  let payload: unknown = null;
  if (contentType.includes('application/json')) {
    payload = await response.json();
  } else if (response.status !== 204) {
    payload = await response.text();
  }

  if (!response.ok) {
    throw safeError(response.status, payload);
  }

  return payload as T;
}
