'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useDropzone } from 'react-dropzone';
import { toast } from 'sonner';
import { Plus, Search, FolderOpen, Upload, X, Loader2, Copy, Calendar, Clock } from 'lucide-react';
import { projectsApi, filesApi } from '@/lib/api';

const INDUSTRIES = [
  { value: 'construction',    label: 'Construction' },
  { value: 'oil_gas',         label: 'Oil & Gas' },
  { value: 'fabrication',     label: 'Fabrication' },
  { value: 'manufacturing',   label: 'Manufacturing' },
  { value: 'epc',             label: 'EPC (Engineering, Procurement & Construction)' },
  { value: 'civil',           label: 'Civil Engineering' },
  { value: 'mechanical',      label: 'Mechanical Engineering' },
  { value: 'electrical',      label: 'Electrical Engineering' },
  { value: 'other',           label: 'Other' },
];

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft', active: 'Active', completed: 'Completed', archived: 'Archived',
};

const SC: Record<string,string> = {
  draft:'bg-gray-100 text-gray-600',
  active:'bg-blue-100 text-blue-700',
  completed:'bg-green-100 text-green-700',
  archived:'bg-gray-50 text-gray-400',
};
const AC: Record<string,string> = {
  pending:'bg-gray-100 text-gray-400',
  processing:'bg-amber-100 text-amber-700',
  completed:'bg-green-100 text-green-700',
  failed:'bg-red-100 text-red-600',
};

function formatDateTime(iso: string) {
  const d = new Date(iso);
  return {
    date: d.toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' }),
    time: d.toLocaleTimeString('en-US', { hour:'2-digit', minute:'2-digit', hour12: true }),
  };
}

function getIndustryLabel(value: string) {
  return INDUSTRIES.find(i => i.value === value)?.label || value;
}

