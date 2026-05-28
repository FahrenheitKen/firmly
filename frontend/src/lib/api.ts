const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:8000';
const API_URL = `${API_BASE_URL}/api`;

type FetchOptions = RequestInit & { token?: string };

// Slow-changing list endpoints that get re-fetched on every modal open across
// the app. Cached in-memory with a short TTL; writes against any of these
// paths invalidate matching cached reads (see invalidateMatching).
const CACHEABLE_PREFIXES = ['/clients', '/users', '/opposing-counsels', '/business', '/locations', '/roles', '/permissions', '/holidays'];
const CACHE_TTL_MS = 60_000;
const getCache = new Map<string, { promise: Promise<unknown>; expiresAt: number }>();

function cacheablePrefix(endpoint: string): string | null {
  const path = endpoint.split('?')[0];
  for (const p of CACHEABLE_PREFIXES) {
    if (path === p || path.startsWith(p + '/')) return p;
  }
  return null;
}

function invalidateMatching(endpoint: string): void {
  const prefix = cacheablePrefix(endpoint);
  if (!prefix) return;
  for (const key of getCache.keys()) {
    if (key === prefix || key.startsWith(prefix + '?') || key.startsWith(prefix + '/')) {
      getCache.delete(key);
    }
  }
}

// Drop all cached reads — called on logout / user switch so we never serve
// the previous user's data to a new session in the same tab.
export function clearApiCache(): void {
  getCache.clear();
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

function xhrUpload<T = unknown>(endpoint: string, data: FormData, token?: string, onProgress?: (loaded: number, total: number) => void): Promise<T> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_URL}${endpoint}`);
    xhr.setRequestHeader('Accept', 'application/json');
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    if (onProgress) {
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) onProgress(e.loaded, e.total);
      });
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try { resolve(JSON.parse(xhr.responseText)); } catch { resolve({} as T); }
      } else {
        try { reject({ status: xhr.status, ...JSON.parse(xhr.responseText) }); } catch { reject({ status: xhr.status, message: xhr.statusText }); }
      }
    };
    xhr.onerror = () => reject({ message: 'Network error' });
    xhr.send(data);
  });
}

export const api = {
  get: <T = unknown>(endpoint: string, token?: string): Promise<T> => {
    if (cacheablePrefix(endpoint)) {
      const hit = getCache.get(endpoint);
      if (hit && hit.expiresAt > Date.now()) return hit.promise as Promise<T>;
      const promise = apiFetch<T>(endpoint, { method: 'GET', token }).catch((e) => {
        // Don't let a transient failure poison the cache.
        getCache.delete(endpoint);
        throw e;
      });
      getCache.set(endpoint, { promise, expiresAt: Date.now() + CACHE_TTL_MS });
      return promise;
    }
    return apiFetch<T>(endpoint, { method: 'GET', token });
  },

  post: async <T = unknown>(endpoint: string, data?: unknown, token?: string): Promise<T> => {
    const res = await apiFetch<T>(endpoint, {
      method: 'POST',
      body: data instanceof FormData ? data : JSON.stringify(data),
      token,
    });
    invalidateMatching(endpoint);
    return res;
  },

  put: async <T = unknown>(endpoint: string, data?: unknown, token?: string): Promise<T> => {
    const res = await apiFetch<T>(endpoint, {
      method: 'PUT',
      body: data instanceof FormData ? data : JSON.stringify(data),
      token,
    });
    invalidateMatching(endpoint);
    return res;
  },

  delete: async <T = unknown>(endpoint: string, token?: string): Promise<T> => {
    const res = await apiFetch<T>(endpoint, { method: 'DELETE', token });
    invalidateMatching(endpoint);
    return res;
  },

  upload: async <T = unknown>(endpoint: string, data: FormData, token?: string, onProgress?: (loaded: number, total: number) => void): Promise<T> => {
    const res = await xhrUpload<T>(endpoint, data, token, onProgress);
    invalidateMatching(endpoint);
    return res;
  },
};
