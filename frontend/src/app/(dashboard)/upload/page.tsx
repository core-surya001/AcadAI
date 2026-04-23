'use client';

import { useEffect, useState, useRef } from 'react';
import { getUploadPreview, uploadFile, type PreviewRow } from '@/lib/api';

interface UploadItem {
  id: string;
  name: string;
  size: string;
  progress: number;
  status: 'uploading' | 'done' | 'error';
}

export default function UploadPage() {
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [preview, setPreview] = useState<PreviewRow[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'upload' | 'connect'>('upload');
  const [sheetUrl, setSheetUrl] = useState('');
  const [connecting, setConnecting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const filteredPreview = preview.filter(
    (r) => r.name.toLowerCase().includes(search.toLowerCase()) || r.id.toLowerCase().includes(search.toLowerCase())
  );

  const handleFiles = (files: FileList | null) => {
    if (!files || !files.length) return;
    const file = files[0];
    const id = `upload-${Date.now()}`;
    const item: UploadItem = { id, name: file.name, size: formatSize(file.size), progress: 0, status: 'uploading' };
    setUploads((u) => [item, ...u]);

    // Simulate progress
    let p = 0;
    const interval = setInterval(() => {
      p = Math.min(p + Math.random() * 15, 100);
      setUploads((u) => u.map((u2) => u2.id === id ? { ...u2, progress: Math.round(p) } : u2));
      if (p >= 100) {
        clearInterval(interval);
        setUploads((u) => u.map((u2) => u2.id === id ? { ...u2, status: 'done', progress: 100 } : u2));
        // Load preview
        setPreviewLoading(true);
        getUploadPreview().then((rows) => { setPreview(rows); setPreviewLoading(false); });
      }
    }, 400);

    uploadFile(file).catch(() => {
      clearInterval(interval);
      setUploads((u) => u.map((u2) => u2.id === id ? { ...u2, status: 'error' } : u2));
    });
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const removeUpload = (id: string) => setUploads((u) => u.filter((u2) => u2.id !== id));

  // Auto-load preview on mount for demo
  useEffect(() => {
    setPreviewLoading(true);
    getUploadPreview().then((rows) => { setPreview(rows); setPreviewLoading(false); });
  }, []);

  return (
    <div className="animate-fade-in-up">
      <div className="flex justify-between items-center mb-10">
        <div>
          <h2 className="text-3xl font-bold text-slate-800 tracking-tight">Upload Data</h2>
          <p className="text-slate-500 mt-1">Import student records into the AcadAI ecosystem</p>
        </div>
        <button className="px-6 py-2.5 neo-raised rounded-xl flex items-center gap-2 text-indigo-600 font-semibold hover:neo-inset transition-all active:scale-95">
          <span className="material-symbols-outlined">help</span>Guide
        </button>
      </div>

      <div className="grid grid-cols-12 gap-8">
        {/* Upload zone */}
        <section className="col-span-12 lg:col-span-7">
          <div className="p-8 rounded-xl neo-raised bg-[#e8eaf0]">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold text-slate-800">Data Import</h3>
              <div className="flex bg-[#e2e4ea] rounded-xl p-1 neo-inset">
                <button
                  onClick={() => setActiveTab('upload')}
                  className={`px-4 py-1.5 text-sm font-bold rounded-lg transition-all ${activeTab === 'upload' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  File Upload
                </button>
                <button
                  onClick={() => setActiveTab('connect')}
                  className={`px-4 py-1.5 text-sm font-bold rounded-lg transition-all ${activeTab === 'connect' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  Live Connect
                </button>
              </div>
            </div>

            {activeTab === 'upload' ? (
              <>
                {/* Drop zone */}
                <div
                  onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={(e) => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files); }}
                  onClick={() => fileRef.current?.click()}
                  className={`neo-inset rounded-xl border-2 border-dashed p-12 flex flex-col items-center justify-center text-center cursor-pointer transition-colors ${dragging ? 'border-indigo-400 bg-indigo-50/30' : 'border-slate-300 hover:bg-[#e2e4ea]'}`}
                >
                  <div className="w-20 h-20 rounded-full neo-raised bg-[#e8eaf0] flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                    <span className="material-symbols-outlined text-indigo-600 text-4xl">cloud_upload</span>
                  </div>
                  <p className="text-lg font-semibold text-slate-700 mb-2">Drag & drop files here</p>
                  <p className="text-sm text-slate-500 mb-6">or click to browse your computer</p>
                  <button
                    type="button"
                    className="px-8 py-3 rounded-xl bg-indigo-600 text-white font-bold neo-raised hover:opacity-90 active:scale-95 transition-all"
                    onClick={(e) => { e.stopPropagation(); fileRef.current?.click(); }}
                  >
                    Choose Files
                  </button>
                  <input ref={fileRef} type="file" accept=".csv,.xlsx" className="hidden" onChange={(e) => handleFiles(e.target.files)} />
                </div>

                {/* Upload items */}
                {uploads.length > 0 && (
                  <div className="mt-8 space-y-4">
                    {uploads.map((u) => (
                      <div key={u.id} className="p-4 rounded-xl neo-raised bg-[#e8eaf0] flex items-center gap-4">
                        <div className="w-12 h-12 rounded-lg neo-inset flex items-center justify-center bg-[#e8eaf0]">
                          <span className="material-symbols-outlined text-slate-500">description</span>
                        </div>
                        <div className="flex-1">
                          <div className="flex justify-between items-end mb-2">
                            <div>
                              <p className="text-sm font-semibold text-slate-700">{u.name}</p>
                              <p className="text-[10px] text-slate-500">{u.size} • {u.progress}% {u.status === 'uploading' ? 'uploaded' : u.status}</p>
                            </div>
                            <span className={`text-xs font-bold ${u.status === 'done' ? 'text-emerald-600' : u.status === 'error' ? 'text-red-500' : 'text-indigo-600'}`}>
                              {u.status === 'done' ? '✓ Done' : u.status === 'error' ? '✗ Error' : 'Uploading…'}
                            </span>
                          </div>
                          <div className="h-2 w-full neo-inset rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-300 ${u.status === 'error' ? 'bg-red-500' : 'bg-indigo-500'}`}
                              style={{ width: `${u.progress}%` }}
                            />
                          </div>
                        </div>
                        <button onClick={() => removeUpload(u.id)} className="w-8 h-8 rounded-full neo-raised flex items-center justify-center text-red-400 hover:neo-inset transition-all">
                          <span className="material-symbols-outlined text-sm">close</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="py-6 animate-fade-in">
                <div className="mb-8 flex flex-col items-center justify-center text-center">
                  <div className="w-20 h-20 rounded-full neo-inset bg-[#e8eaf0] flex items-center justify-center mb-5">
                    <span className="material-symbols-outlined text-emerald-600 text-4xl">link</span>
                  </div>
                  <p className="text-xl font-bold text-slate-800 mb-2">Connect Live Spreadsheet</p>
                  <p className="text-sm text-slate-500 max-w-sm">
                    Paste your Excel Online or Google Sheets URL below. Any changes made in your spreadsheet will automatically sync.
                  </p>
                </div>
                
                <div className="flex flex-col gap-4">
                  <div className="neo-inset rounded-xl px-4 py-3 flex items-center gap-3 w-full">
                    <span className="material-symbols-outlined text-slate-400">link</span>
                    <input 
                      type="url" 
                      value={sheetUrl}
                      onChange={(e) => setSheetUrl(e.target.value)}
                      placeholder="https://docs.google.com/spreadsheets/d/..." 
                      className="bg-transparent border-none outline-none w-full text-sm text-slate-700 placeholder:text-slate-400"
                    />
                  </div>
                  <button 
                    onClick={() => {
                      if(!sheetUrl) return;
                      setConnecting(true);
                      setTimeout(() => {
                        setConnecting(false);
                        setPreviewLoading(true);
                        getUploadPreview().then((rows) => { setPreview(rows); setPreviewLoading(false); });
                      }, 1500);
                    }}
                    disabled={connecting || !sheetUrl}
                    className="w-full py-4 rounded-xl bg-indigo-600 text-white font-bold neo-raised hover:opacity-90 active:scale-95 transition-all disabled:opacity-50 disabled:active:scale-100 flex items-center justify-center gap-2"
                  >
                    {connecting ? (
                      <>
                        <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                        Connecting...
                      </>
                    ) : (
                      'Establish Live Connection'
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Sidebar info */}
        <aside className="col-span-12 lg:col-span-5 space-y-6">
          <div className="p-6 rounded-xl neo-raised bg-[#e8eaf0]">
            <h3 className="text-lg font-semibold text-slate-800 mb-4">Required Format</h3>
            <ul className="space-y-4">
              {[
                { field: 'Student ID',     desc: 'Unique identifier (Numeric)' },
                { field: 'Full Name',      desc: 'First and last name strings' },
                { field: 'Current Grade',  desc: 'Numeric value (1-12)' },
                { field: 'Email Address',  desc: 'Valid institutional email' },
                { field: 'Attendance %',   desc: 'Percentage (0-100)' },
              ].map(({ field, desc }) => (
                <li key={field} className="flex items-start gap-3">
                  <div className="mt-0.5 w-5 h-5 rounded-full neo-inset flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-indigo-600 text-[14px]">check</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-700">{field}</p>
                    <p className="text-xs text-slate-500">{desc}</p>
                  </div>
                </li>
              ))}
            </ul>
            <button className="w-full mt-6 py-3 rounded-xl neo-inset text-slate-500 font-semibold text-sm flex items-center justify-center gap-2 hover:bg-[#e2e4ea] transition-colors">
              <span className="material-symbols-outlined text-sm">download</span>Download Template
            </button>
          </div>

          <div className="p-6 rounded-xl neo-raised bg-[#e8eaf0] relative overflow-hidden">
            <div className="absolute -right-4 -top-4 w-24 h-24 bg-indigo-100 rounded-full blur-2xl" />
            <h3 className="text-lg font-semibold text-slate-800 mb-2">Auto-Mapping</h3>
            <p className="text-sm text-slate-500 mb-4">Our AI will automatically detect headers and map them to the system fields.</p>
            <div className="flex items-center gap-3">
              <div className="flex -space-x-2">
                {['bg-slate-300', 'bg-indigo-300', 'bg-violet-300'].map((c, i) => (
                  <div key={i} className={`w-8 h-8 rounded-full border-2 border-[#e8eaf0] ${c}`} />
                ))}
              </div>
              <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest">Active Intelligence</p>
            </div>
          </div>
        </aside>

        {/* Preview table */}
        <section className="col-span-12">
          <div className="p-8 rounded-xl neo-raised bg-[#e8eaf0]">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
              <div>
                <h3 className="text-xl font-semibold text-slate-800">Data Preview</h3>
                <p className="text-sm text-slate-500">
                  Showing results from: <span className="font-bold text-indigo-600">fall_semester_2024.csv</span>
                </p>
              </div>
              <div className="flex items-center gap-4">
                <div className="neo-inset px-4 py-2 rounded-xl flex items-center gap-2">
                  <span className="material-symbols-outlined text-slate-400 text-sm">search</span>
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search preview..."
                    className="bg-transparent border-none outline-none text-sm w-40 text-slate-700 placeholder:text-slate-400"
                  />
                </div>
                <button className="px-6 py-2 rounded-xl neo-raised bg-indigo-600 text-white font-bold hover:opacity-90 active:scale-95 transition-all">
                  Process Import
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left border-b border-slate-200">
                    {['Student ID', 'Full Name', 'Email Address', 'Grade', 'Status'].map((h, i) => (
                      <th key={h} className={`pb-4 font-semibold text-slate-500 text-sm uppercase tracking-wider ${i === 0 ? 'pl-4' : ''} ${i === 4 ? 'text-right pr-4' : ''}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {previewLoading ? (
                    <tr><td colSpan={5} className="py-10 text-center text-slate-400">Loading preview…</td></tr>
                  ) : filteredPreview.map((row) => (
                    <tr key={row.id} className={`hover:bg-[#e2e4ea] transition-colors ${row.status === 'invalid' ? 'bg-red-50/50' : ''}`}>
                      <td className="py-4 pl-4 font-medium text-indigo-600 text-sm">{row.id}</td>
                      <td className="py-4 text-sm font-semibold text-slate-700">{row.name}</td>
                      <td className="py-4 text-sm text-slate-500">{row.email}</td>
                      <td className="py-4">
                        <span className="px-3 py-1 neo-inset rounded-lg text-xs font-bold text-slate-700">{row.grade}</span>
                      </td>
                      <td className="py-4 text-right pr-4">
                        {row.status === 'valid' ? (
                          <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded">VALID</span>
                        ) : (
                          <span className="text-[10px] font-bold text-red-600 bg-red-50 px-2 py-1 rounded">{row.error ?? 'INVALID'}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-6 flex justify-between items-center px-4">
              <p className="text-xs text-slate-500">Showing {filteredPreview.length} of {preview.length} students found in CSV</p>
              <div className="flex gap-2">
                {[1, 2, 3].map((p) => (
                  <button key={p} className={`w-8 h-8 rounded-lg text-xs font-bold ${p === 1 ? 'neo-inset text-indigo-600' : 'neo-raised text-slate-600 hover:neo-inset'} transition-all`}>{p}</button>
                ))}
                <button className="w-8 h-8 rounded-lg neo-raised flex items-center justify-center text-slate-400 hover:neo-inset transition-all">
                  <span className="material-symbols-outlined text-sm">chevron_right</span>
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
