'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
  { label: 'Dashboard',   href: '/dashboard',  icon: 'dashboard' },
  { label: 'Students',    href: '/students',   icon: 'group' },
  { label: 'Upload Data', href: '/upload',     icon: 'cloud_upload' },
  { label: 'Reports',     href: '/reports',    icon: 'analytics' },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="h-screen w-64 fixed left-0 top-0 bg-[#e8eaf0] flex flex-col p-4 gap-4 z-50 neo-raised">
      {/* Brand */}
      <div className="flex items-center gap-3 px-2 py-4 mb-2">
        <div className="w-10 h-10 rounded-xl neo-raised flex items-center justify-center bg-[#e8eaf0]">
          <span className="material-symbols-outlined icon-filled text-indigo-600">school</span>
        </div>
        <div>
          <h1 className="text-lg font-bold text-indigo-600 leading-none">AcadAI</h1>
          <p className="text-[10px] text-slate-500 font-medium tracking-wider uppercase mt-0.5">SaaS Admin</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex flex-col gap-2">
        {navItems.map(({ label, href, icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all duration-150 ${
                active
                  ? 'neo-inset text-indigo-600'
                  : 'text-slate-500 hover:text-indigo-500 hover:translate-x-1'
              }`}
            >
              <span className={`material-symbols-outlined ${active ? 'icon-filled' : ''}`}>{icon}</span>
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Theme Toggle */}
      <div className="mt-auto p-4 flex items-center justify-between">
        <span className="text-sm font-medium text-slate-500">Theme</span>
        <button 
          onClick={() => {
            document.documentElement.classList.toggle('dark');
            const isDark = document.documentElement.classList.contains('dark');
            localStorage.setItem('theme', isDark ? 'dark' : 'light');
            // Trigger a re-render for the icon (optional, simple approach for now)
            window.dispatchEvent(new Event('themeChange'));
          }}
          className="w-14 h-8 neo-inset rounded-full flex items-center p-1 cursor-pointer transition-all relative"
        >
          {/* We'll use a simple CSS toggle instead of state to keep it simple, but a real implementation would use a theme provider */}
          <div className="w-6 h-6 bg-[#e8eaf0] neo-raised rounded-full flex items-center justify-center transition-transform transform translate-x-0 dark:translate-x-6">
            <span className="material-symbols-outlined text-[14px] text-indigo-500 block dark:hidden">light_mode</span>
            <span className="material-symbols-outlined text-[14px] text-indigo-500 hidden dark:block">dark_mode</span>
          </div>
        </button>
      </div>
    </aside>
  );
}
