const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

export class ApiError extends Error {
  constructor(public status: number, message: string, public body?: any) { super(message); }
}

async function req<T>(method: string, path: string, body?: any): Promise<T> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401) {
    const ok = await tryRefresh();
    if (ok) return req(method, path, body);
    if (typeof window !== 'undefined') { localStorage.clear(); window.location.href = '/login'; }
    throw new ApiError(401, 'Session expired');
  }
  if (res.status === 204) return null as T;
  let data: any;
  try { data = await res.json(); } catch { data = {}; }
  if (!res.ok) throw new ApiError(res.status, data?.message || data?.error || `HTTP ${res.status}`, data);
  return data as T;
}

async function tryRefresh(): Promise<boolean> {
  const rt = typeof window !== 'undefined' ? localStorage.getItem('refresh_token') : null;
  if (!rt) return false;
  try {
    const r = await fetch(`${BASE}/auth/refresh`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ refreshToken: rt }) });
    if (!r.ok) return false;
    const d = await r.json();
    localStorage.setItem('access_token', d.accessToken);
    localStorage.setItem('refresh_token', d.refreshToken);
    return true;
  } catch { return false; }
}

async function upload(path: string, formData: FormData, onProgress?: (p: number) => void): Promise<any> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : '';
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${BASE}${path}`);
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.upload.onprogress = e => { if (e.lengthComputable && onProgress) onProgress(Math.round(e.loaded/e.total*100)); };
    xhr.onload  = () => { try { resolve(JSON.parse(xhr.responseText)); } catch { resolve({}); } };
    xhr.onerror = () => reject(new Error('Upload failed'));
    xhr.send(formData);
  });
}

export const http = {
  get:    <T=any>(path: string)              => req<T>('GET',    path),
  post:   <T=any>(path: string, body?: any)  => req<T>('POST',   path, body),
  patch:  <T=any>(path: string, body?: any)  => req<T>('PATCH',  path, body),
  put:    <T=any>(path: string, body?: any)  => req<T>('PUT',    path, body),
  delete: <T=any>(path: string)              => req<T>('DELETE', path),
};

const qs = (p: Record<string,any>) => { const s = new URLSearchParams(Object.fromEntries(Object.entries(p).filter(([,v]) => v!==''&&v!=null))).toString(); return s ? '?'+s : ''; };

export const authApi = {
  login:     (email: string, password: string) => http.post('/auth/login', { email, password }),
  refresh:   (refreshToken: string)            => http.post('/auth/refresh', { refreshToken }),
  logout:    (refreshToken: string)            => http.post('/auth/logout', { refreshToken }),
  me:        ()                                => http.get('/auth/me'),
  changePassword: (currentPassword: string, newPassword: string) => http.patch('/auth/password', { currentPassword, newPassword }),
};

export const projectsApi = {
  list:   (params: any = {}) => http.get<any>(`/projects${qs(params)}`),
  getOne: (id: string)       => http.get<any>(`/projects/${id}`),
  create: (data: any)        => http.post<any>('/projects', data),
  update: (id: string, d: any) => http.patch<any>(`/projects/${id}`, d),
  delete: (id: string)       => http.delete(`/projects/${id}`),
  clone:  (id: string)       => http.post<any>(`/projects/${id}/clone`),
  stats:  ()                 => http.get<any>('/projects/stats'),
};

export const filesApi = {
  list:        (projectId: string)            => http.get<any[]>(`/files?projectId=${projectId}`),
  delete:      (id: string)                   => http.delete(`/files/${id}`),
  getDownload: (id: string)                   => http.get<any>(`/files/${id}/download`),
  upload: async (projectId: string, files: File[], onProgress?: (p: number)=>void) => {
    const fd = new FormData(); files.forEach(f => fd.append('files', f));
    return upload(`/files/upload?projectId=${projectId}`, fd, onProgress);
  },
};

export const estimationsApi = {
  list:       (projectId: string) => http.get<any[]>(`/estimations?projectId=${projectId}`),
  listAll:    (params: any = {})  => http.get<any>(`/estimations/all${qs(params)}`),
  getOne:     (id: string)        => http.get<any>(`/estimations/${id}`),
  create:     (data: any)         => http.post<any>('/estimations', data),
  update:     (id: string, d: any)=> http.patch<any>(`/estimations/${id}`, d),
  upsertItem: (estimationId: string, item: any) => http.post<any>(`/estimations/${estimationId}/items`, item),
  deleteItem: (estimationId: string, itemId: string) => http.delete(`/estimations/${estimationId}/items/${itemId}`),
  bulkUpdate: (estimationId: string, items: any[]) => http.post<any>(`/estimations/${estimationId}/items/bulk`, { items }),
  version:    (id: string)        => http.post<any>(`/estimations/${id}/version`),
  lock:       (id: string)        => http.post<any>(`/estimations/${id}/lock`),
  unlock:     (id: string)        => http.post<any>(`/estimations/${id}/unlock`),
  analyze:    (projectId: string) => http.post<any>(`/estimations/project/${projectId}/analyze`),
  status:     (projectId: string) => http.get<any>(`/estimations/project/${projectId}/status`),
};

export const quotationsApi = {
  list:    (projectId: string) => http.get<any[]>(`/quotations?projectId=${projectId}`),
  listAll: ()                  => http.get<any[]>('/quotations/all'),
  getOne:  (id: string)        => http.get<any>(`/quotations/${id}`),
  create:  (data: any)         => http.post<any>('/quotations', data),
  update:  (id: string, d: any)=> http.patch<any>(`/quotations/${id}`, d),
  send:    (id: string, d: any)=> http.post(`/quotations/${id}/send`, d),
  pdf: async (id: string): Promise<Blob> => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : '';
    const r = await fetch(`${BASE}/quotations/${id}/pdf`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
    if (!r.ok) throw new Error('PDF failed');
    return r.blob();
  },
};

export const analyticsApi = {
  dashboard:  () => http.get<any>('/analytics/dashboard'),
  aiAccuracy: () => http.get<any>('/analytics/ai-accuracy'),
  project:    (id: string) => http.get<any>(`/analytics/projects/${id}`),
};

export const pricingApi = {
  list:       (params: any = {}) => http.get<any[]>(`/pricing${qs(params)}`),
  create:     (data: any)        => http.post<any>('/pricing', data),
  update:     (id: string, d: any)=> http.patch<any>(`/pricing/${id}`, d),
  delete:     (id: string)       => http.delete(`/pricing/${id}`),
  categories: ()                 => http.get<string[]>('/pricing/categories'),
  bulkImport: (items: any[])     => http.post<any>('/pricing/bulk', { items }),
};

export const usersApi = {
  list:         ()              => http.get<any[]>('/users'),
  stats:        ()              => http.get<any>('/users/stats'),
  roles:        ()              => http.get<any[]>('/users/roles'),
  invite:       (email: string, roleId: string) => http.post<any>('/users/invite', { email, roleId }),
  update:       (id: string, d: any) => http.patch<any>(`/users/${id}`, d),
  deactivate:   (id: string)    => http.delete(`/users/${id}`),
  reactivate:   (id: string)    => http.post<any>(`/users/${id}/reactivate`),
  acceptInvite: (token: string, password: string, firstName: string, lastName: string) =>
    http.post<any>('/users/accept-invite', { token, password, firstName, lastName }),
};

export const clientsApi = {
  list:   (params: any = {}) => http.get<any>(`/clients${qs(params)}`),
  create: (data: any)        => http.post<any>('/clients', data),
  update: (id: string, d: any)=> http.patch<any>(`/clients/${id}`, d),
};

export const approvalsApi = {
  submit:  (estimationId: string, approverIds: string[]) => http.post<any>('/approvals/submit', { estimationId, approverIds }),
  decide:  (wfId: string, decision: string, comments?: string) => http.post<any>(`/approvals/${wfId}/decide`, { decision, comments }),
  byEst:   (estimationId: string) => http.get<any>(`/approvals/estimation/${estimationId}`),
  pending: ()                     => http.get<any[]>('/approvals/my/pending'),
};

export const searchApi = { global: (q: string) => http.get<any>(`/search?q=${encodeURIComponent(q)}`) };

export const tenantsApi = {
  getOne: (id: string)      => http.get<any>(`/tenants/${id}`),
  update: (id: string, d: any) => http.patch<any>(`/tenants/${id}`, d),
  usage:  (id: string)      => http.get<any>(`/tenants/${id}/usage`),
};
