'use client';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { quotationsApi } from '@/lib/api';
import { FileText, ExternalLink } from 'lucide-react';

const STATUS_COLORS: Record<string,string> = {
  draft:    'bg-gray-100 text-gray-600',
  sent:     'bg-blue-100 text-blue-700',
  accepted: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-600',
  expired:  'bg-gray-100 text-gray-400',
};

const fmt = (n: any) => Number(n||0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function QuotationsPage() {
  const router = useRouter();
  const { data, isLoading } = useQuery({
    queryKey: ['quotations-all'],
    queryFn: quotationsApi.listAll,
  });
  const quotes = (data as any[]) || [];

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
          <p className="text-xs text-gray-400 mt-1">Generate quotations from approved estimations</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                {['Quote No.', 'Project', 'Quotation Title', 'Total Amount', 'Status', 'Sent To', 'Created'].map(h => (
                  <th key={h} className="text-left text-xs font-medium text-gray-500 px-5 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {quotes.map((q: any) => (
                <tr key={q.id}
                  onClick={() => router.push(`/quotations/${q.id}`)}
                  className="border-b border-gray-50 hover:bg-blue-50 cursor-pointer group">
                  <td className="px-5 py-3.5 font-medium text-blue-600">{q.quoteNumber}</td>
                  {/* Project name — clickable */}
                  <td className="px-5 py-3.5">
                    {q.estimation?.project ? (
                      <button
                        onClick={ev => { ev.stopPropagation(); router.push(`/projects/${q.estimation.project.id}`); }}
                        className="flex items-center gap-1 text-blue-600 hover:underline text-xs font-medium">
                        {q.estimation.project.name}
                        <ExternalLink size={10}/>
                      </button>
                    ) : <span className="text-gray-400 text-xs">—</span>}
                  </td>
                  <td className="px-5 py-3.5 text-gray-800 max-w-xs">
                    <p className="truncate group-hover:text-blue-700">{q.title}</p>
                  </td>
                  <td className="px-5 py-3.5 font-semibold text-gray-900">
                    {q.currency} {fmt(q.finalTotal)}
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${STATUS_COLORS[q.status] || 'bg-gray-100 text-gray-600'}`}>
                      {q.status}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-gray-500 text-xs">{q.sentToEmail || '—'}</td>
                  <td className="px-5 py-3.5 text-gray-400 text-xs">
                    {new Date(q.createdAt).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' })}
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
