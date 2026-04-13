'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { getStudentById, type Student, type RiskLevel } from '@/lib/api';

const riskConfig: Record<RiskLevel, { label: string; bg: string; text: string }> = {
  low:    { label: 'LOW RISK',    bg: 'bg-green-100',  text: 'text-green-700' },
  medium: { label: 'MEDIUM RISK', bg: 'bg-amber-100',  text: 'text-amber-700' },
  high:   { label: 'HIGH RISK',   bg: 'bg-red-100',    text: 'text-red-700' },
};

const chartMonths = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG'];
const chartValues = [40, 65, 55, 85, 75, 95, 80, 90];

export default function StudentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [student, setStudent] = useState<Student | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getStudentById(id).then((s) => { setStudent(s); setLoading(false); });
  }, [id]);

  if (loading) return <div className="animate-pulse text-slate-400 text-center py-32">Loading student…</div>;
  if (!student) return (
    <div className="text-center py-32">
      <p className="text-slate-500 mb-4">Student not found.</p>
      <Link href="/students" className="text-indigo-600 font-bold hover:underline">← Back to Students</Link>
    </div>
  );

  const rc = riskConfig[student.riskLevel];
  const prediction = student.aiPrediction ?? 75;

  return (
    <div className="animate-fade-in-up">
      {/* Back */}
      <button onClick={() => router.back()} className="flex items-center gap-2 text-slate-500 hover:text-indigo-600 mb-6 font-medium transition-colors">
        <span className="material-symbols-outlined">arrow_back</span>Back to Students
      </button>

      <div className="grid grid-cols-12 gap-8">
        {/* Left: Profile + AI Prediction */}
        <div className="col-span-12 lg:col-span-4 space-y-6">
          {/* Profile card */}
          <section className="neo-raised rounded-3xl p-8 bg-[#e8eaf0] flex flex-col items-center text-center">
            <div className="w-32 h-32 rounded-full neo-raised flex items-center justify-center bg-indigo-100 text-indigo-600 font-extrabold text-4xl mb-6">
              {student.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
            </div>
            <h2 className="text-2xl font-bold text-slate-800 mb-1">{student.name}</h2>
            <p className="text-indigo-600 font-medium mb-6">ID: #{student.id}</p>
            <div className="w-full space-y-3">
              {[
                { label: 'Major',      value: student.major },
                { label: 'Semester',   value: student.semester },
                { label: 'Grade',      value: student.grade },
                { label: 'Attendance', value: `${student.attendance}%` },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between items-center p-4 rounded-2xl neo-inset bg-[#e8eaf0]">
                  <span className="text-sm text-slate-500 font-medium">{label}</span>
                  <span className="text-sm font-semibold text-slate-700">{value}</span>
                </div>
              ))}
            </div>
            <div className="flex gap-3 w-full mt-6">
              <Link href={`/students/${id}/edit`} className="flex-1 py-3 neo-raised rounded-xl text-indigo-600 font-bold text-sm hover:neo-inset transition-all active:scale-95 text-center">
                Edit
              </Link>
              <button className="flex-1 py-3 neo-raised rounded-xl text-red-500 font-bold text-sm hover:neo-inset transition-all active:scale-95">
                Remove
              </button>
            </div>
          </section>

          {/* AI Prediction */}
          <section className="neo-raised rounded-3xl p-8 bg-[#e8eaf0]">
            <h3 className="text-lg font-bold mb-5 flex items-center gap-2">
              <span className="material-symbols-outlined text-indigo-600">psychology</span>
              AI Score Prediction
            </h3>
            <div className="flex flex-col items-center">
              <div className="relative w-44 h-44 flex items-center justify-center mb-5">
                <div className="absolute inset-0 rounded-full neo-raised" />
                <div className="absolute inset-4 rounded-full neo-inset" />
                <div className="text-center z-10">
                  <span className="text-5xl font-extrabold text-indigo-600">{prediction}</span>
                  <span className="text-sm text-slate-500 block font-semibold">/ 100</span>
                </div>
              </div>
              <div className={`px-5 py-1.5 rounded-full ${rc.bg} ${rc.text} text-sm font-bold shadow-inner`}>
                {rc.label}
              </div>
              <p className="text-xs text-slate-500 text-center mt-4 leading-relaxed">
                Based on historical patterns, {student.name.split(' ')[0]} is likely to
                {student.riskLevel === 'low' ? ' excel in' : ' need support for'} upcoming finals with {prediction}% confidence.
              </p>
            </div>
          </section>
        </div>

        {/* Right: Insights + Recommendations + Chart */}
        <div className="col-span-12 lg:col-span-8 space-y-6">
          {/* Behavioral insights */}
          <section className="space-y-4">
            <h3 className="text-xl font-bold flex items-center gap-2">
              <span className="material-symbols-outlined text-indigo-600">auto_awesome</span>
              Behavioral Insights
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {[
                { icon: 'timeline',  color: 'text-indigo-500', title: 'Peak Activity Hours',  desc: 'Analysis shows peak performance during late-night sessions (10 PM – 1 AM).' },
                { icon: 'forum',     color: 'text-purple-500', title: 'Peer Collaboration',   desc: 'High engagement in peer forums and study groups. Prefers collaborative environments.' },
              ].map((c) => (
                <div key={c.title} className="neo-raised rounded-3xl p-6 bg-[#e8eaf0]">
                  <div className="w-12 h-12 rounded-xl neo-inset flex items-center justify-center mb-4">
                    <span className={`material-symbols-outlined ${c.color}`}>{c.icon}</span>
                  </div>
                  <h4 className="font-bold text-slate-800 mb-2">{c.title}</h4>
                  <p className="text-sm text-slate-500 leading-relaxed">{c.desc}</p>
                </div>
              ))}
              <div className="neo-raised rounded-3xl p-6 bg-[#e8eaf0] md:col-span-2">
                <div className="flex items-center gap-6">
                  <div className="w-20 h-20 rounded-2xl neo-inset flex-shrink-0 flex items-center justify-center">
                    <span className="material-symbols-outlined text-indigo-600 text-4xl">menu_book</span>
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-800 mb-2">Cognitive Load Index</h4>
                    <p className="text-sm text-slate-500 leading-relaxed">
                      Current coursework load is 15% above average. Retention scores remain stable at 89%. Monitor for burnout in week 12.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Recommendations */}
          <section className="neo-raised rounded-3xl p-8 bg-[#e8eaf0]">
            <h3 className="text-xl font-bold mb-5 flex items-center gap-2">
              <span className="material-symbols-outlined text-indigo-600">lightbulb</span>
              Strategic Recommendations
            </h3>
            <div className="space-y-3">
              {[
                { icon: 'check_circle', color: 'text-indigo-600', title: 'Advanced Algorithms Bridge',  desc: 'Enroll in the specialized logic workshop to boost performance in CS-402.', action: 'ACTION' },
                { icon: 'star',         color: 'text-purple-600', title: 'Mentorship Opportunity',     desc: 'Recommended as a candidate for the Peer Tutor program for lower division Math.', action: 'INVITE' },
                { icon: 'calendar_month', color: 'text-slate-500', title: 'Balanced Schedule Check',  desc: 'Review upcoming exam schedule to avoid three major assessments in 48 hours.', action: 'VIEW' },
              ].map((r) => (
                <div key={r.title} className="group flex items-center gap-4 p-4 rounded-2xl hover:neo-inset transition-all duration-200">
                  <div className="w-10 h-10 rounded-full neo-raised flex items-center justify-center group-hover:scale-95 transition-transform">
                    <span className={`material-symbols-outlined ${r.color}`}>{r.icon}</span>
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-sm text-slate-700">{r.title}</p>
                    <p className="text-xs text-slate-500">{r.desc}</p>
                  </div>
                  <button className={`px-4 py-2 text-xs font-bold ${r.color} neo-raised rounded-xl hover:neo-inset transition-all`}>
                    {r.action}
                  </button>
                </div>
              ))}
            </div>
          </section>

          {/* Academic velocity chart */}
          <section className="neo-inset rounded-3xl p-8 bg-[#e8eaf0]">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-lg font-bold text-slate-800">Academic Velocity</h3>
                <p className="text-xs text-slate-500">Progression over the last 6 months</p>
              </div>
              <div className="flex gap-2">
                <div className="w-3 h-3 rounded-full bg-indigo-600" />
                <div className="w-3 h-3 rounded-full bg-purple-600" />
              </div>
            </div>
            <div className="h-36 flex items-end justify-between gap-2 px-2">
              {chartValues.map((v, i) => (
                <div key={i} className="flex-1 neo-raised rounded-t-lg bar-animated" style={{
                  height: `${v}%`,
                  background: i % 2 === 0 ? '#818cf8' : '#6366f1',
                }} />
              ))}
            </div>
            <div className="flex justify-between mt-3 px-2 text-[10px] font-bold text-slate-500">
              {chartMonths.map((m) => <span key={m}>{m}</span>)}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
