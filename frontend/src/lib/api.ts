const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:8000';
const API_URL = `${API_BASE_URL}/api`;

type FetchOptions = RequestInit & { token?: string };

let csrfToken: string | null = null;
async function ensureCsrf(): Promise<void> {
  if (!csrfToken) {
    await fetch(`${API_BASE_URL}/sanctum/csrf-cookie`, { credentials: 'include' });
    const cookies = document.cookie.split(';').map(c => c.trim());
    const xsrfCookie = cookies.find(c => c.startsWith('XSRF-TOKEN='));
    if (xsrfCookie) {
      csrfToken = decodeURIComponent(xsrfCookie.split('=')[1]);
    }
  }
}

async function apiFetch<T = unknown>(endpoint: string, options: FetchOptions = {}): Promise<T> {
  const { token, headers: customHeaders, ...rest } = options;

  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...((customHeaders as Record<string, string>) || {}),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  if (!(rest.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const isStateChanging = rest.method && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(rest.method.toUpperCase());
  if (isStateChanging) {
    await ensureCsrf();
    if (csrfToken) {
      headers['X-XSRF-TOKEN'] = csrfToken;
    }
  }

  const isUpload = rest.body instanceof FormData;
  const controller = new AbortController();
  // Uploads can legitimately take a while — only enforce a timeout on JSON requests.
  const timeoutId = isUpload
    ? null
    : setTimeout(() => controller.abort(new DOMException('Request timed out after 30s', 'TimeoutError')), 30000);

  try {
    const res = await fetch(`${API_URL}${endpoint}`, {
      ...rest,
      headers,
      signal: controller.signal,
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({ message: res.statusText }));
      throw { status: res.status, ...error };
    }

    if (res.status === 204) return {} as T;
    return res.json();
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

export const api = {
  get: <T = unknown>(endpoint: string, token?: string) =>
    apiFetch<T>(endpoint, { method: 'GET', token }),

  post: <T = unknown>(endpoint: string, data?: unknown, token?: string) =>
    apiFetch<T>(endpoint, {
      method: 'POST',
      body: data instanceof FormData ? data : JSON.stringify(data),
      token,
    }),

  put: <T = unknown>(endpoint: string, data?: unknown, token?: string) =>
    apiFetch<T>(endpoint, {
      method: 'PUT',
      body: data instanceof FormData ? data : JSON.stringify(data),
      token,
    }),

  delete: <T = unknown>(endpoint: string, token?: string) =>
    apiFetch<T>(endpoint, { method: 'DELETE', token }),
};
