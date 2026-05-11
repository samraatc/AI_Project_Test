'use client';
import { useState, useRef, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  ArrowLeft, Lock, Unlock, GitBranch, Plus, Trash2, Save,
  Loader2, Bot, Send, User, AlertCircle, ExternalLink,
} from 'lucide-react';
import { estimationsApi, quotationsApi } from '@/lib/api';

const CATS = ['material','steel','labor','equipment','transport','other'];
const CAT_COLOR: Record<string,string> = {
  material:  'bg-blue-100 text-blue-700',
  steel:     'bg-gray-100 text-gray-700',
  labor:     'bg-green-100 text-green-700',
  equipment: 'bg-amber-100 text-amber-700',
  transport: 'bg-purple-100 text-purple-700',
  other:     'bg-pink-100 text-pink-700',
};

const CAT_LABELS: Record<string,string> = {
  material:  'Material',
  steel:     'Steel',
  labor:     'Labour',
  equipment: 'Equipment',
  transport: 'Transport',
  other:     'Other',
};

// ── AI Chat Component ────────────────────────────────────────
function AiChat({ estimationId, estimation }: { estimationId: string; estimation: any }) {
  const [messages, setMessages] = useState<Array<{ role: 'user'|'assistant'; content: string }>>([
    {
      role: 'assistant',
      content: `Hello! I'm your AI estimation assistant for **${estimation?.title || 'this estimation'}**.\n\nI can help you:\n- Understand the cost breakdown and line items\n- Explain AI confidence scores and flagged items\n- Analyse specific categories (materials, labour, equipment)\n- Review pricing and identify potential gaps\n- Answer questions about this estimation\n\nWhat would you like to know?`,
    },
  ]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const send = async () => {
    const msg = input.trim();
    if (!msg || sending) return;
    setInput('');
    setMessages(m => [...m, { role: 'user', content: msg }]);
    setSending(true);
    try {
      const history = messages.slice(-10);
      const res = await estimationsApi.chat(estimationId, msg, history) as any;
      setMessages(m => [...m, { role: 'assistant', content: res.reply }]);
    } catch (e: any) {
      setMessages(m => [...m, { role: 'assistant', content: `Sorry, I encountered an error: ${e.message}. Please try again.` }]);
    } finally { setSending(false); }
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  const QUICK = [
    'Explain the AI confidence score',
    'What are the flagged items?',
    'Summarise the cost breakdown',
    'What items might be missing?',
    'How can I reduce the total cost?',
  ];

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden flex flex-col" style={{ height: '600px' }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-3.5 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-white">
        <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center flex-shrink-0">
          <Bot size={15} className="text-white"/>
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-900">AI Estimation Assistant</p>
          <p className="text-xs text-gray-400">Ask about this estimation — costs, quantities, analysis</p>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-green-500"/>
          <span className="text-xs text-gray-400">Active</span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((m, i) => (
          <div key={i} className={`flex gap-3 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
            <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
              m.role === 'user' ? 'bg-blue-600' : 'bg-gray-100 border border-gray-200'
            }`}>
              {m.role === 'user'
                ? <User size={13} className="text-white"/>
                : <Bot size={13} className="text-blue-600"/>
              }
            </div>
            <div className={`max-w-[78%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
              m.role === 'user'
                ? 'bg-blue-600 text-white rounded-tr-sm'
                : 'bg-gray-50 text-gray-800 border border-gray-100 rounded-tl-sm'
            }`}>
              {m.content.split('\n').map((line, j) => (
                <p key={j} className={line === '' ? 'h-2' : ''}>
                  {line.replace(/\*\*(.*?)\*\*/g, '$1')}
                </p>
              ))}
            </div>
          </div>
        ))}
        {sending && (
          <div className="flex gap-3">
            <div className="w-7 h-7 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center">
              <Bot size={13} className="text-blue-600"/>
            </div>
            <div className="bg-gray-50 border border-gray-100 rounded-2xl rounded-tl-sm px-4 py-3">
              <div className="flex gap-1">
                {[0,1,2].map(i => (
                  <div key={i} className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s` }}/>
                ))}
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef}/>
      </div>

      {/* Quick suggestions */}
      {messages.length <= 1 && (
        <div className="px-4 pb-2">
          <p className="text-xs text-gray-400 mb-2">Suggested questions:</p>
          <div className="flex flex-wrap gap-1.5">
            {QUICK.map(q => (
              <button key={q} onClick={() => { setInput(q); }}
                className="text-xs px-3 py-1.5 bg-blue-50 text-blue-700 rounded-full hover:bg-blue-100 transition-colors">
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="p-3 border-t border-gray-100">
        <div className="flex gap-2">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Ask about this estimation… (Enter to send)"
            rows={1}
            className="flex-1 px-3.5 py-2.5 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            style={{ minHeight: '42px', maxHeight: '120px' }}
          />
          <button
            onClick={send}
            disabled={!input.trim() || sending}
            className="px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:bg-gray-200 disabled:text-gray-400 transition-colors flex-shrink-0">
            <Send size={15}/>
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-1.5 text-center">
          AI is limited to estimation-related questions only
        </p>
      </div>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────
export default function EstimationPage() {
  const { projectId, estimationId } = useParams<{ projectId: string; estimationId: string }>();
  const router = useRouter(); const qc = useQueryClient();
  const [tab, setTab] = useState<'items'|'summary'|'risks'|'chat'>('items');
  const [editItem, setEditItem] = useState<any>(null);
  const [newItem, setNewItem] = useState(false);

  const { data: est, isLoading } = useQuery({
    queryKey: ['estimation', estimationId],
    queryFn: () => estimationsApi.getOne(estimationId),
  });
  const e = est as any;

  const lockMut    = useMutation({ mutationFn: () => estimationsApi.lock(estimationId),   onSuccess: () => { toast.success('Estimation locked'); qc.invalidateQueries({ queryKey: ['estimation', estimationId] }); } });
  const unlockMut  = useMutation({ mutationFn: () => estimationsApi.unlock(estimationId), onSuccess: () => { toast.success('Estimation unlocked'); qc.invalidateQueries({ queryKey: ['estimation', estimationId] }); } });
  const versionMut = useMutation({ mutationFn: () => estimationsApi.version(estimationId), onSuccess: (r: any) => { toast.success('New version created'); router.push(`/projects/${projectId}/estimations/${r.id}`); } });
  const quoteMut   = useMutation({ mutationFn: () => quotationsApi.create({ estimationId }), onSuccess: (r: any) => { toast.success('Quotation generated!'); router.push(`/quotations/${r.id}`); } });
  const deleteItemMut = useMutation({ mutationFn: (itemId: string) => estimationsApi.deleteItem(estimationId, itemId), onSuccess: () => { toast.success('Item deleted'); qc.invalidateQueries({ queryKey: ['estimation', estimationId] }); } });

  const saveItem = async (item: any) => {
    try {
      await estimationsApi.upsertItem(estimationId, item);
      toast.success('Item saved');
      qc.invalidateQueries({ queryKey: ['estimation', estimationId] });
      setEditItem(null); setNewItem(false);
    } catch (err: any) { toast.error(err.message); }
  };

  if (isLoading) return <div className="p-6"><div className="h-8 bg-gray-200 rounded animate-pulse w-64"/></div>;
  if (!e) return <div className="p-6 text-gray-500">Estimation not found</div>;

  const fmt = (n: any) => Number(n||0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="p-6 max-w-screen-xl space-y-5">

      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <button onClick={() => router.push(`/projects/${projectId}`)} className="p-2 rounded-xl hover:bg-gray-100 text-gray-500">
          <ArrowLeft size={18}/>
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold text-gray-900 truncate">{e.title}</h1>
            {/* Project name link */}
            {e.project?.name && (
              <button onClick={() => router.push(`/projects/${projectId}`)}
                className="flex items-center gap-1 text-xs text-blue-600 hover:underline bg-blue-50 px-2 py-1 rounded-lg">
                {e.project.name} <ExternalLink size={10}/>
              </button>
            )}
          </div>
          <p className="text-sm text-gray-500 mt-0.5">
            v{e.versionNumber} · {e.currency} {fmt(e.finalTotal)} · {e.status}
            {e.aiConfidence && ` · ${e.aiConfidence}% AI confidence`}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => versionMut.mutate()} disabled={versionMut.isPending}
            className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 text-sm rounded-xl hover:bg-gray-50">
            <GitBranch size={13}/> New Version
          </button>
          {e.isLocked
            ? <button onClick={() => unlockMut.mutate()} className="flex items-center gap-1.5 px-3 py-2 border border-amber-300 text-amber-700 text-sm rounded-xl hover:bg-amber-50"><Unlock size={13}/> Unlock</button>
            : <button onClick={() => lockMut.mutate()} className="flex items-center gap-1.5 px-3 py-2 border border-green-300 text-green-700 text-sm rounded-xl hover:bg-green-50"><Lock size={13}/> Lock</button>
          }
          <button onClick={() => quoteMut.mutate()} disabled={quoteMut.isPending}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-xl hover:bg-blue-700 disabled:bg-blue-400">
            {quoteMut.isPending ? <Loader2 size={13} className="animate-spin"/> : null} Generate Quote
          </button>
        </div>
      </div>

      {e.isLocked && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-700 flex items-center gap-2">
          <Lock size={14}/> This estimation is locked. Create a new version to make changes.
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {([
          { key: 'items',   label: 'Line Items' },
          { key: 'summary', label: 'Summary' },
          { key: 'risks',   label: 'Risk Analysis' },
          { key: 'chat',    label: '🤖 AI Chat' },
        ] as const).map(({ key, label }) => (
          <button key={key} onClick={() => setTab(key as any)}
            className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-all ${tab===key?'bg-white shadow-sm text-gray-900':'text-gray-500 hover:text-gray-700'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* Line Items Tab */}
      {tab === 'items' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900">Line Items ({(e.items||[]).length})</h3>
            {!e.isLocked && (
              <button onClick={() => setNewItem(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700">
                <Plus size={12}/>Add Item
              </button>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  {['Category','Code','Description','Qty','Unit','Unit Rate','Discount','Total',''].map(h => (
                    <th key={h} className="text-left text-xs font-medium text-gray-500 px-3 py-2.5">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {newItem && <ItemRow item={{}} isNew onSave={saveItem} onCancel={() => setNewItem(false)}/>}
                {(e.items||[]).map((item: any) =>
                  editItem?.id === item.id
                    ? <ItemRow key={item.id} item={item} onSave={saveItem} onCancel={() => setEditItem(null)}/>
                    : (
                      <tr key={item.id} className={`border-b border-gray-50 hover:bg-gray-50 ${item.isFlagged?'bg-red-50':''}`}>
                        <td className="px-3 py-2.5">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${CAT_COLOR[item.category]||'bg-gray-100 text-gray-600'}`}>
                            {CAT_LABELS[item.category] || item.category}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-gray-500 text-xs">{item.code||'—'}</td>
                        <td className="px-3 py-2.5 text-gray-800 max-w-xs">
                          <p className="truncate">{item.description}</p>
                          {item.isFlagged && (
                            <p className="text-xs text-red-500 mt-0.5 flex items-center gap-1">
                              <AlertCircle size={10}/> {item.flagReason}
                            </p>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-gray-700">{Number(item.quantity).toLocaleString()}</td>
                        <td className="px-3 py-2.5 text-gray-500">{item.unit}</td>
                        <td className="px-3 py-2.5 text-gray-700">{e.currency} {fmt(item.unitRate)}</td>
                        <td className="px-3 py-2.5 text-gray-500">{item.discountPct>0?`${item.discountPct}%`:'—'}</td>
                        <td className="px-3 py-2.5 font-semibold text-gray-900">{e.currency} {fmt(item.totalAmount)}</td>
                        <td className="px-3 py-2.5">
                          {!e.isLocked && (
                            <div className="flex gap-1">
                              <button onClick={() => setEditItem(item)} className="p-1 text-gray-400 hover:text-blue-600 rounded" title="Edit">
                                <Save size={12}/>
                              </button>
                              <button onClick={() => { if(confirm('Delete this item?')) deleteItemMut.mutate(item.id); }} className="p-1 text-gray-400 hover:text-red-600 rounded" title="Delete">
                                <Trash2 size={12}/>
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    )
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Summary Tab */}
      {tab === 'summary' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-5">Cost Summary</h3>
            <div className="space-y-2.5">
              {[
                ['Materials',  e.materialCost],
                ['Steel',      e.steelCost],
                ['Labour',     e.laborCost],
                ['Equipment',  e.equipmentCost],
                ['Transport',  e.transportCost],
                ['Overhead',   e.overheadCost],
              ].map(([l, v]) => Number(v) > 0 && (
                <div key={l as string} className="flex justify-between text-sm">
                  <span className="text-gray-600">{l}</span>
                  <span className="font-medium text-gray-900">{e.currency} {fmt(v)}</span>
                </div>
              ))}
              <div className="border-t border-gray-100 pt-2.5 flex justify-between text-sm">
                <span className="text-gray-600">Subtotal</span><span className="font-medium">{e.currency} {fmt(e.subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Tax ({e.taxPct}%)</span><span className="font-medium">{e.currency} {fmt(e.taxAmount)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Profit Margin ({e.profitMarginPct}%)</span><span className="font-medium">{e.currency} {fmt(e.profitAmount)}</span>
              </div>
              <div className="border-t-2 border-gray-900 pt-2.5 flex justify-between">
                <span className="font-bold text-gray-900">TOTAL</span>
                <span className="font-bold text-gray-900 text-lg">{e.currency} {fmt(e.finalTotal)}</span>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-4">AI Insights</h3>
            {e.aiConfidence && (
              <div className="mb-4">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm text-gray-600">AI Confidence Score</span>
                  <span className="text-sm font-semibold text-gray-900">{e.aiConfidence}%</span>
                </div>
                <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${Number(e.aiConfidence)>=80?'bg-green-500':Number(e.aiConfidence)>=60?'bg-amber-500':'bg-red-400'}`}
                    style={{ width:`${e.aiConfidence}%` }}/>
                </div>
              </div>
            )}
            {(e.aiRecommendations||[]).length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2">Recommendations</h4>
                {(e.aiRecommendations||[]).slice(0,4).map((r: any, i: number) => (
                  <p key={i} className="text-sm text-gray-600 py-1.5 border-b border-gray-50 last:border-0">
                    💡 {typeof r === 'string' ? r : r.description}
                  </p>
                ))}
              </div>
            )}
            <div className="mt-4 pt-4 border-t border-gray-100">
              <button onClick={() => setTab('chat')} className="text-sm text-blue-600 hover:underline flex items-center gap-1">
                <Bot size={13}/> Ask AI about this estimation →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Risks Tab */}
      {tab === 'risks' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Risk Analysis</h3>
          {(e.aiRiskAnalysis||[]).length === 0 ? (
            <p className="text-sm text-gray-400">No risk analysis available for this estimation</p>
          ) : (
            <div className="space-y-3">
              {(e.aiRiskAnalysis||[]).map((r: any, i: number) => (
                <div key={i} className="p-4 rounded-xl border border-gray-200 bg-gray-50">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-gray-900">{r.risk}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${
                      r.impact==='high'   ? 'bg-red-100 text-red-700' :
                      r.impact==='medium' ? 'bg-amber-100 text-amber-700' :
                      'bg-green-100 text-green-700'
                    }`}>{r.impact} impact</span>
                  </div>
                  <p className="text-xs text-gray-500">{r.mitigation}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* AI Chat Tab */}
      {tab === 'chat' && <AiChat estimationId={estimationId} estimation={e}/>}

    </div>
  );
}

// ── Item Row (inline editor) ──────────────────────────────────
function ItemRow({ item, isNew, onSave, onCancel }: any) {
  const [form, setForm] = useState({
    id: item.id, category: item.category||'material', code: item.code||'',
    description: item.description||'', quantity: item.quantity||1, unit: item.unit||'unit',
    unitRate: item.unitRate||0, discountPct: item.discountPct||0, specification: item.specification||'',
  });
  const s = (k: string, v: any) => setForm(f => ({...f, [k]: v}));
  const total = Number(form.quantity) * Number(form.unitRate) * (1 - Number(form.discountPct)/100);

  return (
    <tr className="bg-blue-50 border-b border-blue-100">
      <td className="px-3 py-2">
        <select value={form.category} onChange={e => s('category', e.target.value)} className="text-xs border border-gray-300 rounded px-1 py-1">
          {CATS.map(c => <option key={c} value={c}>{CAT_LABELS[c]||c}</option>)}
        </select>
      </td>
      <td className="px-3 py-2"><input value={form.code} onChange={e => s('code',e.target.value)} placeholder="Code" className="text-xs border border-gray-300 rounded px-2 py-1 w-20"/></td>
      <td className="px-3 py-2"><input value={form.description} onChange={e => s('description',e.target.value)} placeholder="Description *" className="text-xs border border-gray-300 rounded px-2 py-1 w-52"/></td>
      <td className="px-3 py-2"><input type="number" value={form.quantity} onChange={e => s('quantity',Number(e.target.value))} className="text-xs border border-gray-300 rounded px-2 py-1 w-16"/></td>
      <td className="px-3 py-2"><input value={form.unit} onChange={e => s('unit',e.target.value)} placeholder="unit" className="text-xs border border-gray-300 rounded px-2 py-1 w-16"/></td>
      <td className="px-3 py-2"><input type="number" value={form.unitRate} onChange={e => s('unitRate',Number(e.target.value))} className="text-xs border border-gray-300 rounded px-2 py-1 w-24"/></td>
      <td className="px-3 py-2"><input type="number" value={form.discountPct} onChange={e => s('discountPct',Number(e.target.value))} className="text-xs border border-gray-300 rounded px-2 py-1 w-16"/></td>
      <td className="px-3 py-2 text-xs text-gray-600 font-medium">{total.toLocaleString('en-US',{minimumFractionDigits:2})}</td>
      <td className="px-3 py-2">
        <div className="flex gap-1">
          <button onClick={() => onSave(form)} className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700">Save</button>
          <button onClick={onCancel} className="text-xs px-2 py-1 border border-gray-300 rounded hover:bg-gray-50">Cancel</button>
        </div>
      </td>
    </tr>
  );
}
