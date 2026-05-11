'use client';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { estimationsApi } from '@/lib/api';
import { FileText, ExternalLink } from 'lucide-react';

const STATUS_COLORS: Record<string,string> = {
  draft:        'bg-gray-100 text-gray-600',
  approved:     'bg-green-100 text-green-700',
  locked:       'bg-amber-100 text-amber-700',
  under_review: 'bg-blue-100 text-blue-700',
};

export default function EstimationsPage() {
  const router = useRouter();
  const { data, isLoading } = useQuery({
    queryKey: ['estimations-all'],
    queryFn: () => estimationsApi.listAll(),
  });
  const { data: items, total } = (data as any) || { data: [], total: 0 };
  const ests = items || [];
  const fmt = (n: any) => Number(n||0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="p-6 max-w-screen-xl">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Estimations</h1>
        <p className="text-sm text-gray-500 mt-0.5">{total || ests.length} total</p>
      </div>

      {isLoading ? (
        <div className="bg-white rounded-xl border border-gray-200 h-64 animate-pulse"/>
      ) : ests.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 py-24 text-center">
          <FileText size={44} className="mx-auto text-gray-200 mb-3"/>
          <p className="text-gray-500 font-semibold">No estimations yet</p>
          <p className="text-xs text-gray-400 mt-1">Run AI analysis on a project to generate estimations</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                {['Project', 'Estimation Title', 'Version', 'Status', 'Total Amount', 'AI Confidence', 'Created'].map(h => (
                  <th key={h} className="text-left text-xs font-medium text-gray-500 px-5 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ests.map((e: any) => (
                <tr key={e.id}
                  onClick={() => router.push(`/projects/${e.projectId}/estimations/${e.id}`)}
                  className="border-b border-gray-50 hover:bg-blue-50 cursor-pointer group">
                  {/* Project name — clickable to project */}
                  <td className="px-5 py-3.5">
                    <button
                      onClick={ev => { ev.stopPropagation(); router.push(`/projects/${e.projectId}`); }}
                      className="flex items-center gap-1 text-blue-600 hover:underline text-xs font-medium">
                      {e.project?.name || e.projectId?.slice(0,8) + '…'}
                      <ExternalLink size={10}/>
                    </button>
                  </td>
                  <td className="px-5 py-3.5 font-medium text-gray-900 group-hover:text-blue-700">
                    {e.title}
                  </td>
                  <td className="px-5 py-3.5 text-gray-500">v{e.versionNumber}</td>
                  <td className="px-5 py-3.5">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${STATUS_COLORS[e.status] || 'bg-gray-100 text-gray-600'}`}>
                      {e.status?.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 font-semibold text-gray-900">
                    {e.currency} {fmt(e.finalTotal)}
                  </td>
                  <td className="px-5 py-3.5">
                    {e.aiConfidence ? (
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-20 bg-gray-100 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${Number(e.aiConfidence)>=80?'bg-green-500':Number(e.aiConfidence)>=60?'bg-amber-500':'bg-red-400'}`}
                            style={{ width:`${e.aiConfidence}%` }}/>
                        </div>
                        <span className="text-xs text-gray-600">{e.aiConfidence}%</span>
                      </div>
                    ) : '—'}
                  </td>
                  <td className="px-5 py-3.5 text-gray-400 text-xs">
                    {new Date(e.createdAt).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
