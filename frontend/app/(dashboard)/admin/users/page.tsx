'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { usersApi } from '@/lib/api';
import { UserPlus, X, Loader2, Users } from 'lucide-react';

export default function UsersPage() {
  const qc = useQueryClient();
  const [showInvite, setShowInvite] = useState(false);
  const [invEmail, setInvEmail] = useState(''); const [invRole, setInvRole] = useState('');

  const { data: users, isLoading } = useQuery({ queryKey: ['users'], queryFn: usersApi.list });
  const { data: roles }  = useQuery({ queryKey: ['roles'],  queryFn: usersApi.roles });
  const { data: stats }  = useQuery({ queryKey: ['user-stats'], queryFn: usersApi.stats });

  const invMut = useMutation({ mutationFn: () => usersApi.invite(invEmail, invRole), onSuccess: () => { toast.success('Invite sent!'); setShowInvite(false); setInvEmail(''); setInvRole(''); qc.invalidateQueries({ queryKey: ['users'] }); }, onError: (e: any) => toast.error(e.message) });
  const deactMut = useMutation({ mutationFn: usersApi.deactivate, onSuccess: () => { toast.success('User deactivated'); qc.invalidateQueries({ queryKey: ['users'] }); } });
  const reactMut = useMutation({ mutationFn: usersApi.reactivate, onSuccess: () => { toast.success('User reactivated'); qc.invalidateQueries({ queryKey: ['users'] }); } });

  const userArr = (users as any[]) || [];
  const roleArr = (roles as any[]) || [];
  const st      = (stats as any) || {};

  return (
    <div className="p-6 max-w-screen-xl">
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-xl font-bold text-gray-900">Users</h1><p className="text-sm text-gray-500 mt-0.5">{st.total||0} total · {st.active||0} active</p></div>
        <button onClick={() => setShowInvite(true)} className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700"><UserPlus size={15}/>Invite User</button>
      </div>
      {isLoading ? <div className="bg-white rounded-xl border border-gray-200 h-64 animate-pulse"/> : userArr.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 py-24 text-center"><Users size={44} className="mx-auto text-gray-200 mb-3"/><p className="text-gray-500">No users yet</p></div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="bg-gray-50 border-b border-gray-100">{['Name','Email','Role','Status','Joined',''].map(h => <th key={h} className="text-left text-xs font-medium text-gray-500 px-5 py-3">{h}</th>)}</tr></thead>
            <tbody>
              {userArr.map((u: any) => (
                <tr key={u.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-5 py-3.5"><div className="flex items-center gap-2.5"><div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-semibold">{(u.firstName?.[0]||u.email[0]).toUpperCase()}</div><span className="font-medium text-gray-900">{u.firstName} {u.lastName}</span></div></td>
                  <td className="px-5 py-3.5 text-gray-500">{u.email}</td>
                  <td className="px-5 py-3.5"><span className="text-xs px-2 py-0.5 bg-purple-50 text-purple-700 rounded-full capitalize">{u.role?.name||'—'}</span></td>
                  <td className="px-5 py-3.5"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${u.status==='active'?'bg-green-100 text-green-700':u.status==='invited'?'bg-amber-100 text-amber-700':'bg-gray-100 text-gray-500'}`}>{u.status}</span></td>
                  <td className="px-5 py-3.5 text-gray-400 text-xs">{new Date(u.createdAt).toLocaleDateString()}</td>
                  <td className="px-5 py-3.5">{u.status==='active' ? <button onClick={() => { if(confirm('Deactivate?')) deactMut.mutate(u.id); }} className="text-xs text-red-500 hover:underline">Deactivate</button> : u.status==='inactive' ? <button onClick={() => reactMut.mutate(u.id)} className="text-xs text-blue-600 hover:underline">Reactivate</button> : null}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {showInvite && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-5"><h3 className="font-semibold">Invite User</h3><button onClick={() => setShowInvite(false)} className="text-gray-400"><X size={18}/></button></div>
            <div className="space-y-4">
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label><input type="email" value={invEmail} onChange={e => setInvEmail(e.target.value)} placeholder="user@company.com" className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <select value={invRole} onChange={e => setInvRole(e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none">
                  <option value="">Select role…</option>{roleArr.map((r: any) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select></div>
              <button onClick={() => invMut.mutate()} disabled={invMut.isPending||!invEmail||!invRole} className="w-full py-2.5 bg-blue-600 text-white text-sm rounded-xl flex items-center justify-center gap-2 hover:bg-blue-700 disabled:bg-blue-400">
                {invMut.isPending ? <Loader2 size={14} className="animate-spin"/> : <UserPlus size={14}/>} Send Invite
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
