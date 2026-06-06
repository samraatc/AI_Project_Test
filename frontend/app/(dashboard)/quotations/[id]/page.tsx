'use client';
import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  ArrowLeft, Download, Send, X, Loader2, Edit3, Save,
  Trash2, ExternalLink, Calendar, Clock, CheckCircle,
  MoreVertical, FileText, AlertTriangle,
} from 'lucide-react';
import { quotationsApi } from '@/lib/api';

const fmt = (n: any) => Number(n||0).toLocaleString('en-US', { minimumFractionDigits:2, maximumFractionDigits:2 });

function fmtDT(iso: string) {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${d.toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' })} at ${d.toLocaleTimeString('en-US', { hour:'2-digit', minute:'2-digit', hour12:true })}`;
}
function fmtDate(iso: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' });
}

const STATUS_COLORS: Record<string,string> = {
  draft:'bg-gray-100 text-gray-600', sent:'bg-blue-100 text-blue-700',
  accepted:'bg-green-100 text-green-700', rejected:'bg-red-100 text-red-600', expired:'bg-gray-100 text-gray-400',
};

// ── Edit Modal ─────────────────────────────────────────────────
function EditModal({ quote, onClose, onSaved }: { quote: any; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    title:           quote.title           || '',
    status:          quote.status          || 'draft',
    scopeSummary:    quote.scopeSummary    || '',
    termsConditions: quote.termsConditions || '',
    validityDays:    quote.validityDays    || 30,
    validUntil:      quote.validUntil ? String(quote.validUntil).slice(0,10) : '',
  });
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  const save = async () => {
    if (!form.title.trim()) return toast.error('Title is required');
    setSaving(true);
    try {
      await quotationsApi.update(quote.id, { ...form, validityDays: Number(form.validityDays), validUntil: form.validUntil || null });
      toast.success('Quotation updated');
      onSaved(); onClose();
    } catch (e: any) { toast.error(e.message || 'Failed to update'); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-gray-100 sticky top-0 bg-white">
          <div className="flex items-center gap-2"><Edit3 size={17} className="text-blue-600"/><h2 className="font-semibold text-gray-900">Edit Quotation</h2></div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"><X size={17}/></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Title *</label>
            <input value={form.title} onChange={e => set('title', e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Status</label>
              <select value={form.status} onChange={e => set('status', e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                {['draft','sent','accepted','rejected','expired'].map(s => (
                  <option key={s} value={s}>{s.charAt(0).toUpperCase()+s.slice(1)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Valid Until</label>
              <input type="date" value={form.validUntil} onChange={e => set('validUntil', e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Validity Period (days)</label>
            <input type="number" min="1" value={form.validityDays} onChange={e => set('validityDays', e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Scope of Work</label>
            <textarea value={form.scopeSummary} onChange={e => set('scopeSummary', e.target.value)} rows={4}
              placeholder="Describe the scope of work…"
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"/>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Terms & Conditions</label>
            <textarea value={form.termsConditions} onChange={e => set('termsConditions', e.target.value)} rows={4}
              placeholder="Payment terms, warranties, exclusions…"
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"/>
          </div>
        </div>
        <div className="flex gap-3 p-5 border-t border-gray-100 sticky bottom-0 bg-white">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl border border-gray-300 text-sm font-medium hover:bg-gray-50">Cancel</button>
          <button onClick={save} disabled={saving}
            className="flex-1 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium flex items-center justify-center gap-2 disabled:bg-blue-400">
            {saving ? <><Loader2 size={13} className="animate-spin"/>Saving…</> : <><Save size={13}/>Save Changes</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Send Modal ────────────────────────────────────────────────
function SendModal({ quoteId, quoteNumber, defaultEmail, onClose, onSent }: {
  quoteId: string; quoteNumber: string; defaultEmail?: string; onClose: () => void; onSent: () => void;
}) {
  const [email,   setEmail]   = useState(defaultEmail || '');
  const [message, setMessage] = useState(`Please find attached our quotation ${quoteNumber}.\n\nKind regards`);

  const sendMut = useMutation({
    mutationFn: () => quotationsApi.send(quoteId, { recipientEmail: email, message }),
    onSuccess: () => { toast.success('Quotation sent successfully!'); onSent(); onClose(); },
    onError:   (e: any) => toast.error(e.message || 'Failed to send email'),
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <div className="flex items-center gap-2"><Send size={16} className="text-blue-600"/><h3 className="font-semibold">Send Quotation</h3></div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={17}/></button>
        </div>
        <div className="p-5 space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Recipient Email *</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="client@company.com"
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Message</label>
            <textarea value={message} onChange={e => setMessage(e.target.value)} rows={4}
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"/>
          </div>
          <p className="text-xs text-gray-400">The quotation PDF will be attached automatically.</p>
          <button onClick={() => sendMut.mutate()} disabled={sendMut.isPending || !email.trim()}
            className="w-full py-2.5 bg-blue-600 text-white text-sm rounded-xl flex items-center justify-center gap-2 hover:bg-blue-700 disabled:bg-blue-400 font-medium">
            {sendMut.isPending ? <Loader2 size={13} className="animate-spin"/> : <Send size={13}/>}
            Send PDF to Client
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Delete Confirm ────────────────────────────────────────────
function DeleteConfirm({ quoteNumber, onConfirm, onClose, loading }: {
  quoteNumber: string; onConfirm: () => void; onClose: () => void; loading: boolean;
}) {
  const [typed, setTyped] = useState('');
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
          <Trash2 size={20} className="text-red-600"/>
        </div>
        <h3 className="font-semibold text-gray-900 text-center mb-2">Delete Quotation</h3>
        <p className="text-sm text-gray-500 text-center mb-4">
          This will permanently delete <strong>{quoteNumber}</strong>. This cannot be undone.
        </p>
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4">
          <p className="text-xs text-red-600 mb-2 font-medium">Type the quote number to confirm:</p>
          <input value={typed} onChange={e => setTyped(e.target.value)} placeholder={quoteNumber}
            className="w-full px-3 py-2 rounded-lg border border-red-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"/>
        </div>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl border border-gray-300 text-sm font-medium hover:bg-gray-50">Cancel</button>
          <button onClick={onConfirm} disabled={typed !== quoteNumber || loading}
            className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 text-white text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-40 hover:bg-red-700">
            {loading ? <Loader2 size={13} className="animate-spin"/> : <Trash2 size={13}/>} Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────
export default function QuotationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();

  const [showEdit,   setShowEdit]   = useState(false);
  const [showSend,   setShowSend]   = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [showMenu,   setShowMenu]   = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);

  const { data: q, isLoading, error } = useQuery({
    queryKey: ['quotation', id],
    queryFn:  () => quotationsApi.getOne(id),
    retry: 1,
  });
  const quote = q as any;

  const deleteMut = useMutation({
    mutationFn: () => quotationsApi.delete(id),
    onSuccess: () => { toast.success('Quotation deleted'); qc.invalidateQueries({ queryKey: ['quotations-all'] }); router.push('/quotations'); },
    onError:   (e: any) => toast.error(e.message || 'Delete failed'),
  });

  const markAccepted = useMutation({
    mutationFn: () => quotationsApi.update(id, { status: 'accepted' }),
    onSuccess: () => { toast.success('Marked as accepted'); qc.invalidateQueries({ queryKey: ['quotation', id] }); setShowMenu(false); },
  });

  const downloadPdf = async () => {
    setPdfLoading(true);
    try {
      const blob = await quotationsApi.pdf(id);
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `${quote?.quoteNumber || 'quotation'}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('PDF downloaded');
    } catch (e: any) { toast.error('PDF download failed — ' + e.message); }
    finally { setPdfLoading(false); }
  };

  // ── Loading / Error states ───────────────────────────────────
  if (isLoading) return (
    <div className="p-6 space-y-4 max-w-screen-xl">
      <div className="h-8 bg-gray-200 rounded-xl animate-pulse w-72"/>
      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2 h-64 bg-gray-200 rounded-xl animate-pulse"/>
        <div className="h-64 bg-gray-200 rounded-xl animate-pulse"/>
      </div>
    </div>
  );

  if (error || !quote) return (
    <div className="p-6 text-center">
      <AlertTriangle size={40} className="mx-auto text-gray-300 mb-3"/>
      <p className="text-gray-500 font-medium">Quotation not found</p>
      <button onClick={() => router.push('/quotations')} className="mt-3 text-blue-600 hover:underline text-sm">
        ← Back to Quotations
      </button>
    </div>
  );

  const projectName = quote.project?.name || quote.estimation?.project?.name;
  const projectId   = quote.project?.id   || quote.estimation?.project?.id || quote.projectId;
  const profit = Math.max(0, Number(quote.finalTotal) - Number(quote.subtotal) - Number(quote.taxAmount));

  return (
    <div className="p-6 max-w-screen-xl space-y-5">

      {/* ── Header ── */}
      <div className="flex items-center gap-3 flex-wrap">
        <button onClick={() => router.back()} className="p-2 rounded-xl hover:bg-gray-100 text-gray-500">
          <ArrowLeft size={18}/>
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold text-gray-900">{quote.quoteNumber}</h1>
            <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium capitalize ${STATUS_COLORS[quote.status]||'bg-gray-100 text-gray-600'}`}>
              {quote.status}
            </span>
            {projectName && (
              <button onClick={() => projectId && router.push(`/projects/${projectId}`)}
                className="flex items-center gap-1 text-xs text-blue-600 hover:underline bg-blue-50 px-2 py-0.5 rounded-lg">
                {projectName} <ExternalLink size={9}/>
              </button>
            )}
          </div>
          <p className="text-sm text-gray-500 mt-0.5 truncate">{quote.title}</p>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            <span className="flex items-center gap-1 text-xs text-gray-400">
              <Calendar size={10}/> Created {fmtDT(quote.createdAt)}
            </span>
            {quote.sentAt && (
              <span className="flex items-center gap-1 text-xs text-blue-500">
                <Send size={10}/> Sent {fmtDT(quote.sentAt)} → {quote.sentToEmail}
              </span>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <button onClick={downloadPdf} disabled={pdfLoading}
            className="flex items-center gap-2 px-3 py-2 border border-gray-300 text-sm rounded-xl hover:bg-gray-50 text-gray-700 font-medium">
            {pdfLoading ? <Loader2 size={13} className="animate-spin"/> : <Download size={13}/>} Download PDF
          </button>
          <button onClick={() => setShowSend(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-xl hover:bg-blue-700 font-medium">
            <Send size={13}/> Send to Client
          </button>
          <button onClick={() => setShowEdit(true)}
            className="flex items-center gap-2 px-3 py-2 border border-gray-300 text-sm rounded-xl hover:bg-gray-50 text-gray-700 font-medium">
            <Edit3 size={13}/> Edit
          </button>
          <div className="relative">
            <button onClick={() => setShowMenu(v => !v)}
              className="p-2 rounded-xl border border-gray-300 text-gray-500 hover:bg-gray-50">
              <MoreVertical size={16}/>
            </button>
            {showMenu && (
              <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-gray-200 rounded-xl shadow-lg z-20 py-1">
                {quote.status !== 'accepted' && (
                  <button onClick={() => markAccepted.mutate()}
                    className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50">
                    <CheckCircle size={13} className="text-green-500"/> Mark as Accepted
                  </button>
                )}
                <div className="border-t border-gray-100 my-1"/>
                <button onClick={() => { setShowMenu(false); setShowDelete(true); }}
                  className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-red-600 hover:bg-red-50">
                  <Trash2 size={13}/> Delete Quotation
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Content grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Left — scope + terms */}
        <div className="lg:col-span-2 space-y-4">

          {/* Scope */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-900">Scope of Work</h3>
              <button onClick={() => setShowEdit(true)} className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                <Edit3 size={10}/> Edit
              </button>
            </div>
            {quote.scopeSummary
              ? <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">{quote.scopeSummary}</p>
              : <div className="text-center py-6">
                  <FileText size={28} className="mx-auto text-gray-200 mb-2"/>
                  <p className="text-sm text-gray-400">No scope added yet</p>
                  <button onClick={() => setShowEdit(true)} className="mt-2 text-xs text-blue-600 hover:underline">Add scope</button>
                </div>
            }
          </div>

          {/* Terms */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-900">Terms & Conditions</h3>
              <button onClick={() => setShowEdit(true)} className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                <Edit3 size={10}/> Edit
              </button>
            </div>
            {quote.termsConditions
              ? <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">{quote.termsConditions}</p>
              : <div className="text-center py-6">
                  <p className="text-sm text-gray-400">No terms added yet</p>
                  <button onClick={() => setShowEdit(true)} className="mt-2 text-xs text-blue-600 hover:underline">Add terms</button>
                </div>
            }
          </div>
        </div>

        {/* Right sidebar */}
        <div className="space-y-4">

          {/* Cost summary */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-900 mb-4">Cost Summary</h3>
            <div className="space-y-2.5">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Subtotal</span>
                <span className="font-medium">{quote.currency} {fmt(quote.subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Tax</span>
                <span className="font-medium">{quote.currency} {fmt(quote.taxAmount)}</span>
              </div>
              {profit > 0.01 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Profit Margin</span>
                  <span className="font-medium">{quote.currency} {fmt(profit)}</span>
                </div>
              )}
              <div className="border-t-2 border-gray-900 pt-2.5 flex justify-between">
                <span className="font-bold text-gray-900">TOTAL</span>
                <span className="font-bold text-gray-900 text-lg">{quote.currency} {fmt(quote.finalTotal)}</span>
              </div>
            </div>
          </div>

          {/* Details */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3.5">
            <h3 className="font-semibold text-gray-900">Details</h3>
            {projectName && (
              <div>
                <p className="text-xs text-gray-400 mb-1">Project</p>
                <button onClick={() => projectId && router.push(`/projects/${projectId}`)}
                  className="text-sm text-blue-600 hover:underline flex items-center gap-1">
                  {projectName} <ExternalLink size={10}/>
                </button>
              </div>
            )}
            <div>
              <p className="text-xs text-gray-400 mb-1">Valid Until</p>
              <p className="text-sm text-gray-700">{quote.validUntil ? fmtDate(quote.validUntil) : '—'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">Validity Period</p>
              <p className="text-sm text-gray-700">{quote.validityDays || 30} days</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">Created</p>
              <div className="flex items-center gap-1.5 text-sm text-gray-700">
                <Calendar size={11} className="text-gray-400"/>
                <span>{fmtDate(quote.createdAt)}</span>
                <Clock size={11} className="text-gray-400 ml-1"/>
                <span className="text-gray-500 text-xs">
                  {quote.createdAt ? new Date(quote.createdAt).toLocaleTimeString('en-US', { hour:'2-digit', minute:'2-digit', hour12:true }) : ''}
                </span>
              </div>
            </div>
            {quote.sentAt && (
              <div>
                <p className="text-xs text-gray-400 mb-1">Sent</p>
                <p className="text-sm text-gray-700">{fmtDT(quote.sentAt)}</p>
                <p className="text-xs text-gray-500 mt-0.5">→ {quote.sentToEmail}</p>
              </div>
            )}
          </div>

          {/* Quick actions */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-2">
            <h3 className="font-semibold text-gray-900 mb-1">Actions</h3>
            <button onClick={downloadPdf} disabled={pdfLoading}
              className="flex items-center gap-2 w-full px-3 py-2.5 text-sm text-gray-700 border border-gray-200 rounded-xl hover:bg-gray-50 font-medium">
              {pdfLoading ? <Loader2 size={13} className="animate-spin text-blue-500"/> : <Download size={13} className="text-blue-500"/>}
              Download PDF
            </button>
            <button onClick={() => setShowSend(true)}
              className="flex items-center gap-2 w-full px-3 py-2.5 text-sm text-gray-700 border border-gray-200 rounded-xl hover:bg-gray-50 font-medium">
              <Send size={13} className="text-blue-500"/> Send to Client
            </button>
            <button onClick={() => setShowEdit(true)}
              className="flex items-center gap-2 w-full px-3 py-2.5 text-sm text-gray-700 border border-gray-200 rounded-xl hover:bg-gray-50 font-medium">
              <Edit3 size={13} className="text-blue-500"/> Edit Quotation
            </button>
            <div className="border-t border-gray-100 pt-2 mt-2">
              <button onClick={() => setShowDelete(true)}
                className="flex items-center gap-2 w-full px-3 py-2.5 text-sm text-red-600 border border-red-200 rounded-xl hover:bg-red-50 font-medium">
                <Trash2 size={13}/> Delete Quotation
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      {showEdit && (
        <EditModal quote={quote} onClose={() => setShowEdit(false)}
          onSaved={() => qc.invalidateQueries({ queryKey: ['quotation', id] })}/>
      )}
      {showSend && (
        <SendModal quoteId={id} quoteNumber={quote.quoteNumber} defaultEmail={quote.sentToEmail}
          onClose={() => setShowSend(false)}
          onSent={() => qc.invalidateQueries({ queryKey: ['quotation', id] })}/>
      )}
      {showDelete && (
        <DeleteConfirm quoteNumber={quote.quoteNumber}
          onClose={() => setShowDelete(false)}
          onConfirm={() => deleteMut.mutate()}
          loading={deleteMut.isPending}/>
      )}
    </div>
  );
}
