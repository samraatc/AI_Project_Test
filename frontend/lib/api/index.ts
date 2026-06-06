// ============================================================
// EstimateOS API Client
// - Automatic JWT refresh on 401
// - Concurrent request lock during refresh
// - No redirect on background refetch 401s
// ============================================================
const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

export class ApiError extends Error {
  constructor(public status: number, message: string, public body?: any) {
    super(message);
    this.name = 'ApiError';
  }
}

// ── Refresh lock — prevents multiple concurrent refresh calls ──
let isRefreshing = false;
let refreshQueue: Array<(success: boolean) => void> = [];

function waitForRefresh(): Promise<boolean> {
  return new Promise((resolve) => refreshQueue.push(resolve));
}

function resolveRefreshQueue(success: boolean) {
  refreshQueue.forEach(fn => fn(success));
  refreshQueue = [];
}

async function tryRefresh(): Promise<boolean> {
  // If already refreshing, queue this request
  if (isRefreshing) return waitForRefresh();

  const rt = typeof window !== 'undefined' ? localStorage.getItem('refresh_token') : null;
  if (!rt) return false;

  isRefreshing = true;
  try {
    const r = await fetch(`${BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: rt }),
    });
    if (!r.ok) {
      resolveRefreshQueue(false);
      return false;
    }
    const d = await r.json();
    if (d.accessToken && d.refreshToken) {
      localStorage.setItem('access_token',  d.accessToken);
      localStorage.setItem('refresh_token', d.refreshToken);
      resolveRefreshQueue(true);
      return true;
    }
    resolveRefreshQueue(false);
    return false;
  } catch {
    resolveRefreshQueue(false);
    return false;
  } finally {
    isRefreshing = false;
  }
}

// ── Core request function ─────────────────────────────────────
async function req<T>(
  method: string,
  path: string,
  body?: any,
  isRetry = false,
): Promise<T> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  });

  if (res.status === 401 && !isRetry) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      // Retry once with new token
      return req<T>(method, path, body, true);
    }
    // Refresh failed — only redirect if this is a user-triggered request,
    // not a background refetch (to avoid redirect loops)
    if (typeof window !== 'undefined') {
      const isBackground = document.visibilityState === 'hidden' ||
                           document.hidden;
      if (!isBackground) {
        localStorage.clear();
        window.location.href = '/login';
      }
    }
    throw new ApiError(401, 'Session expired. Please log in again.');
  }

  if (res.status === 204) return null as T;

  let data: any;
  try { data = await res.json(); } catch { data = {}; }

  if (!res.ok) {
    throw new ApiError(
      res.status,
      data?.message || data?.error || `HTTP ${res.status}`,
      data,
    );
  }

  return data as T;
}

// ── File upload with progress ─────────────────────────────────
async function upload(
  path: string,
  formData: FormData,
  onProgress?: (pct: number) => void,
): Promise<any> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : '';
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${BASE}${path}`);
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.upload.onprogress = e => {
      if (e.lengthComputable && onProgress)
        onProgress(Math.round(e.loaded / e.total * 100));
    };
    xhr.onload  = () => { try { resolve(JSON.parse(xhr.responseText)); } catch { resolve({}); } };
    xhr.onerror = () => reject(new Error('Upload failed'));
    xhr.send(formData);
  });
}

// ── Query string builder ──────────────────────────────────────
const qs = (p: Record<string, any>) => {
  const s = new URLSearchParams(
    Object.fromEntries(Object.entries(p).filter(([, v]) => v !== '' && v != null))
  ).toString();
  return s ? '?' + s : '';
};

// ── HTTP verbs ────────────────────────────────────────────────
export const http = {
  get:    <T = any>(path: string)             => req<T>('GET',    path),
  post:   <T = any>(path: string, body?: any) => req<T>('POST',   path, body),
  patch:  <T = any>(path: string, body?: any) => req<T>('PATCH',  path, body),
  put:    <T = any>(path: string, body?: any) => req<T>('PUT',    path, body),
  delete: <T = any>(path: string)             => req<T>('DELETE', path),
};

