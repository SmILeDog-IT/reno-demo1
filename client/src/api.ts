const BASE = '/api';

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(BASE + path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    throw new Error(data?.message || `请求失败 (${res.status})`);
  }
  return data as T;
}

export function qs(params: Record<string, unknown>) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') search.set(k, String(v));
  });
  const s = search.toString();
  return s ? `?${s}` : '';
}

export const api = {
  get: <T>(path: string, params?: Record<string, unknown>) => request<T>(path + (params ? qs(params) : '')),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body: JSON.stringify(body ?? {}) }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PUT', body: JSON.stringify(body ?? {}) }),
  del: <T>(path: string, body?: unknown) => request<T>(path, { method: 'DELETE', body: JSON.stringify(body ?? {}) }),
};

export const fmt = (n: number | undefined | null, digits = 2) =>
  (Number(n) || 0).toLocaleString('zh-CN', { minimumFractionDigits: digits, maximumFractionDigits: digits });

export const fmtPlain = (n: number | undefined | null) => fmt(n, 2);
