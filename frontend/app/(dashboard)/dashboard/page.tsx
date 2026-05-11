'use client';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { analyticsApi } from '@/lib/api';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { FolderOpen, FileText, TrendingUp, Bot, DollarSign, CheckCircle, Clock, Plus, ArrowRight } from 'lucide-react';

const COLORS = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6'];

const fmt    = (n: number) => n >= 1e6 ? `$${(n/1e6).toFixed(1)}M` : n >= 1e3 ? `$${(n/1e3).toFixed(0)}K` : `$${(n||0).toLocaleString()}`;

const STATUS_COLORS: Record<string,string> = {
  draft:      'bg-gray-100 text-gray-600',
  active:     'bg-blue-100 text-blue-700',
  completed:  'bg-green-100 text-green-700',
  processing: 'bg-amber-100 text-amber-700',
  failed:     'bg-red-100 text-red-600',
  pending:    'bg-gray-100 text-gray-400',
};

const STATUS_LABELS: Record<string,string> = {
  draft: 'Draft', active: 'Active', completed: 'Completed',
  archived: 'Archived', processing: 'Processing', failed: 'Failed', pending: 'Pending',
};

const AI_LABELS: Record<string,string> = {
  pending: 'Pending', processing: 'Processing', completed: 'Completed', failed: 'Failed',
};

