'use client';
import { useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useDropzone } from 'react-dropzone';
import { toast } from 'sonner';
import { ArrowLeft, Upload, Trash2, Download, Bot, FileText, Loader2, AlertTriangle, CheckCircle } from 'lucide-react';
import { projectsApi, filesApi, estimationsApi } from '@/lib/api';

export default function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const router = useRouter(); const qc = useQueryClient();
  const [uploading, setUploading] = useState(false); const [uploadPct, setUploadPct] = useState(0);

  const { data: project, isLoading: projLoading } = useQuery({ queryKey: ['project', projectId], queryFn: () => projectsApi.getOne(projectId), refetchInterval: (d: any) => d?.aiStatus === 'processing' ? 3000 : false });
  const { data: files }  = useQuery({ queryKey: ['files', projectId],       queryFn: () => filesApi.list(projectId) });
  const { data: estList } = useQuery({ queryKey: ['estimations', projectId], queryFn: () => estimationsApi.list(projectId) });

  const proj = project as any;
  const fileArr = (files as any[]) || [];
  const ests   = (estList as any[]) || [];

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: useCallback(async (accepted: File[]) => {
      if (!accepted.length) return;
      setUploading(true); setUploadPct(0);
      try {
        await filesApi.upload(projectId, accepted, p => setUploadPct(p));
        toast.success(`${accepted.length} file(s) uploaded. AI analysis queued.`);
        qc.invalidateQueries({ queryKey: ['files', projectId] });
        qc.invalidateQueries({ queryKey: ['project', projectId] });
      } catch (e: any) { toast.error(e.message); }
      finally { setUploading(false); }
    }, [projectId, qc]),
  });

  const analyzeMut = useMutation({
    mutationFn: () => estimationsApi.analyze(projectId),
    onSuccess: () => { toast.success('AI analysis started!'); qc.invalidateQueries({ queryKey: ['project', projectId] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (fileId: string) => filesApi.delete(fileId),
    onSuccess: () => { toast.success('File deleted'); qc.invalidateQueries({ queryKey: ['files', projectId] }); },
  });

  if (projLoading) return <div className="p-6"><div className="h-8 bg-gray-200 rounded animate-pulse w-64"/></div>;
  if (!proj) return <div className="p-6 text-gray-500">Project not found</div>;

  const AI_COLORS: Record<string,string> = { pending:'bg-gray-100 text-gray-500', processing:'bg-amber-100 text-amber-700', completed:'bg-green-100 text-green-700', failed:'bg-red-100 text-red-600' };

  return (
    <div className="p-6 max-w-screen-xl space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="p-2 rounded-xl hover:bg-gray-100 text-gray-500"><ArrowLeft size={18}/></button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-900">{proj.name}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{proj.industry || 'N/A'} · {proj.currency}</p>
        </div>
        <div className="flex gap-2">
          <span className={`text-xs px-3 py-1 rounded-full font-medium ${AI_COLORS[proj.aiStatus]||'bg-gray-100 text-gray-500'}`}>{proj.aiStatus==='processing' ? '⚡ AI Processing…' : `AI: ${proj.aiStatus}`}</span>
          {proj.aiStatus !== 'processing' && fileArr.length > 0 && (
            <button onClick={() => analyzeMut.mutate()} disabled={analyzeMut.isPending} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-xl hover:bg-blue-700 disabled:bg-blue-400">
              {analyzeMut.isPending ? <Loader2 size={13} className="animate-spin"/> : <Bot size={13}/>} Run AI Analysis
            </button>
          )}
        </div>
      </div>

      {proj.aiStatus === 'completed' && proj.aiConfidence && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
          <CheckCircle size={18} className="text-green-600 flex-shrink-0"/>
          <div><p className="text-sm font-medium text-green-800">AI Analysis Complete — {proj.aiConfidence}% Confidence</p><p className="text-xs text-green-600 mt-0.5">{proj.aiSummary?.substring(0,150)}{proj.aiSummary?.length>150?'…':''}</p></div>
        </div>
      )}
      {proj.aiStatus === 'failed' && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
          <AlertTriangle size={18} className="text-red-600 flex-shrink-0"/>
          <p className="text-sm text-red-700">AI analysis failed. Upload documents and try again.</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* File Upload */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Project Files</h3>
          <div {...getRootProps()} className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors mb-4 ${isDragActive ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:border-blue-300'}`}>
            <input {...getInputProps()}/>
            {uploading ? (<><Loader2 size={20} className="mx-auto text-blue-600 animate-spin mb-2"/><p className="text-sm text-blue-600">Uploading… {uploadPct}%</p></>) : (<><Upload size={20} className="mx-auto text-gray-400 mb-1.5"/><p className="text-sm text-gray-600">Drop files or click to upload</p><p className="text-xs text-gray-400 mt-1">PDF, Excel, Word, Images, CSV</p></>)}
          </div>
          {fileArr.length === 0 ? <p className="text-sm text-gray-400 text-center py-4">No files yet</p> : (
            <div className="space-y-2">
              {fileArr.map((f: any) => (
                <div key={f.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                  <FileText size={15} className="text-gray-400 flex-shrink-0"/>
                  <div className="flex-1 min-w-0"><p className="text-sm text-gray-700 truncate">{f.originalName}</p>
                    <p className="text-xs text-gray-400">{f.fileType} · {f.ocrStatus}</p></div>
                  <div className="flex gap-1">
                    <button onClick={async () => { const u = await filesApi.getDownload(f.id) as any; window.open(u.url||u,'_blank'); }} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"><Download size={14}/></button>
                    <button onClick={() => { if(confirm('Delete file?')) deleteMut.mutate(f.id); }} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={14}/></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Estimations */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Estimations</h3>
          </div>
          {ests.length === 0 ? (
            <div className="text-center py-8">
              <FileText size={32} className="mx-auto text-gray-200 mb-2"/>
              <p className="text-sm text-gray-500">No estimations yet</p>
              <p className="text-xs text-gray-400 mt-1">Upload documents and run AI analysis to generate estimations</p>
            </div>
          ) : (
            <div className="space-y-2">
              {ests.map((e: any) => (
                <div key={e.id} onClick={() => router.push(`/projects/${projectId}/estimations/${e.id}`)}
                  className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl cursor-pointer hover:bg-blue-50 hover:border-blue-200 border border-transparent transition-all">
                  <FileText size={15} className="text-blue-500 flex-shrink-0"/>
                  <div className="flex-1"><p className="text-sm font-medium text-gray-800">{e.title}</p><p className="text-xs text-gray-500">v{e.versionNumber} · {e.currency} {Number(e.finalTotal||0).toLocaleString()}</p></div>
                  <div className="text-right"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${e.status==='approved'?'bg-green-100 text-green-700':e.status==='draft'?'bg-gray-100 text-gray-600':'bg-amber-100 text-amber-700'}`}>{e.status}</span>
                    {e.aiConfidence && <p className="text-xs text-gray-400 mt-1">{e.aiConfidence}% conf</p>}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
