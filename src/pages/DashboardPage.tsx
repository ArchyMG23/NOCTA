import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Bookmark, Compass, HeartHandshake, History, Settings, User, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../i18n/I18nContext';
import {
  fetchCoupleHistoryAndFavorites,
  fetchIndividualLedger,
  fetchPublishedActivities,
  fetchUniverses,
  updateUserProfileSettings,
} from '../services/noctaService';
import { AppShell } from '../components/AppShell';
import type { Activity, CoupleFavoriteItem, CoupleHistoryItem, IndividualLedgerItem, Universe } from '../types/nocta';

export function DashboardPage() {
  const {
    firebaseUser,
    profile,
    privateInfo,
    couple,
    dissolvedCoupleNotice,
    dismissDissolvedNotice,
    reactivateOwnAccount,
  } = useAuth();
  const { lang, t } = useI18n();
  const [universes, setUniverses] = useState<Universe[]>([]);
  const [coupleHistory, setCoupleHistory] = useState<CoupleHistoryItem[]>([]);
  const [coupleFavorites, setCoupleFavorites] = useState<CoupleFavoriteItem[]>([]);
  const [individualLedger, setIndividualLedger] = useState<IndividualLedgerItem[]>([]);
  const [activitiesMap, setActivitiesMap] = useState<Map<string, Activity>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      if (!firebaseUser) return;
      setLoading(true);
      try {
        const [uList, actList, indList] = await Promise.all([
          fetchUniverses(),
          fetchPublishedActivities(),
          fetchIndividualLedger(firebaseUser.uid),
        ]);
        if (!active) return;
        setUniverses(uList.filter((u) => u.isActive));
        const map = new Map<string, Activity>();
        for (const a of actList) map.set(a.id, a);
        setActivitiesMap(map);
        setIndividualLedger(indList);

        if (couple?.id) {
          const cf = await fetchCoupleHistoryAndFavorites(couple.id);
          if (!active) return;
          setCoupleHistory(cf.history);
          setCoupleFavorites(cf.favorites);
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [firebaseUser, couple?.id]);

  const totalHistoryCount = couple?.id
    ? coupleHistory.length
    : individualLedger.filter((i) => i.kind === 'history').length;

  const totalFavoritesCount = couple?.id
    ? coupleFavorites.length
    : individualLedger.filter((i) => i.kind === 'favorite').length;

  const recentIds = couple?.id
    ? coupleHistory.slice(0, 4).map((h) => ({ id: h.activityId, status: h.status }))
    : individualLedger
        .filter((i) => i.kind === 'history')
        .slice(0, 4)
        .map((i) => ({ id: i.activityId, status: i.status }));

  const greetingName = profile?.firstName || profile?.displayName || '';

  return (
    <AppShell>
      <div className="space-y-8">
        {/* Account Deactivated Banner */}
        {profile?.accountStatus === 'deactivated' && (
          <div className="p-4 sm:p-5 rounded-xl bg-[#32101D] border border-[#C5A276]/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-[#F4EEF0]">
                {t.dashboard.deactivatedBannerTitle}
              </p>
              <p className="text-xs text-[#B8AAB0]">{t.dashboard.deactivatedBannerBody}</p>
            </div>
            <button
              type="button"
              onClick={() => void reactivateOwnAccount()}
              className="px-4 py-2 bg-[#781D35] hover:bg-[#4B1028] text-xs font-medium text-[#F4EEF0] rounded-lg cursor-pointer shrink-0"
            >
              {t.dashboard.reactivateBtn}
            </button>
          </div>
        )}

        {/* Couple Dissolved Cleanly Notice */}
        {dissolvedCoupleNotice && (
          <div className="p-4 rounded-xl bg-[#191217] border border-[#C5A276]/50 flex items-center justify-between gap-4">
            <p className="text-xs text-[#F4EEF0]">{t.dashboard.coupleDissolvedNotice}</p>
            <button
              type="button"
              onClick={dismissDissolvedNotice}
              aria-label="Dismiss"
              className="text-[#B8AAB0] hover:text-[#F4EEF0] cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Greeting Header */}
        <section className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-[#32101D] pb-6">
          <div className="space-y-1.5">
            <p className="text-xs tracking-wider text-[#C5A276]">NOCTA · {t.brand.secondaryTagline}</p>
            <h1 className="font-display text-3xl sm:text-4xl font-semibold text-[#F4EEF0]">
              {t.dashboard.greeting}{greetingName ? `, ${greetingName}` : ''}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="/space"
              className="inline-flex items-center gap-2 px-4 py-2 border border-[#32101D] hover:border-[#C5A276] rounded-lg text-xs font-medium text-[#B8AAB0] hover:text-[#F4EEF0] transition-colors"
            >
              <Settings className="w-3.5 h-3.5" />
              <span>{t.nav.individual}</span>
            </Link>
            <Link
              to="/couple"
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#781D35] hover:bg-[#4B1028] rounded-lg text-xs font-medium text-[#F4EEF0] transition-colors"
            >
              <HeartHandshake className="w-3.5 h-3.5" />
              <span>{t.dashboard.openCoupleSpace}</span>
            </Link>
          </div>
        </section>

        {/* Optional Onboarding Strip for New Users */}
        {profile && profile.onboardingCompleted === false && (
          <section className="bg-[#191217] border border-[#4B1028] rounded-xl p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="font-display text-2xl font-semibold text-[#F4EEF0]">
                  {t.dashboard.onboardingTitle}
                </h2>
                <p className="text-xs text-[#B8AAB0] mt-1">{t.dashboard.onboardingSubtitle}</p>
              </div>
              <button
                type="button"
                onClick={() =>
                  void updateUserProfileSettings(profile.uid, { onboardingCompleted: true })
                }
                className="text-xs text-[#C5A276] hover:underline self-start sm:self-center cursor-pointer"
              >
                {t.dashboard.onboardingDismiss}
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Link
                to="/space"
                className="p-3.5 rounded-lg bg-[#100D10] border border-[#32101D] hover:border-[#C5A276] flex items-center justify-between text-xs text-[#F4EEF0]"
              >
                <span>{t.dashboard.onboardingStepProfile}</span>
                <ArrowRight className="w-3.5 h-3.5 text-[#C5A276]" />
              </Link>
              <Link
                to="/couple"
                className="p-3.5 rounded-lg bg-[#100D10] border border-[#32101D] hover:border-[#C5A276] flex items-center justify-between text-xs text-[#F4EEF0]"
              >
                <span>{t.dashboard.onboardingStepCouple}</span>
                <ArrowRight className="w-3.5 h-3.5 text-[#C5A276]" />
              </Link>
              <Link
                to="/universes"
                className="p-3.5 rounded-lg bg-[#100D10] border border-[#32101D] hover:border-[#C5A276] flex items-center justify-between text-xs text-[#F4EEF0]"
              >
                <span>{t.dashboard.onboardingStepSolo}</span>
                <ArrowRight className="w-3.5 h-3.5 text-[#C5A276]" />
              </Link>
            </div>
          </section>
        )}

        {/* Partner Status & KPI Summary */}
        <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-2 bg-[#191217] border border-[#32101D] rounded-xl p-6 flex flex-col justify-between space-y-4">
            <div className="space-y-1">
              <p className="text-xs text-[#B8AAB0]">{t.dashboard.coupleStatusTitle}</p>
              <h2 className="font-display text-2xl font-semibold text-[#F4EEF0]">
                {couple?.status === 'active'
                  ? `${couple.name} · ${t.dashboard.coupleConnected}`
                  : couple?.status === 'pending'
                    ? `${couple.name} · ${t.dashboard.couplePending}`
                    : t.dashboard.coupleNone}
              </h2>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-[#32101D]">
              <span className="text-xs text-[#C5A276]">
                {couple
                  ? `${t.dashboard.modeReadyLabel}: ${couple.activeMode}`
                  : t.couple.coupleRequiredNotice}
              </span>
              <Link
                to="/couple"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-[#F4EEF0] hover:text-[#C5A276]"
              >
                <span>{couple ? t.dashboard.openCoupleSpace : t.dashboard.invitePartnerCta}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>

          <div className="bg-[#191217] border border-[#32101D] rounded-xl p-6 flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs text-[#B8AAB0]">
              <span>{t.dashboard.historyCount}</span>
              <History className="w-4 h-4 text-[#C5A276]" />
            </div>
            <p className="font-mono-tabular text-3xl font-semibold text-[#F4EEF0] mt-3">
              {loading ? '—' : totalHistoryCount}
            </p>
            <Link to="/favorites" className="text-xs text-[#C5A276] hover:underline mt-2">
              {t.nav.favorites}
            </Link>
          </div>

          <div className="bg-[#191217] border border-[#32101D] rounded-xl p-6 flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs text-[#B8AAB0]">
              <span>{t.dashboard.favoritesCount}</span>
              <Bookmark className="w-4 h-4 text-[#C5A276]" />
            </div>
            <p className="font-mono-tabular text-3xl font-semibold text-[#F4EEF0] mt-3">
              {loading ? '—' : totalFavoritesCount}
            </p>
            <Link to="/universes" className="text-xs text-[#C5A276] hover:underline mt-2">
              {t.dashboard.openUniverses}
            </Link>
          </div>
        </section>

        {/* Quick Access Grid */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 bg-[#191217] border border-[#32101D] rounded-xl p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-2xl font-semibold text-[#F4EEF0]">
                {t.dashboard.recentActivitiesTitle}
              </h2>
              <Link to="/favorites" className="text-xs text-[#C5A276] hover:underline">
                {t.nav.favorites}
              </Link>
            </div>

            {loading ? (
              <p className="text-sm text-[#B8AAB0]">{t.states.loading}</p>
            ) : recentIds.length === 0 ? (
              <div className="py-6 space-y-4">
                <p className="text-sm text-[#B8AAB0]">{t.dashboard.noRecentActivities}</p>
                <Link
                  to="/couple"
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#781D35] hover:bg-[#4B1028] text-[#F4EEF0] text-xs font-medium rounded-lg transition-colors"
                >
                  <span>{t.dashboard.startFirstActivity}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-[#32101D]">
                {recentIds.map((item) => {
                  const act = activitiesMap.get(item.id);
                  return (
                    <div key={item.id} className="py-3.5 flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-[#F4EEF0] truncate">
                          {privateInfo?.discreetMode
                            ? 'NOCTA · ••••••'
                            : act
                              ? lang === 'fr'
                                ? act.titleFr
                                : act.titleEn
                              : item.id}
                        </p>
                        <p className="text-xs text-[#B8AAB0]">
                          {act?.type || 'activity'} · {item.status}
                        </p>
                      </div>
                      <Link
                        to="/favorites"
                        className="text-xs text-[#C5A276] hover:underline shrink-0"
                      >
                        {lang === 'fr' ? 'Voir' : 'View'}
                      </Link>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="lg:col-span-5 bg-[#191217] border border-[#32101D] rounded-xl p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-2xl font-semibold text-[#F4EEF0]">
                {t.nav.universes}
              </h2>
              <Compass className="w-4 h-4 text-[#C5A276]" />
            </div>

            <div className="space-y-2.5">
              {universes.slice(0, 5).map((u) => (
                <Link
                  key={u.id}
                  to={`/universes/${u.slug}`}
                  className="flex items-center justify-between p-3 rounded-lg bg-[#100D10] border border-[#32101D] hover:border-[#781D35] transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[#F4EEF0] truncate">
                      {String(u.order).padStart(2, '0')}. {lang === 'fr' ? u.titleFr : u.titleEn}
                    </p>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-[#C5A276] shrink-0" />
                </Link>
              ))}
            </div>

            <Link
              to="/universes"
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 border border-[#32101D] hover:border-[#C5A276] rounded-lg text-xs font-medium text-[#F4EEF0] transition-colors"
            >
              <User className="w-3.5 h-3.5 text-[#C5A276]" />
              <span>{t.dashboard.openUniverses}</span>
            </Link>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
