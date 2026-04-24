'use client';

import { useState, useEffect, useRef } from 'react';
import { getStoredUser, logout } from '@/lib/api';

interface TopbarProps {
  searchPlaceholder?: string;
  onSearch?: (q: string) => void;
}

export default function Topbar({ searchPlaceholder = 'Search...', onSearch }: TopbarProps) {
  const [query, setQuery] = useState('');
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [user] = useState<{ name: string; role: string } | null>(() => getStoredUser());
  const profileRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    onSearch?.(e.target.value);
  };

  const initials = user?.name
    ? user.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : 'U';

  return (
    <header className="fixed top-0 right-0 left-64 z-40 bg-[#e8eaf0] neo-raised flex justify-between items-center px-6 py-3">
      {/* Search */}
      <div className="flex items-center flex-1 max-w-md neo-inset rounded-xl px-4 py-2 gap-3">
        <span className="material-symbols-outlined text-slate-400">search</span>
        <input
          type="text"
          value={query}
          onChange={handleSearch}
          placeholder={searchPlaceholder}
          className="bg-transparent border-none outline-none text-sm w-full text-slate-700 placeholder:text-slate-400"
        />
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-5 ml-6">
        {/* Notifications */}
        <div className="relative">
          <button
            id="topbar-notifications"
            onClick={() => { setNotifOpen(!notifOpen); setProfileOpen(false); }}
            className="w-10 h-10 flex items-center justify-center neo-raised rounded-full hover:neo-inset transition-all duration-200 active:scale-95"
          >
            <span className="material-symbols-outlined text-slate-500">notifications</span>
          </button>
          {notifOpen && (
            <div className="absolute right-0 top-12 w-64 neo-raised rounded-2xl bg-[#e8eaf0] p-4 z-50 animate-fade-in-up">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Notifications</p>
              <div className="space-y-2">
                {['New grade posted for CS101', 'Attendance alert for #STU-442', 'Data sync complete'].map((n, i) => (
                  <div key={i} className="flex items-start gap-2 py-2 border-b border-slate-200 last:border-0">
                    <span className="material-symbols-outlined text-indigo-400 text-base">circle_notifications</span>
                    <p className="text-xs text-slate-600">{n}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Profile */}
        <div className="flex items-center gap-3 pl-4 border-l border-slate-300 relative" ref={profileRef}>
          <div className="text-right hidden sm:block">
            <p className="text-sm font-semibold text-slate-800">{user?.name ?? 'User'}</p>
            <p className="text-[10px] text-indigo-600 font-bold uppercase tracking-wide">{user?.role ?? 'Staff'}</p>
          </div>
          <button
            id="topbar-profile"
            onClick={() => { setProfileOpen(!profileOpen); setNotifOpen(false); }}
            title="Profile menu"
            className="w-10 h-10 flex items-center justify-center neo-raised rounded-full bg-indigo-100 text-indigo-600 font-bold text-sm hover:neo-inset transition-all active:scale-95"
          >
            {initials}
          </button>

          {/* Profile dropdown */}
          {profileOpen && (
            <div className="absolute right-0 top-14 w-64 neo-raised rounded-2xl bg-[#e8eaf0] z-50 animate-fade-in-up overflow-hidden">
              {/* Profile header */}
              <div className="p-5 border-b border-slate-200">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full neo-inset flex items-center justify-center bg-indigo-100 text-indigo-600 font-bold text-lg">
                    {initials}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-800">{user?.name ?? 'User'}</p>
                    <p className="text-[10px] text-indigo-600 font-bold uppercase tracking-wide">{user?.role ?? 'Staff'}</p>
                  </div>
                </div>
              </div>

              {/* Menu items */}
              <div className="py-2">
                <button className="w-full flex items-center gap-3 px-5 py-3 text-sm text-slate-600 hover:text-indigo-600 hover:bg-[#e2e4ea] transition-colors">
                  <span className="material-symbols-outlined text-base">person</span>
                  My Profile
                </button>
                <button className="w-full flex items-center gap-3 px-5 py-3 text-sm text-slate-600 hover:text-indigo-600 hover:bg-[#e2e4ea] transition-colors">
                  <span className="material-symbols-outlined text-base">settings</span>
                  Settings
                </button>
                <button className="w-full flex items-center gap-3 px-5 py-3 text-sm text-slate-600 hover:text-indigo-600 hover:bg-[#e2e4ea] transition-colors">
                  <span className="material-symbols-outlined text-base">help</span>
                  Help & Support
                </button>
              </div>

              {/* Logout */}
              <div className="border-t border-slate-200 py-2">
                <button
                  onClick={logout}
                  className="w-full flex items-center gap-3 px-5 py-3 text-sm text-red-500 hover:bg-red-50 transition-colors font-medium"
                >
                  <span className="material-symbols-outlined text-base">logout</span>
                  Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
