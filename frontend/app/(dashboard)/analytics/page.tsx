'use client';
import { useQuery } from '@tanstack/react-query';
import { analyticsApi } from '@/lib/api';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Bot, TrendingUp, CheckCircle, Zap } from 'lucide-react';

const COLORS = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6'];

export default function AnalyticsPage() {
  const { data: dash }  = useQuery({ queryKey: ['analytics-dashboard'],  queryFn: analyticsApi.dashboard });
  const { data: aiAcc } = useQuery({ queryKey: ['analytics-ai-accuracy'], queryFn: analyticsApi.aiAccuracy });

  const kpis    = (dash as any)?.kpis           || {};
  const monthly = (dash as any)?.monthlyRevenue  || [];
  const bd      = (dash as any)?.costBreakdown   || [];
  const ai      = (aiAcc as any)              || {};

  return (
    <div className="p-6 max-w-screen-xl space-y-6">
      <div><h1 className="text-xl font-bold text-gray-900">Analytics</h1><p className="text-sm text-gray-500 mt-0.5">Business intelligence & AI performance</p></div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[{ label:'AI Estimates', value: ai.total_ai_estimates||0, icon:Bot, color:'bg-violet-600' },{ label:'Avg Confidence', value:`${Math.round(Number(ai.avg_confidence||0))}%`, icon:CheckCircle, color:'bg-green-600' },{ label:'Win Rate', value:`${kpis.winRate||0}%`, icon:TrendingUp, color:'bg-blue-600' },{ label:'Revenue', value:`$${Number(kpis.totalRevenue||0).toLocaleString()}`, icon:Zap, color:'bg-orange-600' }].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-200 p-5"><div className={`w-9 h-9 rounded-lg ${color} flex items-center justify-center mb-3`}><Icon size={16} className="text-white"/></div><p className="text-2xl font-bold text-gray-900">{value}</p><p className="text-sm text-gray-500 mt-0.5">{label}</p></div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Monthly Revenue</h3>
          {monthly.length ? (
            <ResponsiveContainer width="100%" height={210}><BarChart data={monthly}><CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/><XAxis dataKey="month" tick={{ fontSize:11 }}/><YAxis tick={{ fontSize:11 }} tickFormatter={v => `$${(v/1000).toFixed(0)}K`}/><Tooltip formatter={(v: any) => [`$${Number(v).toLocaleString()}`, 'Revenue']}/><Bar dataKey="revenue" fill="#3b82f6" radius={[4,4,0,0]}/></BarChart></ResponsiveContainer>
          ) : <div className="h-48 flex items-center justify-center text-gray-400 text-sm">No data yet</div>}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-4">AI Confidence Distribution</h3>
          <div className="space-y-4 mt-2">
            {[{ label:`High ≥80%`, val: ai.high_confidence||0, color:'bg-green-500' },{ label:`Med 60–79%`, val: ai.medium_confidence||0, color:'bg-amber-500' },{ label:`Low <60%`, val: ai.low_confidence||0, color:'bg-red-400' }].map(({ label, val, color }) => {
              const tot = Number(ai.total_ai_estimates)||1; const pct = Math.round(Number(val)/tot*100);
              return (<div key={label}><div className="flex justify-between text-sm mb-1.5"><span className="text-gray-600">{label}</span><span className="font-semibold text-gray-900">{val} ({pct}%)</span></div><div className="h-2 bg-gray-100 rounded-full overflow-hidden"><div className={`h-full ${color} rounded-full`} style={{ width:`${pct}%` }}/></div></div>);
            })}
          </div>
        </div>
      </div>

      {bd.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-5">Average Cost Breakdown</h3>
          <div className="flex flex-col lg:flex-row items-center gap-8">
            <ResponsiveContainer width={220} height={220}><PieChart><Pie data={bd} dataKey="pct" nameKey="category" cx="50%" cy="50%" outerRadius={85} innerRadius={45}>{bd.map((_: any,i: number) => <Cell key={i} fill={COLORS[i%COLORS.length]}/>)}</Pie><Tooltip formatter={(v: any) => [`${v}%`,'']} /></PieChart></ResponsiveContainer>
            <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {bd.map((item: any, i: number) => (
                <div key={item.category} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50">
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background:COLORS[i%COLORS.length] }}/>
                  <div className="flex-1"><div className="flex justify-between text-sm"><span className="text-gray-700 capitalize font-medium">{item.category}</span><span className="font-bold text-gray-900">{item.pct}%</span></div><div className="mt-1.5 h-1.5 bg-gray-200 rounded-full overflow-hidden"><div className="h-full rounded-full" style={{ width:`${item.pct}%`, background:COLORS[i%COLORS.length] }}/></div></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
