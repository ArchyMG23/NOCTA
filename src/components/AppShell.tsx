import React, { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import {
  Bookmark,
  Compass,
  HeartHandshake,
  LayoutDashboard,
  LogOut,
  Menu,
  Shield,
  User,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../i18n/I18nContext';
import { updateUserProfileSettings } from '../services/noctaService';
import { NoctaLogo } from './NoctaLogo';

export function AppShell({ children }: { children: React.ReactNode }) {
  const { firebaseUser, profile, effectiveRole, logout } = useAuth();
  const { lang, setLang, t } = useI18n();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isStaff = ['super_admin', 'admin', 'content_manager', 'moderator'].includes(effectiveRole);

  const handleLangChange = async (nextLang: 'fr' | 'en') => {
    setLang(nextLang);
    if (firebaseUser && firebaseUser.emailVerified) {
      try {
        await updateUserProfileSettings(firebaseUser.uid, { preferredLang: nextLang });
      } catch {
        // non-blocking
      }
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const navItems = [
    { to: '/dashboard', label: t.nav.dashboard, icon: LayoutDashboard },
    { to: '/couple', label: t.nav.couple, icon: HeartHandshake },
    { to: '/universes', label: t.nav.universes, icon: Compass },
    { to: '/favorites', label: t.nav.favorites, icon: Bookmark },
    { to: '/space', label: t.nav.individual, icon: User },
  ];

  return (
    <div className="min-h-screen bg-[#100D10] text-[#F4EEF0] flex flex-col lg:flex-row">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 bg-[#191217] border-r border-[#32101D]">
        <div className="h-16 px-6 flex items-center border-b border-[#32101D]">
          <Link to="/dashboard">
            <NoctaLogo />
          </Link>
        </div>

        <nav className="flex-1 px-3 py-6 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                    isActive
                      ? 'bg-[#4B1028] text-[#F4EEF0]'
                      : 'text-[#B8AAB0] hover:bg-[#32101D]/60 hover:text-[#F4EEF0]'
                  }`
                }
              >
                <Icon className="w-4 h-4 shrink-0 text-[#C5A276]" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}

          {isStaff && (
            <div className="pt-4 mt-4 border-t border-[#32101D]">
              <NavLink
                to="/admin"
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                    isActive
                      ? 'bg-[#781D35] text-[#F4EEF0]'
                      : 'text-[#C5A276] hover:bg-[#32101D]/60'
                  }`
                }
              >
                <Shield className="w-4 h-4 shrink-0" />
                <span>{t.nav.admin}</span>
              </NavLink>
            </div>
          )}
        </nav>

        <div className="p-4 border-t border-[#32101D] space-y-3">
          <div className="flex items-center justify-between gap-2 px-1">
            <span className="text-xs text-[#B8AAB0] truncate max-w-[130px]">
              {profile?.displayName || firebaseUser?.email}
            </span>
            <div className="flex items-center gap-1 border border-[#32101D] rounded-md p-0.5 bg-[#100D10]">
              <button
                type="button"
                onClick={() => void handleLangChange('fr')}
                className={`px-2 py-0.5 text-[11px] rounded cursor-pointer ${
                  lang === 'fr' ? 'bg-[#4B1028] text-[#F4EEF0]' : 'text-[#B8AAB0]'
                }`}
              >
                FR
              </button>
              <button
                type="button"
                onClick={() => void handleLangChange('en')}
                className={`px-2 py-0.5 text-[11px] rounded cursor-pointer ${
                  lang === 'en' ? 'bg-[#4B1028] text-[#F4EEF0]' : 'text-[#B8AAB0]'
                }`}
              >
                EN
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={() => void handleLogout()}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border border-[#32101D] text-[#B8AAB0] hover:text-[#F4EEF0] hover:border-[#781D35] transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>{t.nav.signOut}</span>
          </button>
        </div>
      </aside>

      {/* Mobile Header (Compact <= 56px, well under 15% mobile height cap) */}
      <header className="lg:hidden sticky top-0 z-30 h-14 px-4 bg-[#191217]/95 backdrop-blur border-b border-[#32101D] flex items-center justify-between gap-4">
        <Link to="/dashboard">
          <NoctaLogo compact={false} />
        </Link>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void handleLangChange(lang === 'fr' ? 'en' : 'fr')}
            className="px-2.5 py-1.5 text-xs border border-[#32101D] rounded-md text-[#C5A276] cursor-pointer"
          >
            {lang.toUpperCase()}
          </button>
          <button
            type="button"
            onClick={() => setMobileMenuOpen((v) => !v)}
            aria-label="Menu"
            className="p-2 rounded-lg border border-[#32101D] text-[#F4EEF0] cursor-pointer"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 top-14 z-40 bg-[#100D10]/98 p-4 overflow-y-auto space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setMobileMenuOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-3.5 rounded-lg text-base font-medium ${
                    isActive ? 'bg-[#4B1028] text-[#F4EEF0]' : 'bg-[#191217] text-[#B8AAB0]'
                  }`
                }
              >
                <Icon className="w-5 h-5 text-[#C5A276]" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
          {isStaff && (
            <NavLink
              to="/admin"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-3 px-4 py-3.5 rounded-lg text-base font-medium bg-[#32101D] text-[#C5A276]"
            >
              <Shield className="w-5 h-5" />
              <span>{t.nav.admin}</span>
            </NavLink>
          )}
          <div className="pt-4 border-t border-[#32101D]">
            <button
              type="button"
              onClick={() => void handleLogout()}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-[#191217] border border-[#32101D] text-[#F4EEF0] text-sm font-medium cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>{t.nav.signOut}</span>
            </button>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 lg:pl-64 min-w-0">
        <div className="max-w-6xl mx-auto px-4 sm:px-8 py-6 sm:py-10">{children}</div>
      </main>
    </div>
  );
}
