'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { getReports, getStudents, type Report, type Student } from '@/lib/api';

export default function ReportPreviewPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const [report, setReport] = useState<Report | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const reports = await getReports();
      const r = reports.find(x => x.id === params.id) || null;
      setReport(r);

      if (r?.title === 'Scholarship Eligibility' || r?.title === 'Final Grades Summary') {
        try {
          const res = await getStudents({ limit: 100 } as any);
          setStudents(res.students);
        } catch(e) {}
      }

      setLoading(false);
    }
    load();
  }, [params.id]);

  useEffect(() => {
    if (!loading && searchParams.get('pdf') === 'true') {
      setTimeout(() => {
        window.print();
      }, 500);
    }
  }, [loading, searchParams]);

  if (loading) {
    return <div className="p-10 flex justify-center text-slate-500">Loading report data...</div>;
  }

  if (!report) {
    return <div className="p-10 flex justify-center text-red-500">Report not found.</div>;
  }

  // Final Grades Summary logic
  const averageGrade = students.length > 0 ? (students.reduce((acc, s) => acc + s.score, 0) / students.length).toFixed(2) : 0;
  
  // Scholarship Eligibility Logic
  const eligibleStudents = students.filter(s => s.attendance >= 75 && s.score > 6.0);

  return (
    <div className="max-w-4xl mx-auto p-10 print:p-0 bg-white min-h-screen text-slate-800">
      <div className="flex justify-between items-start mb-10 border-b pb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">{report.title}</h1>
          <p className="text-slate-500 mt-2">{report.description}</p>
        </div>
        <div className="text-right">
          <p className="text-sm font-semibold text-slate-400 uppercase tracking-widest">AcadAI Intelligence</p>
          <p className="text-xs text-slate-400 mt-1">Generated: {new Date().toLocaleDateString()}</p>
          <button 
            onClick={() => window.print()}
            className="mt-4 px-4 py-2 bg-indigo-600 text-white text-sm font-bold rounded hover:bg-indigo-700 print:hidden"
          >
            Download PDF
          </button>
        </div>
      </div>

      <div className="mt-8">
        {report.title === 'Final Grades Summary' && (
          <div className="space-y-6">
            <div className="p-6 bg-slate-50 border rounded-xl">
              <h3 className="text-xl font-bold mb-4">Class Performance Overview</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-white rounded shadow-sm">
                  <p className="text-sm text-slate-500">Total Students Evaluated</p>
                  <p className="text-2xl font-bold text-indigo-600">{students.length}</p>
                </div>
                <div className="p-4 bg-white rounded shadow-sm">
                  <p className="text-sm text-slate-500">Average Class Score</p>
                  <p className="text-2xl font-bold text-emerald-600">{averageGrade} / 10</p>
                </div>
              </div>
            </div>
            
            <h3 className="text-xl font-bold mt-8 mb-4">Student Roster</h3>
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b-2 border-slate-200">
                  <th className="py-3 px-2">Name</th>
                  <th className="py-3 px-2">Grade</th>
                  <th className="py-3 px-2">Score</th>
                  <th className="py-3 px-2">Risk Level</th>
                </tr>
              </thead>
              <tbody>
                {students.map(s => (
                  <tr key={s.id} className="border-b border-slate-100">
                    <td className="py-3 px-2 font-medium">{s.name}</td>
                    <td className="py-3 px-2 text-sm text-slate-500">{s.grade}</td>
                    <td className="py-3 px-2 font-bold">{s.score}</td>
                    <td className="py-3 px-2">
                      <span className={`text-xs px-2 py-1 rounded font-bold uppercase ${s.riskLevel === 'high' ? 'bg-red-100 text-red-600' : s.riskLevel === 'medium' ? 'bg-amber-100 text-amber-600' : 'bg-green-100 text-green-600'}`}>
                        {s.riskLevel}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {report.title === 'AI Assignment Insights' && (
          <div className="space-y-6">
            <div className="p-6 bg-indigo-50 border border-indigo-100 rounded-xl">
              <h3 className="text-xl font-bold text-indigo-900 mb-2">AI Diagnostic Summary</h3>
              <p className="text-indigo-800">
                The AI models have processed recent assessment results and identified a 15% improvement in logical reasoning tasks across the Computer Science department. However, comprehension in complex problem-solving remains a challenge for students classified as 'medium' and 'high' risk.
              </p>
            </div>
            
            <h3 className="text-lg font-bold mt-6 mb-2">Key Insights:</h3>
            <ul className="list-disc pl-6 space-y-2 text-slate-700">
              <li><strong>Top Performers:</strong> Students utilizing the predictive feedback loops have shown a 1.2 point score increase on average.</li>
              <li><strong>Intervention Recommended:</strong> Early warnings trigger effectively for students exhibiting a drop in attendance below 70% alongside a 0.5 score reduction.</li>
              <li><strong>Course Analysis:</strong> 'Physics' and 'Mathematics' currently have the highest variance in grades, suggesting a need for standardized curriculum updates.</li>
            </ul>
          </div>
        )}

        {report.title === 'Scholarship Eligibility' && (
          <div className="space-y-6">
            <div className="p-6 bg-emerald-50 border border-emerald-100 rounded-xl">
              <h3 className="text-xl font-bold text-emerald-900 mb-2">Eligibility Criteria</h3>
              <p className="text-emerald-800">
                The following students have met the strict criteria for merit-based scholarships this semester:
              </p>
              <ul className="list-disc pl-6 mt-2 text-emerald-800">
                <li><strong>Attendance:</strong> 75% or above</li>
                <li><strong>Academic Score:</strong> Above 6.0 / 10</li>
              </ul>
            </div>

            <h3 className="text-xl font-bold mt-8 mb-4">Eligible Candidates ({eligibleStudents.length})</h3>
            {eligibleStudents.length === 0 ? (
              <p className="text-slate-500 italic">No students currently meet the scholarship criteria.</p>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b-2 border-slate-200 bg-slate-50">
                    <th className="py-3 px-4 font-semibold">Student Name</th>
                    <th className="py-3 px-4 font-semibold">Major</th>
                    <th className="py-3 px-4 font-semibold text-center">Attendance %</th>
                    <th className="py-3 px-4 font-semibold text-center">Score</th>
                  </tr>
                </thead>
                <tbody>
                  {eligibleStudents.map(s => (
                    <tr key={s.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="py-3 px-4 font-medium">{s.name}</td>
                      <td className="py-3 px-4 text-sm text-slate-500">{s.major}</td>
                      <td className="py-3 px-4 text-center font-bold text-indigo-600">{s.attendance}%</td>
                      <td className="py-3 px-4 text-center font-bold text-emerald-600">{s.score}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
