'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { Menu, X, LogOut, Leaf, SlidersHorizontal, Sparkles, Trophy, Wrench, Gamepad2 } from 'lucide-react';

const NAV_ITEMS = [
  { label: '基本設定', path: '/dashboard', icon: SlidersHorizontal },
  { label: 'デイリーミッション管理', path: '/dashboard/missions', icon: Sparkles },
  { label: '階級・ランク設定', path: '/dashboard/ranks', icon: Trophy },
  { label: 'マイル手動操作', path: '/dashboard/miles', icon: Wrench },
  { label: '総合操作パネル送信', path: '/dashboard/panel', icon: Gamepad2 },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  };

  return (
    <div className="flex flex-col md:flex-row h-screen min-h-screen bg-leaf-50 text-leaf-900 overflow-hidden">
      <header className="md:hidden flex-none flex items-center justify-between bg-white border-b border-leaf-200 p-4 z-30">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-leaf-500 flex items-center justify-center flex-shrink-0">
            <Leaf className="w-4 h-4 text-white" />
          </div>
          <h2 className="font-bold text-leaf-900 text-sm">どう森BOT ダッシュボード</h2>
        </div>
        <button onClick={() => setIsMobileMenuOpen(true)} className="p-2 text-leaf-600 hover:bg-leaf-100 rounded-lg">
          <Menu size={22} />
        </button>
      </header>

      <div className="flex-1 flex overflow-hidden relative">
        {isMobileMenuOpen && (
          <div className="absolute inset-0 bg-black/30 z-40 md:hidden" onClick={() => setIsMobileMenuOpen(false)} />
        )}

        <aside
          className={`
            absolute md:static inset-y-0 left-0 z-50
            w-72 bg-white border-r border-leaf-200 p-4 flex flex-col
            transform transition-transform duration-300 ease-in-out
            ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
            md:translate-x-0 h-full
          `}
        >
          <div className="mb-6 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-leaf-500 flex items-center justify-center shadow-lg shadow-leaf-500/20">
                <Leaf className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="font-bold text-leaf-900 text-sm leading-tight">どう森BOT</h2>
                <p className="text-xs text-leaf-500">管理ダッシュボード</p>
              </div>
            </div>
            <button className="md:hidden p-1.5 text-leaf-500 hover:bg-leaf-100 rounded-lg" onClick={() => setIsMobileMenuOpen(false)}>
              <X size={18} />
            </button>
          </div>

          <nav className="flex-1 space-y-1">
            {NAV_ITEMS.map((item) => {
              const isActive = pathname === item.path;
              const Icon = item.icon;
              return (
                <Link
                  key={item.path}
                  href={item.path}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`flex items-center gap-2.5 px-3 py-2.5 text-sm rounded-xl transition-colors ${
                    isActive ? 'bg-leaf-100 text-leaf-800 font-bold' : 'text-leaf-600 hover:bg-leaf-50'
                  }`}
                >
                  <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-leaf-600' : 'text-leaf-400'}`} />
                  <span className="truncate">{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="pt-4 border-t border-leaf-200 mt-auto flex-shrink-0">
            <button onClick={handleLogout} className="text-xs text-leaf-500 hover:text-red-500 flex items-center gap-2 transition-colors w-full">
              <LogOut size={14} />
              ログアウト
            </button>
          </div>
        </aside>

        <main className="flex-1 p-4 md:p-8 overflow-y-auto w-full h-full">{children}</main>
      </div>
    </div>
  );
}
