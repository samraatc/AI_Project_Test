'use client';
import { useState, useCallback, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useDropzone } from 'react-dropzone';
import { toast } from 'sonner';
import {
  ArrowLeft, Upload, Trash2, Download, Bot, FileText,
  Loader2, AlertTriangle, CheckCircle, RefreshCw,
  Edit3, Save, X, MoreVertical, Copy, Archive,
  FolderOpen, Calendar, DollarSign, MapPin, Tag,
} from 'lucide-react';
import { projectsApi, filesApi, estimationsApi, clientsApi } from '@/lib/api';

const AI_COLOR: Record<string, string> = {
  pending:    'bg-gray-100 text-gray-500',
  processing: 'bg-amber-100 text-amber-700',
  completed:  'bg-green-100 text-green-700',
  failed:     'bg-red-100 text-red-600',
};

const INDUSTRIES = [
  { value: 'construction',  label: 'Construction' },
  { value: 'oil_gas',       label: 'Oil & Gas' },
  { value: 'fabrication',   label: 'Fabrication' },
  { value: 'manufacturing', label: 'Manufacturing' },
  { value: 'epc',           label: 'EPC' },
  { value: 'civil',         label: 'Civil Engineering' },
  { value: 'mechanical',    label: 'Mechanical Engineering' },
  { value: 'electrical',    label: 'Electrical Engineering' },
  { value: 'other',         label: 'Other' },
];

const STATUSES = [
  { value: 'draft',     label: 'Draft' },
  { value: 'active',    label: 'Active' },
  { value: 'completed', label: 'Completed' },
  { value: 'archived',  label: 'Archived' },
];