// ── Auth ──────────────────────────────────────────────────────
export const authApi = {
  login:     (email: string, password: string) => req<any>('POST', '/auth/login', { email, password }),
  refresh:   (refreshToken: string)            => req<any>('POST', '/auth/refresh', { refreshToken }),
  logout:    (refreshToken: string)            => req<void>('POST', '/auth/logout', { refreshToken }),
  me:        ()                                => req<any>('GET',  '/auth/me'),
  changePassword: (currentPassword: string, newPassword: string) =>
    req<void>('PATCH', '/auth/password', { currentPassword, newPassword }),
};

// ── Projects ──────────────────────────────────────────────────
export const projectsApi = {
  list:   (params: any = {}) => req<any>('GET', `/projects${qs(params)}`),
  getOne: (id: string)       => req<any>('GET', `/projects/${id}`),
  create: (data: any)        => req<any>('POST', '/projects', data),
  update: (id: string, d: any) => req<any>('PATCH', `/projects/${id}`, d),
  delete: (id: string)       => req<void>('DELETE', `/projects/${id}`),
  clone:  (id: string)       => req<any>('POST', `/projects/${id}/clone`),
  stats:  ()                 => req<any>('GET', '/projects/stats'),
};

// ── Files ─────────────────────────────────────────────────────
export const filesApi = {
  list:        (projectId: string)  => req<any[]>('GET', `/files?projectId=${projectId}`),
  delete:      (id: string)         => req<void>('DELETE', `/files/${id}`),
  getDownload: (id: string)         => req<any>('GET', `/files/${id}/download`),
  upload: (projectId: string, files: File[], onProgress?: (p: number) => void) => {
    const fd = new FormData();
    files.forEach(f => fd.append('files', f));
    return upload(`/files/upload?projectId=${projectId}`, fd, onProgress);
  },
};

// ── Estimations ───────────────────────────────────────────────
export const estimationsApi = {
  list:       (projectId: string) => req<any[]>('GET', `/estimations?projectId=${projectId}`),
  listAll:    (params: any = {})  => req<any>('GET', `/estimations/all${qs(params)}`),
  getOne:     (id: string)        => req<any>('GET', `/estimations/${id}`),
  create:     (data: any)         => req<any>('POST', '/estimations', data),
  update:     (id: string, d: any) => req<any>('PATCH', `/estimations/${id}`, d),
  upsertItem: (estimationId: string, item: any) =>
    req<any>('POST', `/estimations/${estimationId}/items`, item),
  deleteItem: (estimationId: string, itemId: string) =>
    req<void>('DELETE', `/estimations/${estimationId}/items/${itemId}`),
  bulkUpdate: (estimationId: string, items: any[]) =>
    req<any>('POST', `/estimations/${estimationId}/items/bulk`, { items }),
  version:    (id: string) => req<any>('POST', `/estimations/${id}/version`),
  lock:       (id: string) => req<any>('POST', `/estimations/${id}/lock`),
  unlock:     (id: string) => req<any>('POST', `/estimations/${id}/unlock`),
  analyze:    (projectId: string) =>
    req<any>('POST', `/estimations/project/${projectId}/analyze`),
  status:     (projectId: string) =>
    req<any>('GET', `/estimations/project/${projectId}/status`),
  chat:       (estimationId: string, message: string, history: any[]) =>
    req<any>('POST', `/estimations/${estimationId}/chat`, { message, history }),
  pdf: async (estimationId: string): Promise<Blob> => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : '';
    const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
    const r = await fetch(`${BASE_URL}/estimations/${estimationId}/pdf`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      cache: 'no-store',
    });
    if (!r.ok) throw new Error('Estimation PDF generation failed');
    return r.blob();
  },
};

