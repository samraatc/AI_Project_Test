'use client';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { analyticsApi } from '@/lib/api';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { FolderOpen, FileText, TrendingUp, Bot, DollarSign, CheckCircle, Clock, Plus } from 'lucide-react';

const COLORS = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6'];
const fmt = (n: number) => n >= 1e6 ? `$${(n/1e6).toFixed(1)}M` : n >= 1e3 ? `$${(n/1e3).toFixed(0)}K` : `$${(n||0).toLocaleString()}`;
const S: Record<string,string> = { draft:'bg-gray-100 text-gray-600', active:'bg-blue-100 text-blue-700', completed:'bg-green-100 text-green-700', processing:'bg-amber-100 text-amber-700', failed:'bg-red-100 text-red-600', pending:'bg-gray-100 text-gray-400' };

export default function DashboardPage() {
  const router = useRouter();
  const { data, isLoading } = useQuery({ queryKey: ['dashboard'], queryFn: analyticsApi.dashboard, refetchInterval: 60000 });

  const kpis    = (data as any)?.kpis            || {};
  const monthly = (data as any)?.monthlyRevenue  || [];
  const bd      = (data as any)?.costBreakdown   || [];
  const recent  = (data as any)?.recentProjects  || [];

  const KPI = ({ label, value, icon: Icon, color }: any) => (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 ${color}`}><Icon size={16} className="text-white"/></div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-sm text-gray-500 mt-0.5">{label}</p>
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
        <div><h1 className="text-xl font-bold text-gray-900">Dashboard</h1><p className="text-sm text-gray-500 mt-0.5">Business overview & AI performance</p></div>
        <button onClick={() => router.push('/projects')} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700">
          <Plus size={15}/> New Project
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPI label="Total Projects"    value={kpis.totalProjects||0}        icon={FolderOpen}  color="bg-blue-600"/>
        <KPI label="Total Estimations" value={kpis.totalEstimations||0}     icon={FileText}    color="bg-violet-600"/>
        <KPI label="Win Rate"          value={`${kpis.winRate||0}%`}        icon={TrendingUp}  color="bg-green-600"/>
        <KPI label="Total Revenue"     value={fmt(kpis.totalRevenue||0)}    icon={DollarSign}  color="bg-emerald-600"/>
        <KPI label="AI Adoption"       value={`${kpis.aiAdoptionPct||0}%`} icon={Bot}         color="bg-orange-600"/>
        <KPI label="Avg AI Confidence" value={`${Math.round(kpis.avgAiConfidence||0)}%`} icon={CheckCircle} color="bg-sky-600"/>
        <KPI label="Active Projects"   value={kpis.activeProjects||0}       icon={Clock}       color="bg-amber-600"/>
        <KPI label="Quotations Sent"   value={kpis.totalQuotations||0}      icon={FileText}    color="bg-rose-600"/>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Revenue Trend</h3>
          {monthly.length ? (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={monthly}>
                <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15}/><stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/></linearGradient></defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/><XAxis dataKey="month" tick={{ fontSize:11 }}/><YAxis tick={{ fontSize:11 }} tickFormatter={v => `$${(v/1000).toFixed(0)}K`}/>
                <Tooltip formatter={(v: any) => [`$${Number(v).toLocaleString()}`, 'Revenue']}/>
                <Area type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={2} fill="url(#g)"/>
              </AreaChart>
            </ResponsiveContainer>
          ) : <div className="h-48 flex items-center justify-center text-gray-400 text-sm">Accept quotations to see revenue trends</div>}
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Cost Breakdown</h3>
          {bd.length ? (
            <ResponsiveContainer width="100%" height={200}><PieChart><Pie data={bd} dataKey="pct" nameKey="category" cx="50%" cy="50%" outerRadius={70} innerRadius={35}>{bd.map((_: any,i: number) => <Cell key={i} fill={COLORS[i%COLORS.length]}/>)}</Pie><Tooltip formatter={(v: any) => [`${v}%`,'']} /></PieChart></ResponsiveContainer>
          ) : <div className="h-48 flex items-center justify-center text-gray-400 text-sm">No breakdown data yet</div>}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">Recent Projects</h3>
          <button onClick={() => router.push('/projects')} className="text-sm text-blue-600 hover:underline font-medium">View all</button>
        </div>
        <table className="w-full text-sm">
          <thead><tr className="bg-gray-50 border-b border-gray-100">{['Project','Industry','Status','AI','Updated'].map(h => <th key={h} className="text-left text-xs font-medium text-gray-500 px-5 py-3">{h}</th>)}</tr></thead>
          <tbody>
            {recent.length === 0 ? (
              <tr><td colSpan={5} className="px-5 py-10 text-center text-gray-400 text-sm">No projects yet — <button onClick={() => router.push('/projects')} className="text-blue-600 hover:underline">create the first one</button></td></tr>
            ) : recent.map((p: any) => (
              <tr key={p.id} onClick={() => router.push(`/projects/${p.id}`)} className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer">
                <td className="px-5 py-3.5 font-medium text-gray-900">{p.name}</td>
                <td className="px-5 py-3.5 text-gray-500 capitalize text-xs">{p.industry||'—'}</td>
                <td className="px-5 py-3.5"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${S[p.status]||'bg-gray-100 text-gray-600'}`}>{p.status}</span></td>
                <td className="px-5 py-3.5"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${S[p.aiStatus]||'bg-gray-100 text-gray-500'}`}>{p.aiStatus}</span></td>
                <td className="px-5 py-3.5 text-gray-400 text-xs">{new Date(p.updatedAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
