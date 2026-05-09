'use client';
import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Zap, Eye, EyeOff, Loader2 } from 'lucide-react';
import { usersApi } from '@/lib/api';

export default function AcceptInvitePage() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get('token') || '';
  const [form, setForm] = useState({ firstName:'', lastName:'', password:'', confirm:'' });
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password !== form.confirm) { setError('Passwords do not match'); return; }
    if (!token) { setError('Invalid invite link'); return; }
    setLoading(true); setError('');
    try {
      await usersApi.acceptInvite(token, form.password, form.firstName, form.lastName);
      router.push('/login?activated=1');
    } catch (err: any) { setError(err.message || 'Failed to activate account'); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-600 mb-4"><Zap className="text-white" size={28}/></div>
          <h1 className="text-2xl font-bold text-white">EstimateOS</h1>
        </div>
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Activate Your Account</h2>
          {error && <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>}
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              {[['First Name','firstName'],['Last Name','lastName']].map(([l,k]) => (
                <div key={k}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{l}</label>
                  <input value={(form as any)[k]} onChange={e => setForm(f => ({...f,[k]:e.target.value}))} required className="w-full px-3 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/>
                </div>
              ))}
            </div>
            {[['Password','password'],['Confirm Password','confirm']].map(([l,k]) => (
              <div key={k}>
                <label className="block text-sm font-medium text-gray-700 mb-1">{l}</label>
                <div className="relative">
                  <input type={showPw?'text':'password'} value={(form as any)[k]} onChange={e => setForm(f => ({...f,[k]:e.target.value}))} required minLength={8}
                    className="w-full px-3 py-2.5 pr-10 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/>
                  {k==='password' && <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">{showPw?<EyeOff size={16}/>:<Eye size={16}/>}</button>}
                </div>
              </div>
            ))}
            <button type="submit" disabled={loading||!token} className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-medium rounded-xl flex items-center justify-center gap-2">
              {loading ? <><Loader2 size={15} className="animate-spin"/>Activating…</> : 'Activate Account'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
