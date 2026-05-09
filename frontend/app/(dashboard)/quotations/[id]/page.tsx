'use client';
import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, Download, Send, X, Loader2 } from 'lucide-react';
import { quotationsApi } from '@/lib/api';

const fmt = (n: any) => Number(n||0).toLocaleString('en-US', { minimumFractionDigits:2 });

export default function QuotationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter(); const qc = useQueryClient();
  const [showSend, setShowSend] = useState(false);
  const [email, setEmail] = useState(''); const [pdfLoading, setPdfLoading] = useState(false);

  const { data: q, isLoading } = useQuery({ queryKey: ['quotation', id], queryFn: () => quotationsApi.getOne(id) });
  const quote = q as any;

  const sendMut = useMutation({ mutationFn: () => quotationsApi.send(id, { recipientEmail: email }), onSuccess: () => { toast.success('Sent!'); setShowSend(false); qc.invalidateQueries({ queryKey: ['quotation', id] }); }, onError: (e: any) => toast.error(e.message) });

  const downloadPdf = async () => {
    setPdfLoading(true);
    try { const blob = await quotationsApi.pdf(id); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `${quote.quoteNumber}.pdf`; a.click(); URL.revokeObjectURL(url); } catch (e: any) { toast.error(e.message); }
    finally { setPdfLoading(false); }
  };

  if (isLoading) return <div className="p-6"><div className="h-8 bg-gray-200 rounded animate-pulse w-64"/></div>;
  if (!quote) return <div className="p-6 text-gray-500">Quotation not found</div>;

  return (
    <div className="p-6 max-w-screen-xl space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="p-2 rounded-xl hover:bg-gray-100 text-gray-500"><ArrowLeft size={18}/></button>
        <div className="flex-1"><h1 className="text-xl font-bold text-gray-900">{quote.quoteNumber}</h1><p className="text-sm text-gray-500 mt-0.5">{quote.title}</p></div>
        <div className="flex gap-2">
          <button onClick={downloadPdf} disabled={pdfLoading} className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-sm rounded-xl hover:bg-gray-50">
            {pdfLoading ? <Loader2 size={14} className="animate-spin"/> : <Download size={14}/>} PDF
          </button>
          <button onClick={() => setShowSend(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-xl hover:bg-blue-700"><Send size={14}/> Send</button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <div className="flex justify-between items-start">
            <div><p className="text-xs text-gray-400 mb-1">Valid Until</p><p className="text-sm font-medium text-gray-800">{quote.validUntil ? new Date(quote.validUntil).toLocaleDateString() : '—'}</p></div>
            <span className={`text-xs px-3 py-1 rounded-full font-medium ${quote.status==='sent'?'bg-blue-100 text-blue-700':quote.status==='accepted'?'bg-green-100 text-green-700':'bg-gray-100 text-gray-600'}`}>{quote.status}</span>
          </div>
          {quote.scopeSummary && <div><h4 className="text-sm font-semibold text-gray-700 mb-2">Scope of Work</h4><p className="text-sm text-gray-600 leading-relaxed">{quote.scopeSummary}</p></div>}
          {quote.termsConditions && <div><h4 className="text-sm font-semibold text-gray-700 mb-2">Terms & Conditions</h4><p className="text-sm text-gray-600 leading-relaxed">{quote.termsConditions}</p></div>}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Cost Summary</h3>
          <div className="space-y-2.5">
            <div className="flex justify-between text-sm"><span className="text-gray-600">Subtotal</span><span className="font-medium">{quote.currency} {fmt(quote.subtotal)}</span></div>
            <div className="flex justify-between text-sm"><span className="text-gray-600">Tax</span><span className="font-medium">{quote.currency} {fmt(quote.taxAmount)}</span></div>
            <div className="border-t-2 border-gray-900 pt-2.5 flex justify-between"><span className="font-bold text-gray-900">TOTAL</span><span className="font-bold text-gray-900 text-lg">{quote.currency} {fmt(quote.finalTotal)}</span></div>
          </div>
          {quote.sentAt && <div className="mt-4 pt-4 border-t border-gray-100"><p className="text-xs text-gray-400">Sent {new Date(quote.sentAt).toLocaleDateString()} to {quote.sentToEmail}</p></div>}
        </div>
      </div>

      {showSend && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-4"><h3 className="font-semibold">Send Quotation</h3><button onClick={() => setShowSend(false)} className="text-gray-400"><X size={18}/></button></div>
            <div className="space-y-3">
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Recipient Email</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="client@example.com" className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/></div>
              <button onClick={() => sendMut.mutate()} disabled={sendMut.isPending||!email} className="w-full py-2.5 bg-blue-600 text-white text-sm rounded-xl flex items-center justify-center gap-2 hover:bg-blue-700 disabled:bg-blue-400">
                {sendMut.isPending ? <Loader2 size={14} className="animate-spin"/> : <Send size={14}/>} Send PDF
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
