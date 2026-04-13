'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getStudentById, updateStudent, type Student, type RiskLevel } from '@/lib/api';

const GRADES = ['Grade 10-A', 'Grade 10-B', 'Grade 10-C', 'Grade 11-A', 'Grade 11-B', 'Grade 12-A'];
const MAJORS = ['Computer Science', 'Mathematics', 'Physics', 'Philosophy', 'Arts'];
const SEMESTERS = ['1st / Fall', '2nd / Spring', '3rd / Fall', '4th / Spring'];

export default function EditStudentPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [form, setForm] = useState<Partial<Student>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    getStudentById(id).then((s) => { if (s) setForm(s); setLoading(false); });
  }, [id]);

  const set = (key: keyof Student, value: string | number) =>
    setForm((f) => ({ ...f, [key]: value }));

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name?.trim()) e.name = 'Name is required';
    if (!form.email?.trim()) e.email = 'Email is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try { await updateStudent(id, form); router.push(`/students/${id}`); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="text-slate-400 text-center py-32">Loading…</div>;

  const Field = ({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) => (
    <div className="space-y-1.5">
      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">{label}</label>
      {children}
      {error && <p className="text-xs text-red-500 ml-1">{error}</p>}
    </div>
  );

  return (
    <div className="animate-fade-in-up max-w-2xl mx-auto">
      <button onClick={() => router.back()} className="flex items-center gap-2 text-slate-500 hover:text-indigo-600 mb-6 font-medium transition-colors">
        <span className="material-symbols-outlined">arrow_back</span>Back
      </button>
      <div className="neo-raised rounded-3xl p-8 bg-[#e8eaf0]">
        <h2 className="text-2xl font-bold text-slate-800 mb-2">Edit Student</h2>
        <p className="text-slate-500 text-sm mb-8">Editing record for {form.name}</p>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <Field label="Full Name" error={errors.name}>
              <div className="neo-inset rounded-xl flex items-center px-4 py-3 gap-3">
                <span className="material-symbols-outlined text-slate-400 text-base">person</span>
                <input value={form.name ?? ''} onChange={(e) => set('name', e.target.value)} className="bg-transparent border-none outline-none text-sm w-full text-slate-700" />
              </div>
            </Field>
            <Field label="Email" error={errors.email}>
              <div className="neo-inset rounded-xl flex items-center px-4 py-3 gap-3">
                <span className="material-symbols-outlined text-slate-400 text-base">mail</span>
                <input type="email" value={form.email ?? ''} onChange={(e) => set('email', e.target.value)} className="bg-transparent border-none outline-none text-sm w-full text-slate-700" />
              </div>
            </Field>
            <Field label="Grade / Class">
              <div className="neo-inset rounded-xl flex items-center px-4 py-3 gap-3">
                <span className="material-symbols-outlined text-slate-400 text-base">class</span>
                <select value={form.grade ?? ''} onChange={(e) => set('grade', e.target.value)} className="bg-transparent border-none outline-none text-sm w-full text-slate-700">
                  {GRADES.map((g) => <option key={g}>{g}</option>)}
                </select>
              </div>
            </Field>
            <Field label="Major">
              <div className="neo-inset rounded-xl flex items-center px-4 py-3 gap-3">
                <span className="material-symbols-outlined text-slate-400 text-base">school</span>
                <select value={form.major ?? ''} onChange={(e) => set('major', e.target.value)} className="bg-transparent border-none outline-none text-sm w-full text-slate-700">
                  {MAJORS.map((m) => <option key={m}>{m}</option>)}
                </select>
              </div>
            </Field>
            <Field label="Semester">
              <div className="neo-inset rounded-xl flex items-center px-4 py-3 gap-3">
                <span className="material-symbols-outlined text-slate-400 text-base">calendar_month</span>
                <select value={form.semester ?? ''} onChange={(e) => set('semester', e.target.value)} className="bg-transparent border-none outline-none text-sm w-full text-slate-700">
                  {SEMESTERS.map((s) => <option key={s}>{s}</option>)}
                </select>
              </div>
            </Field>
            <Field label="Risk Level">
              <div className="neo-inset rounded-xl flex items-center px-4 py-3 gap-3">
                <span className="material-symbols-outlined text-slate-400 text-base">warning</span>
                <select value={form.riskLevel ?? 'low'} onChange={(e) => set('riskLevel', e.target.value as RiskLevel)} className="bg-transparent border-none outline-none text-sm w-full text-slate-700">
                  <option value="low">Low Risk</option>
                  <option value="medium">Medium Risk</option>
                  <option value="high">High Risk</option>
                </select>
              </div>
            </Field>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <Field label={`Attendance: ${form.attendance ?? 80}%`}>
              <div className="neo-inset rounded-xl px-4 py-3">
                <input type="range" min={0} max={100} value={form.attendance ?? 80} onChange={(e) => set('attendance', +e.target.value)} className="w-full accent-indigo-600" />
              </div>
            </Field>
            <Field label={`Score: ${(form.score ?? 0).toFixed(1)} / 10`}>
              <div className="neo-inset rounded-xl px-4 py-3">
                <input type="range" min={0} max={10} step={0.1} value={form.score ?? 7} onChange={(e) => set('score', +e.target.value)} className="w-full accent-indigo-600" />
              </div>
            </Field>
          </div>
          <div className="flex gap-4 pt-4">
            <button type="button" onClick={() => router.back()} className="flex-1 py-4 neo-raised rounded-xl text-slate-500 font-bold hover:neo-inset transition-all active:scale-95">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 py-4 neo-raised rounded-xl text-indigo-600 font-bold hover:neo-inset transition-all active:scale-95 disabled:opacity-50">
              {saving ? 'Saving…' : 'Update Student'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
