'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { getStudents, deleteStudent, type Student, type RiskLevel } from '@/lib/api';

const riskConfig: Record<string, { label: string; dot: string; bg: string; text: string }> = {
  low:      { label: 'Low Risk',    dot: 'bg-emerald-500', bg: 'bg-emerald-50',  text: 'text-emerald-600' },
  medium:   { label: 'Medium Risk', dot: 'bg-amber-400',   bg: 'bg-amber-50',    text: 'text-amber-600' },
  high:     { label: 'High Risk',   dot: 'bg-red-500',     bg: 'bg-red-50',      text: 'text-red-600' },
  unscored: { label: 'Unscored',    dot: 'bg-slate-400',    bg: 'bg-slate-50',    text: 'text-slate-500' },
};

export default function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [risk, setRisk] = useState('all');
  const [sort, setSort] = useState('score');
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    getStudents({ search, risk, sort })
      .then(({ students: s, total: t }) => { setStudents(s); setTotal(t); })
      .catch(() => { setStudents([]); setTotal(0); })
      .finally(() => setLoading(false));
  }, [search, risk, sort]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this student?')) return;
    setDeletingId(id);
    try {
      await deleteStudent(id);
      load();
    } catch {
      // Silently handle — the student list will just not update
    } finally {
      setDeletingId(null);
      setMenuOpen(null);
    }
  };

  const attendanceColor = (v: number) =>
    v >= 85 ? 'bg-indigo-500' : v >= 70 ? 'bg-amber-400' : 'bg-red-500';

  return (
    <div className="animate-fade-in-up">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
        <div>
          <h2 className="text-3xl font-bold text-slate-800 tracking-tight">Student Directory</h2>
          <p className="text-slate-500 mt-1">Manage and monitor student performance and academic risk factors.</p>
        </div>
        <div className="flex items-center gap-4">
          <button className="flex items-center gap-2 px-5 py-3 neo-raised rounded-xl text-indigo-600 font-semibold hover:neo-inset transition-all active:scale-95">
            <span className="material-symbols-outlined">file_download</span>Export
          </button>
          <Link
            href="/students/new"
            className="flex items-center gap-2 px-5 py-3 neo-raised rounded-xl text-indigo-600 font-bold hover:neo-inset transition-all active:scale-95"
          >
            <span className="material-symbols-outlined">add</span>Add Student
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="neo-inset rounded-xl p-3 flex items-center gap-3">
          <span className="material-symbols-outlined text-slate-400">search</span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search students..."
            className="bg-transparent border-none outline-none text-sm w-full text-slate-700 placeholder:text-slate-400"
          />
        </div>
        <div className="neo-inset rounded-xl p-3 flex items-center gap-3">
          <span className="material-symbols-outlined text-slate-400">warning</span>
          <select
            value={risk}
            onChange={(e) => setRisk(e.target.value)}
            className="bg-transparent border-none outline-none text-sm font-medium w-full text-slate-700"
          >
            <option value="all">All Risk Levels</option>
            <option value="high">High Risk</option>
            <option value="medium">Medium Risk</option>
            <option value="low">Low Risk</option>
          </select>
        </div>
        <div className="neo-inset rounded-xl p-3 flex items-center gap-3">
          <span className="material-symbols-outlined text-slate-400">sort</span>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="bg-transparent border-none outline-none text-sm font-medium w-full text-slate-700"
          >
            <option value="score">Sort by Score</option>
            <option value="name">Sort by Name</option>
            <option value="attendance">Sort by Attendance</option>
          </select>
        </div>
        <div className="neo-inset rounded-xl p-3 flex items-center gap-3">
          <span className="material-symbols-outlined text-slate-400">calendar_month</span>
          <select className="bg-transparent border-none outline-none text-sm font-medium w-full text-slate-700">
            <option>Semester 1</option>
            <option>Semester 2</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="neo-raised rounded-xl overflow-hidden bg-[#e8eaf0]">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-200">
              {['Student Name', 'Grade', 'Attendance', 'Score', 'Risk Level', 'Actions'].map((h, i) => (
                <th key={h} className={`px-6 py-4 text-xs font-bold uppercase tracking-widest text-slate-500 ${i === 5 ? 'text-right' : i >= 1 ? 'text-center' : ''}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {loading ? (
              <tr><td colSpan={6} className="px-6 py-16 text-center text-slate-400">Loading…</td></tr>
            ) : students.length === 0 ? (
              <tr><td colSpan={6} className="px-6 py-16 text-center text-slate-400">No students found.</td></tr>
            ) : students.map((s) => {
              const rc = riskConfig[s.riskLevel];
              return (
                <tr key={s.id} className="hover:bg-[#e2e4ea] transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full neo-raised flex items-center justify-center bg-indigo-100 text-indigo-600 font-bold text-sm shrink-0">
                        {s.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-700">{s.name}</p>
                        <p className="text-xs text-slate-500">ID: #{s.id}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="text-xs font-medium px-3 py-1 neo-inset rounded-full text-indigo-600">{s.grade}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-sm font-bold text-slate-700">{s.attendance}%</span>
                      <div className="w-20 h-1.5 neo-inset rounded-full overflow-hidden">
                        <div className={`${attendanceColor(s.attendance)} h-full rounded-full`} style={{ width: `${s.attendance}%` }} />
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="text-sm font-bold text-slate-700">{s.score.toFixed(1)}</span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full ${rc.bg} ${rc.text} text-[10px] font-bold uppercase`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${rc.dot}`} />
                      {rc.label}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="relative inline-block">
                      <button
                        onClick={() => setMenuOpen(menuOpen === s.id ? null : s.id)}
                        className="w-8 h-8 rounded-lg neo-raised flex items-center justify-center text-slate-400 hover:text-indigo-600 transition-all"
                      >
                        <span className="material-symbols-outlined text-[18px]">more_vert</span>
                      </button>
                      {menuOpen === s.id && (
                        <div className="absolute right-0 top-10 z-50 neo-raised rounded-xl bg-[#e8eaf0] py-2 w-40 animate-fade-in-up">
                          <Link href={`/students/${s.id}`} className="flex items-center gap-2 px-4 py-2 text-sm text-slate-600 hover:text-indigo-600 hover:bg-[#e2e4ea]">
                            <span className="material-symbols-outlined text-base">visibility</span>View
                          </Link>
                          <Link href={`/students/${s.id}/edit`} className="flex items-center gap-2 px-4 py-2 text-sm text-slate-600 hover:text-indigo-600 hover:bg-[#e2e4ea]">
                            <span className="material-symbols-outlined text-base">edit</span>Edit
                          </Link>
                          <button
                            onClick={() => handleDelete(s.id)}
                            disabled={deletingId === s.id}
                            className="flex items-center gap-2 px-4 py-2 text-sm text-red-500 hover:bg-[#e2e4ea] w-full text-left"
                          >
                            <span className="material-symbols-outlined text-base">delete</span>
                            {deletingId === s.id ? 'Deleting…' : 'Delete'}
                          </button>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Footer */}
        <div className="px-6 py-5 border-t border-slate-200 flex items-center justify-between">
          <p className="text-xs text-slate-500 font-medium">
            Showing <span className="text-slate-700">{students.length}</span> of <span className="text-slate-700">{total.toLocaleString()}</span> students
          </p>
          <div className="flex items-center gap-2">
            {[1, 2, 3].map((p) => (
              <button key={p} className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${p === 1 ? 'neo-inset text-indigo-600' : 'neo-raised text-slate-600 hover:neo-inset'}`}>{p}</button>
            ))}
            <span className="text-slate-400 text-xs">...</span>
            <button className="w-8 h-8 rounded-lg neo-raised flex items-center justify-center text-slate-400 hover:neo-inset transition-all">
              <span className="material-symbols-outlined text-[18px]">chevron_right</span>
            </button>
          </div>
        </div>
      </div>

      {/* Analytics cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-10">
        {[
          { icon: 'troubleshoot', color: 'text-indigo-600', title: 'Risk Summary', desc: '12 students critically underperforming this week.', action: 'View Details' },
          { icon: 'auto_graph',   color: 'text-emerald-600', title: 'Average Growth', desc: '+14.2% academic progress across all cohorts.', action: 'Full Report' },
          { icon: 'psychology_alt', color: 'text-indigo-600', title: 'AI Prediction', desc: '92% of Grade 11 will pass the next exam.', action: 'AI Insights' },
        ].map((c) => (
          <div key={c.title} className="neo-raised p-6 rounded-xl relative overflow-hidden group">
            <div className="relative z-10">
              <div className="w-12 h-12 rounded-xl neo-inset flex items-center justify-center mb-4">
                <span className={`material-symbols-outlined ${c.color}`}>{c.icon}</span>
              </div>
              <h3 className="text-lg font-bold text-slate-800 mb-1">{c.title}</h3>
              <p className="text-sm text-slate-500 mb-4">{c.desc}</p>
              <button className={`text-xs font-bold ${c.color} uppercase tracking-widest hover:underline flex items-center gap-1`}>
                {c.action}<span className="material-symbols-outlined text-xs">arrow_forward</span>
              </button>
            </div>
            <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:opacity-10 transition-opacity">
              <span className="material-symbols-outlined text-[120px]">{c.icon}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
