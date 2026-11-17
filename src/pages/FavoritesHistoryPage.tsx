import React, { useEffect, useState } from 'react';
import { Bookmark, History, Play, Trash2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../i18n/I18nContext';
import {
  fetchCoupleHistoryAndFavorites,
  fetchIndividualLedger,
  fetchPublishedActivities,
  removeCoupleFavorite,
  replayCoupleFavorite,
} from '../services/noctaService';
import { AppShell } from '../components/AppShell';
import type {
  Activity,
  CoupleFavoriteItem,
  CoupleHistoryItem,
  IndividualLedgerItem,
} from '../types/nocta';

export function FavoritesHistoryPage() {
  const { firebaseUser, couple } = useAuth();
  const { lang, t } = useI18n();
  const [tab, setTab] = useState<'favorites' | 'history'>('favorites');
  const [loading, setLoading] = useState(true);

  const [coupleHistory, setCoupleHistory] = useState<CoupleHistoryItem[]>([]);
  const [coupleFavorites, setCoupleFavorites] = useState<CoupleFavoriteItem[]>([]);
  const [indLedger, setIndLedger] = useState<IndividualLedgerItem[]>([]);
  const [activitiesMap, setActivitiesMap] = useState<Map<string, Activity>>(new Map());
  const [replayingActivity, setReplayingActivity] = useState<Activity | null>(null);

  const loadData = async () => {
    if (!firebaseUser) return;
    setLoading(true);
    try {
      const [allActs, ind] = await Promise.all([
        fetchPublishedActivities(),
        fetchIndividualLedger(firebaseUser.uid),
      ]);
      const map = new Map<string, Activity>();
      for (const a of allActs) map.set(a.id, a);
      setActivitiesMap(map);
      setIndLedger(ind);

      if (couple?.id) {
        const cf = await fetchCoupleHistoryAndFavorites(couple.id);
        setCoupleHistory(cf.history);
        setCoupleFavorites(cf.favorites);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [firebaseUser, couple?.id]);

  const handleReplay = async (activityId: string) => {
    const act = activitiesMap.get(activityId);
    if (act) setReplayingActivity(act);
    if (couple?.id) {
      await replayCoupleFavorite(couple.id, activityId);
      await loadData();
    }
  };

  const handleRemoveFavorite = async (activityId: string) => {
    if (!couple?.id) return;
    await removeCoupleFavorite(couple.id, activityId);
    await loadData();
  };

  const favoritesToDisplay = couple?.id
    ? coupleFavorites.map((f) => ({
        activityId: f.activityId,
        replayCount: f.replayCount,
      }))
    : indLedger
        .filter((i) => i.kind === 'favorite')
        .map((i) => ({
          activityId: i.activityId.replace(/^fav_/, ''),
          replayCount: 0,
        }));

  const historyToDisplay = couple?.id
    ? coupleHistory.map((h) => ({
        activityId: h.activityId,
        status: h.status,
        mode: h.mode,
      }))
    : indLedger
        .filter((i) => i.kind === 'history')
        .map((i) => ({
          activityId: i.activityId,
          status: i.status,
          mode: 'individual',
        }));

  return (
    <AppShell>
      <div className="space-y-8">
        <header className="space-y-2 border-b border-[#32101D] pb-6">
          <h1 className="font-display text-3xl sm:text-4xl font-semibold text-[#F4EEF0]">
            {t.favoritesHistory.title}
          </h1>
          <p className="text-sm text-[#B8AAB0] max-w-2xl">{t.favoritesHistory.subtitle}</p>
        </header>

        <div className="flex items-center gap-2 bg-[#191217] border border-[#32101D] p-1 rounded-lg w-fit">
          <button
            type="button"
            onClick={() => setTab('favorites')}
            className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-md transition-colors cursor-pointer ${
              tab === 'favorites'
                ? 'bg-[#4B1028] text-[#F4EEF0]'
                : 'text-[#B8AAB0] hover:text-[#F4EEF0]'
            }`}
          >
            <Bookmark className="w-3.5 h-3.5 text-[#C5A276]" />
            <span>
              {t.favoritesHistory.tabFavorites} ({favoritesToDisplay.length})
            </span>
          </button>
          <button
            type="button"
            onClick={() => setTab('history')}
            className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-md transition-colors cursor-pointer ${
              tab === 'history'
                ? 'bg-[#4B1028] text-[#F4EEF0]'
                : 'text-[#B8AAB0] hover:text-[#F4EEF0]'
            }`}
          >
            <History className="w-3.5 h-3.5 text-[#C5A276]" />
            <span>
              {t.favoritesHistory.tabHistory} ({historyToDisplay.length})
            </span>
          </button>
        </div>

        {replayingActivity && (
          <div className="bg-[#191217] border border-[#C5A276]/60 rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between text-xs text-[#C5A276]">
              <span>{t.favoritesHistory.replayBtn}</span>
              <button
                type="button"
                onClick={() => setReplayingActivity(null)}
                className="text-[#B8AAB0] hover:text-[#F4EEF0] underline cursor-pointer"
              >
                {t.nav.interruptExperience}
              </button>
            </div>
            <h2 className="font-display text-2xl font-semibold text-[#F4EEF0]">
              {lang === 'fr' ? replayingActivity.titleFr : replayingActivity.titleEn}
            </h2>
            <p className="text-sm text-[#F4EEF0]/90 leading-relaxed">
              {lang === 'fr' ? replayingActivity.bodyFr : replayingActivity.bodyEn}
            </p>
          </div>
        )}

        {loading ? (
          <p className="text-sm text-[#B8AAB0]">{t.states.loading}</p>
        ) : tab === 'favorites' ? (
          favoritesToDisplay.length === 0 ? (
            <div className="bg-[#191217] border border-[#32101D] rounded-xl p-8 text-sm text-[#B8AAB0]">
              {t.favoritesHistory.emptyFavorites}
            </div>
          ) : (
            <div className="space-y-3">
              {favoritesToDisplay.map((fav) => {
                const act = activitiesMap.get(fav.activityId);
                return (
                  <div
                    key={fav.activityId}
                    className="bg-[#191217] border border-[#32101D] rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="space-y-1">
                      <h3 className="font-display text-xl font-semibold text-[#F4EEF0]">
                        {act
                          ? lang === 'fr'
                            ? act.titleFr
                            : act.titleEn
                          : fav.activityId}
                      </h3>
                      <p className="text-xs text-[#B8AAB0]">
                        {act?.type || 'activity'} ·{' '}
                        {lang === 'fr' ? 'Rejouée' : 'Replayed'}: {fav.replayCount}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => void handleReplay(fav.activityId)}
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#781D35] hover:bg-[#4B1028] text-xs font-medium text-[#F4EEF0] rounded-lg cursor-pointer"
                      >
                        <Play className="w-3.5 h-3.5" />
                        <span>{t.favoritesHistory.replayBtn}</span>
                      </button>
                      {couple?.id && (
                        <button
                          type="button"
                          onClick={() => void handleRemoveFavorite(fav.activityId)}
                          aria-label={t.favoritesHistory.removeFavoriteBtn}
                          className="p-2 border border-[#32101D] hover:border-[#781D35] text-[#B8AAB0] hover:text-[#F4EEF0] rounded-lg cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )
        ) : historyToDisplay.length === 0 ? (
          <div className="bg-[#191217] border border-[#32101D] rounded-xl p-8 text-sm text-[#B8AAB0]">
            {t.favoritesHistory.emptyHistory}
          </div>
        ) : (
          <div className="bg-[#191217] border border-[#32101D] rounded-xl divide-y divide-[#32101D]">
            {historyToDisplay.map((item) => {
              const act = activitiesMap.get(item.activityId);
              return (
                <div
                  key={item.activityId}
                  className="p-4 sm:px-6 flex items-center justify-between gap-4"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[#F4EEF0] truncate">
                      {act ? (lang === 'fr' ? act.titleFr : act.titleEn) : item.activityId}
                    </p>
                    <p className="text-xs text-[#B8AAB0]">
                      {item.mode} · {item.status}
                    </p>
                  </div>
                  <span className="font-mono-tabular text-xs text-[#C5A276] shrink-0">
                    {item.status === 'completed'
                      ? t.favoritesHistory.statusCompleted
                      : item.status === 'skipped'
                        ? t.favoritesHistory.statusSkipped
                        : t.favoritesHistory.statusPresented}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
