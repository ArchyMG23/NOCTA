import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity as ActivityIcon,
  ArrowLeft,
  BarChart3,
  BookOpen,
  Compass,
  FileUp,
  Flame,
  Globe,
  HeartHandshake,
  History,
  Image,
  KeyRound,
  LayoutDashboard,
  LayoutTemplate,
  Layers,
  MessageSquareText,
  Palette,
  Settings,
  Shield,
  ShieldAlert,
  Sparkles,
  Type,
  Users,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../i18n/I18nContext';
import { TRANSLATIONS } from '../i18n/translations';
import {
  assignStaffRole,
  bootstrapSuperAdminRecord,
  fetchAdminCouplesList,
  fetchAdminDashboardMetrics,
  fetchAdminRolesList,
  fetchAdminUsersList,
  fetchAllActivitiesForAdmin,
  fetchFormats,
  fetchSiteSettings,
  fetchUniverses,
  saveSiteSettings,
  seedCatalogToFirestore,
  seedStarterActivitiesToFirestore,
  updateFormatAdmin,
  updateUniverseAdmin,
  type AdminDashboardMetrics,
} from '../services/noctaService';
import { NoctaLogo } from '../components/NoctaLogo';
import { ActivityCrudPanel } from '../components/admin/ActivityCrudPanel';
import { DocumentImportPanel } from '../components/admin/DocumentImportPanel';
import { EditorialTextsPanel } from '../components/admin/EditorialTextsPanel';
import { HomepageCustomizerPanel } from '../components/admin/HomepageCustomizerPanel';
import { MediaManagerPanel } from '../components/admin/MediaManagerPanel';
import type {
  Activity,
  ActivityFormat,
  AdminRoleRecord,
  Couple,
  SiteSetting,
  Universe,
  UserPublicProfile,
  UserRole,
} from '../types/nocta';

type AdminSection =
  | 'dashboard'
  | 'users'
  | 'couples'
  | 'universes'
  | 'formats'
  | 'questions'
  | 'challenges'
  | 'scenarios'
  | 'educational'
  | 'imports'
  | 'media'
  | 'editorialTexts'
  | 'homepageBuilder'
  | 'historyStats'
  | 'translations'
  | 'security'
  | 'appearance'
  | 'stats'
  | 'settings'
  | 'roles';