// ── Quotations ────────────────────────────────────────────────
export const quotationsApi = {
  list:    (projectId: string) => req<any[]>('GET', `/quotations?projectId=${projectId}`),
  listAll: ()                  => req<any[]>('GET', '/quotations/all'),
  getOne:  (id: string)        => req<any>('GET', `/quotations/${id}`),
  create:  (data: any)         => req<any>('POST', '/quotations', data),
  update:  (id: string, d: any) => req<any>('PATCH', `/quotations/${id}`, d),
  delete:  (id: string)        => req<void>('DELETE', `/quotations/${id}`),
  send:    (id: string, d: any) => req<void>('POST', `/quotations/${id}/send`, d),
  pdf: async (id: string): Promise<Blob> => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : '';
    const r = await fetch(`${BASE}/quotations/${id}/pdf`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!r.ok) throw new Error('PDF generation failed');
    return r.blob();
  },
};

// ── Analytics ─────────────────────────────────────────────────
export const analyticsApi = {
  dashboard:  () => req<any>('GET', '/analytics/dashboard'),
  aiAccuracy: () => req<any>('GET', '/analytics/ai-accuracy'),
  project:    (id: string) => req<any>('GET', `/analytics/projects/${id}`),
};

// ── Pricing ───────────────────────────────────────────────────
export const pricingApi = {
  list:       (params: any = {}) => req<any[]>('GET', `/pricing${qs(params)}`),
  create:     (data: any)        => req<any>('POST', '/pricing', data),
  update:     (id: string, d: any) => req<any>('PATCH', `/pricing/${id}`, d),
  delete:     (id: string)       => req<void>('DELETE', `/pricing/${id}`),
  categories: ()                 => req<string[]>('GET', '/pricing/categories'),
  bulkImport: (items: any[])     => req<any>('POST', '/pricing/bulk', { items }),
};

// ── Users ─────────────────────────────────────────────────────
export const usersApi = {
  list:         () => req<any[]>('GET', '/users'),
  stats:        () => req<any>('GET', '/users/stats'),
  roles:        () => req<any[]>('GET', '/users/roles'),
  invite:       (email: string, roleId: string) =>
    req<any>('POST', '/users/invite', { email, roleId }),
  update:       (id: string, d: any) => req<any>('PATCH', `/users/${id}`, d),
  deactivate:   (id: string)         => req<void>('DELETE', `/users/${id}`),
  reactivate:   (id: string)         => req<any>('POST', `/users/${id}/reactivate`),
  acceptInvite: (token: string, password: string, firstName: string, lastName: string) =>
    req<any>('POST', '/users/accept-invite', { token, password, firstName, lastName }),
};

// ── Clients ───────────────────────────────────────────────────
export const clientsApi = {
  list:   (params: any = {}) => req<any>('GET', `/clients${qs(params)}`),
  create: (data: any)        => req<any>('POST', '/clients', data),
  update: (id: string, d: any) => req<any>('PATCH', `/clients/${id}`, d),
};

// ── Approvals ─────────────────────────────────────────────────
export const approvalsApi = {
  submit:  (estimationId: string, approverIds: string[]) =>
    req<any>('POST', '/approvals/submit', { estimationId, approverIds }),
  decide:  (wfId: string, decision: string, comments?: string) =>
    req<any>('POST', `/approvals/${wfId}/decide`, { decision, comments }),
  byEst:   (estimationId: string) => req<any>('GET', `/approvals/estimation/${estimationId}`),
  pending: ()                     => req<any[]>('GET', '/approvals/my/pending'),
};

// ── Search ────────────────────────────────────────────────────
export const searchApi = {
  global: (q: string) => req<any>('GET', `/search?q=${encodeURIComponent(q)}`),
};

// ── Tenants ───────────────────────────────────────────────────
export const tenantsApi = {
  getOne: (id: string)       => req<any>('GET', `/tenants/${id}`),
  update: (id: string, d: any) => req<any>('PATCH', `/tenants/${id}`, d),
  usage:  (id: string)       => req<any>('GET', `/tenants/${id}/usage`),
};
