import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Bookmark, Check, Shuffle, SkipForward } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../i18n/I18nContext';
import { FOCAL_POINT_CLASSES } from '../data/editorialDefaults';
import {
  drawNextActivity,
  fetchFormats,
  fetchPublishedActivities,
  fetchPublishedMemberMedia,
  fetchUniverses,
  markActivityOutcome,
  saveActivityToFavorites,
} from '../services/noctaService';
import { AppShell } from '../components/AppShell';
import { SafeImage } from '../components/SafeImage';
import type { Activity, ActivityFormat, MediaAsset, Universe } from '../types/nocta';

export function UniversesPage() {
  const { slug } = useParams<{ slug?: string }>();
  const { firebaseUser, privateInfo, couple } = useAuth();
  const { lang, t } = useI18n();

  const [universes, setUniverses] = useState<Universe[]>([]);
  const [formats, setFormats] = useState<ActivityFormat[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [memberMedia, setMemberMedia] = useState<MediaAsset[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  const [activeDraw, setActiveDraw] = useState<Activity | null>(null);
  const [exhaustedMsg, setExhaustedMsg] = useState(false);
  const [drawError, setDrawError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      try {
        const [uList, fList, aList, mList] = await Promise.all([
          fetchUniverses(),
          fetchFormats(slug),
          fetchPublishedActivities(slug),
          fetchPublishedMemberMedia(),
        ]);
        if (!active) return;
        setUniverses(uList);
        setFormats(fList);
        setActivities(aList);
        setMemberMedia(mList);
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [slug]);

  const handleLaunchFormat = async (universeId: string, formatId: string) => {
    if (!firebaseUser) return;
    setDrawError(null);
    setExhaustedMsg(false);

    const mode = couple?.status === 'active' ? 'couple' : 'individual';
    try {
      const res = await drawNextActivity({
        mode,
        uid: firebaseUser.uid,
        coupleId: couple?.id || null,
        universeId,
        formatId,
        maxIntimacyLevel: privateInfo?.maxIntimacyLevel ?? 5,
      });

      if (res.exhausted || !res.activity) {
        setActiveDraw(null);
        setExhaustedMsg(true);
      } else {
        setActiveDraw(res.activity);
      }
    } catch (err) {
      setDrawError(err instanceof Error ? err.message : t.states.errorTitle);
    }
  };

  const getUniverseCover = (universeId: string): MediaAsset | undefined =>
    memberMedia.find(
      (m) =>
        m.universeId === universeId &&
        m.allowedSpaces.includes('universes') &&
        (m.role === 'universe_cover' || m.role === 'banner' || m.role === 'primary' || m.role === 'gallery')
    );

  const getActivityMedia = (act: Activity): MediaAsset | undefined => {
    if (act.mediaId) {
      const direct = memberMedia.find((m) => m.id === act.mediaId);
      if (direct) return direct;
    }
    return memberMedia.find(
      (m) => m.activityId === act.id || (m.formatId && m.formatId === act.formatId)
    );
  };

  if (slug) {
    const universe = universes.find((u) => u.slug === slug);
    const universeFormats = formats.filter((f) => f.universeId === (universe?.id || slug));
    const mode = couple?.status === 'active' ? 'couple' : 'individual';
    const coverAsset = universe ? getUniverseCover(universe.id) : undefined;
    const activeDrawMedia = activeDraw ? getActivityMedia(activeDraw) : undefined;

    return (
      <AppShell>
        <div className="space-y-10">
          <div className="space-y-6 border-b border-[#32101D] pb-8">
            <Link
              to="/universes"
              className="inline-flex items-center gap-2 text-xs tracking-wider text-[#B8AAB0] hover:text-[#F4EEF0]"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>{t.universes.backToUniverses}</span>
            </Link>

            {universe ? (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-end">
                <div className={coverAsset ? 'lg:col-span-7 space-y-3' : 'lg:col-span-12 space-y-3'}>
                  <p className="font-mono-tabular text-xs tracking-widest text-[#C5A276]">
                    {String(universe.order).padStart(2, '0')} · {universe.category}
                  </p>
                  <h1 className="font-display text-4xl sm:text-5xl font-medium text-[#F4EEF0]">
                    {lang === 'fr' ? universe.titleFr : universe.titleEn}
                  </h1>
                  <p className="text-base text-[#B8AAB0] max-w-2xl leading-relaxed font-light">
                    {lang === 'fr' ? universe.descriptionFr : universe.descriptionEn}
                  </p>
                </div>
                {coverAsset && (
                  <div className="lg:col-span-5 aspect-[16/10] overflow-hidden">
                    <SafeImage
                      src={`/api/media/file/${coverAsset.fileId}`}
                      alt={lang === 'fr' ? coverAsset.titleFr : coverAsset.titleEn}
                      className={`w-full h-full object-cover ${FOCAL_POINT_CLASSES[coverAsset.focalPoint || 'center']}`}
                    />
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-[#B8AAB0]">{t.states.loading}</p>
            )}
          </div>

          {drawError && (
            <div className="p-4 bg-[#32101D] border-l-2 border-[#781D35] text-xs text-[#F4EEF0]">
              {drawError}
            </div>
          )}

          {exhaustedMsg && (
            <div className="py-6 border-y border-[#C5A276]/40 space-y-2">
              <h3 className="font-display text-2xl text-[#F4EEF0]">
                {t.couple.universeExhaustedTitle}
              </h3>
              <p className="text-xs text-[#B8AAB0]">{t.universes.noPublishedInFormat}</p>
            </div>
          )}

          {activeDraw && (
            <div className="bg-[#191217]/70 border-y border-[#C5A276]/50 py-8 px-6 sm:px-8 space-y-6">
              <div className="flex items-center justify-between text-xs text-[#C5A276]">
                <span>
                  {activeDraw.type} · {activeDraw.durationMinutes} min · {activeDraw.intimacyLevel}/5
                </span>
                <button
                  type="button"
                  onClick={() => setActiveDraw(null)}
                  className="text-[#B8AAB0] hover:text-[#F4EEF0] underline cursor-pointer"
                >
                  {t.nav.interruptExperience}
                </button>
              </div>
              {activeDrawMedia && (
                <div className="aspect-[16/9] max-h-96 w-full overflow-hidden">
                  <SafeImage
                    src={`/api/media/file/${activeDrawMedia.fileId}`}
                    alt={lang === 'fr' ? activeDrawMedia.titleFr : activeDrawMedia.titleEn}
                    className={`w-full h-full object-cover ${FOCAL_POINT_CLASSES[activeDrawMedia.focalPoint || 'center']}`}
                  />
                </div>
              )}
              <h3 className="font-display text-3xl font-medium text-[#F4EEF0]">
                {lang === 'fr' ? activeDraw.titleFr : activeDraw.titleEn}
              </h3>
              <p className="text-base text-[#F4EEF0]/90 leading-relaxed font-light">
                {lang === 'fr' ? activeDraw.bodyFr : activeDraw.bodyEn}
              </p>
              <div className="flex flex-wrap gap-3 pt-4 border-t border-[#32101D]">
                <button
                  type="button"
                  onClick={async () => {
                    if (!firebaseUser) return;
                    await markActivityOutcome({
                      mode,
                      uid: firebaseUser.uid,
                      coupleId: couple?.id || null,
                      activityId: activeDraw.id,
                      status: 'completed',
                    });
                    setActiveDraw(null);
                  }}
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-[#781D35] hover:bg-[#4B1028] text-xs text-[#F4EEF0] cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>{t.couple.markCompletedBtn}</span>
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (!firebaseUser) return;
                    await markActivityOutcome({
                      mode,
                      uid: firebaseUser.uid,
                      coupleId: couple?.id || null,
                      activityId: activeDraw.id,
                      status: 'skipped',
                    });
                    setActiveDraw(null);
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 border border-[#32101D] text-xs text-[#B8AAB0] hover:text-[#F4EEF0] cursor-pointer"
                >
                  <SkipForward className="w-3.5 h-3.5" />
                  <span>{t.couple.skipActivityBtn}</span>
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (!firebaseUser) return;
                    await saveActivityToFavorites({
                      mode,
                      uid: firebaseUser.uid,
                      coupleId: couple?.id || null,
                      activity: activeDraw,
                    });
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 border border-[#C5A276]/50 text-xs text-[#C5A276] cursor-pointer"
                >
                  <Bookmark className="w-3.5 h-3.5" />
                  <span>{t.couple.addToFavoritesBtn}</span>
                </button>
              </div>
            </div>
          )}

          {/* 5 Formats Editorial Rows */}
          <div className="divide-y divide-[#32101D]">
            {loading ? (
              <p className="py-6 text-sm text-[#B8AAB0]">{t.states.loading}</p>
            ) : (
              universeFormats.map((fmt) => {
                const countInFormat = activities.filter((a) => a.formatId === fmt.id).length;
                return (
                  <div
                    key={fmt.id}
                    className="py-7 flex flex-col sm:flex-row sm:items-center justify-between gap-6"
                  >
                    <div className="space-y-1.5 max-w-2xl">
                      <p className="font-mono-tabular text-xs text-[#C5A276]">
                        {String(fmt.order).padStart(2, '0')} ·{' '}
                        <span className="text-[#B8AAB0]">
                          {countInFormat} {lang === 'fr' ? 'publiées' : 'published'}
                        </span>
                      </p>
                      <h2 className="font-display text-2xl sm:text-3xl font-medium text-[#F4EEF0]">
                        {lang === 'fr' ? fmt.titleFr : fmt.titleEn}
                      </h2>
                      <p className="text-sm text-[#B8AAB0] font-light">
                        {lang === 'fr' ? fmt.descriptionFr : fmt.descriptionEn}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={!fmt.isActive}
                      onClick={() => void handleLaunchFormat(fmt.universeId, fmt.id)}
                      className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#781D35] hover:bg-[#4B1028] disabled:opacity-40 text-xs font-medium text-[#F4EEF0] shrink-0 cursor-pointer"
                    >
                      <Shuffle className="w-3.5 h-3.5" />
                      <span>{t.universes.launchFormat}</span>
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </AppShell>
    );
  }

  const categories = ['all', ...Array.from(new Set(universes.map((u) => u.category)))];
  const visibleUniverses = universes.filter(
    (u) => categoryFilter === 'all' || u.category === categoryFilter
  );

  return (
    <AppShell>
      <div className="space-y-10">
        <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 border-b border-[#32101D] pb-8">
          <div className="space-y-2">
            <h1 className="font-display text-4xl sm:text-5xl font-medium text-[#F4EEF0]">
              {t.universes.title}
            </h1>
            <p className="text-sm text-[#B8AAB0] font-light">{t.universes.subtitle}</p>
          </div>
          <div className="flex flex-wrap gap-4 border-b border-[#32101D] pb-1">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategoryFilter(cat)}
                className={`pb-2 text-xs tracking-wider transition-colors cursor-pointer ${
                  categoryFilter === cat
                    ? 'text-[#C5A276] border-b border-[#C5A276]'
                    : 'text-[#B8AAB0] hover:text-[#F4EEF0]'
                }`}
              >
                {cat === 'all' ? t.universes.allCategories : cat}
              </button>
            ))}
          </div>
        </header>

        {loading ? (
          <p className="text-sm text-[#B8AAB0]">{t.states.loading}</p>
        ) : (
          <div className="divide-y divide-[#32101D]/80">
            {visibleUniverses.map((u) => {
              const cover = getUniverseCover(u.id);
              return (
                <Link
                  key={u.id}
                  to={`/universes/${u.slug}`}
                  className="group py-7 grid grid-cols-1 md:grid-cols-12 gap-6 items-center transition-colors"
                >
                  <div className="md:col-span-1 font-mono-tabular text-xs text-[#C5A276]">
                    {String(u.order).padStart(2, '0')}
                  </div>
                  <div className="md:col-span-4 space-y-1">
                    <h2 className="font-display text-2xl sm:text-3xl font-medium text-[#F4EEF0] group-hover:text-[#C5A276] transition-colors">
                      {lang === 'fr' ? u.titleFr : u.titleEn}
                    </h2>
                    <p className="text-xs text-[#B8AAB0]">
                      {u.category} · {t.universes.formatsCount}
                      {!u.isActive && ` · ${t.universes.inactiveBadge}`}
                    </p>
                  </div>
                  <div className="md:col-span-5">
                    <p className="text-sm text-[#B8AAB0] leading-relaxed font-light">
                      {lang === 'fr' ? u.descriptionFr : u.descriptionEn}
                    </p>
                  </div>
                  <div className="md:col-span-2 flex items-center justify-between md:justify-end gap-4">
                    {cover && (
                      <div className="w-16 h-11 overflow-hidden opacity-85 group-hover:opacity-100">
                        <SafeImage
                          src={`/api/media/file/${cover.fileId}`}
                          alt={lang === 'fr' ? cover.titleFr : cover.titleEn}
                          className={`w-full h-full object-cover ${FOCAL_POINT_CLASSES[cover.focalPoint || 'center']}`}
                        />
                      </div>
                    )}
                    <ArrowRight className="w-4 h-4 text-[#C5A276] group-hover:translate-x-1 transition-transform" />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