export function AdminPage() {
  const { firebaseUser, profile, isEmailVerified, adminRecord, effectiveRole } = useAuth();
  const { lang, setLang, t } = useI18n();

  const [serverVerified, setServerVerified] = useState(false);
  const [serverRole, setServerRole] = useState<string>('');
  const [canBootstrap, setCanBootstrap] = useState(false);
  const [verifying, setVerifying] = useState(true);
  const [gateError, setGateError] = useState<string | null>(null);
  const [setupTokenInput, setSetupTokenInput] = useState('');

  const [activeSection, setActiveSection] = useState<AdminSection>('dashboard');
  const [metrics, setMetrics] = useState<AdminDashboardMetrics | null>(null);
  const [usersList, setUsersList] = useState<UserPublicProfile[]>([]);
  const [couplesList, setCouplesList] = useState<Couple[]>([]);
  const [universes, setUniverses] = useState<Universe[]>([]);
  const [formats, setFormats] = useState<ActivityFormat[]>([]);
  const [allActivities, setAllActivities] = useState<Activity[]>([]);
  const [rolesList, setRolesList] = useState<AdminRoleRecord[]>([]);
  const [siteSettings, setSiteSettings] = useState<SiteSetting>({
    id: 'public',
    defaultLang: 'fr',
    monetizationEnabled: false,
    remoteSyncEnabled: true,
    maintenanceMode: false,
    brandTaglineFr: 'Découvrez-vous autrement.',
    brandTaglineEn: 'A private world for two.',
  });

  const [selectedUniverseFilter, setSelectedUniverseFilter] = useState('all');
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  // Role assignment form
  const [roleTargetUid, setRoleTargetUid] = useState('');
  const [roleValue, setRoleValue] = useState<UserRole>('content_manager');

  const verifyWithServer = async () => {
    if (!firebaseUser || !isEmailVerified) {
      setVerifying(false);
      setServerVerified(false);
      return;
    }

    setVerifying(true);
    setGateError(null);
    try {
      const idToken = await firebaseUser.getIdToken();
      const resp = await fetch('/api/admin/verify', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
      });
      const data = await resp.json();
      if (!resp.ok || !data.authorized) {
        setServerVerified(false);
        setGateError(data.message || t.admin.accessDenied);
        return;
      }

      setServerRole(data.role);
      if (data.isBootstrapOwner && !data.hasPersistedAdminRecord) {
        setCanBootstrap(true);
        setServerVerified(false);
      } else {
        setCanBootstrap(false);
        setServerVerified(true);
      }
    } catch (err) {
      setGateError(err instanceof Error ? err.message : t.states.errorTitle);
      setServerVerified(false);
    } finally {
      setVerifying(false);
    }
  };

  useEffect(() => {
    void verifyWithServer();
  }, [firebaseUser, isEmailVerified, adminRecord?.role]);

  const handleBootstrapSuperAdmin = async () => {
    if (!firebaseUser) return;
    setGateError(null);
    setVerifying(true);
    try {
      if (setupTokenInput.trim()) {
        const idToken = await firebaseUser.getIdToken();
        const resp = await fetch('/api/admin/verify-setup-token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({ token: setupTokenInput.trim() }),
        });
        if (!resp.ok) {
          setGateError(
            lang === 'fr'
              ? 'Jeton d’initialisation invalide.'
              : 'Invalid server setup token.'
          );
          setVerifying(false);
          return;
        }
      }

      await bootstrapSuperAdminRecord({
        uid: firebaseUser.uid,
        email: firebaseUser.email || '',
        displayName: profile?.displayName || firebaseUser.displayName || 'Super Admin',
      });
      setCanBootstrap(false);
      setServerVerified(true);
      setServerRole('super_admin');
    } catch (err) {
      setGateError(err instanceof Error ? err.message : t.states.errorTitle);
    } finally {
      setVerifying(false);
    }
  };

  const loadAdminWorkspace = async () => {
    if (!serverVerified) return;
    try {
      const [m, u, c, univs, fmts, acts, rls, settings] = await Promise.all([
        fetchAdminDashboardMetrics(),
        ['super_admin', 'admin'].includes(serverRole) ? fetchAdminUsersList() : Promise.resolve([]),
        ['super_admin', 'admin'].includes(serverRole) ? fetchAdminCouplesList() : Promise.resolve([]),
        fetchUniverses(),
        fetchFormats(),
        fetchAllActivitiesForAdmin(),
        ['super_admin', 'admin'].includes(serverRole) ? fetchAdminRolesList() : Promise.resolve([]),
        fetchSiteSettings(),
      ]);
      setMetrics(m);
      setUsersList(u);
      setCouplesList(c);
      setUniverses(univs);
      setFormats(fmts);
      setAllActivities(acts);
      setRolesList(rls);
      setSiteSettings(settings);
    } catch (err) {
      console.error('Admin workspace load error:', err);
    }
  };

  useEffect(() => {
    if (serverVerified) {
      void loadAdminWorkspace();
    }
  }, [serverVerified, activeSection]);

  if (!firebaseUser || !isEmailVerified) {
    return (
      <div className="min-h-screen bg-[#100D10] text-[#F4EEF0] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-[#191217] border border-[#32101D] rounded-xl p-8 space-y-5">
          <NoctaLogo />
          <h1 className="font-display text-3xl font-semibold text-[#F4EEF0]">
            {t.admin.gateTitle}
          </h1>
          <p className="text-sm text-[#B8AAB0] leading-relaxed">{t.admin.gateSubtitle}</p>
          <div className="flex gap-3">
            <Link
              to="/auth?mode=signin"
              className="px-5 py-2.5 bg-[#781D35] hover:bg-[#4B1028] text-xs font-medium text-[#F4EEF0] rounded-lg"
            >
              {t.nav.signIn}
            </Link>
            <Link
              to="/"
              className="px-5 py-2.5 border border-[#32101D] text-xs text-[#B8AAB0] rounded-lg"
            >
              {t.nav.backHome}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (verifying) {
    return (
      <div className="min-h-screen bg-[#100D10] text-[#F4EEF0] flex items-center justify-center p-6">
        <p className="text-sm text-[#B8AAB0]">{t.states.loading}</p>
      </div>
    );
  }

  if (canBootstrap && !serverVerified) {
    return (
      <div className="min-h-screen bg-[#100D10] text-[#F4EEF0] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-[#191217] border border-[#C5A276]/50 rounded-xl p-8 space-y-5">
          <NoctaLogo />
          <h1 className="font-display text-3xl font-semibold text-[#F4EEF0]">
            {t.admin.bootstrapTitle}
          </h1>
          <p className="text-sm text-[#B8AAB0] leading-relaxed">{t.admin.bootstrapBody}</p>
          {gateError && (
            <div className="p-3 rounded-lg bg-[#32101D] border border-[#781D35] text-xs text-[#F4EEF0]">
              {gateError}
            </div>
          )}
          <div className="space-y-1.5">
            <label className="block text-xs text-[#B8AAB0]">{t.admin.setupTokenLabel}</label>
            <input
              type="password"
              value={setupTokenInput}
              onChange={(e) => setSetupTokenInput(e.target.value)}
              className="w-full px-3.5 py-2 bg-[#100D10] border border-[#32101D] rounded-lg text-xs text-[#F4EEF0]"
            />
          </div>
          <button
            type="button"
            onClick={() => void handleBootstrapSuperAdmin()}
            className="w-full px-5 py-3 bg-[#781D35] hover:bg-[#4B1028] text-xs font-medium text-[#F4EEF0] rounded-lg cursor-pointer"
          >
            {t.admin.bootstrapBtn}
          </button>
        </div>
      </div>
    );
  }

  if (!serverVerified) {
    return (
      <div className="min-h-screen bg-[#100D10] text-[#F4EEF0] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-[#191217] border border-[#781D35] rounded-xl p-8 space-y-5">
          <div className="flex items-center gap-2 text-xs text-[#C5A276]">
            <ShieldAlert className="w-4 h-4" />
            <span>HTTP 403 · Server Protected</span>
          </div>
          <h1 className="font-display text-3xl font-semibold text-[#F4EEF0]">
            {t.admin.gateTitle}
          </h1>
          <p className="text-sm text-[#B8AAB0]">{gateError || t.admin.accessDenied}</p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => void verifyWithServer()}
              className="px-4 py-2.5 bg-[#4B1028] text-xs text-[#F4EEF0] rounded-lg cursor-pointer"
            >
              {t.admin.verifyServerBtn}
            </button>
            <Link
              to="/dashboard"
              className="px-4 py-2.5 border border-[#32101D] text-xs text-[#B8AAB0] rounded-lg"
            >
              {t.nav.dashboard}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const navItems: Array<{ id: AdminSection; label: string; icon: React.ComponentType<{ className?: string }> }> = [
    { id: 'dashboard', label: t.admin.modules.dashboard, icon: LayoutDashboard },
    { id: 'users', label: t.admin.modules.users, icon: Users },
    { id: 'couples', label: t.admin.modules.couples, icon: HeartHandshake },
    { id: 'universes', label: t.admin.modules.universes, icon: Compass },
    { id: 'formats', label: t.admin.modules.formats, icon: Layers },
    { id: 'questions', label: t.admin.modules.questions, icon: MessageSquareText },
    { id: 'challenges', label: t.admin.modules.challenges, icon: Flame },
    { id: 'scenarios', label: t.admin.modules.scenarios, icon: Sparkles },
    { id: 'educational', label: t.admin.modules.educational, icon: BookOpen },
    { id: 'imports', label: t.admin.modules.imports, icon: FileUp },
    { id: 'media', label: t.admin.modules.media, icon: Image },
    { id: 'editorialTexts', label: t.admin.modules.editorialTexts, icon: Type },
    { id: 'homepageBuilder', label: t.admin.modules.homepageBuilder, icon: LayoutTemplate },
    { id: 'historyStats', label: t.admin.modules.historyStats, icon: History },
    { id: 'translations', label: t.admin.modules.translations, icon: Globe },
    { id: 'security', label: t.admin.modules.security, icon: Shield },
    { id: 'appearance', label: t.admin.modules.appearance, icon: Palette },
    { id: 'stats', label: t.admin.modules.stats, icon: BarChart3 },
    { id: 'settings', label: t.admin.modules.settings, icon: Settings },
    { id: 'roles', label: t.admin.modules.roles, icon: KeyRound },
  ];

  const handleSeedCatalog = async () => {
    if (!firebaseUser) return;
    await seedCatalogToFirestore(firebaseUser.uid, serverRole);
    setActionNotice(
      lang === 'fr'
        ? 'Les 12 univers et 60 formats ont été synchronisés dans Firestore.'
        : '12 universes and 60 formats synchronized to Firestore.'
    );
    await loadAdminWorkspace();
  };

  const handleSeedStarterActivities = async () => {
    if (!firebaseUser) return;
    const count = await seedStarterActivitiesToFirestore(firebaseUser.uid, serverRole);
    setActionNotice(
      lang === 'fr'
        ? `${count} activité(s) de base ajoutée(s).`
        : `${count} starter activity(ies) added.`
    );
    await loadAdminWorkspace();
  };

  const effectiveAdminRole = serverRole || effectiveRole;

  return (
    <div className="min-h-screen bg-[#100D10] text-[#F4EEF0] flex flex-col lg:flex-row">
      {/* Admin Sidebar */}
      <aside className="lg:w-72 lg:fixed lg:inset-y-0 bg-[#191217] border-b lg:border-b-0 lg:border-r border-[#32101D] flex flex-col">
        <div className="h-16 px-5 border-b border-[#32101D] flex items-center justify-between">
          <Link to="/dashboard" className="flex items-center gap-2 text-xs text-[#B8AAB0] hover:text-[#F4EEF0]">
            <ArrowLeft className="w-3.5 h-3.5" />
            <NoctaLogo compact />
            <span className="font-display text-lg text-[#F4EEF0]">Admin</span>
          </Link>
          <button
            type="button"
            onClick={() => setLang(lang === 'fr' ? 'en' : 'fr')}
            className="px-2 py-1 text-[11px] border border-[#32101D] rounded text-[#C5A276] cursor-pointer"
          >
            {lang.toUpperCase()}
          </button>
        </div>

        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto flex lg:flex-col gap-1 lg:gap-0.5 overflow-x-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setActionNotice(null);
                  setActiveSection(item.id);
                }}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                  activeSection === item.id
                    ? 'bg-[#4B1028] text-[#F4EEF0]'
                    : 'text-[#B8AAB0] hover:bg-[#32101D]/60 hover:text-[#F4EEF0]'
                }`}
              >
                <Icon className="w-3.5 h-3.5 text-[#C5A276] shrink-0" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="hidden lg:block p-4 border-t border-[#32101D] text-xs text-[#B8AAB0]">
          <p className="truncate text-[#F4EEF0]">{firebaseUser.email}</p>
          <p className="text-[#C5A276] mt-0.5">{effectiveAdminRole}</p>
        </div>
      </aside>

      {/* Main Admin Viewport */}
      <main className="flex-1 lg:pl-72 min-w-0">
        <div className="max-w-6xl mx-auto p-4 sm:p-8 space-y-6">
          {actionNotice && (
            <div className="p-3.5 rounded-lg bg-[#191217] border border-[#C5A276]/60 text-xs text-[#C5A276]">
              {actionNotice}
            </div>
          )}

          {/* 1. Dashboard */}
          {activeSection === 'dashboard' && (
            <div className="space-y-8">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#32101D] pb-5">
                <div>
                  <h1 className="font-display text-3xl font-semibold text-[#F4EEF0]">
                    {t.admin.modules.dashboard}
                  </h1>
                  <p className="text-xs text-[#B8AAB0]">
                    {firebaseUser.email} · {effectiveAdminRole}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void handleSeedCatalog()}
                    className="px-4 py-2 bg-[#4B1028] hover:bg-[#781D35] text-xs font-medium text-[#F4EEF0] rounded-lg cursor-pointer"
                  >
                    {t.admin.seedCatalogBtn}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleSeedStarterActivities()}
                    className="px-4 py-2 border border-[#32101D] hover:border-[#C5A276] text-xs text-[#F4EEF0] rounded-lg cursor-pointer"
                  >
                    {t.admin.seedStarterActivitiesBtn}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                {[
                  { label: t.admin.statsCards.users, val: metrics?.usersCount ?? 0 },
                  { label: t.admin.statsCards.couples, val: metrics?.couplesCount ?? 0 },
                  { label: t.admin.statsCards.published, val: metrics?.publishedActivitiesCount ?? 0 },
                  { label: t.admin.statsCards.drafts, val: metrics?.draftActivitiesCount ?? 0 },
                  { label: t.admin.statsCards.activeUniverses, val: metrics?.activeUniversesCount ?? 0 },
                  { label: t.admin.modules.imports, val: metrics?.importsCount ?? 0 },
                ].map((stat, idx) => (
                  <div
                    key={idx}
                    className="bg-[#191217] border border-[#32101D] rounded-xl p-5 space-y-2"
                  >
                    <p className="text-xs text-[#B8AAB0]">{stat.label}</p>
                    <p className="font-mono-tabular text-3xl font-semibold text-[#F4EEF0]">
                      {stat.val}
                    </p>
                  </div>
                ))}
              </div>

              <section className="bg-[#191217] border border-[#32101D] rounded-xl p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="font-display text-2xl font-semibold text-[#F4EEF0]">
                    {lang === 'fr' ? 'Journal administratif récent' : 'Recent administrative logs'}
                  </h2>
                  <ActivityIcon className="w-4 h-4 text-[#C5A276]" />
                </div>
                {!metrics || metrics.recentLogs.length === 0 ? (
                  <p className="text-xs text-[#B8AAB0]">{t.states.empty}</p>
                ) : (
                  <div className="divide-y divide-[#32101D] text-xs">
                    {metrics.recentLogs.map((log) => (
                      <div key={log.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <span className="text-[#C5A276] font-mono-tabular">{log.action}</span>
                          <span className="text-[#B8AAB0] ml-2">{log.summary}</span>
                        </div>
                        <span className="text-[#B8AAB0] font-mono-tabular shrink-0">
                          {log.actorRole}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          )}

          {/* 2. Users */}
          {activeSection === 'users' && (
            <div className="space-y-4">
              <h1 className="font-display text-3xl font-semibold">{t.admin.modules.users}</h1>
              <div className="bg-[#191217] border border-[#32101D] rounded-xl overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-[#32101D] text-[#B8AAB0]">
                      <th className="p-4">Name</th>
                      <th className="p-4">UID</th>
                      <th className="p-4">Role</th>
                      <th className="p-4">Lang</th>
                      <th className="p-4">Couple</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#32101D]">
                    {usersList.map((u) => (
                      <tr key={u.uid}>
                        <td className="p-4 font-medium text-[#F4EEF0]">{u.displayName}</td>
                        <td className="p-4 font-mono-tabular text-[#B8AAB0]">{u.uid.slice(0, 12)}...</td>
                        <td className="p-4 text-[#C5A276]">{u.role}</td>
                        <td className="p-4">{u.preferredLang.toUpperCase()}</td>
                        <td className="p-4 font-mono-tabular">{u.coupleId ? 'Linked' : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 3. Couples (Metadata only, zero intimate answers exposed) */}
          {activeSection === 'couples' && (
            <div className="space-y-4">
              <h1 className="font-display text-3xl font-semibold">{t.admin.modules.couples}</h1>
              <p className="text-xs text-[#B8AAB0]">
                {lang === 'fr'
                  ? 'Seules les métadonnées structurelles sont visibles ici. Les réponses et confidences intimes restent strictement privées.'
                  : 'Only structural metadata is visible here. Intimate answers and confidences remain strictly private.'}
              </p>
              <div className="bg-[#191217] border border-[#32101D] rounded-xl overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-[#32101D] text-[#B8AAB0]">
                      <th className="p-4">ID</th>
                      <th className="p-4">Name</th>
                      <th className="p-4">Status</th>
                      <th className="p-4">Mode</th>
                      <th className="p-4 text-right">Members</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#32101D]">
                    {couplesList.map((c) => (
                      <tr key={c.id}>
                        <td className="p-4 font-mono-tabular text-[#B8AAB0]">{c.id}</td>
                        <td className="p-4 text-[#F4EEF0]">{c.name}</td>
                        <td className="p-4 text-[#C5A276]">{c.status}</td>
                        <td className="p-4">{c.activeMode}</td>
                        <td className="p-4 text-right font-mono-tabular">{c.memberIds.length}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 4. Universes */}
          {activeSection === 'universes' && (
            <div className="space-y-4">
              <h1 className="font-display text-3xl font-semibold">{t.admin.modules.universes}</h1>
              <div className="space-y-3">
                {universes.map((u) => (
                  <div
                    key={u.id}
                    className="bg-[#191217] border border-[#32101D] rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div>
                      <p className="font-mono-tabular text-xs text-[#C5A276]">
                        {String(u.order).padStart(2, '0')} · {u.category}
                      </p>
                      <p className="text-sm font-semibold text-[#F4EEF0]">
                        {u.titleFr} / {u.titleEn}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        await updateUniverseAdmin(
                          { ...u, isActive: !u.isActive },
                          firebaseUser.uid,
                          effectiveAdminRole
                        );
                        await loadAdminWorkspace();
                      }}
                      className={`px-4 py-2 text-xs rounded-lg cursor-pointer ${
                        u.isActive
                          ? 'bg-[#4B1028] text-[#F4EEF0]'
                          : 'border border-[#32101D] text-[#B8AAB0]'
                      }`}
                    >
                      {u.isActive ? 'Active' : 'Disabled'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 5. Formats (60) */}
          {activeSection === 'formats' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <h1 className="font-display text-3xl font-semibold">
                  {t.admin.modules.formats} ({formats.length})
                </h1>
                <select
                  value={selectedUniverseFilter}
                  onChange={(e) => setSelectedUniverseFilter(e.target.value)}
                  className="px-3 py-2 bg-[#191217] border border-[#32101D] rounded-lg text-xs text-[#F4EEF0]"
                >
                  <option value="all">{t.universes.allCategories}</option>
                  {universes.map((u) => (
                    <option key={u.id} value={u.id}>
                      {lang === 'fr' ? u.titleFr : u.titleEn}
                    </option>
                  ))}
                </select>
              </div>

              <div className="bg-[#191217] border border-[#32101D] rounded-xl divide-y divide-[#32101D]">
                {formats
                  .filter(
                    (f) =>
                      selectedUniverseFilter === 'all' || f.universeId === selectedUniverseFilter
                  )
                  .map((f) => (
                    <div
                      key={f.id}
                      className="p-4 flex items-center justify-between gap-4 text-xs"
                    >
                      <div>
                        <p className="font-medium text-[#F4EEF0]">
                          {f.titleFr} / {f.titleEn}
                        </p>
                        <p className="text-[#B8AAB0]">
                          {f.universeId} · #{f.order}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={async () => {
                          await updateFormatAdmin(
                            { ...f, isActive: !f.isActive },
                            firebaseUser.uid,
                            effectiveAdminRole
                          );
                          await loadAdminWorkspace();
                        }}
                        className={`px-3 py-1.5 rounded cursor-pointer ${
                          f.isActive
                            ? 'bg-[#4B1028] text-[#F4EEF0]'
                            : 'border border-[#32101D] text-[#B8AAB0]'
                        }`}
                      >
                        {f.isActive ? 'Active' : 'Disabled'}
                      </button>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* 6, 7, 8, 9. Content CRUD */}
          {activeSection === 'questions' && (
            <ActivityCrudPanel
              defaultType="question"
              sectionTitle={t.admin.modules.questions}
              actorRole={effectiveAdminRole}
            />
          )}
          {activeSection === 'challenges' && (
            <ActivityCrudPanel
              defaultType="challenge"
              sectionTitle={t.admin.modules.challenges}
              actorRole={effectiveAdminRole}
            />
          )}
          {activeSection === 'scenarios' && (
            <ActivityCrudPanel
              defaultType="scenario"
              sectionTitle={t.admin.modules.scenarios}
              actorRole={effectiveAdminRole}
            />
          )}
          {activeSection === 'educational' && (
            <ActivityCrudPanel
              defaultType="educational"
              sectionTitle={t.admin.modules.educational}
              actorRole={effectiveAdminRole}
            />
          )}

          {/* 10. Deterministic PDF/DOCX Document Import */}
          {activeSection === 'imports' && <DocumentImportPanel actorRole={effectiveAdminRole} />}

          {/* 10b. Private Media & Adult Photography Manager */}
          {activeSection === 'media' && <MediaManagerPanel actorRole={effectiveAdminRole} />}

          {/* 10c. Visual FR/EN Editorial Copy Editor */}
          {activeSection === 'editorialTexts' && (
            <EditorialTextsPanel actorRole={effectiveAdminRole} />
          )}

          {/* 10d. Homepage Customizer & Responsive Preview */}
          {activeSection === 'homepageBuilder' && (
            <HomepageCustomizerPanel actorRole={effectiveAdminRole} />
          )}

          {/* 11. Favorites & Histories (Privacy-preserving aggregate view) */}
          {activeSection === 'historyStats' && (
            <div className="space-y-4">
              <h1 className="font-display text-3xl font-semibold">
                {t.admin.modules.historyStats}
              </h1>
              <div className="bg-[#191217] border border-[#32101D] rounded-xl p-6 space-y-3 text-sm text-[#B8AAB0]">
                <p>
                  {lang === 'fr'
                    ? 'Conformément aux garanties de confidentialité NOCTA, les historiques individuels, favoris privés et réponses intimes des couples ne sont pas consultables nominativement dans cet espace.'
                    : 'In compliance with NOCTA privacy guarantees, individual histories, private favorites, and couple intimate responses cannot be inspected individually here.'}
                </p>
                <p className="font-mono-tabular text-[#C5A276]">
                  {t.admin.statsCards.couples}: {metrics?.couplesCount ?? 0} ·{' '}
                  {t.admin.statsCards.published}: {metrics?.publishedActivitiesCount ?? 0}
                </p>
              </div>
            </div>
          )}

          {/* 12. Languages & Translations */}
          {activeSection === 'translations' && (
            <div className="space-y-4">
              <h1 className="font-display text-3xl font-semibold">
                {t.admin.modules.translations}
              </h1>
              <div className="bg-[#191217] border border-[#32101D] rounded-xl p-6 space-y-4">
                <p className="text-xs text-[#B8AAB0]">
                  {lang === 'fr'
                    ? 'Système bilingue centralisé (FR par défaut / EN).'
                    : 'Centralized bilingual dictionary (FR default / EN).'}
                </p>
                <div className="divide-y divide-[#32101D] text-xs">
                  {Object.keys(TRANSLATIONS.fr).map((ns) => (
                    <div key={ns} className="py-2.5 flex items-center justify-between">
                      <span className="font-mono-tabular text-[#F4EEF0]">{ns}</span>
                      <span className="text-[#C5A276]">FR · EN</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 13. Security & Moderation */}
          {activeSection === 'security' && (
            <div className="space-y-4">
              <h1 className="font-display text-3xl font-semibold">{t.admin.modules.security}</h1>
              <div className="bg-[#191217] border border-[#32101D] rounded-xl p-6 space-y-3 text-xs text-[#B8AAB0]">
                <p>
                  <strong className="text-[#F4EEF0]">Firestore Rules:</strong> Eight Pillars
                  enforced (PII isolation, couple membership gate, immutable audit logs, verified
                  email enforcement).
                </p>
                <p>
                  <strong className="text-[#F4EEF0]">MFA Readiness:</strong>{' '}
                  {lang === 'fr'
                    ? 'Activez l’authentification multifacteur (TOTP/SMS) sur le compte Google / Firebase Console des administrateurs.'
                    : 'Enable multi-factor authentication (TOTP/SMS) on staff Google accounts and Firebase Console.'}
                </p>
              </div>
            </div>
          )}

          {/* 14. Appearance & Brand Identity */}
          {activeSection === 'appearance' && (
            <div className="space-y-6">
              <h1 className="font-display text-3xl font-semibold">
                {t.admin.modules.appearance}
              </h1>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { name: 'Noir profond', hex: '#100D10' },
                  { name: 'Noir secondaire', hex: '#191217' },
                  { name: 'Bordeaux profond', hex: '#4B1028' },
                  { name: 'Rouge profond', hex: '#781D35' },
                  { name: 'Rouge sombre', hex: '#32101D' },
                  { name: 'Blanc doux', hex: '#F4EEF0' },
                  { name: 'Gris rosé', hex: '#B8AAB0' },
                  { name: 'Champagne', hex: '#C5A276' },
                ].map((sw) => (
                  <div
                    key={sw.hex}
                    className="bg-[#191217] border border-[#32101D] rounded-xl p-3 space-y-2"
                  >
                    <div
                      className="h-12 rounded-lg border border-white/10"
                      style={{ backgroundColor: sw.hex }}
                    />
                    <p className="text-xs font-medium text-[#F4EEF0]">{sw.name}</p>
                    <p className="font-mono-tabular text-[11px] text-[#B8AAB0]">{sw.hex}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 15. Statistics */}
          {activeSection === 'stats' && (
            <div className="space-y-4">
              <h1 className="font-display text-3xl font-semibold">{t.admin.modules.stats}</h1>
              <div className="bg-[#191217] border border-[#32101D] rounded-xl p-6 space-y-4">
                {universes.map((u) => {
                  const count = allActivities.filter((a) => a.universeId === u.id).length;
                  return (
                    <div key={u.id} className="flex items-center justify-between text-xs">
                      <span className="text-[#F4EEF0]">
                        {String(u.order).padStart(2, '0')}.{' '}
                        {lang === 'fr' ? u.titleFr : u.titleEn}
                      </span>
                      <span className="font-mono-tabular text-[#C5A276]">
                        {count} {lang === 'fr' ? 'contenus' : 'items'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 16. General Settings */}
          {activeSection === 'settings' && (
            <div className="space-y-4">
              <h1 className="font-display text-3xl font-semibold">{t.admin.modules.settings}</h1>
              <div className="bg-[#191217] border border-[#32101D] rounded-xl p-6 space-y-4 max-w-xl">
                <div className="space-y-1.5">
                  <label className="block text-xs text-[#B8AAB0]">Default Language</label>
                  <select
                    value={siteSettings.defaultLang}
                    onChange={(e) =>
                      setSiteSettings({
                        ...siteSettings,
                        defaultLang: e.target.value as 'fr' | 'en',
                      })
                    }
                    className="w-full px-3 py-2 bg-[#100D10] border border-[#32101D] rounded-lg text-xs text-[#F4EEF0]"
                  >
                    <option value="fr">Français</option>
                    <option value="en">English</option>
                  </select>
                </div>

                <label className="flex items-center gap-2.5 text-xs text-[#F4EEF0] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={siteSettings.remoteSyncEnabled}
                    onChange={(e) =>
                      setSiteSettings({ ...siteSettings, remoteSyncEnabled: e.target.checked })
                    }
                    className="accent-[#781D35]"
                  />
                  <span>Remote couple sync architecture enabled</span>
                </label>

                <label className="flex items-center gap-2.5 text-xs text-[#B8AAB0]">
                  <input
                    type="checkbox"
                    disabled
                    checked={false}
                    className="accent-[#781D35]"
                  />
                  <span>
                    Monetization / Subscriptions (Disabled — NOCTA v1 is 100% free)
                  </span>
                </label>

                <button
                  type="button"
                  onClick={async () => {
                    await saveSiteSettings(siteSettings, firebaseUser.uid, effectiveAdminRole);
                    setActionNotice(t.individual.savedSuccess);
                  }}
                  className="px-5 py-2.5 bg-[#781D35] hover:bg-[#4B1028] text-xs font-medium text-[#F4EEF0] rounded-lg cursor-pointer"
                >
                  {lang === 'fr' ? 'Enregistrer les paramètres' : 'Save settings'}
                </button>
              </div>
            </div>
          )}

          {/* 17. Roles & Permissions */}
          {activeSection === 'roles' && (
            <div className="space-y-6">
              <h1 className="font-display text-3xl font-semibold">{t.admin.modules.roles}</h1>

              <div className="bg-[#191217] border border-[#32101D] rounded-xl divide-y divide-[#32101D]">
                {rolesList.map((r) => (
                  <div key={r.uid} className="p-4 flex items-center justify-between text-xs">
                    <div>
                      <p className="font-medium text-[#F4EEF0]">{r.displayName || r.email}</p>
                      <p className="text-[#B8AAB0]">{r.email}</p>
                    </div>
                    <span className="font-mono-tabular text-[#C5A276]">{r.role}</span>
                  </div>
                ))}
              </div>

              {effectiveAdminRole === 'super_admin' && usersList.length > 0 && (
                <div className="bg-[#191217] border border-[#32101D] rounded-xl p-6 space-y-4 max-w-xl">
                  <h2 className="font-display text-xl font-semibold text-[#F4EEF0]">
                    {lang === 'fr' ? 'Attribuer un rôle' : 'Assign role'}
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <select
                      value={roleTargetUid}
                      onChange={(e) => setRoleTargetUid(e.target.value)}
                      className="px-3 py-2 bg-[#100D10] border border-[#32101D] rounded-lg text-xs text-[#F4EEF0]"
                    >
                      <option value="">Select user...</option>
                      {usersList.map((u) => (
                        <option key={u.uid} value={u.uid}>
                          {u.displayName} ({u.role})
                        </option>
                      ))}
                    </select>
                    <select
                      value={roleValue}
                      onChange={(e) => setRoleValue(e.target.value as UserRole)}
                      className="px-3 py-2 bg-[#100D10] border border-[#32101D] rounded-lg text-xs text-[#F4EEF0]"
                    >
                      <option value="user">user</option>
                      <option value="moderator">moderator</option>
                      <option value="content_manager">content_manager</option>
                      <option value="admin">admin</option>
                      <option value="super_admin">super_admin</option>
                    </select>
                  </div>
                  <button
                    type="button"
                    disabled={!roleTargetUid}
                    onClick={async () => {
                      const target = usersList.find((u) => u.uid === roleTargetUid);
                      if (!target) return;
                      await assignStaffRole({
                        targetUid: target.uid,
                        targetEmail: target.uid,
                        displayName: target.displayName,
                        role: roleValue,
                        actorUid: firebaseUser.uid,
                        actorRole: effectiveAdminRole,
                      });
                      setActionNotice('Role updated.');
                      await loadAdminWorkspace();
                    }}
                    className="px-4 py-2 bg-[#781D35] hover:bg-[#4B1028] disabled:opacity-40 text-xs text-[#F4EEF0] rounded-lg cursor-pointer"
                  >
                    {lang === 'fr' ? 'Appliquer le rôle' : 'Apply role'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