// ── Edit Project Modal ────────────────────────────────────────
function EditProjectModal({ project, onClose, onSaved }: { project: any; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    name:            project.name            || '',
    industry:        project.industry        || '',
    currency:        project.currency        || 'USD',
    status:          project.status          || 'draft',
    description:     project.description     || '',
    location:        project.location        || '',
    referenceNumber: project.referenceNumber || '',
    deadline:        project.deadline ? project.deadline.slice(0, 10) : '',
    taxPct:          project.taxPct          || 0,
    profitMarginPct: project.profitMarginPct || 0,
    notes:           project.notes           || '',
  });
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.name.trim()) return toast.error('Project name is required');
    setSaving(true);
    try {
      await projectsApi.update(project.id, {
        ...form,
        taxPct:          Number(form.taxPct),
        profitMarginPct: Number(form.profitMarginPct),
        deadline:        form.deadline || null,
      });
      toast.success('Project updated successfully');
      onSaved();
      onClose();
    } catch (e: any) {
      toast.error(e.message || 'Failed to update project');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100 sticky top-0 bg-white z-10">
          <div className="flex items-center gap-2">
            <Edit3 size={18} className="text-blue-600"/>
            <h2 className="text-lg font-semibold text-gray-900">Edit Project</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
            <X size={18}/>
          </button>
        </div>

        {/* Form */}
        <div className="p-6 space-y-5">
          {/* Project Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Project Name *</label>
            <input
              value={form.name}
              onChange={e => set('name', e.target.value)}
              placeholder="e.g. Steel Structure Phase 1"
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Industry + Status */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Industry</label>
              <select value={form.industry} onChange={e => set('industry', e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Select industry…</option>
                {INDUSTRIES.map(i => <option key={i.value} value={i.value}>{i.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Status</label>
              <select value={form.status} onChange={e => set('status', e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
          </div>

          {/* Currency + Reference */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Currency</label>
              <select value={form.currency} onChange={e => set('currency', e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                {['USD','EUR','GBP','AED','SAR','INR','PKR'].map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Reference Number</label>
              <input value={form.referenceNumber} onChange={e => set('referenceNumber', e.target.value)}
                placeholder="e.g. PRJ-2026-001"
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/>
            </div>
          </div>

          {/* Location + Deadline */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Location</label>
              <input value={form.location} onChange={e => set('location', e.target.value)}
                placeholder="e.g. Dubai, UAE"
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Deadline</label>
              <input type="date" value={form.deadline} onChange={e => set('deadline', e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/>
            </div>
          </div>

          {/* Tax + Profit */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Tax Rate (%)</label>
              <input type="number" min="0" max="100" step="0.1"
                value={form.taxPct} onChange={e => set('taxPct', e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Profit Margin (%)</label>
              <input type="number" min="0" max="100" step="0.1"
                value={form.profitMarginPct} onChange={e => set('profitMarginPct', e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
            <textarea value={form.description} onChange={e => set('description', e.target.value)}
              rows={3} placeholder="Project description and scope of work…"
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"/>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Internal Notes</label>
            <textarea value={form.notes} onChange={e => set('notes', e.target.value)}
              rows={2} placeholder="Internal notes (not visible to clients)…"
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"/>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-6 border-t border-gray-100 sticky bottom-0 bg-white">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl border border-gray-300 text-sm font-medium hover:bg-gray-50">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium flex items-center justify-center gap-2 disabled:bg-blue-400">
            {saving ? <><Loader2 size={14} className="animate-spin"/>Saving…</> : <><Save size={14}/>Save Changes</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Delete Confirm Modal ──────────────────────────────────────
function DeleteConfirmModal({ projectName, onConfirm, onClose, loading }: {
  projectName: string; onConfirm: () => void; onClose: () => void; loading: boolean;
}) {
  const [typed, setTyped] = useState('');
  const match = typed === projectName;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="p-6">
          <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <Trash2 size={22} className="text-red-600"/>
          </div>
          <h2 className="text-lg font-semibold text-gray-900 text-center mb-1">Delete Project</h2>
          <p className="text-sm text-gray-500 text-center mb-5">
            This will permanently delete <strong>"{projectName}"</strong> and all its files, estimations, and quotations. This action cannot be undone.
          </p>
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-5">
            <p className="text-xs text-red-600 mb-2 font-medium">Type the project name to confirm:</p>
            <input
              value={typed}
              onChange={e => setTyped(e.target.value)}
              placeholder={projectName}
              className="w-full px-3 py-2 rounded-lg border border-red-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
            />
          </div>
          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl border border-gray-300 text-sm font-medium hover:bg-gray-50">
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={!match || loading}
              className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed">
              {loading ? <Loader2 size={14} className="animate-spin"/> : <Trash2 size={14}/>}
              Delete Project
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────
export default function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const router  = useRouter();
  const qc      = useQueryClient();

  const [uploading,    setUploading]    = useState(false);
  const [uploadPct,    setUploadPct]    = useState(0);
  const [showEdit,     setShowEdit]     = useState(false);
  const [showDelete,   setShowDelete]   = useState(false);
  const [showMenu,     setShowMenu]     = useState(false);

  const prevAiStatus = useRef<string | null>(null);
  const menuRef      = useRef<HTMLDivElement>(null);

  // Close menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowMenu(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ── Queries ──────────────────────────────────────────────────
  const { data: project, isLoading: projLoading } = useQuery({
    queryKey: ['project', projectId],
    queryFn:  () => projectsApi.getOne(projectId),
    refetchInterval: (query) => {
      const d = query.state.data as any;
      return d?.aiStatus === 'processing' ? 4000 : false;
    },
    retry: (count, err: any) => err?.status === 401 ? count < 2 : count < 1,
  });

  const proj     = project as any;
  const aiStatus = proj?.aiStatus || 'pending';

  useEffect(() => {
    if (prevAiStatus.current === 'processing' && aiStatus === 'completed') {
      qc.invalidateQueries({ queryKey: ['estimations', projectId] });
      qc.invalidateQueries({ queryKey: ['files',       projectId] });
      toast.success('AI analysis complete! Estimation is ready.');
    }
    prevAiStatus.current = aiStatus;
  }, [aiStatus, projectId, qc]);

  const { data: files }   = useQuery({ queryKey: ['files', projectId],       queryFn: () => filesApi.list(projectId) });
  const { data: estList } = useQuery({
    queryKey:        ['estimations', projectId],
    queryFn:         () => estimationsApi.list(projectId),
    refetchInterval: aiStatus === 'processing' ? 5000 : false,
    refetchOnWindowFocus: true,
  });

  const fileArr = (Array.isArray(files)   ? files   : []) as any[];
  const ests    = (Array.isArray(estList) ? estList : []) as any[];

  // ── Mutations ────────────────────────────────────────────────
  const deleteProjMut = useMutation({
    mutationFn: () => projectsApi.delete(projectId),
    onSuccess: () => {
      toast.success('Project deleted');
      qc.invalidateQueries({ queryKey: ['projects'] });
      router.push('/projects');
    },
    onError: (e: any) => toast.error(e.message || 'Failed to delete project'),
  });

  const cloneMut = useMutation({
    mutationFn: () => projectsApi.clone(projectId),
    onSuccess: (r: any) => {
      toast.success('Project cloned successfully');
      qc.invalidateQueries({ queryKey: ['projects'] });
      router.push(`/projects/${r.id}`);
    },
    onError: (e: any) => toast.error(e.message || 'Failed to clone project'),
  });

  const archiveMut = useMutation({
    mutationFn: () => projectsApi.update(projectId, { status: 'archived' }),
    onSuccess: () => {
      toast.success('Project archived');
      qc.invalidateQueries({ queryKey: ['project', projectId] });
      qc.invalidateQueries({ queryKey: ['projects'] });
    },
  });

  const analyzeMut = useMutation({
    mutationFn: () => estimationsApi.analyze(projectId),
    onSuccess: () => {
      toast.info('AI analysis started — this takes 1–3 minutes.');
      qc.invalidateQueries({ queryKey: ['project', projectId] });
    },
    onError: (e: any) => toast.error(e.message || 'Failed to start AI analysis'),
  });

  const deleteFileMut = useMutation({
    mutationFn: (id: string) => filesApi.delete(id),
    onSuccess:  () => { toast.success('File deleted'); qc.invalidateQueries({ queryKey: ['files', projectId] }); },
    onError:    (e: any) => toast.error(e.message),
  });

  const downloadFile = async (file: any) => {
    try {
      const res = await filesApi.getDownload(file.id) as any;
      const url = res?.url || res;
      if (url) window.open(url, '_blank');
    } catch { toast.error('Download failed'); }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: useCallback(async (accepted: File[]) => {
      if (!accepted.length) return;
      setUploading(true); setUploadPct(0);
      try {
        await filesApi.upload(projectId, accepted, p => setUploadPct(p));
        toast.success(`${accepted.length} file(s) uploaded — AI analysis queued.`);
        qc.invalidateQueries({ queryKey: ['files',   projectId] });
        qc.invalidateQueries({ queryKey: ['project', projectId] });
      } catch (e: any) { toast.error(e.message || 'Upload failed'); }
      finally { setUploading(false); }
    }, [projectId, qc]),
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'text/csv': ['.csv'],
      'image/*': ['.png', '.jpg', '.jpeg', '.tiff'],
    },
  });

  // ── Loading ──────────────────────────────────────────────────
  if (projLoading) return (
    <div className="p-6 space-y-4 max-w-screen-xl">
      <div className="h-8 bg-gray-200 rounded-xl animate-pulse w-72"/>
      <div className="grid grid-cols-2 gap-4">
        {[0,1].map(i => <div key={i} className="h-72 bg-gray-200 rounded-xl animate-pulse"/>)}
      </div>
    </div>
  );

  if (!proj) return (
    <div className="p-6 text-center">
      <AlertTriangle size={40} className="mx-auto text-gray-300 mb-3"/>
      <p className="text-gray-500">Project not found.</p>
      <button onClick={() => router.push('/projects')} className="mt-3 text-blue-600 hover:underline text-sm">← Back to Projects</button>
    </div>
  );

  const isProcessing = aiStatus === 'processing';
  const industryLabel = INDUSTRIES.find(i => i.value === proj.industry)?.label || proj.industry;

  return (
    <div className="p-6 max-w-screen-xl space-y-6">

      {/* ── Header ── */}
      <div className="flex items-center gap-3 flex-wrap">
        <button onClick={() => router.back()} className="p-2 rounded-xl hover:bg-gray-100 text-gray-500">
          <ArrowLeft size={18}/>
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold text-gray-900 truncate">{proj.name}</h1>
            {proj.referenceNumber && (
              <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-lg">{proj.referenceNumber}</span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-0.5 flex-wrap">
            {industryLabel && <span className="text-xs text-gray-500">{industryLabel}</span>}
            {proj.currency  && <span className="text-xs text-gray-400">· {proj.currency}</span>}
            {proj.location  && <span className="text-xs text-gray-400 flex items-center gap-1"><MapPin size={10}/>{proj.location}</span>}
            {proj.deadline  && <span className="text-xs text-gray-400 flex items-center gap-1"><Calendar size={10}/>Due {new Date(proj.deadline).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})}</span>}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* AI status badge */}
          <span className={`text-xs px-3 py-1.5 rounded-full font-medium ${AI_COLOR[aiStatus]}`}>
            {isProcessing && <Loader2 size={10} className="inline animate-spin mr-1"/>}
            {isProcessing ? 'AI Processing…' : `AI: ${aiStatus}`}
          </span>

          {/* Run AI */}
          {!isProcessing && fileArr.length > 0 && (
            <button onClick={() => analyzeMut.mutate()} disabled={analyzeMut.isPending}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-xl hover:bg-blue-700 disabled:bg-blue-400">
              {analyzeMut.isPending ? <Loader2 size={13} className="animate-spin"/> : <Bot size={13}/>}
              Run AI Analysis
            </button>
          )}
          {aiStatus === 'failed' && (
            <button onClick={() => analyzeMut.mutate()} disabled={analyzeMut.isPending}
              className="flex items-center gap-2 px-3 py-2 border border-red-200 text-red-600 text-sm rounded-xl hover:bg-red-50">
              <RefreshCw size={13}/> Retry
            </button>
          )}

          {/* Edit button */}
          <button onClick={() => setShowEdit(true)}
            className="flex items-center gap-2 px-3 py-2 border border-gray-300 text-gray-700 text-sm rounded-xl hover:bg-gray-50">
            <Edit3 size={14}/> Edit
          </button>

          {/* More menu */}
          <div className="relative" ref={menuRef}>
            <button onClick={() => setShowMenu(v => !v)}
              className="p-2 rounded-xl border border-gray-300 text-gray-500 hover:bg-gray-50">
              <MoreVertical size={16}/>
            </button>
            {showMenu && (
              <div className="absolute right-0 top-full mt-1 w-52 bg-white border border-gray-200 rounded-xl shadow-lg z-20 py-1 overflow-hidden">
                <button
                  onClick={() => { setShowMenu(false); cloneMut.mutate(); }}
                  className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 text-left">
                  <Copy size={14} className="text-gray-400"/> Clone Project
                </button>
                {proj.status !== 'archived' && (
                  <button
                    onClick={() => { setShowMenu(false); archiveMut.mutate(); }}
                    className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 text-left">
                    <Archive size={14} className="text-gray-400"/> Archive Project
                  </button>
                )}
                <div className="border-t border-gray-100 my-1"/>
                <button
                  onClick={() => { setShowMenu(false); setShowDelete(true); }}
                  className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 text-left">
                  <Trash2 size={14}/> Delete Project
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── AI Status Banners ── */}
      {aiStatus === 'completed' && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-start gap-3">
          <CheckCircle size={18} className="text-green-600 flex-shrink-0 mt-0.5"/>
          <div>
            <p className="text-sm font-semibold text-green-800">AI Analysis Complete — {proj.aiConfidence}% Confidence</p>
            {proj.aiSummary && <p className="text-xs text-green-600 mt-1 leading-relaxed line-clamp-2">{proj.aiSummary}</p>}
          </div>
        </div>
      )}
      {isProcessing && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3">
          <Loader2 size={18} className="text-amber-600 animate-spin flex-shrink-0"/>
          <div>
            <p className="text-sm font-semibold text-amber-800">AI Analysis in Progress</p>
            <p className="text-xs text-amber-600 mt-0.5">GPT-4o is reading your documents. This takes 1–3 minutes and updates automatically.</p>
          </div>
        </div>
      )}
      {aiStatus === 'failed' && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
          <AlertTriangle size={18} className="text-red-600 flex-shrink-0"/>
          <div>
            <p className="text-sm font-semibold text-red-700">AI Analysis Failed</p>
            <p className="text-xs text-red-500 mt-0.5">Check your OPENAI_API_KEY has credits, then click Retry.</p>
          </div>
        </div>
      )}

      {/* ── Project Details Card ── */}
      {(proj.description || proj.client || proj.taxPct || proj.profitMarginPct || proj.notes) && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Project Details</h3>
            <button onClick={() => setShowEdit(true)}
              className="text-xs text-blue-600 hover:underline flex items-center gap-1">
              <Edit3 size={11}/> Edit details
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            {proj.client?.name && (
              <div>
                <p className="text-xs text-gray-400 mb-1">Client</p>
                <p className="text-sm font-medium text-gray-700">{proj.client.name}</p>
              </div>
            )}
            {proj.referenceNumber && (
              <div>
                <p className="text-xs text-gray-400 mb-1">Reference</p>
                <p className="text-sm font-medium text-gray-700">{proj.referenceNumber}</p>
              </div>
            )}
            {proj.location && (
              <div>
                <p className="text-xs text-gray-400 mb-1">Location</p>
                <p className="text-sm text-gray-700">{proj.location}</p>
              </div>
            )}
            {proj.deadline && (
              <div>
                <p className="text-xs text-gray-400 mb-1">Deadline</p>
                <p className="text-sm text-gray-700">{new Date(proj.deadline).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})}</p>
              </div>
            )}
            {Number(proj.taxPct) > 0 && (
              <div>
                <p className="text-xs text-gray-400 mb-1">Tax Rate</p>
                <p className="text-sm text-gray-700">{proj.taxPct}%</p>
              </div>
            )}
            {Number(proj.profitMarginPct) > 0 && (
              <div>
                <p className="text-xs text-gray-400 mb-1">Profit Margin</p>
                <p className="text-sm text-gray-700">{proj.profitMarginPct}%</p>
              </div>
            )}
          </div>
          {proj.description && (
            <div className="border-t border-gray-50 pt-4">
              <p className="text-xs text-gray-400 mb-1">Description</p>
              <p className="text-sm text-gray-600 leading-relaxed">{proj.description}</p>
            </div>
          )}
          {proj.notes && (
            <div className="border-t border-gray-50 pt-3 mt-3">
              <p className="text-xs text-gray-400 mb-1">Internal Notes</p>
              <p className="text-sm text-gray-500 italic leading-relaxed">{proj.notes}</p>
            </div>
          )}
        </div>
      )}

      {/* ── Main Grid: Files + Estimations ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Files */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-4">
            Project Files
            <span className="ml-2 text-xs font-normal text-gray-400">({fileArr.length} file{fileArr.length !== 1 ? 's' : ''})</span>
          </h3>
          <div {...getRootProps()} className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all mb-4 ${isDragActive ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'}`}>
            <input {...getInputProps()}/>
            {uploading ? (
              <div>
                <Loader2 size={22} className="mx-auto text-blue-600 animate-spin mb-2"/>
                <p className="text-sm text-blue-600 font-medium">Uploading… {uploadPct}%</p>
                <div className="mt-2 h-1.5 bg-blue-100 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${uploadPct}%` }}/>
                </div>
              </div>
            ) : (
              <div>
                <Upload size={22} className="mx-auto text-gray-400 mb-2"/>
                <p className="text-sm text-gray-600 font-medium">{isDragActive ? 'Drop files here' : 'Drag & drop or click to upload'}</p>
                <p className="text-xs text-gray-400 mt-1">PDF, Excel, Word, Images, CSV</p>
              </div>
            )}
          </div>
          {fileArr.length === 0 ? (
            <div className="text-center py-8">
              <FileText size={36} className="mx-auto text-gray-200 mb-2"/>
              <p className="text-sm text-gray-400">No files yet — upload to enable AI analysis</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {fileArr.map((f: any) => (
                <div key={f.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl group">
                  <FileText size={14} className="text-gray-400 flex-shrink-0"/>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-700 font-medium truncate">{f.originalName}</p>
                    <p className="text-xs text-gray-400">
                      {f.fileType?.toUpperCase()} ·{' '}
                      <span className={f.ocrStatus==='done'?'text-green-600':f.ocrStatus==='processing'?'text-amber-600':'text-gray-400'}>
                        {f.ocrStatus==='done'?'✓ Processed':f.ocrStatus==='processing'?'⚡ Processing…':'Pending'}
                      </span>
                    </p>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => downloadFile(f)} title="Download" className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"><Download size={13}/></button>
                    <button onClick={() => { if (confirm('Delete this file?')) deleteFileMut.mutate(f.id); }} title="Delete" className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={13}/></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Estimations */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">
              Estimations <span className="text-xs font-normal text-gray-400">({ests.length})</span>
            </h3>
            <button onClick={() => qc.invalidateQueries({ queryKey: ['estimations', projectId] })}
              className="p-1.5 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-blue-50" title="Refresh">
              <RefreshCw size={13}/>
            </button>
          </div>
          {ests.length === 0 ? (
            <div className="text-center py-10">
              <Bot size={36} className="mx-auto text-gray-200 mb-3"/>
              <p className="text-sm text-gray-500 font-medium">{isProcessing ? 'Generating estimation…' : 'No estimations yet'}</p>
              <p className="text-xs text-gray-400 mt-1 max-w-[220px] mx-auto">
                {fileArr.length === 0 ? 'Upload documents then click Run AI Analysis'
                  : isProcessing ? 'The estimation will appear here automatically'
                  : 'Click Run AI Analysis to generate a cost estimation'}
              </p>
              {isProcessing && (
                <div className="mt-4 flex justify-center gap-1">
                  {[0,1,2].map(i => <div key={i} className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay:`${i*0.15}s`}}/>)}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {ests.map((e: any) => (
                <div key={e.id} onClick={() => router.push(`/projects/${projectId}/estimations/${e.id}`)}
                  className="flex items-center gap-3 p-3 bg-gray-50 hover:bg-blue-50 border border-transparent hover:border-blue-200 rounded-xl cursor-pointer transition-all group">
                  <FileText size={15} className="text-blue-500 flex-shrink-0"/>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 group-hover:text-blue-700 truncate">{e.title}</p>
                    <p className="text-xs text-gray-400">v{e.versionNumber} · {e.currency} {Number(e.finalTotal||0).toLocaleString()}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${e.status==='approved'?'bg-green-100 text-green-700':e.status==='locked'?'bg-amber-100 text-amber-700':e.status==='under_review'?'bg-blue-100 text-blue-700':'bg-gray-100 text-gray-600'}`}>
                      {e.status}
                    </span>
                    {e.aiConfidence && <p className="text-xs text-gray-400 mt-0.5">{e.aiConfidence}% conf</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Modals ── */}
      {showEdit && (
        <EditProjectModal
          project={proj}
          onClose={() => setShowEdit(false)}
          onSaved={() => qc.invalidateQueries({ queryKey: ['project', projectId] })}
        />
      )}
      {showDelete && (
        <DeleteConfirmModal
          projectName={proj.name}
          onClose={() => setShowDelete(false)}
          onConfirm={() => deleteProjMut.mutate()}
          loading={deleteProjMut.isPending}
        />
      )}
    </div>
  );
}
