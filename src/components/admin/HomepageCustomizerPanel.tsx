import React, { useEffect, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Check,
  Eye,
  EyeOff,
  Globe,
  Monitor,
  Save,
  Send,
  ShieldAlert,
  Smartphone,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useI18n } from '../../i18n/I18nContext';
import {
  CURATED_LOCAL_PHOTOGRAPHS,
  DEFAULT_HOMEPAGE_EDITORIAL,
  FOCAL_POINT_CLASSES,
} from '../../data/editorialDefaults';
import {
  fetchAllMediaAssetsForAdmin,
  fetchHomepageEditorial,
  fetchUniverses,
  saveHomepageEditorial,
  updateMediaAssetDoc,
} from '../../services/noctaService';
import { EditorialLandingView } from '../EditorialLandingView';
import { SafeImage } from '../SafeImage';
import type {
  EditorialLayoutVariant,
  EditorialSectionId,
  FocalPoint,
  HomepageEditorialPayload,
  Language,
  MediaAsset,
  Universe,
} from '../../types/nocta';

interface HomepageCustomizerPanelProps {
  actorRole: string;
}

const SECTION_LABELS: Record<EditorialSectionId, { fr: string; en: string }> = {
  hero: { fr: 'Ouverture & Photographie Hero', en: 'Opening Hero & Primary Photography' },
  editorial_spread: { fr: 'Dossier Magazine & Diptyque', en: 'Magazine Editorial Spread' },
  pillars: { fr: 'Piliers & Architecture', en: 'Editorial Pillars' },
  universes: { fr: 'Index des 12 Univers', en: '12 Universes Index' },
  privacy: { fr: 'Manifeste Confidentialité', en: 'Privacy Manifesto' },
};

const LAYOUT_VARIANTS: Array<{
  id: EditorialLayoutVariant;
  labelFr: string;
  labelEn: string;
  descFr: string;
  descEn: string;
}> = [
  {
    id: 'full_bleed',
    labelFr: 'Pleine largeur immersif',
    labelEn: 'Full-Bleed Immersion',
    descFr: 'Photographie bord à bord avec typographie éditoriale posée en bas de cadre.',
    descEn: 'Edge-to-edge full-bleed photography with expressive serif headline overlay.',
  },
  {
    id: 'editorial_split',
    labelFr: 'Diptyque texte / photo',
    labelEn: 'Editorial Split Screen',
    descFr: 'Composition moitié-moitié inspirée des revues de luxe contemporaines.',
    descEn: 'Balanced luxury magazine split pairing wide negative space with portrait photography.',
  },
  {
    id: 'asymmetric_magazine',
    labelFr: 'Magazine asymétrique',
    labelEn: 'Asymmetric Magazine',
    descFr: 'Superposition décalée d’un portrait principal et d’un second cliché.',
    descEn: 'Staggered editorial composition layering primary and secondary prints.',
  },
];

