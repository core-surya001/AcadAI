'use client';

import { useEffect, useState } from 'react';
import { getReports, type Report } from '@/lib/api';

const statusConfig: Record<string, { label: string; bg: string; text: string }> = {
  completed:  { label: 'COMPLETED',  bg: 'bg-green-100',  text: 'text-green-700' },
  processing: { label: 'PROCESSING', bg: 'bg-blue-100',   text: 'text-blue-700' },
  draft:      { label: 'DRAFT',      bg: 'bg-slate-100',  text: 'text-slate-500' },
  archived:   { label: 'ARCHIVED',   bg: 'bg-rose-100',   text: 'text-rose-700' },
};

export default function ReportsPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getReports().then((r) => { setReports(r); setLoading(false); });
  }, []);

  return (
    <div className="animate-fade-in-up">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-800 tracking-tight">Academic Reports</h2>
          <p className="text-slate-500 mt-1">Generate, analyze and export institutional data.</p>
        </div>
        <button className="neo-raised bg-[#e8eaf0] px-6 py-3 rounded-xl flex items-center gap-2 text-indigo-600 font-semibold hover:neo-inset transition-all active:scale-95">
          <span className="material-symbols-outlined">add_chart</span>Create New Report
        </button>
      </div>

      {/* Filters */}
      <section className="grid grid-cols-1 md:grid-cols-4 gap-5 mb-10">
        {[
          { label: 'Class Period',   value: 'Spring Semester 2024' },
          { label: 'Student Group',  value: 'All Engineering Students' },
          { label: 'Report Type',    value: 'Performance Analytics' },
        ].map(({ label, value }) => (
          <div key={label} className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-500 ml-1">{label}</label>
            <div className="neo-inset bg-[#e8eaf0] rounded-xl px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-[#e2e4ea] transition-colors">
              <span className="text-sm text-slate-700">{value}</span>
              <span className="material-symbols-outlined text-slate-400">expand_more</span>
            </div>
          </div>
        ))}
        <div className="flex items-end">
          <button className="neo-raised bg-[#e8eaf0] w-full py-3 rounded-xl text-indigo-600 font-semibold hover:neo-inset flex items-center justify-center gap-2 transition-all active:scale-95">
            <span className="material-symbols-outlined">filter_list</span>Apply Filters
          </button>
        </div>
      </section>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="neo-raised rounded-xl p-6 bg-[#e8eaf0] h-48 animate-pulse" />
          ))
        ) : (
          <>
            {reports.map((r) => <ReportCard key={r.id} report={r} />)}
            {/* Add new */}
            <div className="border-4 border-dashed border-slate-300 rounded-xl flex flex-col items-center justify-center p-6 bg-slate-100/30 group cursor-pointer hover:border-indigo-300 transition-colors">
              <div className="w-16 h-16 rounded-full neo-raised flex items-center justify-center bg-[#e8eaf0] mb-4 group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined text-indigo-400 text-3xl">post_add</span>
              </div>
              <p className="font-bold text-slate-700">Generate Custom Report</p>
              <p className="text-xs text-slate-500 text-center mt-2 px-4">Use the AI builder to create specialized data views.</p>
            </div>
          </>
        )}
      </div>

      {/* Footer */}
      <footer className="mt-16 pt-8 border-t border-slate-200 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-8">
          <span className="text-[10px] uppercase tracking-widest font-bold text-slate-400">Security: Tier 3 AES-256</span>
          <span className="text-[10px] uppercase tracking-widest font-bold text-slate-400">Compliance: FERPA & GDPR</span>
        </div>
        <div className="flex items-center gap-4">
          {['Documentation', 'API Access', 'Support'].map((l) => (
            <button key={l} className="text-xs font-semibold text-slate-500 hover:text-indigo-600 transition-colors">{l}</button>
          ))}
        </div>
        <p className="text-[10px] font-medium text-slate-400">© 2024 AcadAI Intelligence Systems.</p>
      </footer>
    </div>
  );
}

function ReportCard({ report: r }: { report: Report }) {
  const sc = statusConfig[r.status];
  const inset = r.status === 'draft';

  return (
    <div className={`${inset ? 'neo-inset' : 'neo-raised hover:-translate-y-1'} bg-[#e8eaf0] rounded-xl p-6 group transition-transform`}>
      <div className="flex justify-between items-start mb-4">
        <div className={`w-12 h-12 rounded-lg ${inset ? 'neo-raised' : 'neo-inset'} flex items-center justify-center bg-[#e8eaf0]`}>
          <span className={`material-symbols-outlined ${r.iconColor} icon-filled`}>{r.icon}</span>
        </div>
        <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${sc.bg} ${sc.text}`}>{sc.label}</span>
      </div>

      <h3 className="text-lg font-bold text-slate-800 mb-1">{r.title}</h3>
      <p className="text-sm text-slate-500 mb-5 line-clamp-2">{r.description}</p>

      {/* Extra info */}
      {r.status === 'processing' && r.progress !== undefined && (
        <div className="w-full h-1 bg-slate-200 rounded-full overflow-hidden mb-5">
          <div className="h-full bg-purple-500" style={{ width: `${r.progress}%` }} />
        </div>
      )}
      {r.lastUpdated && (
        <p className="text-[10px] text-slate-400 italic mb-5">Last updated: {r.lastUpdated}</p>
      )}
      {r.tag && (
        <div className="flex items-center gap-2 mb-5">
          <span className="material-symbols-outlined text-amber-500 text-sm">star</span>
          <span className="text-[10px] font-bold text-slate-700">{r.tag}</span>
        </div>
      )}
      {r.archiveId && (
        <p className="text-[10px] text-slate-400 mb-5">Archive ID: {r.archiveId}</p>
      )}
      {r.sections !== undefined && (
        <p className="text-[10px] font-medium text-indigo-600 mb-5">{r.sections} sections pending review</p>
      )}

      {/* Actions */}
      <div className="grid grid-cols-2 gap-3">
        {r.status === 'completed' && (
          <>
            <button className="neo-raised bg-[#e8eaf0] py-2 rounded-lg text-xs font-semibold text-indigo-600 hover:neo-inset transition-all">Preview</button>
            <button className="neo-raised bg-[#e8eaf0] py-2 rounded-lg text-xs font-semibold text-indigo-700 flex items-center justify-center gap-1 hover:neo-inset transition-all">
              <span className="material-symbols-outlined text-sm">download</span>PDF
            </button>
          </>
        )}
        {r.status === 'processing' && (
          <>
            <button className="opacity-50 cursor-not-allowed neo-inset bg-[#e8eaf0] py-2 rounded-lg text-xs font-semibold text-slate-400">Preview</button>
            <button className="neo-raised bg-[#e8eaf0] py-2 rounded-lg text-xs font-semibold text-indigo-700 flex items-center justify-center gap-1 hover:neo-inset transition-all">
              <span className="material-symbols-outlined text-sm">notifications</span>Notify Me
            </button>
          </>
        )}
        {r.status === 'archived' && (
          <button className="col-span-2 neo-raised bg-[#e8eaf0] py-2 rounded-lg text-xs font-semibold text-slate-600 flex items-center justify-center gap-1 hover:neo-inset transition-all">
            <span className="material-symbols-outlined text-sm">unarchive</span>Restore to Active
          </button>
        )}
        {r.status === 'draft' && (
          <button className="col-span-2 neo-raised bg-[#e8eaf0] py-2 rounded-lg text-xs font-semibold text-indigo-600 hover:neo-inset transition-all">Continue Editing</button>
        )}
      </div>
    </div>
  );
}
