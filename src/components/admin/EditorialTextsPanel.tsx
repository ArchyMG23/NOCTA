import React, { useEffect, useState } from 'react';
import { BookText, Check, Eye, Globe, Save, Send } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useI18n } from '../../i18n/I18nContext';
import { DEFAULT_HOMEPAGE_EDITORIAL } from '../../data/editorialDefaults';
import {
  fetchAllActivitiesForAdmin,
  fetchHomepageEditorial,
  fetchPublicLandingMedia,
  fetchUniverses,
  saveHomepageEditorial,
  updateUniverseAdmin,
  upsertActivity,
} from '../../services/noctaService';
import { EditorialLandingView } from '../EditorialLandingView';
import type {
  Activity,
  HomepageEditorialPayload,
  Language,
  MediaAsset,
  Universe,
} from '../../types/nocta';

interface EditorialTextsPanelProps {
  actorRole: string;
}

type EditorTab = 'homepage' | 'universes' | 'activities';

export function EditorialTextsPanel({ actorRole }: EditorialTextsPanelProps) {
  const { firebaseUser } = useAuth();
  const { lang, t } = useI18n();

  const [tab, setTab] = useState<EditorTab>('homepage');
  const [editorial, setEditorial] = useState<HomepageEditorialPayload>(DEFAULT_HOMEPAGE_EDITORIAL);
  const [draftVersion, setDraftVersion] = useState(1);
  const [publishedVersion, setPublishedVersion] = useState(1);

  const [universes, setUniverses] = useState<Universe[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [publicMedia, setPublicMedia] = useState<MediaAsset[]>([]);
  const [activitySearch, setActivitySearch] = useState('');
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);

  const [showPreview, setShowPreview] = useState(false);
  const [previewLang, setPreviewLang] = useState<Language>(lang);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadWorkspace = async () => {
    setLoading(true);
    try {
      const [draftRes, pubRes, univs, acts, med] = await Promise.all([
        fetchHomepageEditorial('homepage_draft'),
        fetchHomepageEditorial('homepage_published'),
        fetchUniverses(),
        fetchAllActivitiesForAdmin(),
        fetchPublicLandingMedia(),
      ]);

      setEditorial(draftRes.exists ? draftRes.payload : pubRes.payload);
      setDraftVersion(draftRes.version);
      setPublishedVersion(pubRes.version);
      setUniverses(univs);
      setActivities(acts);
      setPublicMedia(med);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : t.states.errorTitle);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadWorkspace();
  }, []);

  const handleSaveHomepageTexts = async (target: 'homepage_draft' | 'homepage_published') => {
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
            ? `Textes enregistrés en brouillon (v${ver}).`
            : `Editorial copy saved to draft (v${ver}).`
        );
      } else {
        // Sync draft alongside publish
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
            ? `Textes publiés en direct sur l’accueil (v${ver}).`
            : `Editorial copy published live to homepage (v${ver}).`
        );
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : t.states.errorTitle);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveUniverse = async (u: Universe) => {
    if (!firebaseUser) return;
    setSaving(true);
    setNotice(null);
    setErrorMsg(null);
    try {
      await updateUniverseAdmin(u, firebaseUser.uid, actorRole);
      setNotice(
        lang === 'fr'
          ? `Univers « ${u.titleFr} » mis à jour.`
          : `Universe "${u.titleEn}" updated.`
      );
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : t.states.errorTitle);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveActivityCopy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingActivity || !firebaseUser) return;
    setSaving(true);
    setNotice(null);
    setErrorMsg(null);
    try {
      await upsertActivity({
        activity: editingActivity,
        actorUid: firebaseUser.uid,
        actorRole,
      });
      setActivities((prev) =>
        prev.map((a) => (a.id === editingActivity.id ? editingActivity : a))
      );
      setNotice(
        lang === 'fr'
          ? `Activité « ${editingActivity.titleFr} » enregistrée.`
          : `Activity "${editingActivity.titleEn}" saved.`
      );
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : t.states.errorTitle);
    } finally {
      setSaving(false);
    }
  };

  const filteredActivities = activities.filter((a) => {
    if (!activitySearch.trim()) return true;
    const q = activitySearch.toLowerCase();
    return (
      a.titleFr.toLowerCase().includes(q) ||
      a.titleEn.toLowerCase().includes(q) ||
      a.bodyFr.toLowerCase().includes(q) ||
      a.bodyEn.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-[#32101D] pb-5">
        <div>
          <h1 className="font-display text-3xl sm:text-4xl font-semibold text-[#F4EEF0]">
            {t.admin.modules.editorialTexts}
          </h1>
          <p className="text-xs text-[#B8AAB0] mt-1">
            {lang === 'fr'
              ? 'Modifiez librement les titres, sous-titres, accroches, boutons, descriptions des univers et contenus FR/EN.'
              : 'Visually edit homepage titles, subtitles, taglines, CTAs, universe descriptions, and activity copy in FR & EN.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowPreview((v) => !v)}
            className={`inline-flex items-center gap-2 px-4 py-2 border text-xs rounded-lg cursor-pointer ${
              showPreview
                ? 'border-[#C5A276] bg-[#32101D] text-[#C5A276]'
                : 'border-[#32101D] text-[#B8AAB0] hover:text-[#F4EEF0]'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>{showPreview ? (lang === 'fr' ? 'Masquer l’aperçu' : 'Hide preview') : lang === 'fr' ? 'Prévisualiser' : 'Preview'}</span>
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

      {/* Sub-navigation Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-[#32101D] pb-3">
        {[
          {
            id: 'homepage' as EditorTab,
            label: lang === 'fr' ? 'Textes de la page d’accueil (FR / EN)' : 'Homepage Copy (FR / EN)',
          },
          {
            id: 'universes' as EditorTab,
            label: lang === 'fr' ? 'Titres & descriptions des univers' : 'Universes Titles & Descriptions',
          },
          {
            id: 'activities' as EditorTab,
            label: lang === 'fr' ? 'Textes des activités' : 'Activity Copy Editor',
          },
        ].map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`px-4 py-2 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
              tab === item.id
                ? 'bg-[#4B1028] text-[#F4EEF0]'
                : 'text-[#B8AAB0] hover:bg-[#191217] hover:text-[#F4EEF0]'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Live Preview Drawer */}
      {showPreview && (
        <div className="bg-[#191217] border border-[#C5A276]/50 rounded-xl overflow-hidden">
          <div className="px-4 py-2.5 border-b border-[#32101D] flex items-center justify-between text-xs">
            <span className="text-[#C5A276] font-medium">
              {lang === 'fr' ? 'Prévisualisation éditoriale en direct' : 'Live editorial preview'}
            </span>
            <button
              type="button"
              onClick={() => setPreviewLang((l) => (l === 'fr' ? 'en' : 'fr'))}
              className="inline-flex items-center gap-1.5 px-3 py-1 border border-[#32101D] rounded text-[#F4EEF0] cursor-pointer"
            >
              <Globe className="w-3.5 h-3.5 text-[#C5A276]" />
              <span>{previewLang.toUpperCase()}</span>
            </button>
          </div>
          <div className="max-h-[560px] overflow-y-auto">
            <EditorialLandingView
              lang={previewLang}
              isAuthed={false}
              editorial={editorial}
              universes={universes.filter((u) => u.isActive)}
              mediaAssets={publicMedia}
              previewMode
              translations={{
                navUniverses: previewLang === 'fr' ? 'Univers' : 'Universes',
                navExperience: previewLang === 'fr' ? 'L’expérience' : 'The Experience',
                navPrivacy: previewLang === 'fr' ? 'Confidentialité' : 'Privacy',
                navDashboard: previewLang === 'fr' ? 'Tableau de bord' : 'Dashboard',
                navSignIn: previewLang === 'fr' ? 'Se connecter' : 'Sign in',
                formatsCount: previewLang === 'fr' ? '5 formats' : '5 formats',
                exploreLabel: previewLang === 'fr' ? 'Explorer' : 'Explore',
                privacyTitle: previewLang === 'fr' ? 'Politique de confidentialité' : 'Privacy Policy',
                termsTitle: previewLang === 'fr' ? 'Conditions d’utilisation' : 'Terms of Use',
              }}
            />
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-xs text-[#B8AAB0]">{t.states.loading}</p>
      ) : (
        <>
          {/* TAB 1: Homepage FR & EN Texts */}
          {tab === 'homepage' && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3 bg-[#191217] border border-[#32101D] rounded-xl p-4">
                <div className="text-xs text-[#B8AAB0] font-mono-tabular">
                  {lang === 'fr' ? 'Brouillon' : 'Draft'} v{draftVersion} ·{' '}
                  {lang === 'fr' ? 'Publié' : 'Published'} v{publishedVersion}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void handleSaveHomepageTexts('homepage_draft')}
                    className="inline-flex items-center gap-2 px-4 py-2 border border-[#32101D] hover:border-[#C5A276] text-xs text-[#F4EEF0] rounded-lg cursor-pointer"
                  >
                    <Save className="w-3.5 h-3.5 text-[#C5A276]" />
                    <span>{lang === 'fr' ? 'Enregistrer en brouillon' : 'Save Draft'}</span>
                  </button>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void handleSaveHomepageTexts('homepage_published')}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-[#781D35] hover:bg-[#4B1028] text-xs font-medium text-[#F4EEF0] rounded-lg cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{lang === 'fr' ? 'Publier sur le site' : 'Publish Live'}</span>
                  </button>
                </div>
              </div>

              {/* Hero Copy */}
              <section className="bg-[#191217] border border-[#32101D] rounded-xl p-6 space-y-4 text-xs">
                <h2 className="font-display text-2xl text-[#F4EEF0]">
                  {lang === 'fr' ? '1. Ouverture / Hero' : '1. Opening / Hero'}
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[#B8AAB0] mb-1">Titre principal (FR)</label>
                    <input
                      type="text"
                      value={editorial.heroTitleFr}
                      onChange={(e) => setEditorial({ ...editorial, heroTitleFr: e.target.value })}
                      className="w-full px-3 py-2 bg-[#100D10] border border-[#32101D] rounded-lg text-[#F4EEF0]"
                    />
                  </div>
                  <div>
                    <label className="block text-[#B8AAB0] mb-1">Main Title (EN)</label>
                    <input
                      type="text"
                      value={editorial.heroTitleEn}
                      onChange={(e) => setEditorial({ ...editorial, heroTitleEn: e.target.value })}
                      className="w-full px-3 py-2 bg-[#100D10] border border-[#32101D] rounded-lg text-[#F4EEF0]"
                    />
                  </div>
                  <div>
                    <label className="block text-[#B8AAB0] mb-1">Signature secondaire (FR)</label>
                    <input
                      type="text"
                      value={editorial.heroSecondaryTaglineFr}
                      onChange={(e) =>
                        setEditorial({ ...editorial, heroSecondaryTaglineFr: e.target.value })
                      }
                      className="w-full px-3 py-2 bg-[#100D10] border border-[#32101D] rounded-lg text-[#F4EEF0]"
                    />
                  </div>
                  <div>
                    <label className="block text-[#B8AAB0] mb-1">Secondary Tagline (EN)</label>
                    <input
                      type="text"
                      value={editorial.heroSecondaryTaglineEn}
                      onChange={(e) =>
                        setEditorial({ ...editorial, heroSecondaryTaglineEn: e.target.value })
                      }
                      className="w-full px-3 py-2 bg-[#100D10] border border-[#32101D] rounded-lg text-[#F4EEF0]"
                    />
                  </div>
                  <div>
                    <label className="block text-[#B8AAB0] mb-1">Sous-titre éditorial (FR)</label>
                    <textarea
                      rows={3}
                      value={editorial.heroSubtitleFr}
                      onChange={(e) => setEditorial({ ...editorial, heroSubtitleFr: e.target.value })}
                      className="w-full px-3 py-2 bg-[#100D10] border border-[#32101D] rounded-lg text-[#F4EEF0]"
                    />
                  </div>
                  <div>
                    <label className="block text-[#B8AAB0] mb-1">Editorial Subtitle (EN)</label>
                    <textarea
                      rows={3}
                      value={editorial.heroSubtitleEn}
                      onChange={(e) => setEditorial({ ...editorial, heroSubtitleEn: e.target.value })}
                      className="w-full px-3 py-2 bg-[#100D10] border border-[#32101D] rounded-lg text-[#F4EEF0]"
                    />
                  </div>
                  <div>
                    <label className="block text-[#B8AAB0] mb-1">Bouton principal (FR)</label>
                    <input
                      type="text"
                      value={editorial.heroPrimaryCtaFr}
                      onChange={(e) =>
                        setEditorial({ ...editorial, heroPrimaryCtaFr: e.target.value })
                      }
                      className="w-full px-3 py-2 bg-[#100D10] border border-[#32101D] rounded-lg text-[#F4EEF0]"
                    />
                  </div>
                  <div>
                    <label className="block text-[#B8AAB0] mb-1">Primary CTA (EN)</label>
                    <input
                      type="text"
                      value={editorial.heroPrimaryCtaEn}
                      onChange={(e) =>
                        setEditorial({ ...editorial, heroPrimaryCtaEn: e.target.value })
                      }
                      className="w-full px-3 py-2 bg-[#100D10] border border-[#32101D] rounded-lg text-[#F4EEF0]"
                    />
                  </div>
                  <div>
                    <label className="block text-[#B8AAB0] mb-1">Lien secondaire (FR)</label>
                    <input
                      type="text"
                      value={editorial.heroSecondaryCtaFr}
                      onChange={(e) =>
                        setEditorial({ ...editorial, heroSecondaryCtaFr: e.target.value })
                      }
                      className="w-full px-3 py-2 bg-[#100D10] border border-[#32101D] rounded-lg text-[#F4EEF0]"
                    />
                  </div>
                  <div>
                    <label className="block text-[#B8AAB0] mb-1">Secondary Link (EN)</label>
                    <input
                      type="text"
                      value={editorial.heroSecondaryCtaEn}
                      onChange={(e) =>
                        setEditorial({ ...editorial, heroSecondaryCtaEn: e.target.value })
                      }
                      className="w-full px-3 py-2 bg-[#100D10] border border-[#32101D] rounded-lg text-[#F4EEF0]"
                    />
                  </div>
                  <div>
                    <label className="block text-[#B8AAB0] mb-1">Lien d’exploration (FR)</label>
                    <input
                      type="text"
                      value={editorial.heroExploreLinkFr}
                      onChange={(e) =>
                        setEditorial({ ...editorial, heroExploreLinkFr: e.target.value })
                      }
                      className="w-full px-3 py-2 bg-[#100D10] border border-[#32101D] rounded-lg text-[#F4EEF0]"
                    />
                  </div>
                  <div>
                    <label className="block text-[#B8AAB0] mb-1">Explore Anchor Text (EN)</label>
                    <input
                      type="text"
                      value={editorial.heroExploreLinkEn}
                      onChange={(e) =>
                        setEditorial({ ...editorial, heroExploreLinkEn: e.target.value })
                      }
                      className="w-full px-3 py-2 bg-[#100D10] border border-[#32101D] rounded-lg text-[#F4EEF0]"
                    />
                  </div>
                </div>
              </section>

              {/* Editorial Spread + Pillars */}
              <section className="bg-[#191217] border border-[#32101D] rounded-xl p-6 space-y-5 text-xs">
                <h2 className="font-display text-2xl text-[#F4EEF0]">
                  {lang === 'fr' ? '2. Magazine & Piliers' : '2. Editorial Spread & Pillars'}
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[#B8AAB0] mb-1">Titre du dossier (FR)</label>
                    <input
                      type="text"
                      value={editorial.spreadTitleFr}
                      onChange={(e) => setEditorial({ ...editorial, spreadTitleFr: e.target.value })}
                      className="w-full px-3 py-2 bg-[#100D10] border border-[#32101D] rounded-lg text-[#F4EEF0]"
                    />
                  </div>
                  <div>
                    <label className="block text-[#B8AAB0] mb-1">Spread Title (EN)</label>
                    <input
                      type="text"
                      value={editorial.spreadTitleEn}
                      onChange={(e) => setEditorial({ ...editorial, spreadTitleEn: e.target.value })}
                      className="w-full px-3 py-2 bg-[#100D10] border border-[#32101D] rounded-lg text-[#F4EEF0]"
                    />
                  </div>
                  <div>
                    <label className="block text-[#B8AAB0] mb-1">Texte du dossier (FR)</label>
                    <textarea
                      rows={3}
                      value={editorial.spreadSubtitleFr}
                      onChange={(e) =>
                        setEditorial({ ...editorial, spreadSubtitleFr: e.target.value })
                      }
                      className="w-full px-3 py-2 bg-[#100D10] border border-[#32101D] rounded-lg text-[#F4EEF0]"
                    />
                  </div>
                  <div>
                    <label className="block text-[#B8AAB0] mb-1">Spread Narrative (EN)</label>
                    <textarea
                      rows={3}
                      value={editorial.spreadSubtitleEn}
                      onChange={(e) =>
                        setEditorial({ ...editorial, spreadSubtitleEn: e.target.value })
                      }
                      className="w-full px-3 py-2 bg-[#100D10] border border-[#32101D] rounded-lg text-[#F4EEF0]"
                    />
                  </div>
                </div>

                <div className="space-y-4 pt-3 border-t border-[#32101D]">
                  {editorial.pillars.map((pillar, idx) => (
                    <div key={pillar.index + idx} className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3.5 bg-[#100D10] border border-[#32101D] rounded-lg">
                      <div className="md:col-span-2 text-[#C5A276] font-mono-tabular">
                        Pilier {pillar.index}
                      </div>
                      <input
                        type="text"
                        value={pillar.titleFr}
                        onChange={(e) => {
                          const next = [...editorial.pillars];
                          next[idx] = { ...pillar, titleFr: e.target.value };
                          setEditorial({ ...editorial, pillars: next });
                        }}
                        placeholder="Titre FR"
                        className="px-3 py-2 bg-[#191217] border border-[#32101D] rounded text-[#F4EEF0]"
                      />
                      <input
                        type="text"
                        value={pillar.titleEn}
                        onChange={(e) => {
                          const next = [...editorial.pillars];
                          next[idx] = { ...pillar, titleEn: e.target.value };
                          setEditorial({ ...editorial, pillars: next });
                        }}
                        placeholder="Title EN"
                        className="px-3 py-2 bg-[#191217] border border-[#32101D] rounded text-[#F4EEF0]"
                      />
                      <textarea
                        rows={2}
                        value={pillar.descFr}
                        onChange={(e) => {
                          const next = [...editorial.pillars];
                          next[idx] = { ...pillar, descFr: e.target.value };
                          setEditorial({ ...editorial, pillars: next });
                        }}
                        placeholder="Description FR"
                        className="px-3 py-2 bg-[#191217] border border-[#32101D] rounded text-[#F4EEF0]"
                      />
                      <textarea
                        rows={2}
                        value={pillar.descEn}
                        onChange={(e) => {
                          const next = [...editorial.pillars];
                          next[idx] = { ...pillar, descEn: e.target.value };
                          setEditorial({ ...editorial, pillars: next });
                        }}
                        placeholder="Description EN"
                        className="px-3 py-2 bg-[#191217] border border-[#32101D] rounded text-[#F4EEF0]"
                      />
                    </div>
                  ))}
                </div>
              </section>

              {/* Universes & Privacy Intros */}
              <section className="bg-[#191217] border border-[#32101D] rounded-xl p-6 space-y-5 text-xs">
                <h2 className="font-display text-2xl text-[#F4EEF0]">
                  {lang === 'fr' ? '3. Sections Univers & Confidentialité' : '3. Universes & Privacy Copy'}
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[#B8AAB0] mb-1">Titre Univers (FR)</label>
                    <input
                      type="text"
                      value={editorial.universesTitleFr}
                      onChange={(e) =>
                        setEditorial({ ...editorial, universesTitleFr: e.target.value })
                      }
                      className="w-full px-3 py-2 bg-[#100D10] border border-[#32101D] rounded-lg text-[#F4EEF0]"
                    />
                  </div>
                  <div>
                    <label className="block text-[#B8AAB0] mb-1">Universes Title (EN)</label>
                    <input
                      type="text"
                      value={editorial.universesTitleEn}
                      onChange={(e) =>
                        setEditorial({ ...editorial, universesTitleEn: e.target.value })
                      }
                      className="w-full px-3 py-2 bg-[#100D10] border border-[#32101D] rounded-lg text-[#F4EEF0]"
                    />
                  </div>
                  <div>
                    <label className="block text-[#B8AAB0] mb-1">Intro Univers (FR)</label>
                    <textarea
                      rows={2}
                      value={editorial.universesSubtitleFr}
                      onChange={(e) =>
                        setEditorial({ ...editorial, universesSubtitleFr: e.target.value })
                      }
                      className="w-full px-3 py-2 bg-[#100D10] border border-[#32101D] rounded-lg text-[#F4EEF0]"
                    />
                  </div>
                  <div>
                    <label className="block text-[#B8AAB0] mb-1">Universes Intro (EN)</label>
                    <textarea
                      rows={2}
                      value={editorial.universesSubtitleEn}
                      onChange={(e) =>
                        setEditorial({ ...editorial, universesSubtitleEn: e.target.value })
                      }
                      className="w-full px-3 py-2 bg-[#100D10] border border-[#32101D] rounded-lg text-[#F4EEF0]"
                    />
                  </div>
                  <div>
                    <label className="block text-[#B8AAB0] mb-1">Titre Confidentialité (FR)</label>
                    <input
                      type="text"
                      value={editorial.privacyTitleFr}
                      onChange={(e) =>
                        setEditorial({ ...editorial, privacyTitleFr: e.target.value })
                      }
                      className="w-full px-3 py-2 bg-[#100D10] border border-[#32101D] rounded-lg text-[#F4EEF0]"
                    />
                  </div>
                  <div>
                    <label className="block text-[#B8AAB0] mb-1">Privacy Title (EN)</label>
                    <input
                      type="text"
                      value={editorial.privacyTitleEn}
                      onChange={(e) =>
                        setEditorial({ ...editorial, privacyTitleEn: e.target.value })
                      }
                      className="w-full px-3 py-2 bg-[#100D10] border border-[#32101D] rounded-lg text-[#F4EEF0]"
                    />
                  </div>
                  <div>
                    <label className="block text-[#B8AAB0] mb-1">Manifeste Confidentialité (FR)</label>
                    <textarea
                      rows={3}
                      value={editorial.privacyBodyFr}
                      onChange={(e) =>
                        setEditorial({ ...editorial, privacyBodyFr: e.target.value })
                      }
                      className="w-full px-3 py-2 bg-[#100D10] border border-[#32101D] rounded-lg text-[#F4EEF0]"
                    />
                  </div>
                  <div>
                    <label className="block text-[#B8AAB0] mb-1">Privacy Manifesto (EN)</label>
                    <textarea
                      rows={3}
                      value={editorial.privacyBodyEn}
                      onChange={(e) =>
                        setEditorial({ ...editorial, privacyBodyEn: e.target.value })
                      }
                      className="w-full px-3 py-2 bg-[#100D10] border border-[#32101D] rounded-lg text-[#F4EEF0]"
                    />
                  </div>
                </div>
              </section>
            </div>
          )}

          {/* TAB 2: 12 Universes Direct Titles & Descriptions Editor */}
          {tab === 'universes' && (
            <div className="space-y-4">
              {universes.map((u, idx) => (
                <div
                  key={u.id}
                  className="bg-[#191217] border border-[#32101D] rounded-xl p-5 space-y-3 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono-tabular text-[#C5A276]">
                      {String(u.order).padStart(2, '0')} · {u.slug}
                    </span>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => void handleSaveUniverse(u)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#4B1028] hover:bg-[#781D35] text-[#F4EEF0] rounded-lg cursor-pointer"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>{lang === 'fr' ? 'Enregistrer' : 'Save'}</span>
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <input
                      type="text"
                      value={u.titleFr}
                      onChange={(e) => {
                        const next = [...universes];
                        next[idx] = { ...u, titleFr: e.target.value };
                        setUniverses(next);
                      }}
                      placeholder="Titre FR"
                      className="px-3 py-2 bg-[#100D10] border border-[#32101D] rounded text-[#F4EEF0]"
                    />
                    <input
                      type="text"
                      value={u.titleEn}
                      onChange={(e) => {
                        const next = [...universes];
                        next[idx] = { ...u, titleEn: e.target.value };
                        setUniverses(next);
                      }}
                      placeholder="Title EN"
                      className="px-3 py-2 bg-[#100D10] border border-[#32101D] rounded text-[#F4EEF0]"
                    />
                    <textarea
                      rows={2}
                      value={u.descriptionFr}
                      onChange={(e) => {
                        const next = [...universes];
                        next[idx] = { ...u, descriptionFr: e.target.value };
                        setUniverses(next);
                      }}
                      placeholder="Description FR"
                      className="px-3 py-2 bg-[#100D10] border border-[#32101D] rounded text-[#F4EEF0]"
                    />
                    <textarea
                      rows={2}
                      value={u.descriptionEn}
                      onChange={(e) => {
                        const next = [...universes];
                        next[idx] = { ...u, descriptionEn: e.target.value };
                        setUniverses(next);
                      }}
                      placeholder="Description EN"
                      className="px-3 py-2 bg-[#100D10] border border-[#32101D] rounded text-[#F4EEF0]"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* TAB 3: Quick Activity FR/EN Copy Editor */}
          {tab === 'activities' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              <div className="lg:col-span-5 space-y-3">
                <input
                  type="text"
                  value={activitySearch}
                  onChange={(e) => setActivitySearch(e.target.value)}
                  placeholder={lang === 'fr' ? 'Rechercher une activité...' : 'Search activity copy...'}
                  className="w-full px-3.5 py-2 bg-[#191217] border border-[#32101D] rounded-lg text-xs text-[#F4EEF0]"
                />
                <div className="bg-[#191217] border border-[#32101D] rounded-xl divide-y divide-[#32101D] max-h-[540px] overflow-y-auto">
                  {filteredActivities.map((act) => (
                    <button
                      key={act.id}
                      type="button"
                      onClick={() => setEditingActivity({ ...act })}
                      className={`w-full text-left p-3.5 text-xs transition-colors cursor-pointer ${
                        editingActivity?.id === act.id
                          ? 'bg-[#4B1028]/60 text-[#F4EEF0]'
                          : 'hover:bg-[#32101D]/40 text-[#B8AAB0]'
                      }`}
                    >
                      <p className="font-medium text-[#F4EEF0] truncate">
                        {lang === 'fr' ? act.titleFr : act.titleEn}
                      </p>
                      <p className="text-[11px] text-[#C5A276] mt-0.5">
                        {act.type} · {act.status}
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="lg:col-span-7">
                {!editingActivity ? (
                  <div className="bg-[#191217] border border-[#32101D] rounded-xl p-10 text-center space-y-2">
                    <BookText className="w-7 h-7 text-[#C5A276] mx-auto" />
                    <p className="text-xs text-[#B8AAB0]">
                      {lang === 'fr'
                        ? 'Sélectionnez une activité à gauche pour éditer ses textes FR et EN.'
                        : 'Select an activity on the left to edit its FR and EN copy.'}
                    </p>
                  </div>
                ) : (
                  <form
                    onSubmit={(e) => void handleSaveActivityCopy(e)}
                    className="bg-[#191217] border border-[#C5A276]/40 rounded-xl p-6 space-y-4 text-xs"
                  >
                    <h2 className="font-display text-2xl text-[#F4EEF0]">
                      {lang === 'fr' ? 'Édition du texte d’activité' : 'Edit Activity Copy'}
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[#B8AAB0] mb-1">Titre (FR)</label>
                        <input
                          type="text"
                          required
                          value={editingActivity.titleFr}
                          onChange={(e) =>
                            setEditingActivity({ ...editingActivity, titleFr: e.target.value })
                          }
                          className="w-full px-3 py-2 bg-[#100D10] border border-[#32101D] rounded text-[#F4EEF0]"
                        />
                      </div>
                      <div>
                        <label className="block text-[#B8AAB0] mb-1">Title (EN)</label>
                        <input
                          type="text"
                          required
                          value={editingActivity.titleEn}
                          onChange={(e) =>
                            setEditingActivity({ ...editingActivity, titleEn: e.target.value })
                          }
                          className="w-full px-3 py-2 bg-[#100D10] border border-[#32101D] rounded text-[#F4EEF0]"
                        />
                      </div>
                      <div>
                        <label className="block text-[#B8AAB0] mb-1">Texte principal (FR)</label>
                        <textarea
                          rows={4}
                          required
                          value={editingActivity.bodyFr}
                          onChange={(e) =>
                            setEditingActivity({ ...editingActivity, bodyFr: e.target.value })
                          }
                          className="w-full px-3 py-2 bg-[#100D10] border border-[#32101D] rounded text-[#F4EEF0]"
                        />
                      </div>
                      <div>
                        <label className="block text-[#B8AAB0] mb-1">Body Copy (EN)</label>
                        <textarea
                          rows={4}
                          required
                          value={editingActivity.bodyEn}
                          onChange={(e) =>
                            setEditingActivity({ ...editingActivity, bodyEn: e.target.value })
                          }
                          className="w-full px-3 py-2 bg-[#100D10] border border-[#32101D] rounded text-[#F4EEF0]"
                        />
                      </div>
                      <div>
                        <label className="block text-[#B8AAB0] mb-1">Instructions (FR)</label>
                        <textarea
                          rows={2}
                          value={editingActivity.instructionsFr || ''}
                          onChange={(e) =>
                            setEditingActivity({
                              ...editingActivity,
                              instructionsFr: e.target.value,
                            })
                          }
                          className="w-full px-3 py-2 bg-[#100D10] border border-[#32101D] rounded text-[#F4EEF0]"
                        />
                      </div>
                      <div>
                        <label className="block text-[#B8AAB0] mb-1">Instructions (EN)</label>
                        <textarea
                          rows={2}
                          value={editingActivity.instructionsEn || ''}
                          onChange={(e) =>
                            setEditingActivity({
                              ...editingActivity,
                              instructionsEn: e.target.value,
                            })
                          }
                          className="w-full px-3 py-2 bg-[#100D10] border border-[#32101D] rounded text-[#F4EEF0]"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={saving}
                      className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#781D35] hover:bg-[#4B1028] text-[#F4EEF0] rounded-lg cursor-pointer"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>{lang === 'fr' ? 'Enregistrer les textes' : 'Save activity copy'}</span>
                    </button>
                  </form>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
