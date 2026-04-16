import Link from 'next/link';
import { useRouter } from 'next/router';
import { useAuth } from '../../hooks/useAuth';
import { useState } from 'react';

export default function Layout({ children }) {
  const { user, logout, isAdmin } = useAuth();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  const riderLinks = [
    { href: '/dashboard',  label: 'Dashboard',  icon: '📊' },
    { href: '/policy',     label: 'My Policy',  icon: '📋' },
    { href: '/claims',     label: 'Claims',     icon: '💰' },
    { href: '/zones',      label: 'Zone Risk',  icon: '🗺️' },
    { href: '/demand', label: 'Storm Cover', icon: '⚡' },
    { href: '/trust', label: 'Trust Score', icon: '🏆' },
  ];

  const adminLinks = [
    { href: '/admin',         label: 'Overview',   icon: '📊' },
    { href: '/admin/claims',  label: 'Claims',     icon: '📋' },
    { href: '/admin/riders',  label: 'Riders',     icon: '🛵' },
    { href: '/admin/simulate',label: 'Simulate',   icon: '⚡' },
    { href: '/admin/analytics', label: 'Analytics', icon: '🔮' },
  ];

  const links = isAdmin ? adminLinks : riderLinks;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top nav */}
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href={isAdmin ? '/admin' : '/dashboard'} className="flex items-center gap-2">
            <span className="text-2xl">🌧️</span>
            <span className="font-extrabold text-blue-700 text-lg leading-none">
              MonsoonShield
              <span className="text-xs font-normal text-slate-400 block">AI</span>
            </span>
          </Link>

          {/* Desktop links */}
          <div className="hidden md:flex items-center gap-1">
            {links.map(l => (
              <Link key={l.href} href={l.href}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition ${
                  router.pathname === l.href
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}>
                {l.icon} {l.label}
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-3">
            {user && (
              <div className="hidden md:flex items-center gap-2">
                <span className="text-xs text-slate-500">
                  {isAdmin ? '🛡️ Admin' : `🛵 ${user.full_name?.split(' ')[0]}`}
                </span>
                <button onClick={logout}
                  className="text-xs text-red-500 hover:text-red-700 font-medium border border-red-200 px-2 py-1 rounded-lg transition">
                  Logout
                </button>
              </div>
            )}
            {/* Mobile hamburger */}
            <button className="md:hidden p-2" onClick={() => setMenuOpen(!menuOpen)}>
              <div className="w-5 h-0.5 bg-slate-700 mb-1 rounded" />
              <div className="w-5 h-0.5 bg-slate-700 mb-1 rounded" />
              <div className="w-5 h-0.5 bg-slate-700 rounded" />
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="md:hidden border-t border-slate-100 bg-white px-4 pb-4">
            {links.map(l => (
              <Link key={l.href} href={l.href}
                onClick={() => setMenuOpen(false)}
                className={`block px-3 py-3 rounded-lg text-sm font-medium my-1 ${
                  router.pathname === l.href ? 'bg-blue-50 text-blue-700' : 'text-slate-600'
                }`}>
                {l.icon} {l.label}
              </Link>
            ))}
            <button onClick={logout} className="text-sm text-red-500 font-medium px-3 py-2">
              Logout
            </button>
          </div>
        )}
      </nav>

      {/* Bottom nav (mobile only) */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 z-50 flex">
        {links.map(l => (
          <Link key={l.href} href={l.href}
            className={`flex-1 flex flex-col items-center py-2 text-xs font-medium transition ${
              router.pathname === l.href ? 'text-blue-600' : 'text-slate-500'
            }`}>
            <span className="text-lg">{l.icon}</span>
            <span className="mt-0.5">{l.label}</span>
          </Link>
        ))}
      </div>

      {/* Main content - extra bottom padding for mobile nav */}
      <main className="max-w-5xl mx-auto px-4 py-6 pb-24 md:pb-6">
        {children}
      </main>
    </div>
  );
}
