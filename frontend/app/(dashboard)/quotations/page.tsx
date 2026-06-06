'use client';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { FileText, ExternalLink, Trash2, Eye, Calendar, Clock } from 'lucide-react';
import { quotationsApi } from '@/lib/api';

const STATUS_COLORS: Record<string,string> = {
  draft:    'bg-gray-100 text-gray-600',
  sent:     'bg-blue-100 text-blue-700',
  accepted: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-600',
  expired:  'bg-gray-100 text-gray-400',
};

const STATUS_LABELS: Record<string,string> = {
  draft:'Draft', sent:'Sent', accepted:'Accepted', rejected:'Rejected', expired:'Expired',
};

const fmt = (n: any) => Number(n||0).toLocaleString('en-US', { minimumFractionDigits:2, maximumFractionDigits:2 });

function fmtDate(iso: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' });
}
function fmtTime(iso: string) {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('en-US', { hour:'2-digit', minute:'2-digit', hour12:true });
}

export default function QuotationsPage() {
  const router = useRouter();
  const qc = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ['quotations-all'],
    queryFn:  quotationsApi.listAll,
  });

  // Handle both array response and {data:[]} response shape
  const quotes: any[] = Array.isArray(data) ? data : (data as any)?.data || [];

  const deleteMut = useMutation({
    mutationFn: (id: string) => quotationsApi.delete(id),
    onSuccess: () => {
      toast.success('Quotation deleted');
      qc.invalidateQueries({ queryKey: ['quotations-all'] });
    },
    onError: (e: any) => toast.error(e.message || 'Failed to delete'),
  });

  if (error) return (
    <div className="p-6">
      <p className="text-red-500 text-sm">Failed to load quotations. Please refresh.</p>
    </div>
  );

  return (
    <div className="p-6 max-w-screen-xl">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Quotations</h1>
        <p className="text-sm text-gray-500 mt-0.5">{quotes.length} total</p>
      </div>

      {isLoading ? (
        <div className="bg-white rounded-xl border border-gray-200 h-64 animate-pulse"/>
      ) : quotes.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 py-24 text-center">
          <FileText size={44} className="mx-auto text-gray-200 mb-3"/>
          <p className="text-gray-500 font-semibold">No quotations yet</p>
          <p className="text-xs text-gray-400 mt-1">Generate quotations from estimations</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
          <table className="w-full text-sm min-w-[700px]">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                {['Quote No.', 'Project', 'Title', 'Total', 'Status', 'Sent To', 'Created', ''].map(h => (
                  <th key={h} className="text-left text-xs font-medium text-gray-500 px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {quotes.map((q: any) => {
                if (!q || !q.id) return null;
                const projectName = q.project?.name || q.estimation?.project?.name || null;
                const projectId   = q.project?.id   || q.estimation?.project?.id   || q.projectId;
                return (
                  <tr key={q.id}
                    onClick={() => router.push(`/quotations/${q.id}`)}
                    className="border-b border-gray-50 hover:bg-blue-50 cursor-pointer group">

                    <td className="px-4 py-3 font-semibold text-blue-600 whitespace-nowrap">
                      {q.quoteNumber || '—'}
                    </td>

                    <td className="px-4 py-3 max-w-[140px]">
                      {projectName ? (
                        <button
                          onClick={e => { e.stopPropagation(); if(projectId) router.push(`/projects/${projectId}`); }}
                          className="flex items-center gap-1 text-blue-600 hover:underline text-xs font-medium">
                          <span className="truncate">{projectName}</span>
                          <ExternalLink size={10} className="flex-shrink-0"/>
                        </button>
                      ) : <span className="text-gray-400 text-xs">—</span>}
                    </td>

                    <td className="px-4 py-3 text-gray-800 max-w-[180px]">
                      <p className="truncate group-hover:text-blue-700">{q.title || '—'}</p>
                    </td>

                    <td className="px-4 py-3 font-semibold text-gray-900 whitespace-nowrap">
                      {q.currency} {fmt(q.finalTotal)}
                    </td>

                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[q.status] || 'bg-gray-100 text-gray-600'}`}>
                        {STATUS_LABELS[q.status] || q.status || 'draft'}
                      </span>
                    </td>

                    <td className="px-4 py-3 text-gray-500 text-xs max-w-[140px]">
                      <span className="truncate block">{q.sentToEmail || '—'}</span>
                    </td>

                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-1 text-xs text-gray-500">
                        <Calendar size={10} className="text-gray-400"/>
                        <span>{fmtDate(q.createdAt)}</span>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-gray-400 mt-0.5">
                        <Clock size={10}/>
                        <span>{fmtTime(q.createdAt)}</span>
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={e => { e.stopPropagation(); router.push(`/quotations/${q.id}`); }}
                          title="View"
                          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg">
                          <Eye size={13}/>
                        </button>
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            if (confirm(`Delete "${q.quoteNumber}"?`)) deleteMut.mutate(q.id);
                          }}
                          title="Delete"
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                          <Trash2 size={13}/>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
