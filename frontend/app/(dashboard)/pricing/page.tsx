'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { pricingApi } from '@/lib/api';
import { Plus, Pencil, Trash2, X, Loader2 } from 'lucide-react';

function ItemModal({ item, onClose }: { item?: any; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ category: item?.category||'material', code: item?.code||'', name: item?.name||'', unit: item?.unit||'unit', unitRate: item?.unitRate||0, currency: item?.currency||'USD', description: item?.description||'' });
  const [saving, setSaving] = useState(false);
  const s = (k: string, v: any) => setForm(f => ({...f,[k]:v}));
  const save = async () => {
    if (!form.name||!form.unitRate) return toast.error('Name and rate required');
    setSaving(true);
    try { item ? await pricingApi.update(item.id, form) : await pricingApi.create(form); toast.success('Saved'); qc.invalidateQueries({ queryKey: ['pricing'] }); onClose(); } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  };
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5"><h2 className="text-lg font-semibold">{item ? 'Edit Item' : 'New Pricing Item'}</h2><button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18}/></button></div>
        <div className="space-y-4">
          {[['Category','category','select'],['Code','code','text'],['Name','name','text'],['Unit','unit','text'],['Rate','unitRate','number'],['Currency','currency','select'],['Description','description','text']].map(([l,k,t]) => (
            <div key={k}><label className="block text-sm font-medium text-gray-700 mb-1">{l}</label>
              {t==='select' && k==='category' ? <select value={form.category} onChange={e => s('category',e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none">{['material','steel','labor','equipment','transport','other'].map(c => <option key={c}>{c}</option>)}</select>
              : t==='select' && k==='currency' ? <select value={form.currency} onChange={e => s('currency',e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none">{['USD','EUR','GBP','AED','SAR','INR','PKR'].map(c => <option key={c}>{c}</option>)}</select>
              : <input type={t} value={(form as any)[k]} onChange={e => s(k, t==='number' ? Number(e.target.value) : e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/>}
            </div>
          ))}
        </div>
        <div className="flex gap-3 mt-5"><button onClick={onClose} className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl text-sm hover:bg-gray-50">Cancel</button><button onClick={save} disabled={saving} className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm hover:bg-blue-700 disabled:bg-blue-400 flex items-center justify-center gap-2">{saving ? <Loader2 size={14} className="animate-spin"/> : null}Save</button></div>
      </div>
    </div>
  );
}

export default function PricingPage() {
  const qc = useQueryClient();
  const [modal, setModal] = useState<any>(null);
  const [cat, setCat] = useState('');
  const { data, isLoading } = useQuery({ queryKey: ['pricing', cat], queryFn: () => pricingApi.list(cat ? { category: cat } : {}) });
  const { data: cats } = useQuery({ queryKey: ['pricing-cats'], queryFn: pricingApi.categories });
  const items = (data as any[]) || [];
  const delMut = useMutation({ mutationFn: pricingApi.delete, onSuccess: () => { toast.success('Deleted'); qc.invalidateQueries({ queryKey: ['pricing'] }); } });

  return (
    <div className="p-6 max-w-screen-xl">
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-xl font-bold text-gray-900">Pricing Library</h1><p className="text-sm text-gray-500 mt-0.5">{items.length} items</p></div>
        <button onClick={() => setModal({})} className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700"><Plus size={15}/>Add Item</button>
      </div>
      <div className="mb-4">
        <select value={cat} onChange={e => setCat(e.target.value)} className="text-sm px-3 py-2 rounded-xl border border-gray-200 focus:outline-none">
          <option value="">All categories</option>{((cats as string[])||[]).map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      {isLoading ? <div className="bg-white rounded-xl border border-gray-200 h-64 animate-pulse"/> : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="bg-gray-50 border-b border-gray-100">{['Category','Code','Name','Unit','Rate','Currency',''].map(h => <th key={h} className="text-left text-xs font-medium text-gray-500 px-5 py-3">{h}</th>)}</tr></thead>
            <tbody>
              {items.length === 0 ? <tr><td colSpan={7} className="px-5 py-10 text-center text-gray-400 text-sm">No pricing items. Add items to speed up estimation.</td></tr>
              : items.map((i: any) => (
                <tr key={i.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-5 py-3"><span className="text-xs px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full capitalize">{i.category}</span></td>
                  <td className="px-5 py-3 text-gray-500 text-xs">{i.code||'—'}</td>
                  <td className="px-5 py-3 text-gray-800 font-medium">{i.name}</td>
                  <td className="px-5 py-3 text-gray-500">{i.unit}</td>
                  <td className="px-5 py-3 font-semibold text-gray-900">{Number(i.unitRate).toLocaleString('en-US',{ minimumFractionDigits:2 })}</td>
                  <td className="px-5 py-3 text-gray-500 text-xs">{i.currency}</td>
                  <td className="px-5 py-3"><div className="flex gap-1"><button onClick={() => setModal(i)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"><Pencil size={13}/></button><button onClick={() => { if(confirm('Delete?')) delMut.mutate(i.id); }} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={13}/></button></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {modal !== null && <ItemModal item={Object.keys(modal).length ? modal : undefined} onClose={() => setModal(null)}/>}
    </div>
  );
}
