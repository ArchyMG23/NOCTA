import React, { useEffect, useRef, useState } from 'react';
import {
  Check,
  Eye,
  EyeOff,
  FolderPlus,
  ImagePlus,
  RefreshCw,
  Search,
  ShieldAlert,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useI18n } from '../../i18n/I18nContext';
import {
  ADULT_CLASSIFICATION_LABELS,
  FOCAL_POINT_CLASSES,
  MEDIA_SPACE_LABELS,
} from '../../data/editorialDefaults';
import {
  createMediaAssetDoc,
  deleteMediaAssetFull,
  deleteMediaCategory,
  fetchAllActivitiesForAdmin,
  fetchAllMediaAssetsForAdmin,
  fetchFormats,
  fetchMediaCategories,
  fetchUniverses,
  seedDefaultMediaCategories,
  updateMediaAssetDoc,
  upsertMediaCategory,
} from '../../services/noctaService';
import { SafeImage } from '../SafeImage';
import type {
  Activity,
  ActivityFormat,
  AdultClassification,
  FocalPoint,
  MediaAsset,
  MediaCategory,
  MediaPublicationStatus,
  MediaRole,
  MediaSpace,
  Universe,
} from '../../types/nocta';

interface MediaManagerPanelProps {
  actorRole: string;
}

