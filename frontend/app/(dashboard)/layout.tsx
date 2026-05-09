'use client';
import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { LayoutDashboard, FolderOpen, FileText, Quote, BarChart2, Tag, Users, Settings, Zap, LogOut, ChevronRight, Loader2 } from 'lucide-react';

const NAV = [
  { href: '/dashboard',   label: 'Dashboard',   icon: LayoutDashboard },
  { href: '/projects',    label: 'Projects',     icon: FolderOpen },
  { href: '/estimations', label: 'Estimations',  icon: FileText },
  { href: '/quotations',  label: 'Quotations',   icon: Quote },
  { href: '/analytics',   label: 'Analytics',    icon: BarChart2 },
  { href: '/pricing',     label: 'Pricing',      icon: Tag },
  { href: '/admin/users', label: 'Users',        icon: Users },
  { href: '/admin/settings', label: 'Settings',  icon: Settings },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const path   = usePathname();

  useEffect(() => {
    if (!loading && !user) router.push('/login');
  }, [user, loading, router]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Loader2 size={32} className="animate-spin text-blue-600"/>
    </div>
  );

  if (!user) return null;

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-60 bg-slate-900 flex flex-col flex-shrink-0">
        <div className="p-5 border-b border-slate-700">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center"><Zap size={16} className="text-white"/></div>
            <div>
              <p className="text-white font-semibold text-sm leading-none">BENSON</p>
              <p className="text-slate-400 text-xs mt-0.5 truncate max-w-[130px]">{user.tenantName}</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 p-3 overflow-y-auto space-y-0.5">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = path === href || (href !== '/dashboard' && path.startsWith(href));
            return (
              <Link key={href} href={href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${active ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}>
                <Icon size={16}/> {label}
                {active && <ChevronRight size={14} className="ml-auto opacity-70"/>}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-slate-700">
          <div className="px-3 py-2 mb-1">
            <p className="text-white text-sm font-medium truncate">{user.firstName} {user.lastName}</p>
            <p className="text-slate-400 text-xs truncate">{user.email}</p>
          </div>
          <button onClick={logout} className="flex items-center gap-2 w-full px-3 py-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl text-sm transition-all">
            <LogOut size={15}/> Sign out
          </button>
        </div>
      </aside>
      {/* Main */}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