export default function DashboardPage() {
  const router = useRouter();
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: analyticsApi.dashboard,
    refetchInterval: 60000,
  });

  const kpis    = (data as any)?.kpis           || {};
  const monthly = (data as any)?.monthlyRevenue  || [];
  const bd      = (data as any)?.costBreakdown   || [];
  const recent  = (data as any)?.recentProjects  || [];

  const KPI = ({ label, value, icon: Icon, color, href }: any) => (
    <div
      onClick={() => href && router.push(href)}
      className={`bg-white rounded-xl border border-gray-200 p-5 transition-all ${href ? 'cursor-pointer hover:border-blue-300 hover:shadow-sm' : ''}`}>
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 ${color}`}>
        <Icon size={16} className="text-white"/>
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <div className="flex items-center justify-between mt-0.5">
        <p className="text-sm text-gray-500">{label}</p>
        {href && <ArrowRight size={13} className="text-gray-300"/>}
      </div>
    </div>
  );

  if (isLoading) return (
    <div className="p-6 grid grid-cols-2 lg:grid-cols-4 gap-4">
      {[...Array(8)].map((_,i) => <div key={i} className="bg-white rounded-xl border border-gray-200 h-28 animate-pulse"/>)}
    </div>
  );

  return (
    <div className="p-6 space-y-6 max-w-screen-xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">Business overview & AI performance</p>
        </div>
        <button
          onClick={() => router.push('/projects')}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700">
          <Plus size={15}/> New Project
        </button>
      </div>

      {/* KPI Grid — all clickable */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPI label="Total Projects"     value={kpis.totalProjects||0}                           icon={FolderOpen}  color="bg-blue-600"    href="/projects"/>
        <KPI label="Total Estimations"  value={kpis.totalEstimations||0}                        icon={FileText}    color="bg-violet-600"  href="/estimations"/>
        <KPI label="Win Rate"           value={`${kpis.winRate||0}%`}                           icon={TrendingUp}  color="bg-green-600"   href="/quotations"/>
        <KPI label="Total Revenue"      value={fmt(kpis.totalRevenue||0)}                       icon={DollarSign}  color="bg-emerald-600" href="/analytics"/>
        <KPI label="AI Adoption"        value={`${kpis.aiAdoptionPct||0}%`}                     icon={Bot}         color="bg-orange-600"  href="/projects"/>
        <KPI label="Average AI Confidence" value={`${Math.round(kpis.avgAiConfidence||0)}%`}   icon={CheckCircle} color="bg-sky-600"     href="/estimations"/>
        <KPI label="Active Projects"    value={kpis.activeProjects||0}                          icon={Clock}       color="bg-amber-600"   href="/projects"/>
        <KPI label="Quotations Sent"    value={kpis.totalQuotations||0}                         icon={FileText}    color="bg-rose-600"    href="/quotations"/>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Revenue trend */}
        <div
          onClick={() => router.push('/analytics')}
          className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-5 cursor-pointer hover:border-blue-200 transition-all">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Revenue Trend</h3>
            <span className="text-xs text-blue-600 flex items-center gap-1">View analytics <ArrowRight size={11}/></span>
          </div>
          {monthly.length ? (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={monthly}>
                <defs>
                  <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/>
                <XAxis dataKey="month" tick={{ fontSize:11 }}/>
                <YAxis tick={{ fontSize:11 }} tickFormatter={v => `$${(v/1000).toFixed(0)}K`}/>
                <Tooltip formatter={(v: any) => [`$${Number(v).toLocaleString()}`, 'Revenue']}/>
                <Area type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={2} fill="url(#g)"/>
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 flex items-center justify-center text-gray-400 text-sm">
              Accept quotations to see revenue trends
            </div>
          )}
        </div>

        {/* Cost breakdown */}
        <div
          onClick={() => router.push('/analytics')}
          className="bg-white rounded-xl border border-gray-200 p-5 cursor-pointer hover:border-blue-200 transition-all">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Cost Breakdown</h3>
            <ArrowRight size={13} className="text-gray-300"/>
          </div>
          {bd.length ? (
            <>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={bd} dataKey="pct" nameKey="category" cx="50%" cy="50%" outerRadius={65} innerRadius={35}>
                    {bd.map((_: any, i: number) => <Cell key={i} fill={COLORS[i%COLORS.length]}/>)}
                  </Pie>
                  <Tooltip formatter={(v: any) => [`${v}%`, '']}/>
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-2 space-y-1">
                {bd.slice(0,4).map((item: any, i: number) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full" style={{ background: COLORS[i%COLORS.length] }}/>
                      <span className="text-gray-600 capitalize">{item.category}</span>
                    </div>
                    <span className="text-gray-700 font-medium">{item.pct}%</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="h-48 flex items-center justify-center text-gray-400 text-sm">
              No breakdown data yet
            </div>
          )}
        </div>
      </div>

      {/* Recent Projects — fully clickable */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">Recent Projects</h3>
          <button onClick={() => router.push('/projects')} className="text-sm text-blue-600 hover:underline font-medium flex items-center gap-1">
            View all <ArrowRight size={12}/>
          </button>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              {['Project Name', 'Industry', 'Status', 'AI Status', 'Last Updated'].map(h => (
                <th key={h} className="text-left text-xs font-medium text-gray-500 px-5 py-3">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {recent.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-10 text-center text-gray-400 text-sm">
                  No projects yet —{' '}
                  <button onClick={() => router.push('/projects')} className="text-blue-600 hover:underline">
                    create the first one
                  </button>
                </td>
              </tr>
            ) : recent.map((p: any) => (
              <tr key={p.id}
                onClick={() => router.push(`/projects/${p.id}`)}
                className="border-b border-gray-50 hover:bg-blue-50 cursor-pointer group">
                <td className="px-5 py-3.5 font-medium text-gray-900 group-hover:text-blue-700">
                  {p.name}
                </td>
                <td className="px-5 py-3.5 text-gray-500 text-xs capitalize">
                  {p.industry ? p.industry.replace('_', ' & ').replace('oil & gas', 'Oil & Gas') : '—'}
                </td>
                <td className="px-5 py-3.5">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[p.status]||'bg-gray-100 text-gray-600'}`}>
                    {STATUS_LABELS[p.status] || p.status}
                  </span>
                </td>
                <td className="px-5 py-3.5">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[p.aiStatus]||'bg-gray-100 text-gray-500'}`}>
                    {AI_LABELS[p.aiStatus] || p.aiStatus}
                  </span>
                </td>
                <td className="px-5 py-3.5 text-gray-400 text-xs">
                  {new Date(p.updatedAt).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {recent.length > 0 && (
          <div className="px-5 py-3 border-t border-gray-50 text-center">
            <button onClick={() => router.push('/projects')}
              className="text-sm text-blue-600 hover:underline flex items-center gap-1 mx-auto">
              View all projects <ArrowRight size={12}/>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
