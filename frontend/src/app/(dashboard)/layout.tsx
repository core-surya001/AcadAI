'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import Topbar from '@/components/Topbar';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [authState, setAuthState] = useState<'loading' | 'authenticated' | 'unauthenticated'>('loading');

  useEffect(() => {
    // Only check auth on the client after hydration
    const token = localStorage.getItem('acadai_token');
    if (!token) {
      setAuthState('unauthenticated');
      router.replace('/login');
    } else {
      setAuthState('authenticated');
    }
  }, [pathname, router]);

  // Show loading state while checking auth
  if (authState === 'loading') {
    return (
      <div className="min-h-screen bg-[#e8eaf0] flex items-center justify-center">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full border-[3px] border-indigo-200 border-t-indigo-600 animate-spin" />
          <span className="text-slate-400 font-medium">Loading…</span>
        </div>
      </div>
    );
  }

  // Redirecting to login
  if (authState === 'unauthenticated') {
    return null;
  }

  return (
    <div className="flex min-h-screen bg-[#e8eaf0]">
      <Sidebar />
      <div className="flex-1 ml-64 flex flex-col">
        <Topbar />
        <main className="flex-1 mt-[68px] p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
