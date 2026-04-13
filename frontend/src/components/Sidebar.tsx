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

      {/* Storage */}
      <div className="mt-auto p-4 neo-raised rounded-2xl bg-[#e8eaf0]">
        <p className="text-xs text-slate-500 mb-2 font-medium">Storage Usage</p>
        <div className="h-2 w-full neo-inset rounded-full overflow-hidden">
          <div className="h-full bg-indigo-500 rounded-full" style={{ width: '75%' }} />
        </div>
        <p className="text-[10px] text-right mt-1 text-slate-400">75% of 10 GB</p>
      </div>
    </aside>
  );
}