function NewProjectModal({ onClose }: { onClose: () => void }) {
  const router = useRouter(); const qc = useQueryClient();
  const [form, setForm] = useState({ name:'', industry:'', currency:'USD', description:'' });
  const [files, setFiles] = useState<File[]>([]); const [saving, setSaving] = useState(false);
  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop: f => setFiles(p => [...p,...f]), multiple: true });

  const handleCreate = async () => {
    if (!form.name.trim()) return toast.error('Project name is required');
    setSaving(true);
    try {
      const proj = await projectsApi.create(form) as any;
      if (files.length > 0) { toast.info(`Uploading ${files.length} file(s)…`); await filesApi.upload(proj.id, files); await projectsApi.update(proj.id, {}); }
      toast.success('Project created! AI analysis queued.');
      qc.invalidateQueries({ queryKey: ['projects'] });
      router.push(`/projects/${proj.id}`);
    } catch (e: any) { toast.error(e.message || 'Failed to create project'); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-lg font-semibold">New Project</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"><X size={18}/></button>
        </div>
        <div className="p-6 space-y-4">
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Project Name *</label>
            <input value={form.name} onChange={e => setForm(f => ({...f,name:e.target.value}))} placeholder="e.g. Steel Structure Phase 1"
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Industry</label>
              <select value={form.industry} onChange={e => setForm(f => ({...f,industry:e.target.value}))} className="w-full px-3 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none">
                <option value="">Select industry…</option>
                {INDUSTRIES.map(i => <option key={i.value} value={i.value}>{i.label}</option>)}
              </select></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
              <select value={form.currency} onChange={e => setForm(f => ({...f,currency:e.target.value}))} className="w-full px-3 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none">
                {['USD','EUR','GBP','AED','SAR','INR','PKR'].map(c => <option key={c}>{c}</option>)}
              </select></div>
          </div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea value={form.description} onChange={e => setForm(f => ({...f,description:e.target.value}))} rows={2} placeholder="Brief project description…" className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none resize-none"/></div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Upload Documents <span className="text-gray-400 font-normal">(optional — triggers AI analysis)</span>
            </label>
            <div {...getRootProps()} className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-colors ${isDragActive ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:border-blue-300'}`}>
              <input {...getInputProps()}/><Upload size={20} className="mx-auto text-gray-400 mb-1.5"/>
              <p className="text-sm text-gray-600">{isDragActive ? 'Drop files here' : 'Drag & drop or click to browse'}</p>
              <p className="text-xs text-gray-400 mt-1">PDF, Excel, Word, Images, CSV</p>
            </div>
            {files.length > 0 && <div className="mt-2 space-y-1">{files.map((f,i) => (
              <div key={i} className="flex items-center gap-2 text-xs text-gray-600 bg-gray-50 px-3 py-1.5 rounded-lg">
                <span className="flex-1 truncate">{f.name}</span>
                <button onClick={() => setFiles(fs => fs.filter((_,j) => j!==i))} className="text-gray-400 hover:text-red-500">✕</button>
              </div>
            ))}</div>}
          </div>
        </div>
        <div className="flex gap-3 p-6 border-t border-gray-100">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl border border-gray-300 text-sm font-medium hover:bg-gray-50">Cancel</button>
          <button onClick={handleCreate} disabled={saving} className="flex-1 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium flex items-center justify-center gap-2 disabled:bg-blue-400">
            {saving ? <><Loader2 size={14} className="animate-spin"/>Creating…</> : <><Plus size={14}/>Create Project</>}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ProjectsPage() {
  const router = useRouter(); const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState(''); const [status, setStatus] = useState(''); const [industry, setIndustry] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['projects', { search, status, industry, page }],
    queryFn: () => projectsApi.list({ search, status, industry, page, limit: 18 }),
  });
  const projects = (data as any)?.data || [];
  const total    = (data as any)?.total || 0;
  const pages    = (data as any)?.pages || 1;

  const cloneMut = useMutation({
    mutationFn: (id: string) => projectsApi.clone(id),
    onSuccess: (r: any) => { toast.success('Project cloned'); qc.invalidateQueries({ queryKey: ['projects'] }); router.push(`/projects/${r.id}`); },
  });

  return (
    <div className="p-6 max-w-screen-xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Projects</h1>
          <p className="text-sm text-gray-500 mt-0.5">{total} total</p>
        </div>
        <button onClick={() => setShowModal(true)} className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700">
          <Plus size={15}/>New Project
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-5 flex-wrap">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Search projects…"
            className="pl-9 pr-4 py-2 text-sm rounded-xl border border-gray-200 w-56 focus:outline-none focus:ring-1 focus:ring-blue-500"/>
        </div>
        <select value={status} onChange={e => { setStatus(e.target.value); setPage(1); }} className="text-sm px-3 py-2 rounded-xl border border-gray-200 focus:outline-none">
          <option value="">All statuses</option>
          {Object.entries(STATUS_LABELS).map(([v,l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select value={industry} onChange={e => { setIndustry(e.target.value); setPage(1); }} className="text-sm px-3 py-2 rounded-xl border border-gray-200 focus:outline-none">
          <option value="">All industries</option>
          {INDUSTRIES.map(i => <option key={i.value} value={i.value}>{i.label}</option>)}
        </select>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_,i) => <div key={i} className="bg-white rounded-xl border border-gray-200 h-48 animate-pulse"/>)}
        </div>
      ) : projects.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 py-24 text-center">
          <FolderOpen size={44} className="mx-auto text-gray-200 mb-3"/>
          <p className="text-gray-500 font-semibold">No projects found</p>
          <p className="text-xs text-gray-400 mt-1 mb-4">Create your first project to get started</p>
          <button onClick={() => setShowModal(true)} className="px-6 py-2.5 bg-blue-600 text-white text-sm rounded-xl hover:bg-blue-700 font-medium">
            Create First Project
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((p: any) => {
            const created  = formatDateTime(p.createdAt);
            const updated  = formatDateTime(p.updatedAt);
            return (
              <div key={p.id} onClick={() => router.push(`/projects/${p.id}`)}
                className="bg-white rounded-xl border border-gray-200 p-5 cursor-pointer hover:border-blue-300 hover:shadow-sm transition-all group">

                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="font-semibold text-gray-900 text-sm leading-snug group-hover:text-blue-700 line-clamp-2">{p.name}</h3>
                  <button onClick={e => { e.stopPropagation(); cloneMut.mutate(p.id); }}
                    className="p-1 rounded-lg opacity-0 group-hover:opacity-100 text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-all flex-shrink-0" title="Clone project">
                    <Copy size={13}/>
                  </button>
                </div>

                {p.client && <p className="text-xs text-gray-400 mb-2 truncate">{p.client.name}</p>}

                <div className="flex flex-wrap gap-1.5 mb-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${SC[p.status]||'bg-gray-100 text-gray-600'}`}>
                    {STATUS_LABELS[p.status] || p.status}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${AC[p.aiStatus]||'bg-gray-100 text-gray-500'}`}>
                    {p.aiStatus === 'processing' ? '⚡ AI Processing…' : `AI: ${p.aiStatus}`}
                  </span>
                  {p.industry && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-purple-50 text-purple-700">
                      {getIndustryLabel(p.industry)}
                    </span>
                  )}
                </div>

                {p.aiConfidence && (
                  <div className="mb-3">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-400">AI Confidence</span>
                      <span className="font-semibold text-gray-700">{p.aiConfidence}%</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${Number(p.aiConfidence)>=80?'bg-green-500':Number(p.aiConfidence)>=60?'bg-amber-500':'bg-red-400'}`}
                        style={{ width:`${p.aiConfidence}%` }}/>
                    </div>
                  </div>
                )}

                {/* Creation date & time */}
                <div className="pt-3 border-t border-gray-50 flex items-center justify-between">
                  <div className="flex items-center gap-1 text-xs text-gray-400">
                    <Calendar size={11}/>
                    <span>{created.date}</span>
                    <Clock size={11} className="ml-1"/>
                    <span>{created.time}</span>
                  </div>
                  {p.updatedAt !== p.createdAt && (
                    <span className="text-xs text-gray-300">Updated {updated.date}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {pages > 1 && (
        <div className="flex justify-center gap-1 mt-6">
          {Array.from({length:pages},(_,i)=>i+1).map(pg => (
            <button key={pg} onClick={() => setPage(pg)}
              className={`w-8 h-8 text-sm rounded-lg ${pg===page?'bg-blue-600 text-white':'border border-gray-200 hover:bg-gray-50'}`}>
              {pg}
            </button>
          ))}
        </div>
      )}

      {showModal && <NewProjectModal onClose={() => setShowModal(false)}/>}
    </div>
  );
}