export function HomepageCustomizerPanel({ actorRole }: HomepageCustomizerPanelProps) {
  const { firebaseUser } = useAuth();
  const { lang, t } = useI18n();

  const [editorial, setEditorial] = useState<HomepageEditorialPayload>(DEFAULT_HOMEPAGE_EDITORIAL);
  const [draftVersion, setDraftVersion] = useState(1);
  const [publishedVersion, setPublishedVersion] = useState(1);
  const [allMedia, setAllMedia] = useState<MediaAsset[]>([]);
  const [universes, setUniverses] = useState<Universe[]>([]);

  const [viewport, setViewport] = useState<'desktop' | 'mobile'>('desktop');
  const [previewLang, setPreviewLang] = useState<Language>(lang);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [draftRes, pubRes, mediaRes, univRes] = await Promise.all([
        fetchHomepageEditorial('homepage_draft'),
        fetchHomepageEditorial('homepage_published'),
        fetchAllMediaAssetsForAdmin(),
        fetchUniverses(),
      ]);
      setEditorial(draftRes.exists ? draftRes.payload : pubRes.payload);
      setDraftVersion(draftRes.version);
      setPublishedVersion(pubRes.version);
      setAllMedia(mediaRes);
      setUniverses(univRes.filter((u) => u.isActive));
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : t.states.errorTitle);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  // Strictly block 'explicit' media from being selected for public homepage sections
  const homepageSafeMedia = allMedia.filter((m) => m.adultClassification !== 'explicit');

  const moveSection = (index: number, direction: -1 | 1) => {
    const nextOrder = [...editorial.sectionOrder];
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= nextOrder.length) return;
    const tmp = nextOrder[index];
    nextOrder[index] = nextOrder[targetIdx];
    nextOrder[targetIdx] = tmp;
    setEditorial({ ...editorial, sectionOrder: nextOrder });
  };

  const handleSave = async (target: 'homepage_draft' | 'homepage_published') => {
    if (!firebaseUser) return;
    setSaving(true);
    setNotice(null);
    setErrorMsg(null);
    try {
      const ver = await saveHomepageEditorial({
        target,
        payload: editorial,
        currentVersion: target === 'homepage_draft' ? draftVersion : publishedVersion,
        actorUid: firebaseUser.uid,
        actorRole,
      });
      if (target === 'homepage_draft') {
        setDraftVersion(ver);
        setNotice(
          lang === 'fr'
            ? `Mise en page enregistrée en brouillon (v${ver}).`
            : `Homepage layout saved to draft (v${ver}).`
        );
      } else {
        const dVer = await saveHomepageEditorial({
          target: 'homepage_draft',
          payload: editorial,
          currentVersion: draftVersion,
          actorUid: firebaseUser.uid,
          actorRole,
        });
        setDraftVersion(dVer);
        setPublishedVersion(ver);
        setNotice(
          lang === 'fr'
            ? `Page d’accueil publiée en direct (v${ver}).`
            : `Homepage published live (v${ver}).`
        );
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : t.states.errorTitle);
    } finally {
      setSaving(false);
    }
  };

  const handleQuickPublishAsset = async (asset: MediaAsset) => {
    if (!firebaseUser || asset.adultClassification === 'explicit') return;
    setSaving(true);
    try {
      const idToken = await firebaseUser.getIdToken();
      const nextSpaces = Array.from(new Set([...asset.allowedSpaces, 'public_landing' as const]));
      const updated: MediaAsset = {
        ...asset,
        status: 'published',
        allowedSpaces: nextSpaces,
        publicLandingSafe: true,
      };
      await updateMediaAssetDoc({
        media: updated,
        actorUid: firebaseUser.uid,
        actorRole,
        idToken,
      });
      await loadData();
      setNotice(
        lang === 'fr'
          ? `Média « ${asset.titleFr} » publié pour l’accueil.`
          : `Media "${asset.titleEn}" published for homepage.`
      );
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : t.states.errorTitle);
    } finally {
      setSaving(false);
    }
  };

  const renderSlotSelector = (params: {
    label: string;
    mediaId: string;
    fallbackUrl: string;
    focalPoint: FocalPoint;
    onChangeMediaId: (id: string) => void;
    onChangeFallback: (url: string) => void;
    onChangeFocal: (fp: FocalPoint) => void;
  }) => {
    const selectedAsset = homepageSafeMedia.find((m) => m.id === params.mediaId);
    const needsPublishWarning =
      selectedAsset &&
      (selectedAsset.status !== 'published' ||
        !selectedAsset.allowedSpaces.includes('public_landing'));
    const previewSrc =
      selectedAsset && selectedAsset.status === 'published'
        ? `/api/media/file/${selectedAsset.fileId}`
        : selectedAsset
          ? `/api/media/file/${selectedAsset.fileId}`
          : params.fallbackUrl;

    return (
      <div className="p-4 rounded-xl bg-[#100D10] border border-[#32101D] space-y-3 text-xs">
        <div className="flex items-center justify-between gap-3">
          <span className="font-medium text-[#F4EEF0]">{params.label}</span>
          <div className="w-16 h-11 overflow-hidden bg-[#191217] shrink-0">
            <SafeImage
              src={previewSrc}
              alt={params.label}
              className={`w-full h-full object-cover ${FOCAL_POINT_CLASSES[params.focalPoint]}`}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div>
            <label className="block text-[11px] text-[#B8AAB0] mb-1">
              {lang === 'fr' ? 'Photographie de la médiathèque' : 'Media library asset'}
            </label>
            <select
              value={params.mediaId}
              onChange={(e) => params.onChangeMediaId(e.target.value)}
              className="w-full px-2.5 py-2 bg-[#191217] border border-[#32101D] rounded text-[#F4EEF0]"
            >
              <option value="">
                {lang === 'fr' ? '— Utiliser l’image éditoriale locale —' : '— Use curated local photograph —'}
              </option>
              {homepageSafeMedia.map((m) => (
                <option key={m.id} value={m.id}>
                  {lang === 'fr' ? m.titleFr : m.titleEn} ({m.status} · {m.adultClassification})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] text-[#B8AAB0] mb-1">
              {lang === 'fr' ? 'Cadrage / Focus' : 'Focal point'}
            </label>
            <select
              value={params.focalPoint}
              onChange={(e) => params.onChangeFocal(e.target.value as FocalPoint)}
              className="w-full px-2.5 py-2 bg-[#191217] border border-[#32101D] rounded text-[#F4EEF0]"
            >
              <option value="center">Center</option>
              <option value="top">Top</option>
              <option value="bottom">Bottom</option>
              <option value="left">Left</option>
              <option value="right">Right</option>
            </select>
          </div>
        </div>

        {!params.mediaId && (
          <div>
            <label className="block text-[11px] text-[#B8AAB0] mb-1">
              {lang === 'fr' ? 'Photographie locale de secours' : 'Curated fallback photograph'}
            </label>
            <select
              value={params.fallbackUrl}
              onChange={(e) => params.onChangeFallback(e.target.value)}
              className="w-full px-2.5 py-2 bg-[#191217] border border-[#32101D] rounded text-[#F4EEF0]"
            >
              {CURATED_LOCAL_PHOTOGRAPHS.map((ph) => (
                <option key={ph.url} value={ph.url}>
                  {lang === 'fr' ? ph.labelFr : ph.labelEn}
                </option>
              ))}
            </select>
          </div>
        )}

        {needsPublishWarning && selectedAsset && (
          <div className="p-2.5 rounded bg-[#32101D] border border-[#C5A276]/50 flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#C5A276]">
            <span>
              {lang === 'fr'
                ? 'Ce média est encore en brouillon ou non autorisé sur l’accueil.'
                : 'This media is still draft or not allowed on public landing.'}
            </span>
            <button
              type="button"
              disabled={saving}
              onClick={() => void handleQuickPublishAsset(selectedAsset)}
              className="px-2.5 py-1 bg-[#781D35] text-[#F4EEF0] rounded cursor-pointer"
            >
              {lang === 'fr' ? 'Publier pour l’accueil' : 'Publish for landing'}
            </button>
          </div>
        )}
      </div>
    );
  };

  // In preview mode we only show published public-landing-safe images, matching production behavior
  const previewMedia = allMedia.filter(
    (m) =>
      m.adultClassification !== 'explicit' &&
      m.status === 'published' &&
      m.allowedSpaces.includes('public_landing')
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-[#32101D] pb-5">
        <div>
          <h1 className="font-display text-3xl sm:text-4xl font-semibold text-[#F4EEF0]">
            {t.admin.modules.homepageBuilder}
          </h1>
          <p className="text-xs text-[#B8AAB0] mt-1">
            {lang === 'fr'
              ? 'Composez la page d’accueil éditoriale : variantes visuelles, ordre des sections, photographies, liens et aperçu Bureau / Mobile.'
              : 'Compose the editorial homepage: layout variants, section ordering, photographs, links, and Desktop / Mobile preview.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={saving}
            onClick={() => void handleSave('homepage_draft')}
            className="inline-flex items-center gap-2 px-4 py-2 border border-[#32101D] hover:border-[#C5A276] text-xs text-[#F4EEF0] rounded-lg cursor-pointer"
          >
            <Save className="w-3.5 h-3.5 text-[#C5A276]" />
            <span>
              {lang === 'fr' ? 'Brouillon' : 'Save Draft'} (v{draftVersion})
            </span>
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => void handleSave('homepage_published')}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#781D35] hover:bg-[#4B1028] text-xs font-medium text-[#F4EEF0] rounded-lg cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
            <span>
              {lang === 'fr' ? 'Publier en direct' : 'Publish Live'} (v{publishedVersion})
            </span>
          </button>
        </div>
      </div>

      {notice && (
        <div className="p-3.5 rounded-lg bg-[#191217] border border-[#C5A276]/60 text-xs text-[#C5A276] flex items-center gap-2">
          <Check className="w-4 h-4 shrink-0" />
          <span>{notice}</span>
        </div>
      )}
      {errorMsg && (
        <div className="p-3.5 rounded-lg bg-[#32101D] border border-[#781D35] text-xs text-[#F4EEF0]">
          {errorMsg}
        </div>
      )}

      {loading ? (
        <p className="text-xs text-[#B8AAB0]">{t.states.loading}</p>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          {/* Left Controls Column */}
          <div className="xl:col-span-5 space-y-5">
            {/* 1. Layout Variant */}
            <section className="bg-[#191217] border border-[#32101D] rounded-xl p-5 space-y-3">
              <h2 className="font-display text-2xl text-[#F4EEF0]">
                {lang === 'fr' ? 'Mise en page d’ouverture' : 'Hero Editorial Layout'}
              </h2>
              <div className="space-y-2">
                {LAYOUT_VARIANTS.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => setEditorial({ ...editorial, layoutVariant: v.id })}
                    className={`w-full text-left p-3.5 rounded-lg border text-xs transition-colors cursor-pointer ${
                      editorial.layoutVariant === v.id
                        ? 'border-[#C5A276] bg-[#32101D]/60 text-[#F4EEF0]'
                        : 'border-[#32101D] bg-[#100D10] text-[#B8AAB0] hover:border-[#781D35]'
                    }`}
                  >
                    <p className="font-medium text-[#F4EEF0]">
                      {lang === 'fr' ? v.labelFr : v.labelEn}
                    </p>
                    <p className="text-[11px] text-[#B8AAB0] mt-0.5">
                      {lang === 'fr' ? v.descFr : v.descEn}
                    </p>
                  </button>
                ))}
              </div>
            </section>

            {/* 2. Section Order & Visibility */}
            <section className="bg-[#191217] border border-[#32101D] rounded-xl p-5 space-y-3">
              <h2 className="font-display text-2xl text-[#F4EEF0]">
                {lang === 'fr' ? 'Ordre et visibilité des sections' : 'Section Order & Visibility'}
              </h2>
              <div className="space-y-2">
                {editorial.sectionOrder.map((secId, idx) => {
                  const isVisible = editorial.visibleSections[secId];
                  return (
                    <div
                      key={secId}
                      className="p-3 rounded-lg bg-[#100D10] border border-[#32101D] flex items-center justify-between gap-2 text-xs"
                    >
                      <button
                        type="button"
                        onClick={() =>
                          setEditorial({
                            ...editorial,
                            visibleSections: {
                              ...editorial.visibleSections,
                              [secId]: !isVisible,
                            },
                          })
                        }
                        className="flex items-center gap-2 text-left cursor-pointer"
                      >
                        {isVisible ? (
                          <Eye className="w-3.5 h-3.5 text-[#C5A276]" />
                        ) : (
                          <EyeOff className="w-3.5 h-3.5 text-[#B8AAB0]/50" />
                        )}
                        <span className={isVisible ? 'text-[#F4EEF0]' : 'text-[#B8AAB0]/50 line-through'}>
                          {SECTION_LABELS[secId][lang]}
                        </span>
                      </button>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => moveSection(idx, -1)}
                          className="p-1 border border-[#32101D] rounded text-[#B8AAB0] hover:text-[#F4EEF0] disabled:opacity-30 cursor-pointer"
                        >
                          <ArrowUp className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          disabled={idx === editorial.sectionOrder.length - 1}
                          onClick={() => moveSection(idx, 1)}
                          className="p-1 border border-[#32101D] rounded text-[#B8AAB0] hover:text-[#F4EEF0] disabled:opacity-30 cursor-pointer"
                        >
                          <ArrowDown className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* 3. Photographic Slots (Explicit strictly excluded) */}
            <section className="bg-[#191217] border border-[#32101D] rounded-xl p-5 space-y-3">
              <div className="space-y-1">
                <h2 className="font-display text-2xl text-[#F4EEF0]">
                  {lang === 'fr' ? 'Photographies de la page d’accueil' : 'Homepage Photography'}
                </h2>
                <p className="text-[11px] text-[#C5A276] flex items-center gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    {lang === 'fr'
                      ? 'Les médias classés « explicite » sont automatiquement filtrés ici.'
                      : 'Explicit-classified media are automatically filtered out of homepage slots.'}
                  </span>
                </p>
              </div>

              {renderSlotSelector({
                label: lang === 'fr' ? 'Photographie principale (Hero)' : 'Primary Hero Photograph',
                mediaId: editorial.heroPrimaryMediaId,
                fallbackUrl: editorial.heroFallbackUrl,
                focalPoint: editorial.heroFocalPoint,
                onChangeMediaId: (id) => setEditorial({ ...editorial, heroPrimaryMediaId: id }),
                onChangeFallback: (url) => setEditorial({ ...editorial, heroFallbackUrl: url }),
                onChangeFocal: (fp) => setEditorial({ ...editorial, heroFocalPoint: fp }),
              })}

              {renderSlotSelector({
                label: lang === 'fr' ? 'Dossier Magazine — Grande image' : 'Editorial Spread — Primary',
                mediaId: editorial.spreadPrimaryMediaId,
                fallbackUrl: editorial.spreadPrimaryFallbackUrl,
                focalPoint: editorial.spreadPrimaryFocalPoint,
                onChangeMediaId: (id) => setEditorial({ ...editorial, spreadPrimaryMediaId: id }),
                onChangeFallback: (url) =>
                  setEditorial({ ...editorial, spreadPrimaryFallbackUrl: url }),
                onChangeFocal: (fp) => setEditorial({ ...editorial, spreadPrimaryFocalPoint: fp }),
              })}

              {renderSlotSelector({
                label: lang === 'fr' ? 'Dossier Magazine — Image décalée' : 'Editorial Spread — Secondary',
                mediaId: editorial.spreadSecondaryMediaId,
                fallbackUrl: editorial.spreadSecondaryFallbackUrl,
                focalPoint: editorial.spreadSecondaryFocalPoint,
                onChangeMediaId: (id) =>
                  setEditorial({ ...editorial, spreadSecondaryMediaId: id }),
                onChangeFallback: (url) =>
                  setEditorial({ ...editorial, spreadSecondaryFallbackUrl: url }),
                onChangeFocal: (fp) =>
                  setEditorial({ ...editorial, spreadSecondaryFocalPoint: fp }),
              })}

              {renderSlotSelector({
                label: lang === 'fr' ? 'Section Confidentialité' : 'Privacy Section Photograph',
                mediaId: editorial.privacyMediaId,
                fallbackUrl: editorial.privacyFallbackUrl,
                focalPoint: editorial.privacyFocalPoint,
                onChangeMediaId: (id) => setEditorial({ ...editorial, privacyMediaId: id }),
                onChangeFallback: (url) => setEditorial({ ...editorial, privacyFallbackUrl: url }),
                onChangeFocal: (fp) => setEditorial({ ...editorial, privacyFocalPoint: fp }),
              })}
            </section>

            {/* 4. Quick Hero Text & Links */}
            <section className="bg-[#191217] border border-[#32101D] rounded-xl p-5 space-y-3 text-xs">
              <h2 className="font-display text-2xl text-[#F4EEF0]">
                {lang === 'fr' ? 'Titres & liens d’action' : 'Hero Titles & Action Links'}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <input
                  type="text"
                  value={editorial.heroTitleFr}
                  onChange={(e) => setEditorial({ ...editorial, heroTitleFr: e.target.value })}
                  placeholder="Titre FR"
                  className="px-3 py-2 bg-[#100D10] border border-[#32101D] rounded text-[#F4EEF0]"
                />
                <input
                  type="text"
                  value={editorial.heroTitleEn}
                  onChange={(e) => setEditorial({ ...editorial, heroTitleEn: e.target.value })}
                  placeholder="Title EN"
                  className="px-3 py-2 bg-[#100D10] border border-[#32101D] rounded text-[#F4EEF0]"
                />
                <input
                  type="text"
                  value={editorial.heroPrimaryCtaFr}
                  onChange={(e) =>
                    setEditorial({ ...editorial, heroPrimaryCtaFr: e.target.value })
                  }
                  placeholder="CTA FR"
                  className="px-3 py-2 bg-[#100D10] border border-[#32101D] rounded text-[#F4EEF0]"
                />
                <input
                  type="text"
                  value={editorial.heroPrimaryCtaLink}
                  onChange={(e) =>
                    setEditorial({ ...editorial, heroPrimaryCtaLink: e.target.value })
                  }
                  placeholder="/auth?mode=signup"
                  className="px-3 py-2 bg-[#100D10] border border-[#32101D] rounded text-[#F4EEF0]"
                />
                <input
                  type="text"
                  value={editorial.heroSecondaryCtaFr}
                  onChange={(e) =>
                    setEditorial({ ...editorial, heroSecondaryCtaFr: e.target.value })
                  }
                  placeholder="CTA secondaire FR"
                  className="px-3 py-2 bg-[#100D10] border border-[#32101D] rounded text-[#F4EEF0]"
                />
                <input
                  type="text"
                  value={editorial.heroSecondaryCtaLink}
                  onChange={(e) =>
                    setEditorial({ ...editorial, heroSecondaryCtaLink: e.target.value })
                  }
                  placeholder="/auth?mode=signin"
                  className="px-3 py-2 bg-[#100D10] border border-[#32101D] rounded text-[#F4EEF0]"
                />
              </div>
            </section>
          </div>

          {/* Right Column: Live Responsive Desktop vs Mobile Preview */}
          <div className="xl:col-span-7 bg-[#191217] border border-[#32101D] rounded-xl overflow-hidden sticky top-6">
            <div className="px-4 py-3 border-b border-[#32101D] flex flex-wrap items-center justify-between gap-3 text-xs">
              <span className="font-medium text-[#C5A276]">
                {lang === 'fr' ? 'Aperçu en direct' : 'Live Responsive Preview'}
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setViewport('desktop')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded border cursor-pointer ${
                    viewport === 'desktop'
                      ? 'border-[#C5A276] bg-[#32101D] text-[#F4EEF0]'
                      : 'border-[#32101D] text-[#B8AAB0]'
                  }`}
                >
                  <Monitor className="w-3.5 h-3.5" />
                  <span>Desktop</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewport('mobile')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded border cursor-pointer ${
                    viewport === 'mobile'
                      ? 'border-[#C5A276] bg-[#32101D] text-[#F4EEF0]'
                      : 'border-[#32101D] text-[#B8AAB0]'
                  }`}
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>Mobile</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewLang((l) => (l === 'fr' ? 'en' : 'fr'))}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 border border-[#32101D] rounded text-[#C5A276] cursor-pointer"
                >
                  <Globe className="w-3.5 h-3.5" />
                  <span>{previewLang.toUpperCase()}</span>
                </button>
              </div>
            </div>

            <div className="bg-[#0B090B] p-4 flex justify-center">
              <div
                className={`border border-[#32101D] overflow-y-auto max-h-[760px] transition-all duration-300 ${
                  viewport === 'mobile' ? 'w-[390px]' : 'w-full'
                }`}
              >
                <EditorialLandingView
                  lang={previewLang}
                  isAuthed={false}
                  editorial={editorial}
                  universes={universes}
                  mediaAssets={previewMedia}
                  previewMode
                  translations={{
                    navUniverses: previewLang === 'fr' ? 'Univers' : 'Universes',
                    navExperience: previewLang === 'fr' ? 'L’expérience' : 'The Experience',
                    navPrivacy: previewLang === 'fr' ? 'Confidentialité' : 'Privacy',
                    navDashboard: previewLang === 'fr' ? 'Tableau de bord' : 'Dashboard',
                    navSignIn: previewLang === 'fr' ? 'Se connecter' : 'Sign in',
                    formatsCount: previewLang === 'fr' ? '5 formats' : '5 formats',
                    exploreLabel: previewLang === 'fr' ? 'Explorer' : 'Explore',
                    privacyTitle: previewLang === 'fr' ? 'Confidentialité' : 'Privacy',
                    termsTitle: previewLang === 'fr' ? 'Conditions' : 'Terms',
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