export function MediaManagerPanel({ actorRole }: MediaManagerPanelProps) {
  const { firebaseUser } = useAuth();
  const { lang, t } = useI18n();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const replaceInputRef = useRef<HTMLInputElement | null>(null);

  const [mediaList, setMediaList] = useState<MediaAsset[]>([]);
  const [categories, setCategories] = useState<MediaCategory[]>([]);
  const [universes, setUniverses] = useState<Universe[]>([]);
  const [formats, setFormats] = useState<ActivityFormat[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  const [uploading, setUploading] = useState(false);
  const [uploadClassification, setUploadClassification] = useState<AdultClassification>('sensual');
  const [uploadCategory, setUploadCategory] = useState('cat_accueil');
  const [notice, setNotice] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCat, setFilterCat] = useState('all');
  const [filterClass, setFilterClass] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');

  // Selected Media for Full Metadata Editing
  const [selected, setSelected] = useState<MediaAsset | null>(null);
  const [keywordsInput, setKeywordsInput] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [cacheBust, setCacheBust] = useState<number>(0);

  // Confirmation modal for deletion
  const [pendingDelete, setPendingDelete] = useState<MediaAsset | null>(null);

  // Super Admin Category Editor
  const [showCatEditor, setShowCatEditor] = useState(false);
  const [newCatFr, setNewCatFr] = useState('');
  const [newCatEn, setNewCatEn] = useState('');
  const [newCatOrder, setNewCatOrder] = useState(11);

  const isSuperAdmin = actorRole === 'super_admin';

  const loadData = async () => {
    setLoading(true);
    try {
      const [mList, cList, uList, fList, aList] = await Promise.all([
        fetchAllMediaAssetsForAdmin(),
        fetchMediaCategories(),
        fetchUniverses(),
        fetchFormats(),
        fetchAllActivitiesForAdmin(),
      ]);
      setMediaList(mList);
      setCategories(cList);
      setUniverses(uList);
      setFormats(fList);
      setActivities(aList);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : t.states.errorTitle);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const selectMediaForEdit = (item: MediaAsset) => {
    setSelected({ ...item });
    setKeywordsInput((item.keywords || []).join(', '));
    setNotice(null);
    setErrorMsg(null);
  };

  const handleBatchUpload = async (files: FileList | null) => {
    if (!files || files.length === 0 || !firebaseUser) return;
    setUploading(true);
    setErrorMsg(null);
    setNotice(null);
    try {
      const idToken = await firebaseUser.getIdToken();
      const formData = new FormData();
      Array.from(files).forEach((f) => formData.append('images', f));

      const resp = await fetch('/api/media/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${idToken}` },
        body: formData,
      });

      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data.message || 'Upload failed.');
      }

      const defaultSpaces: MediaSpace[] =
        uploadClassification === 'explicit'
          ? ['universes', 'couple_space']
          : ['public_landing', 'universes', 'couple_space'];

      let orderCursor = mediaList.length + 1;
      for (const up of data.uploaded as Array<{
        fileId: string;
        originalName: string;
        mimeType: string;
        fileSize: number;
      }>) {
        const baseTitle = up.originalName.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ');
        await createMediaAssetDoc({
          fileId: up.fileId,
          titleFr: baseTitle || 'Photographie NOCTA',
          titleEn: baseTitle || 'NOCTA Photograph',
          descriptionFr: '',
          descriptionEn: '',
          keywords: [],
          categoryId: uploadCategory || 'cat_accueil',
          collectionName: '',
          universeId: null,
          formatId: null,
          activityId: null,
          role: 'gallery',
          focalPoint: 'center',
          displayOrder: orderCursor++,
          adultClassification: uploadClassification,
          allowedSpaces: defaultSpaces,
          status: 'draft',
          mimeType: up.mimeType,
          fileSize: up.fileSize,
          actorUid: firebaseUser.uid,
          actorRole,
          idToken,
        });
      }

      setNotice(
        lang === 'fr'
          ? `${data.uploaded.length} image(s) importée(s) en brouillon dans le stockage privé.`
          : `${data.uploaded.length} image(s) uploaded as draft into private storage.`
      );
      await loadData();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : t.states.errorTitle);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleReplaceBinary = async (file: File | undefined) => {
    if (!file || !selected || !firebaseUser) return;
    setSavingEdit(true);
    setErrorMsg(null);
    try {
      const idToken = await firebaseUser.getIdToken();
      const formData = new FormData();
      formData.append('image', file);

      const resp = await fetch(`/api/media/replace/${encodeURIComponent(selected.fileId)}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${idToken}` },
        body: formData,
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.message || 'Replace failed.');

      const updated: MediaAsset = {
        ...selected,
        mimeType: data.mimeType,
        fileSize: data.fileSize,
      };
      await updateMediaAssetDoc({
        media: updated,
        actorUid: firebaseUser.uid,
        actorRole,
        idToken,
      });
      setCacheBust(Date.now());
      setSelected(updated);
      setNotice(
        lang === 'fr'
          ? 'Fichier image remplacé sans perte de métadonnées.'
          : 'Image file replaced while preserving metadata.'
      );
      await loadData();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : t.states.errorTitle);
    } finally {
      setSavingEdit(false);
      if (replaceInputRef.current) replaceInputRef.current.value = '';
    }
  };

  const handleSaveSelected = async (overrideStatus?: MediaPublicationStatus) => {
    if (!selected || !firebaseUser) return;
    setSavingEdit(true);
    setErrorMsg(null);
    setNotice(null);
    try {
      const idToken = await firebaseUser.getIdToken();
      const keywords = keywordsInput
        .split(',')
        .map((k) => k.trim())
        .filter(Boolean);

      const nextStatus = overrideStatus || selected.status;
      const nextSpaces =
        selected.adultClassification === 'explicit'
          ? selected.allowedSpaces.filter((s) => s !== 'public_landing')
          : selected.allowedSpaces;

      const updated: MediaAsset = {
        ...selected,
        keywords,
        status: nextStatus,
        allowedSpaces: nextSpaces,
        publicLandingSafe:
          nextStatus === 'published' &&
          selected.adultClassification !== 'explicit' &&
          nextSpaces.includes('public_landing'),
      };

      await updateMediaAssetDoc({
        media: updated,
        actorUid: firebaseUser.uid,
        actorRole,
        idToken,
      });

      setSelected(updated);
      setNotice(
        lang === 'fr' ? 'Média mis à jour et synchronisé.' : 'Media asset updated and synced.'
      );
      await loadData();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : t.states.errorTitle);
    } finally {
      setSavingEdit(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!pendingDelete || !firebaseUser) return;
    setSavingEdit(true);
    try {
      const idToken = await firebaseUser.getIdToken();
      await deleteMediaAssetFull({
        mediaId: pendingDelete.id,
        fileId: pendingDelete.fileId,
        actorUid: firebaseUser.uid,
        actorRole,
        idToken,
      });
      if (selected?.id === pendingDelete.id) {
        setSelected(null);
      }
      setPendingDelete(null);
      setNotice(lang === 'fr' ? 'Média supprimé définitivement.' : 'Media permanently deleted.');
      await loadData();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : t.states.errorTitle);
    } finally {
      setSavingEdit(false);
    }
  };

  const handleSeedCategories = async () => {
    if (!firebaseUser || !isSuperAdmin) return;
    await seedDefaultMediaCategories(firebaseUser.uid, actorRole);
    setNotice(
      lang === 'fr'
        ? 'Catégories par défaut enregistrées dans Firestore.'
        : 'Default categories saved to Firestore.'
    );
    await loadData();
  };

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser || !isSuperAdmin || !newCatFr.trim()) return;
    const slug = newCatFr
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-');
    await upsertMediaCategory({
      category: {
        id: `cat_${slug}_${Date.now().toString(36)}`,
        slug,
        labelFr: newCatFr.trim(),
        labelEn: newCatEn.trim() || newCatFr.trim(),
        order: newCatOrder,
        isSystem: false,
      },
      actorUid: firebaseUser.uid,
      actorRole,
    });
    setNewCatFr('');
    setNewCatEn('');
    await loadData();
  };

  const filteredMedia = mediaList.filter((m) => {
    if (filterCat !== 'all' && m.categoryId !== filterCat) return false;
    if (filterClass !== 'all' && m.adultClassification !== filterClass) return false;
    if (filterStatus !== 'all' && m.status !== filterStatus) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        m.titleFr.toLowerCase().includes(q) ||
        m.titleEn.toLowerCase().includes(q) ||
        (m.collectionName || '').toLowerCase().includes(q) ||
        (m.keywords || []).some((k) => k.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const selectedUniverseFormats = selected?.universeId
    ? formats.filter((f) => f.universeId === selected.universeId)
    : formats;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-[#32101D] pb-5">
        <div>
          <h1 className="font-display text-3xl sm:text-4xl font-semibold text-[#F4EEF0]">
            {t.admin.modules.media}
          </h1>
          <p className="text-xs text-[#B8AAB0] mt-1">
            {lang === 'fr'
              ? 'Bibliothèque photographique privée : import multiple, classification adulte, cadrage, remplacement et diffusion ciblée.'
              : 'Private photography library: batch upload, adult classification, focal framing, file replacement, and placement control.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isSuperAdmin && (
            <button
              type="button"
              onClick={() => setShowCatEditor((v) => !v)}
              className="inline-flex items-center gap-2 px-4 py-2 border border-[#32101D] hover:border-[#C5A276] text-xs text-[#C5A276] rounded-lg cursor-pointer"
            >
              <FolderPlus className="w-3.5 h-3.5" />
              <span>{lang === 'fr' ? 'Gérer les catégories' : 'Manage categories'}</span>
            </button>
          )}
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

      {/* Super Admin Category Manager */}
      {showCatEditor && isSuperAdmin && (
        <div className="bg-[#191217] border border-[#C5A276]/40 rounded-xl p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-2xl text-[#F4EEF0]">
              {lang === 'fr' ? 'Catégories de médias (Super Admin)' : 'Media Categories (Super Admin)'}
            </h2>
            <button
              type="button"
              onClick={() => void handleSeedCategories()}
              className="px-3.5 py-2 bg-[#4B1028] hover:bg-[#781D35] text-xs text-[#F4EEF0] rounded-lg cursor-pointer"
            >
              {lang === 'fr' ? 'Initialiser les catégories par défaut' : 'Seed default categories'}
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-xs">
            {categories.map((cat) => (
              <div
                key={cat.id}
                className="p-3 rounded-lg bg-[#100D10] border border-[#32101D] flex items-center justify-between gap-2"
              >
                <div>
                  <p className="text-[#F4EEF0] font-medium">
                    {cat.order}. {cat.labelFr} / {cat.labelEn}
                  </p>
                </div>
                {!cat.isSystem && (
                  <button
                    type="button"
                    onClick={async () => {
                      if (!firebaseUser) return;
                      await deleteMediaCategory(cat.id, firebaseUser.uid, actorRole);
                      await loadData();
                    }}
                    className="text-[#B8AAB0] hover:text-[#781D35] cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>

          <form onSubmit={(e) => void handleAddCategory(e)} className="flex flex-wrap gap-2">
            <input
              type="text"
              required
              value={newCatFr}
              onChange={(e) => setNewCatFr(e.target.value)}
              placeholder={lang === 'fr' ? 'Nom FR' : 'FR label'}
              className="px-3 py-2 bg-[#100D10] border border-[#32101D] rounded-lg text-xs text-[#F4EEF0]"
            />
            <input
              type="text"
              value={newCatEn}
              onChange={(e) => setNewCatEn(e.target.value)}
              placeholder={lang === 'fr' ? 'Nom EN' : 'EN label'}
              className="px-3 py-2 bg-[#100D10] border border-[#32101D] rounded-lg text-xs text-[#F4EEF0]"
            />
            <input
              type="number"
              value={newCatOrder}
              onChange={(e) => setNewCatOrder(Number(e.target.value))}
              className="w-20 px-3 py-2 bg-[#100D10] border border-[#32101D] rounded-lg text-xs text-[#F4EEF0]"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-[#781D35] hover:bg-[#4B1028] text-xs text-[#F4EEF0] rounded-lg cursor-pointer"
            >
              {lang === 'fr' ? 'Ajouter' : 'Add'}
            </button>
          </form>
        </div>
      )}

      {/* Multi-Image Private Upload Dropzone */}
      <div className="bg-[#191217] border border-[#32101D] rounded-xl p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div className="space-y-1.5">
            <label className="block text-xs text-[#B8AAB0]">
              {lang === 'fr' ? 'Catégorie initiale' : 'Initial category'}
            </label>
            <select
              value={uploadCategory}
              onChange={(e) => setUploadCategory(e.target.value)}
              className="w-full px-3 py-2 bg-[#100D10] border border-[#32101D] rounded-lg text-xs text-[#F4EEF0]"
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {lang === 'fr' ? c.labelFr : c.labelEn}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs text-[#B8AAB0]">
              {lang === 'fr' ? 'Classification adulte par défaut' : 'Default adult classification'}
            </label>
            <select
              value={uploadClassification}
              onChange={(e) => setUploadClassification(e.target.value as AdultClassification)}
              className="w-full px-3 py-2 bg-[#100D10] border border-[#32101D] rounded-lg text-xs text-[#F4EEF0]"
            >
              {(Object.keys(ADULT_CLASSIFICATION_LABELS) as AdultClassification[]).map((k) => (
                <option key={k} value={k}>
                  {ADULT_CLASSIFICATION_LABELS[k][lang]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/png,image/jpeg,image/webp,image/avif"
              onChange={(e) => void handleBatchUpload(e.target.files)}
              className="hidden"
            />
            <button
              type="button"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
              className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-[#781D35] hover:bg-[#4B1028] disabled:opacity-50 text-xs font-medium text-[#F4EEF0] rounded-lg cursor-pointer"
            >
              <Upload className="w-4 h-4" />
              <span>
                {uploading
                  ? t.states.loading
                  : lang === 'fr'
                    ? 'Importer une ou plusieurs images'
                    : 'Upload one or multiple images'}
              </span>
            </button>
          </div>
        </div>
        <p className="text-[11px] text-[#B8AAB0]">
          {lang === 'fr'
            ? 'Formats acceptés : PNG, JPEG, WebP, AVIF (max 15 Mo par image). Stockage serveur privé chiffré par session — les médias explicites ne sont jamais servis sur l’accueil public.'
            : 'Accepted formats: PNG, JPEG, WebP, AVIF (max 15 MB per image). Private session-gated server storage — explicit media are never served on the public landing page.'}
        </p>
      </div>

      {/* Filters Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="relative">
          <Search className="w-4 h-4 text-[#B8AAB0] absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={lang === 'fr' ? 'Titre, mot-clé, collection...' : 'Title, keyword, collection...'}
            className="w-full pl-9 pr-3 py-2 bg-[#191217] border border-[#32101D] rounded-lg text-xs text-[#F4EEF0]"
          />
        </div>

        <select
          value={filterCat}
          onChange={(e) => setFilterCat(e.target.value)}
          className="px-3 py-2 bg-[#191217] border border-[#32101D] rounded-lg text-xs text-[#F4EEF0]"
        >
          <option value="all">{lang === 'fr' ? 'Toutes les catégories' : 'All categories'}</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {lang === 'fr' ? c.labelFr : c.labelEn}
            </option>
          ))}
        </select>

        <select
          value={filterClass}
          onChange={(e) => setFilterClass(e.target.value)}
          className="px-3 py-2 bg-[#191217] border border-[#32101D] rounded-lg text-xs text-[#F4EEF0]"
        >
          <option value="all">{lang === 'fr' ? 'Toutes classifications' : 'All classifications'}</option>
          {(Object.keys(ADULT_CLASSIFICATION_LABELS) as AdultClassification[]).map((k) => (
            <option key={k} value={k}>
              {ADULT_CLASSIFICATION_LABELS[k][lang]}
            </option>
          ))}
        </select>

        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-2 bg-[#191217] border border-[#32101D] rounded-lg text-xs text-[#F4EEF0]"
        >
          <option value="all">{lang === 'fr' ? 'Tous statuts' : 'All statuses'}</option>
          <option value="published">{lang === 'fr' ? 'Publiée' : 'Published'}</option>
          <option value="draft">{lang === 'fr' ? 'Brouillon' : 'Draft'}</option>
          <option value="unpublished">{lang === 'fr' ? 'Dépubliée' : 'Unpublished'}</option>
        </select>
      </div>

      {/* Main Split: Gallery Grid + Full Metadata Editor */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className={selected ? 'lg:col-span-7' : 'lg:col-span-12'}>
          {loading ? (
            <p className="text-xs text-[#B8AAB0]">{t.states.loading}</p>
          ) : filteredMedia.length === 0 ? (
            <div className="p-10 text-center bg-[#191217] border border-[#32101D] rounded-xl space-y-2">
              <ImagePlus className="w-8 h-8 text-[#C5A276] mx-auto" />
              <p className="text-sm text-[#B8AAB0]">{t.states.empty}</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {filteredMedia.map((m) => {
                const isSelected = selected?.id === m.id;
                const imgSrc = `/api/media/file/${m.fileId}${cacheBust ? `?t=${cacheBust}` : ''}`;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => selectMediaForEdit(m)}
                    className={`group text-left bg-[#191217] border rounded-xl overflow-hidden transition-colors cursor-pointer ${
                      isSelected ? 'border-[#C5A276]' : 'border-[#32101D] hover:border-[#781D35]'
                    }`}
                  >
                    <div className="aspect-[4/3] w-full overflow-hidden relative bg-[#100D10]">
                      <SafeImage
                        src={imgSrc}
                        alt={lang === 'fr' ? m.titleFr : m.titleEn}
                        className={`w-full h-full object-cover ${FOCAL_POINT_CLASSES[m.focalPoint || 'center']} group-hover:scale-105 transition-transform duration-500`}
                      />
                      <span className="absolute top-2 right-2 px-2 py-0.5 text-[10px] bg-[#100D10]/85 text-[#C5A276] border border-[#32101D]">
                        {m.status}
                      </span>
                    </div>
                    <div className="p-3 space-y-1">
                      <p className="text-xs font-medium text-[#F4EEF0] truncate">
                        {lang === 'fr' ? m.titleFr : m.titleEn}
                      </p>
                      <p className="text-[11px] text-[#B8AAB0] truncate">
                        #{m.displayOrder} · {m.adultClassification} · {m.role}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Selected Media Full Inspector */}
        {selected && (
          <div className="lg:col-span-5 bg-[#191217] border border-[#C5A276]/50 rounded-xl p-5 space-y-5">
            <div className="flex items-center justify-between border-b border-[#32101D] pb-3">
              <h2 className="font-display text-2xl text-[#F4EEF0]">
                {lang === 'fr' ? 'Édition du média' : 'Edit media'}
              </h2>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="text-xs text-[#B8AAB0] hover:text-[#F4EEF0] cursor-pointer"
              >
                {lang === 'fr' ? 'Fermer' : 'Close'}
              </button>
            </div>

            <div className="aspect-[16/10] w-full overflow-hidden bg-[#100D10] relative">
              <SafeImage
                src={`/api/media/file/${selected.fileId}${cacheBust ? `?t=${cacheBust}` : ''}`}
                alt={selected.titleFr}
                className={`w-full h-full object-cover ${FOCAL_POINT_CLASSES[selected.focalPoint || 'center']}`}
              />
            </div>

            {/* Replace binary & Quick status buttons */}
            <div className="flex flex-wrap gap-2">
              <input
                ref={replaceInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/avif"
                onChange={(e) => void handleReplaceBinary(e.target.files?.[0])}
                className="hidden"
              />
              <button
                type="button"
                disabled={savingEdit}
                onClick={() => replaceInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-[#32101D] hover:border-[#C5A276] text-xs text-[#F4EEF0] rounded-lg cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5 text-[#C5A276]" />
                <span>{lang === 'fr' ? 'Remplacer le fichier' : 'Replace image'}</span>
              </button>

              {selected.status === 'published' ? (
                <button
                  type="button"
                  disabled={savingEdit}
                  onClick={() => void handleSaveSelected('unpublished')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-[#32101D] text-xs text-[#B8AAB0] hover:text-[#F4EEF0] rounded-lg cursor-pointer"
                >
                  <EyeOff className="w-3.5 h-3.5" />
                  <span>{lang === 'fr' ? 'Dépublier' : 'Unpublish'}</span>
                </button>
              ) : (
                <button
                  type="button"
                  disabled={savingEdit}
                  onClick={() => void handleSaveSelected('published')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#4B1028] hover:bg-[#781D35] text-xs text-[#F4EEF0] rounded-lg cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>{lang === 'fr' ? 'Publier' : 'Publish'}</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setPendingDelete(selected)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-[#781D35]/60 text-xs text-[#B8AAB0] hover:text-[#F4EEF0] rounded-lg cursor-pointer ml-auto"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{lang === 'fr' ? 'Supprimer' : 'Delete'}</span>
              </button>
            </div>

            {/* Bilingual Title & Description */}
            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[#B8AAB0] mb-1">Titre (FR)</label>
                  <input
                    type="text"
                    value={selected.titleFr}
                    onChange={(e) => setSelected({ ...selected, titleFr: e.target.value })}
                    className="w-full px-3 py-2 bg-[#100D10] border border-[#32101D] rounded-lg text-[#F4EEF0]"
                  />
                </div>
                <div>
                  <label className="block text-[#B8AAB0] mb-1">Title (EN)</label>
                  <input
                    type="text"
                    value={selected.titleEn}
                    onChange={(e) => setSelected({ ...selected, titleEn: e.target.value })}
                    className="w-full px-3 py-2 bg-[#100D10] border border-[#32101D] rounded-lg text-[#F4EEF0]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[#B8AAB0] mb-1">Description (FR)</label>
                  <textarea
                    rows={2}
                    value={selected.descriptionFr || ''}
                    onChange={(e) => setSelected({ ...selected, descriptionFr: e.target.value })}
                    className="w-full px-3 py-2 bg-[#100D10] border border-[#32101D] rounded-lg text-[#F4EEF0]"
                  />
                </div>
                <div>
                  <label className="block text-[#B8AAB0] mb-1">Description (EN)</label>
                  <textarea
                    rows={2}
                    value={selected.descriptionEn || ''}
                    onChange={(e) => setSelected({ ...selected, descriptionEn: e.target.value })}
                    className="w-full px-3 py-2 bg-[#100D10] border border-[#32101D] rounded-lg text-[#F4EEF0]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[#B8AAB0] mb-1">
                    {lang === 'fr' ? 'Mots-clés (virgules)' : 'Keywords (comma-separated)'}
                  </label>
                  <input
                    type="text"
                    value={keywordsInput}
                    onChange={(e) => setKeywordsInput(e.target.value)}
                    placeholder="intime, clair-obscur, couple"
                    className="w-full px-3 py-2 bg-[#100D10] border border-[#32101D] rounded-lg text-[#F4EEF0]"
                  />
                </div>
                <div>
                  <label className="block text-[#B8AAB0] mb-1">
                    {lang === 'fr' ? 'Collection' : 'Collection'}
                  </label>
                  <input
                    type="text"
                    value={selected.collectionName || ''}
                    onChange={(e) => setSelected({ ...selected, collectionName: e.target.value })}
                    placeholder="Collection Automne"
                    className="w-full px-3 py-2 bg-[#100D10] border border-[#32101D] rounded-lg text-[#F4EEF0]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-[#B8AAB0] mb-1">
                    {lang === 'fr' ? 'Catégorie' : 'Category'}
                  </label>
                  <select
                    value={selected.categoryId}
                    onChange={(e) => setSelected({ ...selected, categoryId: e.target.value })}
                    className="w-full px-2.5 py-2 bg-[#100D10] border border-[#32101D] rounded-lg text-[#F4EEF0]"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {lang === 'fr' ? c.labelFr : c.labelEn}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[#B8AAB0] mb-1">
                    {lang === 'fr' ? 'Rôle visuel' : 'Role'}
                  </label>
                  <select
                    value={selected.role}
                    onChange={(e) => setSelected({ ...selected, role: e.target.value as MediaRole })}
                    className="w-full px-2.5 py-2 bg-[#100D10] border border-[#32101D] rounded-lg text-[#F4EEF0]"
                  >
                    <option value="primary">Primary Hero</option>
                    <option value="banner">Banner</option>
                    <option value="secondary">Secondary</option>
                    <option value="universe_cover">Universe Cover</option>
                    <option value="activity">Activity</option>
                    <option value="gallery">Gallery</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[#B8AAB0] mb-1">
                    {lang === 'fr' ? 'Cadrage / Focus' : 'Focal point'}
                  </label>
                  <select
                    value={selected.focalPoint}
                    onChange={(e) =>
                      setSelected({ ...selected, focalPoint: e.target.value as FocalPoint })
                    }
                    className="w-full px-2.5 py-2 bg-[#100D10] border border-[#32101D] rounded-lg text-[#F4EEF0]"
                  >
                    <option value="center">Center</option>
                    <option value="top">Top</option>
                    <option value="bottom">Bottom</option>
                    <option value="left">Left</option>
                    <option value="right">Right</option>
                  </select>
                </div>
              </div>

              {/* Associations: Universe / Format / Activity & Display Order */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[#B8AAB0] mb-1">
                    {lang === 'fr' ? 'Univers associé' : 'Linked universe'}
                  </label>
                  <select
                    value={selected.universeId || ''}
                    onChange={(e) =>
                      setSelected({
                        ...selected,
                        universeId: e.target.value || null,
                        formatId: null,
                      })
                    }
                    className="w-full px-2.5 py-2 bg-[#100D10] border border-[#32101D] rounded-lg text-[#F4EEF0]"
                  >
                    <option value="">—</option>
                    {universes.map((u) => (
                      <option key={u.id} value={u.id}>
                        {String(u.order).padStart(2, '0')}. {lang === 'fr' ? u.titleFr : u.titleEn}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[#B8AAB0] mb-1">
                    {lang === 'fr' ? 'Format associé' : 'Linked format'}
                  </label>
                  <select
                    value={selected.formatId || ''}
                    onChange={(e) =>
                      setSelected({ ...selected, formatId: e.target.value || null })
                    }
                    className="w-full px-2.5 py-2 bg-[#100D10] border border-[#32101D] rounded-lg text-[#F4EEF0]"
                  >
                    <option value="">—</option>
                    {selectedUniverseFormats.map((f) => (
                      <option key={f.id} value={f.id}>
                        {lang === 'fr' ? f.titleFr : f.titleEn}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div className="sm:col-span-2">
                  <label className="block text-[#B8AAB0] mb-1">
                    {lang === 'fr' ? 'Activité associée' : 'Linked activity'}
                  </label>
                  <select
                    value={selected.activityId || ''}
                    onChange={(e) =>
                      setSelected({ ...selected, activityId: e.target.value || null })
                    }
                    className="w-full px-2.5 py-2 bg-[#100D10] border border-[#32101D] rounded-lg text-[#F4EEF0]"
                  >
                    <option value="">—</option>
                    {activities.map((a) => (
                      <option key={a.id} value={a.id}>
                        {lang === 'fr' ? a.titleFr : a.titleEn}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[#B8AAB0] mb-1">
                    {lang === 'fr' ? 'Ordre' : 'Order'}
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={10000}
                    value={selected.displayOrder}
                    onChange={(e) =>
                      setSelected({ ...selected, displayOrder: Number(e.target.value) })
                    }
                    className="w-full px-2.5 py-2 bg-[#100D10] border border-[#32101D] rounded-lg text-[#F4EEF0]"
                  />
                </div>
              </div>

              {/* Adult Classification & Placement Safety */}
              <div className="p-3.5 rounded-lg bg-[#100D10] border border-[#32101D] space-y-3">
                <div>
                  <label className="block text-[#C5A276] mb-1 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>{lang === 'fr' ? 'Classification adulte' : 'Adult classification'}</span>
                  </label>
                  <select
                    value={selected.adultClassification}
                    onChange={(e) => {
                      const nextClass = e.target.value as AdultClassification;
                      const nextSpaces =
                        nextClass === 'explicit'
                          ? selected.allowedSpaces.filter((s) => s !== 'public_landing')
                          : selected.allowedSpaces;
                      setSelected({
                        ...selected,
                        adultClassification: nextClass,
                        allowedSpaces: nextSpaces,
                      });
                    }}
                    className="w-full px-2.5 py-2 bg-[#191217] border border-[#32101D] rounded-lg text-[#F4EEF0]"
                  >
                    {(Object.keys(ADULT_CLASSIFICATION_LABELS) as AdultClassification[]).map(
                      (k) => (
                        <option key={k} value={k}>
                          {ADULT_CLASSIFICATION_LABELS[k][lang]}
                        </option>
                      )
                    )}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <p className="text-[#B8AAB0]">
                    {lang === 'fr' ? 'Espaces autorisés :' : 'Allowed placement spaces:'}
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {(Object.keys(MEDIA_SPACE_LABELS) as MediaSpace[]).map((sp) => {
                      const blocked =
                        selected.adultClassification === 'explicit' && sp === 'public_landing';
                      return (
                        <label
                          key={sp}
                          className={`flex items-center gap-2 ${
                            blocked ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'
                          }`}
                        >
                          <input
                            type="checkbox"
                            disabled={blocked}
                            checked={selected.allowedSpaces.includes(sp)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelected({
                                  ...selected,
                                  allowedSpaces: [...selected.allowedSpaces, sp],
                                });
                              } else {
                                setSelected({
                                  ...selected,
                                  allowedSpaces: selected.allowedSpaces.filter((x) => x !== sp),
                                });
                              }
                            }}
                            className="accent-[#781D35]"
                          />
                          <span className="text-[#F4EEF0]">{MEDIA_SPACE_LABELS[sp][lang]}</span>
                        </label>
                      );
                    })}
                  </div>
                  {selected.adultClassification === 'explicit' && (
                    <p className="text-[11px] text-[#C5A276] flex items-center gap-1.5 pt-1">
                      <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                      <span>
                        {lang === 'fr'
                          ? 'Sécurité active : les images explicites sont strictement exclues de l’accueil public.'
                          : 'Safety active: explicit images are strictly excluded from public landing pages.'}
                      </span>
                    </p>
                  )}
                </div>
              </div>

              <button
                type="button"
                disabled={savingEdit}
                onClick={() => void handleSaveSelected()}
                className="w-full px-4 py-2.5 bg-[#781D35] hover:bg-[#4B1028] disabled:opacity-50 text-xs font-medium text-[#F4EEF0] rounded-lg cursor-pointer"
              >
                {savingEdit
                  ? t.states.loading
                  : lang === 'fr'
                    ? 'Enregistrer les modifications'
                    : 'Save media changes'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      {pendingDelete && (
        <div
          className="fixed inset-0 z-50 bg-[#100D10]/90 backdrop-blur-sm flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="max-w-md w-full bg-[#191217] border border-[#781D35] rounded-xl p-6 space-y-4">
            <h3 className="font-display text-2xl text-[#F4EEF0]">{t.admin.confirmDeleteTitle}</h3>
            <p className="text-xs text-[#B8AAB0] leading-relaxed">
              {t.admin.confirmDeleteBody} ({pendingDelete.titleFr})
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setPendingDelete(null)}
                className="px-4 py-2 border border-[#32101D] text-xs text-[#B8AAB0] rounded-lg cursor-pointer"
              >
                {t.admin.cancelBtn}
              </button>
              <button
                type="button"
                onClick={() => void handleConfirmDelete()}
                className="px-4 py-2 bg-[#781D35] hover:bg-[#4B1028] text-xs text-[#F4EEF0] rounded-lg cursor-pointer"
              >
                {t.admin.confirmBtn}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
