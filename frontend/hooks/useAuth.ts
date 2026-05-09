'use client';
import { useState, useEffect, useCallback } from 'react';

export interface AuthUser { id: string; email: string; firstName: string; lastName: string; role: string; permissions: string[]; tenantId: string; tenantName: string; tenantSlug: string; }

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const loadUser = useCallback(() => {
    try {
      const raw = typeof window !== 'undefined' ? localStorage.getItem('user') : null;
      setUser(raw ? JSON.parse(raw) : null);
    } catch { setUser(null); }
    setLoading(false);
  }, []);

  useEffect(() => { loadUser(); }, [loadUser]);

  const logout = useCallback(async () => {
    const rt = localStorage.getItem('refresh_token') || '';
    try { const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1'; const token = localStorage.getItem('access_token'); await fetch(`${BASE}/auth/logout`, { method:'POST', headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})}, body: JSON.stringify({ refreshToken: rt }) }); } catch {}
    localStorage.clear();
    setUser(null);
    window.location.href = '/login';
  }, []);

  const hasPermission = useCallback((perm: string) => {
    if (!user) return false;
    return user.permissions?.includes('*') || user.permissions?.includes(perm);
  }, [user]);

  const refreshProfile = useCallback(async () => {
    try {
      const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
      const token = localStorage.getItem('access_token');
      if (!token) return;
      const r = await fetch(`${BASE}/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
      if (r.ok) { const d = await r.json(); localStorage.setItem('user', JSON.stringify(d)); setUser(d); }
    } catch {}
  }, []);

  return { user, loading, logout, hasPermission, refreshProfile };
}
