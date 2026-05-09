'use client';
import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, Lock, Unlock, GitBranch, Plus, Trash2, Save, Loader2 } from 'lucide-react';
import { estimationsApi, quotationsApi } from '@/lib/api';

const CATS = ['material','steel','labor','equipment','transport','other'];
const CAT_COLOR: Record<string,string> = { material:'bg-blue-100 text-blue-700', steel:'bg-gray-100 text-gray-700', labor:'bg-green-100 text-green-700', equipment:'bg-amber-100 text-amber-700', transport:'bg-purple-100 text-purple-700', other:'bg-pink-100 text-pink-700' };

export default function EstimationPage() {
  const { projectId, estimationId } = useParams<{ projectId: string; estimationId: string }>();
  const router = useRouter(); const qc = useQueryClient();
  const [tab, setTab] = useState<'items'|'summary'|'risks'|'ai'>('items');
  const [editItem, setEditItem] = useState<any>(null);
  const [newItem, setNewItem] = useState(false);

  const { data: est, isLoading } = useQuery({ queryKey: ['estimation', estimationId], queryFn: () => estimationsApi.getOne(estimationId), refetchInterval: 5000 });
  const e = est as any;

  const lockMut    = useMutation({ mutationFn: () => estimationsApi.lock(estimationId), onSuccess: () => { toast.success('Locked'); qc.invalidateQueries({ queryKey: ['estimation', estimationId] }); } });
  const unlockMut  = useMutation({ mutationFn: () => estimationsApi.unlock(estimationId), onSuccess: () => { toast.success('Unlocked'); qc.invalidateQueries({ queryKey: ['estimation', estimationId] }); } });
  const versionMut = useMutation({ mutationFn: () => estimationsApi.version(estimationId), onSuccess: (r: any) => { toast.success('New version created'); router.push(`/projects/${projectId}/estimations/${r.id}`); } });
  const quoteMut   = useMutation({ mutationFn: () => quotationsApi.create({ estimationId }), onSuccess: (r: any) => { toast.success('Quotation generated!'); router.push(`/quotations/${r.id}`); } });
  const deleteItemMut = useMutation({ mutationFn: (itemId: string) => estimationsApi.deleteItem(estimationId, itemId), onSuccess: () => { toast.success('Item deleted'); qc.invalidateQueries({ queryKey: ['estimation', estimationId] }); } });

  const saveItem = async (item: any) => {
    try { await estimationsApi.upsertItem(estimationId, item); toast.success('Saved'); qc.invalidateQueries({ queryKey: ['estimation', estimationId] }); setEditItem(null); setNewItem(false); } catch (err: any) { toast.error(err.message); }
  };

  if (isLoading) return <div className="p-6"><div className="h-8 bg-gray-200 rounded animate-pulse w-64"/></div>;
  if (!e) return <div className="p-6 text-gray-500">Estimation not found</div>;

  const fmt = (n: any) => Number(n||0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="p-6 max-w-screen-xl space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={() => router.push(`/projects/${projectId}`)} className="p-2 rounded-xl hover:bg-gray-100 text-gray-500"><ArrowLeft size={18}/></button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-900">{e.title}</h1>
          <p className="text-sm text-gray-500 mt-0.5">v{e.versionNumber} · {e.currency} {fmt(e.finalTotal)} · {e.status}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => versionMut.mutate()} disabled={versionMut.isPending} className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 text-sm rounded-xl hover:bg-gray-50"><GitBranch size={13}/> New Version</button>
          {e.isLocked ? <button onClick={() => unlockMut.mutate()} className="flex items-center gap-1.5 px-3 py-2 border border-amber-300 text-amber-700 text-sm rounded-xl hover:bg-amber-50"><Unlock size={13}/> Unlock</button>
                       : <button onClick={() => lockMut.mutate()}  className="flex items-center gap-1.5 px-3 py-2 border border-green-300 text-green-700 text-sm rounded-xl hover:bg-green-50"><Lock size={13}/> Lock</button>}
          <button onClick={() => quoteMut.mutate()} disabled={quoteMut.isPending} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-xl hover:bg-blue-700 disabled:bg-blue-400">
            {quoteMut.isPending ? <Loader2 size={13} className="animate-spin"/> : null} Generate Quote
          </button>
        </div>
      </div>

      {e.isLocked && <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-700 flex items-center gap-2"><Lock size={14}/>This estimation is locked. Create a new version to make changes.</div>}

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {(['items','summary','risks','ai'] as const).map(t => <button key={t} onClick={() => setTab(t)} className={`px-4 py-1.5 text-sm font-medium rounded-lg capitalize transition-all ${tab===t?'bg-white shadow-sm text-gray-900':'text-gray-500 hover:text-gray-700'}`}>{t}</button>)}
      </div>

      {tab === 'items' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900">Line Items ({(e.items||[]).length})</h3>
            {!e.isLocked && <button onClick={() => setNewItem(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700"><Plus size={12}/>Add Item</button>}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="bg-gray-50 border-b border-gray-100">{['Cat','Code','Description','Qty','Unit','Rate','Discount','Total',''].map(h => <th key={h} className="text-left text-xs font-medium text-gray-500 px-3 py-2.5">{h}</th>)}</tr></thead>
              <tbody>
                {newItem && <ItemRow item={{}} isNew onSave={saveItem} onCancel={() => setNewItem(false)}/>}
                {(e.items||[]).map((item: any) => editItem?.id === item.id
                  ? <ItemRow key={item.id} item={item} onSave={saveItem} onCancel={() => setEditItem(null)}/>
                  : <tr key={item.id} className={`border-b border-gray-50 hover:bg-gray-50 ${item.isFlagged?'bg-red-50':''}`}>
                      <td className="px-3 py-2.5"><span className={`text-xs px-2 py-0.5 rounded-full ${CAT_COLOR[item.category]||'bg-gray-100 text-gray-600'}`}>{item.category}</span></td>
                      <td className="px-3 py-2.5 text-gray-500 text-xs">{item.code||'—'}</td>
                      <td className="px-3 py-2.5 text-gray-800 max-w-xs"><p className="truncate">{item.description}</p>{item.isFlagged&&<p className="text-xs text-red-500 mt-0.5">⚠ {item.flagReason}</p>}</td>
                      <td className="px-3 py-2.5 text-gray-700">{Number(item.quantity).toLocaleString()}</td>
                      <td className="px-3 py-2.5 text-gray-500">{item.unit}</td>
                      <td className="px-3 py-2.5 text-gray-700">{fmt(item.unitRate)}</td>
                      <td className="px-3 py-2.5 text-gray-500">{item.discountPct>0?`${item.discountPct}%`:'—'}</td>
                      <td className="px-3 py-2.5 font-semibold text-gray-900">{fmt(item.totalAmount)}</td>
                      <td className="px-3 py-2.5">
                        {!e.isLocked && <div className="flex gap-1">
                          <button onClick={() => setEditItem(item)} className="p-1 text-gray-400 hover:text-blue-600 rounded"><Save size={12}/></button>
                          <button onClick={() => { if(confirm('Delete?')) deleteItemMut.mutate(item.id); }} className="p-1 text-gray-400 hover:text-red-600 rounded"><Trash2 size={12}/></button>
                        </div>}
                      </td>
                    </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'summary' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 max-w-md">
          <h3 className="font-semibold text-gray-900 mb-5">Cost Summary</h3>
          <div className="space-y-2.5">
            {[['Materials', e.materialCost],['Steel', e.steelCost],['Labour', e.laborCost],['Equipment', e.equipmentCost],['Transport', e.transportCost],['Overhead', e.overheadCost]].map(([l,v]) => Number(v) > 0 && (
              <div key={l as string} className="flex justify-between text-sm"><span className="text-gray-600">{l}</span><span className="font-medium text-gray-900">{e.currency} {fmt(v)}</span></div>
            ))}
            <div className="border-t border-gray-100 pt-2.5 flex justify-between text-sm"><span className="text-gray-600">Subtotal</span><span className="font-medium">{e.currency} {fmt(e.subtotal)}</span></div>
            <div className="flex justify-between text-sm"><span className="text-gray-600">Tax ({e.taxPct}%)</span><span className="font-medium">{e.currency} {fmt(e.taxAmount)}</span></div>
            <div className="flex justify-between text-sm"><span className="text-gray-600">Profit ({e.profitMarginPct}%)</span><span className="font-medium">{e.currency} {fmt(e.profitAmount)}</span></div>
            <div className="border-t-2 border-gray-900 pt-2.5 flex justify-between"><span className="font-bold text-gray-900">TOTAL</span><span className="font-bold text-gray-900 text-lg">{e.currency} {fmt(e.finalTotal)}</span></div>
          </div>
        </div>
      )}

      {tab === 'risks' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Risk Analysis</h3>
          {(e.aiRiskAnalysis||[]).length === 0 ? <p className="text-sm text-gray-400">No risk analysis available</p> : (
            <div className="space-y-3">
              {(e.aiRiskAnalysis||[]).map((r: any, i: number) => (
                <div key={i} className="p-4 rounded-xl border border-gray-200 bg-gray-50">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-gray-900">{r.risk}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${r.impact==='high'?'bg-red-100 text-red-700':r.impact==='medium'?'bg-amber-100 text-amber-700':'bg-green-100 text-green-700'}`}>{r.impact}</span>
                  </div>
                  <p className="text-xs text-gray-500">{r.mitigation}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'ai' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <h3 className="font-semibold text-gray-900">AI Insights</h3>
          {e.aiConfidence && <div className="flex items-center gap-3"><div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden"><div className={`h-full rounded-full ${Number(e.aiConfidence)>=80?'bg-green-500':Number(e.aiConfidence)>=60?'bg-amber-500':'bg-red-400'}`} style={{ width:`${e.aiConfidence}%` }}/></div><span className="text-sm font-semibold text-gray-700">{e.aiConfidence}% confidence</span></div>}
          {(e.aiRecommendations||[]).length > 0 && <div><h4 className="text-sm font-medium text-gray-700 mb-2">Recommendations</h4>{(e.aiRecommendations||[]).map((r: any, i: number) => <p key={i} className="text-sm text-gray-600 py-1.5 border-b border-gray-50 last:border-0">💡 {typeof r === 'string' ? r : r.description}</p>)}</div>}
          {(e.aiMissingItems||[]).length > 0 && <div><h4 className="text-sm font-medium text-gray-700 mb-2">Possibly Missing Items</h4>{(e.aiMissingItems||[]).map((m: any, i: number) => <p key={i} className="text-sm text-gray-600 py-1.5 border-b border-gray-50 last:border-0">⚠ {m.item} — {m.reason}</p>)}</div>}
        </div>
      )}
    </div>
  );
}

function ItemRow({ item, isNew, onSave, onCancel }: any) {
  const [form, setForm] = useState({ id: item.id, category: item.category||'material', code: item.code||'', description: item.description||'', quantity: item.quantity||1, unit: item.unit||'unit', unitRate: item.unitRate||0, discountPct: item.discountPct||0, specification: item.specification||'' });
  const s = (k: string, v: any) => setForm(f => ({...f,[k]:v}));
  return (
    <tr className="bg-blue-50 border-b border-blue-100">
      <td className="px-3 py-2"><select value={form.category} onChange={e => s('category',e.target.value)} className="text-xs border border-gray-300 rounded px-1 py-1">{['material','steel','labor','equipment','transport','other'].map(c => <option key={c}>{c}</option>)}</select></td>
      <td className="px-3 py-2"><input value={form.code} onChange={e => s('code',e.target.value)} placeholder="Code" className="text-xs border border-gray-300 rounded px-2 py-1 w-20"/></td>
      <td className="px-3 py-2"><input value={form.description} onChange={e => s('description',e.target.value)} placeholder="Description *" className="text-xs border border-gray-300 rounded px-2 py-1 w-52"/></td>
      <td className="px-3 py-2"><input type="number" value={form.quantity} onChange={e => s('quantity',Number(e.target.value))} className="text-xs border border-gray-300 rounded px-2 py-1 w-16"/></td>
      <td className="px-3 py-2"><input value={form.unit} onChange={e => s('unit',e.target.value)} placeholder="unit" className="text-xs border border-gray-300 rounded px-2 py-1 w-16"/></td>
      <td className="px-3 py-2"><input type="number" value={form.unitRate} onChange={e => s('unitRate',Number(e.target.value))} className="text-xs border border-gray-300 rounded px-2 py-1 w-24"/></td>
      <td className="px-3 py-2"><input type="number" value={form.discountPct} onChange={e => s('discountPct',Number(e.target.value))} className="text-xs border border-gray-300 rounded px-2 py-1 w-16"/></td>
      <td className="px-3 py-2 text-xs text-gray-600">{Number(form.quantity*form.unitRate*(1-form.discountPct/100)).toLocaleString('en-US',{minimumFractionDigits:2})}</td>
      <td className="px-3 py-2"><div className="flex gap-1"><button onClick={() => onSave(form)} className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700">Save</button><button onClick={onCancel} className="text-xs px-2 py-1 border border-gray-300 rounded hover:bg-gray-50">Cancel</button></div></td>
    </tr>
  );
}
