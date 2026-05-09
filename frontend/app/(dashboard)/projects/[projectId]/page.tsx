'use client';
import { useState, useCallback, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useDropzone } from 'react-dropzone';
import { toast } from 'sonner';
import {
  ArrowLeft, Upload, Trash2, Download, Bot, FileText,
  Loader2, AlertTriangle, CheckCircle, RefreshCw,
} from 'lucide-react';
import { projectsApi, filesApi, estimationsApi } from '@/lib/api';

const AI_COLOR: Record<string, string> = {
  pending:    'bg-gray-100 text-gray-500',
  processing: 'bg-amber-100 text-amber-700',
  completed:  'bg-green-100 text-green-700',
  failed:     'bg-red-100 text-red-600',
};

export default function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const router  = useRouter();
  const qc      = useQueryClient();

  const [uploading,  setUploading]  = useState(false);
  const [uploadPct,  setUploadPct]  = useState(0);

  // Track previous aiStatus so we can detect transition to 'completed'
  const prevAiStatus = useRef<string | null>(null);

  // ── Project query — polls every 4s while AI is running ──────
  const { data: project, isLoading: projLoading } = useQuery({
    queryKey: ['project', projectId],
    queryFn:  () => projectsApi.getOne(projectId),
    refetchInterval: (query) => {
      const d = query.state.data as any;
      return d?.aiStatus === 'processing' ? 4000 : false;
    },
    retry: (count, err: any) => err?.status === 401 ? count < 2 : count < 1,
  });

  const proj      = project as any;
  const aiStatus  = proj?.aiStatus || 'pending';

  // ── When AI transitions to 'completed' → force re-fetch estimations ─
  useEffect(() => {
    if (
      prevAiStatus.current === 'processing' &&
      aiStatus === 'completed'
    ) {
      // AI just finished — invalidate everything
      qc.invalidateQueries({ queryKey: ['estimations', projectId] });
      qc.invalidateQueries({ queryKey: ['files',       projectId] });
      toast.success('AI analysis complete! Estimation is ready.');
    }
    prevAiStatus.current = aiStatus;
  }, [aiStatus, projectId, qc]);

  // ── Files query ──────────────────────────────────────────────
  const { data: files } = useQuery({
    queryKey: ['files', projectId],
    queryFn:  () => filesApi.list(projectId),
  });

  // ── Estimations query — also polls during AI processing ─────
  const { data: estList } = useQuery({
    queryKey: ['estimations', projectId],
    queryFn:  () => estimationsApi.list(projectId),
    // Poll every 5s while AI is processing so estimations appear automatically
    refetchInterval: aiStatus === 'processing' ? 5000 : false,
    // Refetch when window regains focus
    refetchOnWindowFocus: true,
  });

  const fileArr = (Array.isArray(files)   ? files   : []) as any[];
  const ests    = (Array.isArray(estList) ? estList : []) as any[];

  // ── File upload ──────────────────────────────────────────────
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: useCallback(async (accepted: File[]) => {
      if (!accepted.length) return;
      setUploading(true); setUploadPct(0);
      try {
        await filesApi.upload(projectId, accepted, p => setUploadPct(p));
        toast.success(`${accepted.length} file(s) uploaded — AI analysis queued.`);
        qc.invalidateQueries({ queryKey: ['files',   projectId] });
        qc.invalidateQueries({ queryKey: ['project', projectId] });
      } catch (e: any) {
        toast.error(e.message || 'Upload failed');
      } finally {
        setUploading(false);
      }
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

  // ── AI analysis ──────────────────────────────────────────────
  const analyzeMut = useMutation({
    mutationFn: () => estimationsApi.analyze(projectId),
    onSuccess: () => {
      toast.info('AI analysis started — this takes 1–3 minutes.');
      qc.invalidateQueries({ queryKey: ['project', projectId] });
    },
    onError: (e: any) => toast.error(e.message || 'Failed to start AI analysis'),
  });

  // ── File actions ─────────────────────────────────────────────
  const deleteMut = useMutation({
    mutationFn: (id: string) => filesApi.delete(id),
    onSuccess:  () => {
      toast.success('File deleted');
      qc.invalidateQueries({ queryKey: ['files', projectId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const downloadFile = async (file: any) => {
    try {
      const res = await filesApi.getDownload(file.id) as any;
      const url = res?.url || res;
      if (url) window.open(url, '_blank');
    } catch { toast.error('Download failed'); }
  };

  // ── Loading ──────────────────────────────────────────────────
  if (projLoading) {
    return (
      <div className="p-6 space-y-4 max-w-screen-xl">
        <div className="h-8 bg-gray-200 rounded-xl animate-pulse w-72"/>
        <div className="grid grid-cols-2 gap-4">
          {[0,1].map(i => <div key={i} className="h-72 bg-gray-200 rounded-xl animate-pulse"/>)}
        </div>
      </div>
    );
  }

  if (!proj) {
    return (
      <div className="p-6 text-center">
        <AlertTriangle size={40} className="mx-auto text-gray-300 mb-3"/>
        <p className="text-gray-500">Project not found.</p>
        <button onClick={() => router.push('/projects')} className="mt-3 text-blue-600 hover:underline text-sm">
          ← Back to Projects
        </button>
      </div>
    );
  }

  const isProcessing = aiStatus === 'processing';

  return (
    <div className="p-6 max-w-screen-xl space-y-6">

      {/* ── Header ── */}
      <div className="flex items-center gap-3 flex-wrap">
        <button onClick={() => router.back()} className="p-2 rounded-xl hover:bg-gray-100 text-gray-500">
          <ArrowLeft size={18}/>
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-gray-900 truncate">{proj.name}</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {[proj.industry, proj.currency, proj.status].filter(Boolean).join(' · ')}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className={`text-xs px-3 py-1.5 rounded-full font-medium ${AI_COLOR[aiStatus]}`}>
            {isProcessing && <Loader2 size={10} className="inline animate-spin mr-1"/>}
            {isProcessing ? 'AI Processing…' : `AI: ${aiStatus}`}
          </span>
          {!isProcessing && fileArr.length > 0 && (
            <button
              onClick={() => analyzeMut.mutate()}
              disabled={analyzeMut.isPending}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-xl hover:bg-blue-700 disabled:bg-blue-400 transition-colors"
            >
              {analyzeMut.isPending
                ? <><Loader2 size={13} className="animate-spin"/> Starting…</>
                : <><Bot size={13}/> Run AI Analysis</>
              }
            </button>
          )}
          {aiStatus === 'failed' && (
            <button
              onClick={() => analyzeMut.mutate()}
              disabled={analyzeMut.isPending}
              className="flex items-center gap-2 px-3 py-2 border border-red-200 text-red-600 text-sm rounded-xl hover:bg-red-50"
            >
              <RefreshCw size={13}/> Retry
            </button>
          )}
        </div>
      </div>

      {/* ── AI Status Banners ── */}
      {aiStatus === 'completed' && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-start gap-3">
          <CheckCircle size={18} className="text-green-600 flex-shrink-0 mt-0.5"/>
          <div>
            <p className="text-sm font-semibold text-green-800">
              AI Analysis Complete — {proj.aiConfidence}% Confidence
            </p>
            {proj.aiSummary && (
              <p className="text-xs text-green-600 mt-1 leading-relaxed line-clamp-2">
                {proj.aiSummary}
              </p>
            )}
          </div>
        </div>
      )}

      {isProcessing && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3">
          <Loader2 size={18} className="text-amber-600 animate-spin flex-shrink-0"/>
          <div>
            <p className="text-sm font-semibold text-amber-800">AI Analysis in Progress</p>
            <p className="text-xs text-amber-600 mt-0.5">
              GPT-4o is reading your documents and generating estimations. This takes 1–3 minutes.
              This page will update automatically when complete.
            </p>
          </div>
        </div>
      )}

      {aiStatus === 'failed' && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
          <AlertTriangle size={18} className="text-red-600 flex-shrink-0"/>
          <div>
            <p className="text-sm font-semibold text-red-700">AI Analysis Failed</p>
            <p className="text-xs text-red-500 mt-0.5">
              Ensure your OPENAI_API_KEY is valid and has credits. Then click Retry.
            </p>
          </div>
        </div>
      )}

      {/* ── Main Grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Files */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-4">
            Project Files
            <span className="ml-2 text-xs font-normal text-gray-400">
              ({fileArr.length} file{fileArr.length !== 1 ? 's' : ''})
            </span>
          </h3>

          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all mb-4 ${
              isDragActive ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
            }`}
          >
            <input {...getInputProps()}/>
            {uploading ? (
              <div>
                <Loader2 size={22} className="mx-auto text-blue-600 animate-spin mb-2"/>
                <p className="text-sm text-blue-600 font-medium">Uploading… {uploadPct}%</p>
                <div className="mt-2 h-1.5 bg-blue-100 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 rounded-full transition-all duration-300" style={{ width: `${uploadPct}%` }}/>
                </div>
              </div>
            ) : (
              <div>
                <Upload size={22} className="mx-auto text-gray-400 mb-2"/>
                <p className="text-sm text-gray-600 font-medium">
                  {isDragActive ? 'Drop files here' : 'Drag & drop or click to upload'}
                </p>
                <p className="text-xs text-gray-400 mt-1">PDF, Excel, Word, Images, CSV</p>
              </div>
            )}
          </div>

          {fileArr.length === 0 ? (
            <div className="text-center py-8">
              <FileText size={36} className="mx-auto text-gray-200 mb-2"/>
              <p className="text-sm text-gray-400">No files yet — upload to enable AI</p>
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
                      <span className={
                        f.ocrStatus === 'done'       ? 'text-green-600' :
                        f.ocrStatus === 'processing' ? 'text-amber-600' :
                        'text-gray-400'
                      }>
                        {f.ocrStatus === 'done' ? '✓ Processed' :
                         f.ocrStatus === 'processing' ? '⚡ Processing…' : 'Pending'}
                      </span>
                    </p>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => downloadFile(f)} title="Download"
                      className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg">
                      <Download size={13}/>
                    </button>
                    <button onClick={() => { if (confirm('Delete?')) deleteMut.mutate(f.id); }} title="Delete"
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                      <Trash2 size={13}/>
                    </button>
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
              Estimations
              <span className="ml-2 text-xs font-normal text-gray-400">({ests.length})</span>
            </h3>
            <button
              onClick={() => qc.invalidateQueries({ queryKey: ['estimations', projectId] })}
              className="p-1.5 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 transition-colors"
              title="Refresh"
            >
              <RefreshCw size={13}/>
            </button>
          </div>

          {ests.length === 0 ? (
            <div className="text-center py-10">
              <Bot size={36} className="mx-auto text-gray-200 mb-3"/>
              <p className="text-sm text-gray-500 font-medium">
                {isProcessing ? 'Generating estimation…' : 'No estimations yet'}
              </p>
              <p className="text-xs text-gray-400 mt-1 max-w-[220px] mx-auto">
                {fileArr.length === 0
                  ? 'Upload documents then click Run AI Analysis'
                  : isProcessing
                  ? 'The estimation will appear here automatically when AI completes'
                  : 'Click Run AI Analysis to generate an AI-powered cost estimation'
                }
              </p>
              {isProcessing && (
                <div className="mt-4 flex justify-center gap-1">
                  {[0,1,2].map(i => (
                    <div key={i} className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"
                      style={{ animationDelay: `${i * 0.15}s` }}/>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {ests.map((e: any) => (
                <div
                  key={e.id}
                  onClick={() => router.push(`/projects/${projectId}/estimations/${e.id}`)}
                  className="flex items-center gap-3 p-3 bg-gray-50 hover:bg-blue-50 border border-transparent hover:border-blue-200 rounded-xl cursor-pointer transition-all group"
                >
                  <FileText size={15} className="text-blue-500 flex-shrink-0"/>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 group-hover:text-blue-700 truncate">
                      {e.title}
                    </p>
                    <p className="text-xs text-gray-400">
                      v{e.versionNumber} · {e.currency}{' '}
                      {Number(e.finalTotal || 0).toLocaleString()}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      e.status === 'approved'     ? 'bg-green-100 text-green-700' :
                      e.status === 'locked'       ? 'bg-amber-100 text-amber-700' :
                      e.status === 'under_review' ? 'bg-blue-100 text-blue-700'  :
                      'bg-gray-100 text-gray-600'
                    }`}>{e.status}</span>
                    {e.aiConfidence && (
                      <p className="text-xs text-gray-400 mt-0.5">{e.aiConfidence}% conf</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Project meta */}
      {(proj.description || proj.location || proj.referenceNumber || proj.client) && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Project Details</h3>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {proj.referenceNumber && (
              <div><p className="text-xs text-gray-400 mb-1">Reference</p><p className="text-sm font-medium text-gray-700">{proj.referenceNumber}</p></div>
            )}
            {proj.location && (
              <div><p className="text-xs text-gray-400 mb-1">Location</p><p className="text-sm text-gray-700">{proj.location}</p></div>
            )}
            {proj.client?.name && (
              <div><p className="text-xs text-gray-400 mb-1">Client</p><p className="text-sm text-gray-700">{proj.client.name}</p></div>
            )}
            {proj.deadline && (
              <div><p className="text-xs text-gray-400 mb-1">Deadline</p><p className="text-sm text-gray-700">{new Date(proj.deadline).toLocaleDateString()}</p></div>
            )}
          </div>
          {proj.description && (
            <div className="mt-4 pt-4 border-t border-gray-50">
              <p className="text-xs text-gray-400 mb-1">Description</p>
              <p className="text-sm text-gray-600 leading-relaxed">{proj.description}</p>
            </div>
          )}
        </div>
      )}

    </div>
  );
}
