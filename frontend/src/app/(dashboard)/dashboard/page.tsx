'use client';

import { useEffect, useState } from 'react';
import {
  getDashboardStats, getPerformanceTrends, getClassDistribution, getRecentActivity,
  type DashboardStats, type PerformanceTrend, type ClassDistribution, type ActivityItem
} from '@/lib/api';

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [trends, setTrends] = useState<PerformanceTrend[]>([]);
  const [classDist, setClassDist] = useState<ClassDistribution[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [chartMode, setChartMode] = useState<'weekly' | 'monthly'>('weekly');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getDashboardStats(), getPerformanceTrends(), getClassDistribution(), getRecentActivity()])
      .then(([s, t, c, a]) => { setStats(s); setTrends(t); setClassDist(c); setActivity(a); })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSkeleton />;

  return (
    <div className="animate-fade-in-up">
      {/* Page header */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Academic Overview</h2>
        <p className="text-slate-500 font-medium mt-1">Real-time performance metrics for Spring 2024</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <StatCard
          label="Total Students"
          value={stats!.totalStudents.toLocaleString()}
          trend={`+${stats!.totalStudentsTrend}% from last term`}
          trendUp
          icon="group"
        />
        <StatCard
          label="Average Score"
          value={`${stats!.averageScore}%`}
          trend={`${stats!.averageScoreTrend}% vs target`}
          trendUp
          icon="grade"
        />
        <StatCard
          label="At-Risk Students"
          value={stats!.atRiskStudents.toString()}
          trend={`${stats!.atRiskNew} new this week`}
          trendUp={false}
          icon="person_alert"
          iconColor="text-red-500"
        />
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Performance chart */}
        <div className="lg:col-span-2 neo-raised rounded-2xl p-6 bg-[#e8eaf0]">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-bold text-slate-800">Performance Trends</h3>
            <div className="flex gap-2">
              {(['weekly', 'monthly'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setChartMode(m)}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg capitalize transition-all ${
                    chartMode === m ? 'neo-inset text-indigo-600' : 'neo-raised text-slate-500'
                  }`}
                >
                  {m.charAt(0).toUpperCase() + m.slice(1)}
                </button>
              ))}
            </div>
          </div>
          {/* Bar chart — use explicit px height (container = 192px) */}
          <div className="h-48 flex items-end justify-between gap-2 px-2">
            {trends.map((t, i) => (
              <div key={t.day} className="flex flex-col items-center gap-1 flex-1 h-full justify-end">
                <div
                  className="w-full neo-raised rounded-t-lg transition-all duration-700 bar-animated"
                  style={{
                    height: `${Math.round((t.value / 100) * 192)}px`,
                    background: `rgba(99,102,241,${0.35 + (i / trends.length) * 0.65})`,
                  }}
                />
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-3 px-2 text-[10px] text-slate-500 font-bold uppercase tracking-widest">
            {trends.map((t) => <span key={t.day}>{t.day}</span>)}
          </div>
        </div>

        {/* Recent activity */}
        <div className="neo-raised rounded-2xl p-6 bg-[#e8eaf0]">
          <h3 className="font-bold text-slate-800 mb-5">Recent Activity</h3>
          <div className="space-y-5">
            {activity.map((a) => (
              <div key={a.id} className="flex gap-3">
                <div className="w-9 h-9 rounded-full neo-inset flex items-center justify-center shrink-0">
                  <span className={`material-symbols-outlined text-xl ${a.iconColor}`}>{a.icon}</span>
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-700 leading-snug">{a.title}</p>
                  <p className="text-xs text-slate-500">{a.description}</p>
                  <p className="text-[10px] text-indigo-400 font-bold mt-0.5 uppercase">{a.time}</p>
                </div>
              </div>
            ))}
          </div>
          <button className="w-full mt-6 py-2.5 neo-raised rounded-xl text-indigo-600 text-sm font-bold hover:neo-inset transition-all active:scale-95">
            View All Activity
          </button>
        </div>
      </div>

      {/* Class distribution */}
      <div className="neo-raised rounded-2xl p-6 bg-[#e8eaf0]">
        <div className="flex justify-between items-center mb-6">
          <h3 className="font-bold text-slate-800">Class Distribution</h3>
          <span className="material-symbols-outlined text-slate-400 cursor-pointer">more_horiz</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {classDist.map((c) => (
            <div key={c.name} className="p-4 neo-inset rounded-2xl">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{c.name}</span>
                <span className="text-xs font-bold text-indigo-600">{c.percent}%</span>
              </div>
              <div className="w-full h-2 neo-inset rounded-full overflow-hidden">
                <div className={`h-full ${c.color} rounded-full transition-all duration-700`} style={{ width: `${c.percent}%` }} />
              </div>
              <p className="text-[10px] text-slate-400 mt-3">{c.students} Active Students</p>
            </div>
          ))}
        </div>
      </div>

      {/* FAB */}
      <button className="fixed bottom-8 right-8 w-16 h-16 bg-[#e8eaf0] neo-raised rounded-full flex items-center justify-center text-indigo-600 hover:scale-105 active:scale-95 transition-all z-50">
        <span className="material-symbols-outlined text-3xl">add</span>
      </button>
    </div>
  );
}

/* ─── Sub-components ─────────────────────────────────────────────────────────── */

function StatCard({
  label, value, trend, trendUp, icon, iconColor = 'text-indigo-600'
}: {
  label: string; value: string; trend: string; trendUp: boolean; icon: string; iconColor?: string;
}) {
  return (
    <div className="neo-raised p-6 rounded-2xl bg-[#e8eaf0] flex items-center justify-between group hover:-translate-y-1 transition-transform">
      <div>
        <p className="text-slate-500 text-sm font-medium">{label}</p>
        <h3 className="text-3xl font-bold text-slate-800 mt-1 tracking-tight">{value}</h3>
        <div className={`flex items-center mt-2 ${trendUp ? 'text-emerald-500' : 'text-red-500'} text-xs font-bold`}>
          <span className="material-symbols-outlined text-sm">{trendUp ? 'trending_up' : 'warning'}</span>
          <span className="ml-1">{trend}</span>
        </div>
      </div>
      <div className="w-14 h-14 neo-inset rounded-xl flex items-center justify-center bg-[#e8eaf0]">
        <span className={`material-symbols-outlined ${iconColor} text-3xl icon-filled`}>{icon}</span>
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="h-8 bg-slate-200 rounded-xl w-64" />
      <div className="grid grid-cols-3 gap-6">
        {[0, 1, 2].map((i) => <div key={i} className="h-32 bg-slate-200 rounded-2xl" />)}
      </div>
      <div className="h-64 bg-slate-200 rounded-2xl" />
    </div>
  );
}
