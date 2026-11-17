import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ArrowUpRight } from 'lucide-react';
import { FOCAL_POINT_CLASSES, resolveEditorialImageUrl } from '../data/editorialDefaults';
import type {
  EditorialSectionId,
  HomepageEditorialPayload,
  Language,
  MediaAsset,
  Universe,
} from '../types/nocta';
import { NoctaLogo } from './NoctaLogo';
import { SafeImage } from './SafeImage';

interface EditorialLandingViewProps {
  lang: Language;
  onToggleLang?: () => void;
  isAuthed: boolean;
  editorial: HomepageEditorialPayload;
  universes: Universe[];
  mediaAssets: MediaAsset[];
  previewMode?: boolean;
  translations: {
    navUniverses: string;
    navExperience: string;
    navPrivacy: string;
    navDashboard: string;
    navSignIn: string;
    formatsCount: string;
    exploreLabel: string;
    privacyTitle: string;
    termsTitle: string;
  };
}

export function EditorialLandingView({
  lang,
  onToggleLang,
  isAuthed,
  editorial,
  universes,
  mediaAssets,
  previewMode = false,
  translations,
}: EditorialLandingViewProps) {
  const mediaMap = new Map<string, MediaAsset>();
  for (const m of mediaAssets) {
    // Defense-in-depth: never expose explicit media inside public landing view
    if (m.adultClassification !== 'explicit' && m.status === 'published') {
      mediaMap.set(m.id, m);
    }
  }

  // Also map universe covers if published & public_landing allowed
  const universeCoverMap = new Map<string, MediaAsset>();
  for (const m of mediaAssets) {
    if (
      m.status === 'published' &&
      m.adultClassification !== 'explicit' &&
      m.allowedSpaces.includes('public_landing') &&
      m.universeId &&
      (m.role === 'universe_cover' || m.role === 'gallery' || m.role === 'secondary')
    ) {
      if (!universeCoverMap.has(m.universeId)) {
        universeCoverMap.set(m.universeId, m);
      }
    }
  }

  const heroImage = resolveEditorialImageUrl(
    editorial.heroPrimaryMediaId,
    mediaMap,
    editorial.heroFallbackUrl,
    'public_landing'
  );
  const spreadPrimaryImg = resolveEditorialImageUrl(
    editorial.spreadPrimaryMediaId,
    mediaMap,
    editorial.spreadPrimaryFallbackUrl,
    'public_landing'
  );
  const spreadSecondaryImg = resolveEditorialImageUrl(
    editorial.spreadSecondaryMediaId,
    mediaMap,
    editorial.spreadSecondaryFallbackUrl,
    'public_landing'
  );
  const privacyImg = resolveEditorialImageUrl(
    editorial.privacyMediaId,
    mediaMap,
    editorial.privacyFallbackUrl,
    'public_landing'
  );

  const heroTitle = lang === 'fr' ? editorial.heroTitleFr : editorial.heroTitleEn;
  const heroSecondary =
    lang === 'fr' ? editorial.heroSecondaryTaglineFr : editorial.heroSecondaryTaglineEn;
  const heroSubtitle = lang === 'fr' ? editorial.heroSubtitleFr : editorial.heroSubtitleEn;
  const primaryCtaLabel = isAuthed
    ? translations.navDashboard
    : lang === 'fr'
      ? editorial.heroPrimaryCtaFr
      : editorial.heroPrimaryCtaEn;
  const primaryCtaTarget = isAuthed ? '/dashboard' : editorial.heroPrimaryCtaLink || '/auth?mode=signup';
  const secondaryCtaLabel =
    lang === 'fr' ? editorial.heroSecondaryCtaFr : editorial.heroSecondaryCtaEn;
  const secondaryCtaTarget = editorial.heroSecondaryCtaLink || '/auth?mode=signin';
  const exploreLinkLabel =
    lang === 'fr' ? editorial.heroExploreLinkFr : editorial.heroExploreLinkEn;

  const renderHero = () => {
    const heroFocus = FOCAL_POINT_CLASSES[editorial.heroFocalPoint || heroImage.focalPoint];

    if (editorial.layoutVariant === 'editorial_split') {
      return (
        <section key="hero" className="relative bg-[#100D10]">
          <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 min-h-[78vh]">
            <div className="lg:col-span-6 px-6 sm:px-12 py-16 sm:py-24 flex flex-col justify-between space-y-10">
              <div className="space-y-6 pt-4">
                <p className="font-display italic text-xl sm:text-2xl text-[#C5A276]">
                  {heroSecondary}
                </p>
                <h1 className="font-display text-5xl sm:text-6xl lg:text-7xl font-medium text-[#F4EEF0] leading-[0.98] tracking-tight [text-wrap:balance]">
                  {heroTitle}
                </h1>
                <p className="text-base sm:text-lg text-[#B8AAB0] leading-relaxed max-w-md font-light">
                  {heroSubtitle}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-6 pt-4">
                <Link
                  to={previewMode ? '#' : primaryCtaTarget}
                  onClick={(e) => previewMode && e.preventDefault()}
                  className="inline-flex items-center gap-3 px-7 py-3.5 bg-[#781D35] hover:bg-[#4B1028] text-[#F4EEF0] text-sm font-medium tracking-wide transition-colors whitespace-nowrap"
                >
                  <span>{primaryCtaLabel}</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
                {!isAuthed && (
                  <Link
                    to={previewMode ? '#' : secondaryCtaTarget}
                    onClick={(e) => previewMode && e.preventDefault()}
                    className="text-sm text-[#F4EEF0] hover:text-[#C5A276] transition-colors tracking-wide"
                  >
                    {secondaryCtaLabel}
                  </Link>
                )}
                <a
                  href="#universes"
                  className="text-sm text-[#B8AAB0] hover:text-[#C5A276] border-b border-[#C5A276]/40 pb-0.5 transition-colors"
                >
                  {exploreLinkLabel}
                </a>
              </div>
            </div>

            <div className="lg:col-span-6 relative min-h-[420px] lg:min-h-full overflow-hidden">
              <SafeImage
                src={heroImage.src}
                alt={heroImage.alt || 'NOCTA'}
                className={`w-full h-full object-cover ${heroFocus} transition-transform duration-1000`}
              />
              <div className="absolute inset-0 bg-gradient-to-r from-[#100D10] via-[#100D10]/20 to-transparent lg:w-32" />
            </div>
          </div>
        </section>
      );
    }

    if (editorial.layoutVariant === 'asymmetric_magazine') {
      return (
        <section key="hero" className="relative bg-[#100D10] overflow-hidden">
          <div className="max-w-7xl mx-auto px-6 sm:px-12 pt-14 pb-20 sm:pt-20 sm:pb-28">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-8 items-end">
              <div className="lg:col-span-7 z-10 space-y-8 lg:pb-12">
                <p className="font-display italic text-xl sm:text-2xl text-[#C5A276]">
                  {heroSecondary}
                </p>
                <h1 className="font-display text-5xl sm:text-7xl lg:text-[5.25rem] font-medium text-[#F4EEF0] leading-[0.96] tracking-tight [text-wrap:balance]">
                  {heroTitle}
                </h1>
                <p className="text-base sm:text-lg text-[#B8AAB0] leading-relaxed max-w-lg font-light">
                  {heroSubtitle}
                </p>
                <div className="flex flex-wrap items-center gap-7 pt-2">
                  <Link
                    to={previewMode ? '#' : primaryCtaTarget}
                    onClick={(e) => previewMode && e.preventDefault()}
                    className="inline-flex items-center gap-3 px-7 py-3.5 bg-[#781D35] hover:bg-[#4B1028] text-[#F4EEF0] text-sm font-medium tracking-wide transition-colors"
                  >
                    <span>{primaryCtaLabel}</span>
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                  {!isAuthed && (
                    <Link
                      to={previewMode ? '#' : secondaryCtaTarget}
                      onClick={(e) => previewMode && e.preventDefault()}
                      className="text-sm text-[#F4EEF0] hover:text-[#C5A276] transition-colors"
                    >
                      {secondaryCtaLabel}
                    </Link>
                  )}
                  <a
                    href="#universes"
                    className="text-sm text-[#B8AAB0] hover:text-[#C5A276] border-b border-[#C5A276]/40 pb-0.5 transition-colors"
                  >
                    {exploreLinkLabel}
                  </a>
                </div>
              </div>

              <div className="lg:col-span-5 relative">
                <div className="aspect-[3/4] w-full overflow-hidden">
                  <SafeImage
                    src={heroImage.src}
                    alt={heroImage.alt || 'NOCTA'}
                    className={`w-full h-full object-cover ${heroFocus}`}
                  />
                </div>
                <div className="hidden sm:block absolute -left-16 bottom-12 w-44 aspect-[4/5] overflow-hidden shadow-2xl">
                  <SafeImage
                    src={spreadPrimaryImg.src}
                    alt={spreadPrimaryImg.alt || 'NOCTA detail'}
                    className={`w-full h-full object-cover ${FOCAL_POINT_CLASSES[editorial.spreadPrimaryFocalPoint || 'center']}`}
                  />
                </div>
              </div>
            </div>
          </div>
        </section>
      );
    }

    // Default: full_bleed luxury fashion editorial hero
    return (
      <section key="hero" className="relative min-h-[82vh] flex items-end overflow-hidden bg-[#100D10]">
        <div className="absolute inset-0">
          <SafeImage
            src={heroImage.src}
            alt={heroImage.alt || 'NOCTA'}
            className={`w-full h-full object-cover ${heroFocus}`}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#100D10] via-[#100D10]/55 to-[#100D10]/25" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#100D10]/85 via-[#100D10]/35 to-transparent" />
        </div>

        <div className="relative z-10 w-full max-w-7xl mx-auto px-6 sm:px-12 pb-16 sm:pb-24 pt-36">
          <div className="max-w-3xl space-y-6">
            <p className="font-display italic text-xl sm:text-2xl text-[#C5A276]">
              {heroSecondary}
            </p>
            <h1 className="font-display text-5xl sm:text-7xl lg:text-[5.5rem] font-medium text-[#F4EEF0] leading-[0.96] tracking-tight [text-wrap:balance]">
              {heroTitle}
            </h1>
            <p className="text-base sm:text-lg text-[#F4EEF0]/85 leading-relaxed max-w-xl font-light">
              {heroSubtitle}
            </p>

            <div className="flex flex-wrap items-center gap-7 pt-4">
              <Link
                to={previewMode ? '#' : primaryCtaTarget}
                onClick={(e) => previewMode && e.preventDefault()}
                className="inline-flex items-center gap-3 px-7 py-3.5 bg-[#781D35] hover:bg-[#4B1028] text-[#F4EEF0] text-sm font-medium tracking-wide transition-colors whitespace-nowrap"
              >
                <span>{primaryCtaLabel}</span>
                <ArrowRight className="w-4 h-4" />
              </Link>

              {!isAuthed && (
                <Link
                  to={previewMode ? '#' : secondaryCtaTarget}
                  onClick={(e) => previewMode && e.preventDefault()}
                  className="text-sm text-[#F4EEF0] hover:text-[#C5A276] transition-colors tracking-wide whitespace-nowrap"
                >
                  {secondaryCtaLabel}
                </Link>
              )}

              <a
                href="#universes"
                className="text-sm text-[#B8AAB0] hover:text-[#C5A276] border-b border-[#C5A276]/40 pb-0.5 transition-colors whitespace-nowrap"
              >
                {exploreLinkLabel}
              </a>
            </div>
          </div>
        </div>
      </section>
    );
  };

  const renderEditorialSpread = () => (
    <section
      key="editorial_spread"
      id="experience"
      className="bg-[#100D10] py-24 sm:py-36 overflow-hidden"
    >
      <div className="max-w-7xl mx-auto px-6 sm:px-12 space-y-20 sm:space-y-28">
        {/* Asymmetric Magazine Spread */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-14 items-center">
          <div className="lg:col-span-5 space-y-6">
            <h2 className="font-display text-4xl sm:text-5xl lg:text-6xl font-medium text-[#F4EEF0] leading-[1.04]">
              {lang === 'fr' ? editorial.spreadTitleFr : editorial.spreadTitleEn}
            </h2>
            <div className="w-16 h-px bg-[#C5A276]/60" />
            <p className="text-base sm:text-lg text-[#B8AAB0] leading-relaxed font-light">
              {lang === 'fr' ? editorial.spreadSubtitleFr : editorial.spreadSubtitleEn}
            </p>
          </div>

          <div className="lg:col-span-7 grid grid-cols-12 gap-4 sm:gap-6 items-start">
            <div className="col-span-7 aspect-[3/4] overflow-hidden">
              <SafeImage
                src={spreadPrimaryImg.src}
                alt={spreadPrimaryImg.alt || 'Intimacy'}
                className={`w-full h-full object-cover ${FOCAL_POINT_CLASSES[editorial.spreadPrimaryFocalPoint || spreadPrimaryImg.focalPoint]} hover:scale-[1.02] transition-transform duration-700`}
              />
            </div>
            <div className="col-span-5 aspect-[3/4] mt-12 sm:mt-20 overflow-hidden">
              <SafeImage
                src={spreadSecondaryImg.src}
                alt={spreadSecondaryImg.alt || 'Silhouettes'}
                className={`w-full h-full object-cover ${FOCAL_POINT_CLASSES[editorial.spreadSecondaryFocalPoint || spreadSecondaryImg.focalPoint]} hover:scale-[1.02] transition-transform duration-700`}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );

  const renderPillars = () => (
    <section
      key="pillars"
      className="bg-[#191217]/40 border-y border-[#32101D]/70 py-20 sm:py-28"
    >
      <div className="max-w-7xl mx-auto px-6 sm:px-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 md:gap-0 md:divide-x md:divide-[#32101D]/80">
          {editorial.pillars.map((pillar, idx) => (
            <div
              key={pillar.index + idx}
              className="md:px-10 first:md:pl-0 last:md:pr-0 space-y-4"
            >
              <span className="font-mono-tabular text-xs tracking-[0.2em] text-[#C5A276] block">
                {pillar.index}
              </span>
              <h3 className="font-display text-3xl font-medium text-[#F4EEF0]">
                {lang === 'fr' ? pillar.titleFr : pillar.titleEn}
              </h3>
              <p className="text-sm sm:text-base text-[#B8AAB0] leading-relaxed font-light">
                {lang === 'fr' ? pillar.descFr : pillar.descEn}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );

  const renderUniverses = () => (
    <section key="universes" id="universes" className="bg-[#100D10] py-24 sm:py-36">
      <div className="max-w-7xl mx-auto px-6 sm:px-12 space-y-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-end border-b border-[#32101D] pb-10">
          <div className="lg:col-span-7">
            <h2 className="font-display text-4xl sm:text-5xl lg:text-6xl font-medium text-[#F4EEF0] leading-[1.04]">
              {lang === 'fr' ? editorial.universesTitleFr : editorial.universesTitleEn}
            </h2>
          </div>
          <div className="lg:col-span-5">
            <p className="text-base text-[#B8AAB0] leading-relaxed font-light">
              {lang === 'fr' ? editorial.universesSubtitleFr : editorial.universesSubtitleEn}
            </p>
          </div>
        </div>

        {/* Typographic Luxury Magazine Index (No Boxed Cards) */}
        <div className="divide-y divide-[#32101D]/70">
          {universes.map((u) => {
            const cover = universeCoverMap.get(u.id);
            return (
              <Link
                key={u.id}
                to={previewMode ? '#' : isAuthed ? `/universes/${u.slug}` : '/auth?mode=signin'}
                onClick={(e) => previewMode && e.preventDefault()}
                className="group py-7 sm:py-9 grid grid-cols-1 md:grid-cols-12 gap-6 items-center transition-colors"
              >
                <div className="md:col-span-1 font-mono-tabular text-xs tracking-[0.2em] text-[#C5A276]">
                  {String(u.order).padStart(2, '0')}
                </div>

                <div className="md:col-span-4 space-y-1">
                  <h3 className="font-display text-3xl sm:text-4xl font-medium text-[#F4EEF0] group-hover:text-[#C5A276] transition-colors">
                    {lang === 'fr' ? u.titleFr : u.titleEn}
                  </h3>
                  <p className="text-xs tracking-wider text-[#B8AAB0]/75">
                    {translations.formatsCount}
                  </p>
                </div>

                <div className="md:col-span-5">
                  <p className="text-sm sm:text-base text-[#B8AAB0] leading-relaxed font-light">
                    {lang === 'fr' ? u.descriptionFr : u.descriptionEn}
                  </p>
                </div>

                <div className="md:col-span-2 flex items-center justify-between md:justify-end gap-4">
                  {cover && (
                    <div className="w-16 h-12 overflow-hidden hidden sm:block opacity-80 group-hover:opacity-100 transition-opacity">
                      <SafeImage
                        src={`/api/media/file/${cover.fileId}`}
                        alt={lang === 'fr' ? cover.titleFr : cover.titleEn}
                        className={`w-full h-full object-cover ${FOCAL_POINT_CLASSES[cover.focalPoint || 'center']}`}
                      />
                    </div>
                  )}
                  <span className="inline-flex items-center gap-1.5 text-xs tracking-wider text-[#C5A276] group-hover:translate-x-1 transition-transform">
                    <span>{translations.exploreLabel}</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );

  const renderPrivacy = () => {
    const points = lang === 'fr' ? editorial.privacyPointsFr : editorial.privacyPointsEn;
    return (
      <section key="privacy" id="privacy" className="bg-[#191217]/30 border-t border-[#32101D]/70 py-24 sm:py-36">
        <div className="max-w-7xl mx-auto px-6 sm:px-12 grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          <div className="lg:col-span-5 aspect-[4/5] overflow-hidden">
            <SafeImage
              src={privacyImg.src}
              alt={privacyImg.alt || 'NOCTA Evening Ritual'}
              className={`w-full h-full object-cover ${FOCAL_POINT_CLASSES[editorial.privacyFocalPoint || privacyImg.focalPoint]}`}
            />
          </div>

          <div className="lg:col-span-7 space-y-8">
            <h2 className="font-display text-4xl sm:text-5xl font-medium text-[#F4EEF0] leading-[1.06]">
              {lang === 'fr' ? editorial.privacyTitleFr : editorial.privacyTitleEn}
            </h2>
            <p className="text-base sm:text-lg text-[#B8AAB0] leading-relaxed font-light max-w-2xl">
              {lang === 'fr' ? editorial.privacyBodyFr : editorial.privacyBodyEn}
            </p>

            <div className="divide-y divide-[#32101D] border-y border-[#32101D]">
              {points.map((pt, idx) => (
                <div key={idx} className="py-4 flex items-baseline gap-4 text-sm sm:text-base text-[#F4EEF0]">
                  <span className="font-mono-tabular text-xs text-[#C5A276]">
                    {String(idx + 1).padStart(2, '0')}
                  </span>
                  <span className="font-light">{pt}</span>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-6 pt-2">
              <Link
                to={previewMode ? '#' : primaryCtaTarget}
                onClick={(e) => previewMode && e.preventDefault()}
                className="inline-flex items-center gap-3 px-7 py-3.5 bg-[#781D35] hover:bg-[#4B1028] text-[#F4EEF0] text-sm font-medium tracking-wide transition-colors"
              >
                <span>{primaryCtaLabel}</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                to={previewMode ? '#' : '/privacy'}
                onClick={(e) => previewMode && e.preventDefault()}
                className="text-sm text-[#B8AAB0] hover:text-[#C5A276] border-b border-[#32101D] hover:border-[#C5A276] pb-0.5 transition-colors"
              >
                {translations.privacyTitle}
              </Link>
            </div>
          </div>
        </div>
      </section>
    );
  };

  const sectionRenderers: Record<EditorialSectionId, () => React.ReactNode> = {
    hero: renderHero,
    editorial_spread: renderEditorialSpread,
    pillars: renderPillars,
    universes: renderUniverses,
    privacy: renderPrivacy,
  };

  return (
    <div className="min-h-screen bg-[#100D10] text-[#F4EEF0]">
      {/* Minimalist Hairline Top Bar (No Admin button, No 18+ badge clutter) */}
      <header className="sticky top-0 z-30 h-16 bg-[#100D10]/85 backdrop-blur-md border-b border-[#32101D]/60">
        <div className="max-w-7xl mx-auto h-full px-6 sm:px-12 flex items-center justify-between gap-8">
          <Link
            to={previewMode ? '#' : '/'}
            onClick={(e) => previewMode && e.preventDefault()}
            className="whitespace-nowrap shrink-0"
          >
            <NoctaLogo />
          </Link>

          <nav className="hidden md:flex items-center gap-8 text-xs tracking-widest uppercase text-[#B8AAB0]">
            <a
              href="#universes"
              className="hover:text-[#F4EEF0] transition-colors whitespace-nowrap shrink-0"
            >
              {translations.navUniverses}
            </a>
            <a
              href="#experience"
              className="hover:text-[#F4EEF0] transition-colors whitespace-nowrap shrink-0"
            >
              {translations.navExperience}
            </a>
            <a
              href="#privacy"
              className="hover:text-[#F4EEF0] transition-colors whitespace-nowrap shrink-0"
            >
              {translations.navPrivacy}
            </a>
            {onToggleLang && (
              <button
                type="button"
                onClick={onToggleLang}
                className="hover:text-[#C5A276] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                {lang === 'fr' ? 'FR / EN' : 'EN / FR'}
              </button>
            )}
          </nav>

          <div className="flex items-center gap-4 shrink-0">
            {onToggleLang && (
              <button
                type="button"
                onClick={onToggleLang}
                className="md:hidden text-xs tracking-wider text-[#C5A276] whitespace-nowrap shrink-0 cursor-pointer"
              >
                {lang.toUpperCase()}
              </button>
            )}
            <Link
              to={previewMode ? '#' : primaryCtaTarget}
              onClick={(e) => previewMode && e.preventDefault()}
              className="px-5 py-2 bg-[#781D35] hover:bg-[#4B1028] text-[#F4EEF0] text-xs font-medium tracking-wide transition-colors whitespace-nowrap shrink-0"
            >
              {primaryCtaLabel}
            </Link>
          </div>
        </div>
      </header>

      {/* Ordered Editorial Sections */}
      {editorial.sectionOrder.map((secId) => {
        if (!editorial.visibleSections[secId]) return null;
        return sectionRenderers[secId]?.();
      })}

      {/* Quiet Editorial Footer — Strictly NO Admin button or foreground clutter */}
      <footer className="bg-[#100D10] border-t border-[#32101D]/70 py-14">
        <div className="max-w-7xl mx-auto px-6 sm:px-12 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-8">
          <div className="space-y-2">
            <NoctaLogo />
            <p className="font-display italic text-base text-[#C5A276]">
              {heroTitle} · {heroSecondary}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-8 text-xs tracking-wider text-[#B8AAB0]">
            <Link
              to={previewMode ? '#' : '/privacy'}
              onClick={(e) => previewMode && e.preventDefault()}
              className="hover:text-[#F4EEF0] transition-colors"
            >
              {translations.privacyTitle}
            </Link>
            <Link
              to={previewMode ? '#' : '/terms'}
              onClick={(e) => previewMode && e.preventDefault()}
              className="hover:text-[#F4EEF0] transition-colors"
            >
              {translations.termsTitle}
            </Link>
            <Link
              to={previewMode ? '#' : '/auth'}
              onClick={(e) => previewMode && e.preventDefault()}
              className="hover:text-[#C5A276] transition-colors"
            >
              {translations.navSignIn}
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
