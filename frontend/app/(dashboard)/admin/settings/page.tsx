'use client';
import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { tenantsApi, authApi } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { Loader2 } from 'lucide-react';

export default function SettingsPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<'org'|'security'>('org');
  const [pw, setPw] = useState({ current:'', next:'', confirm:'' });
  const [savingPw, setSavingPw] = useState(false);

  const { data: tenant } = useQuery({ queryKey: ['tenant', user?.tenantId], queryFn: () => tenantsApi.getOne(user!.tenantId), enabled: !!user?.tenantId });
  const t = tenant as any;

  const updateMut = useMutation({ mutationFn: (d: any) => tenantsApi.update(user!.tenantId, d), onSuccess: () => toast.success('Settings saved') });

  const changePw = async () => {
    if (pw.next !== pw.confirm) return toast.error('Passwords do not match');
    if (pw.next.length < 8) return toast.error('Password must be at least 8 characters');
    setSavingPw(true);
    try { await authApi.changePassword(pw.current, pw.next); toast.success('Password changed'); setPw({ current:'', next:'', confirm:'' }); } catch (e: any) { toast.error(e.message); } finally { setSavingPw(false); }
  };

  return (
    <div className="p-6 max-w-screen-lg">
      <div className="mb-6"><h1 className="text-xl font-bold text-gray-900">Settings</h1><p className="text-sm text-gray-500 mt-0.5">Organisation and account settings</p></div>
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit mb-6">
        {(['org','security'] as const).map(t => <button key={t} onClick={() => setTab(t)} className={`px-4 py-1.5 text-sm font-medium rounded-lg capitalize transition-all ${tab===t?'bg-white shadow-sm text-gray-900':'text-gray-500 hover:text-gray-700'}`}>{t==='org'?'Organisation':'Security'}</button>)}
      </div>

      {tab === 'org' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 max-w-lg">
          <h3 className="font-semibold text-gray-900 mb-5">Organisation Details</h3>
          {t && <div className="space-y-4">
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Organisation Name</label><input defaultValue={t.name} key={t.name} onBlur={e => updateMut.mutate({ name: e.target.value })} className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Plan</label><p className="text-sm text-gray-600 capitalize px-3.5 py-2.5 bg-gray-50 rounded-xl">{t.plan}</p></div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Max Users</label><p className="text-sm text-gray-600 px-3.5 py-2.5 bg-gray-50 rounded-xl">{t.maxUsers}</p></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">AI Tokens Used</label><p className="text-sm text-gray-600 px-3.5 py-2.5 bg-gray-50 rounded-xl">{Number(t.aiTokensUsed).toLocaleString()}</p></div>
            </div>
          </div>}
        </div>
      )}

      {tab === 'security' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 max-w-lg">
          <h3 className="font-semibold text-gray-900 mb-5">Change Password</h3>
          <div className="space-y-4">
            {[['Current Password','current'],['New Password','next'],['Confirm New Password','confirm']].map(([l,k]) => (
              <div key={k}><label className="block text-sm font-medium text-gray-700 mb-1">{l}</label>
                <input type="password" value={(pw as any)[k]} onChange={e => setPw(p => ({...p,[k]:e.target.value}))} className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/></div>
            ))}
            <button onClick={changePw} disabled={savingPw||!pw.current||!pw.next} className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white text-sm rounded-xl hover:bg-blue-700 disabled:bg-blue-400">
              {savingPw ? <Loader2 size={14} className="animate-spin"/> : null} Update Password
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
