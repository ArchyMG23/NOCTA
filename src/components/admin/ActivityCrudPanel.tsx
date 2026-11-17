import React, { useEffect, useState } from 'react';
import { Edit3, Plus, Search, Trash2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useI18n } from '../../i18n/I18nContext';
import {
  ADULT_CLASSIFICATION_LABELS,
  MEDIA_SPACE_LABELS,
} from '../../data/editorialDefaults';
import {
  fetchAllActivitiesForAdmin,
  fetchAllMediaAssetsForAdmin,
  fetchFormats,
  fetchUniverses,
  removeActivity,
  upsertActivity,
} from '../../services/noctaService';
import type {
  Activity,
  ActivityFormat,
  ActivityType,
  AdultClassification,
  MediaAsset,
  MediaSpace,
  PublicationStatus,
  Universe,
} from '../../types/nocta';

interface ActivityCrudPanelProps {
  defaultType: ActivityType;
  sectionTitle: string;
  actorRole: string;
}

export function ActivityCrudPanel({
  defaultType,
  sectionTitle,
  actorRole,
}: ActivityCrudPanelProps) {
  const { firebaseUser } = useAuth();
  const { lang, t } = useI18n();

  const [activities, setActivities] = useState<Activity[]>([]);
  const [universes, setUniverses] = useState<Universe[]>([]);
  const [formats, setFormats] = useState<ActivityFormat[]>([]);
  const [mediaAssets, setMediaAssets] = useState<MediaAsset[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [universeId, setUniverseId] = useState('decouverte');
  const [formatId, setFormatId] = useState('decouverte__premiers-eclairages');
  const [titleFr, setTitleFr] = useState('');
  const [titleEn, setTitleEn] = useState('');
  const [bodyFr, setBodyFr] = useState('');
  const [bodyEn, setBodyEn] = useState('');
  const [instructionsFr, setInstructionsFr] = useState('');
  const [instructionsEn, setInstructionsEn] = useState('');
  const [intimacyLevel, setIntimacyLevel] = useState(2);
  const [durationMinutes, setDurationMinutes] = useState(10);
  const [status, setStatus] = useState<PublicationStatus>('draft');
  const [adultClassification, setAdultClassification] = useState<AdultClassification>('general');
  const [allowedSpaces, setAllowedSpaces] = useState<MediaSpace[]>([
    'universes',
    'couple_space',
    'individual_space',
  ]);
  const [mediaId, setMediaId] = useState<string>('');
  const [saving, setSaving] = useState(false);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [aList, uList, fList, mList] = await Promise.all([
        fetchAllActivitiesForAdmin(),
        fetchUniverses(),
        fetchFormats(),
        fetchAllMediaAssetsForAdmin().catch(() => [] as MediaAsset[]),
      ]);
      setActivities(aList);
      setUniverses(uList);
      setFormats(fList);
      setMediaAssets(mList);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAll();
  }, [defaultType]);

  const resetForm = () => {
    setEditingId(null);
    setUniverseId('decouverte');
    setFormatId('decouverte__premiers-eclairages');
    setTitleFr('');
    setTitleEn('');
    setBodyFr('');
    setBodyEn('');
    setInstructionsFr('');
    setInstructionsEn('');
    setIntimacyLevel(2);
    setDurationMinutes(10);
    setStatus('draft');
    setAdultClassification('general');
    setAllowedSpaces(['universes', 'couple_space', 'individual_space']);
    setMediaId('');
  };

  const openEdit = (act: Activity) => {
    setEditingId(act.id);
    setUniverseId(act.universeId);
    setFormatId(act.formatId);
    setTitleFr(act.titleFr);
    setTitleEn(act.titleEn);
    setBodyFr(act.bodyFr);
    setBodyEn(act.bodyEn);
    setInstructionsFr(act.instructionsFr || '');
    setInstructionsEn(act.instructionsEn || '');
    setIntimacyLevel(act.intimacyLevel);
    setDurationMinutes(act.durationMinutes);
    setStatus(act.status);
    setAdultClassification(act.adultClassification || 'general');
    setAllowedSpaces(act.allowedSpaces || ['universes', 'couple_space', 'individual_space']);
    setMediaId(act.mediaId || '');
    setShowEditor(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser) return;
    setSaving(true);
    try {
      await upsertActivity({
        activity: {
          id: editingId || undefined,
          universeId,
          formatId,
          type: defaultType,
          titleFr,
          titleEn: titleEn || titleFr,
          bodyFr,
          bodyEn: bodyEn || bodyFr,
          instructionsFr,
          instructionsEn,
          intimacyLevel,
          durationMinutes,
          status,
          adultClassification,
          allowedSpaces:
            adultClassification === 'explicit'
              ? allowedSpaces.filter((s) => s !== 'public_landing')
              : allowedSpaces,
          mediaId: mediaId || null,
        },
        actorUid: firebaseUser.uid,
        actorRole,
      });
      setShowEditor(false);
      resetForm();
      await loadAll();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!firebaseUser) return;
    if (!window.confirm(t.admin.confirmDeleteBody)) return;
    await removeActivity(id, firebaseUser.uid, actorRole);
    await loadAll();
  };

  const filtered = activities.filter((a) => {
    if (a.type !== defaultType) return false;
    if (statusFilter !== 'all' && a.status !== statusFilter) return false;
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      return (
        a.titleFr.toLowerCase().includes(q) ||
        a.titleEn.toLowerCase().includes(q) ||
        a.bodyFr.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const availableFormats = formats.filter((f) => f.universeId === universeId);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 className="font-display text-2xl sm:text-3xl font-semibold text-[#F4EEF0]">
          {sectionTitle}
        </h2>
        <button
          type="button"
          onClick={() => {
            resetForm();
            setShowEditor(true);
          }}
          className="inline-flex items-center gap-2 px-4 py-2 bg-[#781D35] hover:bg-[#4B1028] text-xs font-medium text-[#F4EEF0] rounded-lg cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>{lang === 'fr' ? 'Nouveau contenu' : 'New item'}</span>
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-[#B8AAB0] absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={lang === 'fr' ? 'Rechercher...' : 'Search...'}
            className="w-full pl-9 pr-3 py-2 bg-[#191217] border border-[#32101D] rounded-lg text-xs text-[#F4EEF0] outline-none"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 bg-[#191217] border border-[#32101D] rounded-lg text-xs text-[#F4EEF0]"
        >
          <option value="all">{t.universes.allCategories}</option>
          <option value="published">Published</option>
          <option value="draft">Draft</option>
          <option value="scheduled">Scheduled</option>
          <option value="archived">Archived</option>
        </select>
      </div>

      {showEditor && (
        <form
          onSubmit={(e) => void handleSave(e)}
          className="bg-[#191217] border border-[#C5A276]/50 rounded-xl p-6 space-y-4"
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <select
              value={universeId}
              onChange={(e) => {
                const u = e.target.value;
                setUniverseId(u);
                const firstFmt = formats.find((f) => f.universeId === u)?.id || '';
                setFormatId(firstFmt);
              }}
              className="px-3 py-2 bg-[#100D10] border border-[#32101D] rounded-lg text-xs text-[#F4EEF0]"
            >
              {universes.map((u) => (
                <option key={u.id} value={u.id}>
                  {lang === 'fr' ? u.titleFr : u.titleEn}
                </option>
              ))}
            </select>

            <select
              value={formatId}
              onChange={(e) => setFormatId(e.target.value)}
              className="px-3 py-2 bg-[#100D10] border border-[#32101D] rounded-lg text-xs text-[#F4EEF0]"
            >
              {availableFormats.map((f) => (
                <option key={f.id} value={f.id}>
                  {lang === 'fr' ? f.titleFr : f.titleEn}
                </option>
              ))}
            </select>

            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as PublicationStatus)}
              className="px-3 py-2 bg-[#100D10] border border-[#32101D] rounded-lg text-xs text-[#F4EEF0]"
            >
              <option value="draft">Draft</option>
              <option value="scheduled">Scheduled</option>
              <option value="published">Published</option>
              <option value="archived">Archived</option>
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input
              type="text"
              required
              value={titleFr}
              onChange={(e) => setTitleFr(e.target.value)}
              placeholder="Titre (FR)"
              className="px-3 py-2 bg-[#100D10] border border-[#32101D] rounded-lg text-xs text-[#F4EEF0]"
            />
            <input
              type="text"
              value={titleEn}
              onChange={(e) => setTitleEn(e.target.value)}
              placeholder="Title (EN)"
              className="px-3 py-2 bg-[#100D10] border border-[#32101D] rounded-lg text-xs text-[#F4EEF0]"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <textarea
              rows={3}
              required
              value={bodyFr}
              onChange={(e) => setBodyFr(e.target.value)}
              placeholder="Contenu (FR)"
              className="px-3 py-2 bg-[#100D10] border border-[#32101D] rounded-lg text-xs text-[#F4EEF0]"
            />
            <textarea
              rows={3}
              value={bodyEn}
              onChange={(e) => setBodyEn(e.target.value)}
              placeholder="Content (EN)"
              className="px-3 py-2 bg-[#100D10] border border-[#32101D] rounded-lg text-xs text-[#F4EEF0]"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input
              type="text"
              value={instructionsFr}
              onChange={(e) => setInstructionsFr(e.target.value)}
              placeholder="Consignes (FR)"
              className="px-3 py-2 bg-[#100D10] border border-[#32101D] rounded-lg text-xs text-[#F4EEF0]"
            />
            <input
              type="text"
              value={instructionsEn}
              onChange={(e) => setInstructionsEn(e.target.value)}
              placeholder="Instructions (EN)"
              className="px-3 py-2 bg-[#100D10] border border-[#32101D] rounded-lg text-xs text-[#F4EEF0]"
            />
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs text-[#B8AAB0]">
            <label className="flex items-center gap-2">
              <span>Intimacy (1-5):</span>
              <input
                type="number"
                min={1}
                max={5}
                value={intimacyLevel}
                onChange={(e) => setIntimacyLevel(Number(e.target.value))}
                className="w-16 px-2 py-1 bg-[#100D10] border border-[#32101D] rounded text-[#F4EEF0]"
              />
            </label>
            <label className="flex items-center gap-2">
              <span>Minutes:</span>
              <input
                type="number"
                min={1}
                max={240}
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(Number(e.target.value))}
                className="w-20 px-2 py-1 bg-[#100D10] border border-[#32101D] rounded text-[#F4EEF0]"
              />
            </label>
          </div>

          {/* Adult Classification, Placement & Media Link */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-[#32101D]">
            <div className="space-y-1.5">
              <label className="block text-xs text-[#C5A276]">
                {lang === 'fr' ? 'Classification adulte' : 'Adult classification'}
              </label>
              <select
                value={adultClassification}
                onChange={(e) => {
                  const val = e.target.value as AdultClassification;
                  setAdultClassification(val);
                  if (val === 'explicit') {
                    setAllowedSpaces((prev) => prev.filter((s) => s !== 'public_landing'));
                  }
                }}
                className="w-full px-3 py-2 bg-[#100D10] border border-[#32101D] rounded-lg text-xs text-[#F4EEF0]"
              >
                {(Object.keys(ADULT_CLASSIFICATION_LABELS) as AdultClassification[]).map((k) => (
                  <option key={k} value={k}>
                    {ADULT_CLASSIFICATION_LABELS[k][lang]}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs text-[#C5A276]">
                {lang === 'fr' ? 'Photographie associée' : 'Linked photograph'}
              </label>
              <select
                value={mediaId}
                onChange={(e) => setMediaId(e.target.value)}
                className="w-full px-3 py-2 bg-[#100D10] border border-[#32101D] rounded-lg text-xs text-[#F4EEF0]"
              >
                <option value="">{lang === 'fr' ? 'Aucune image liée' : 'No linked image'}</option>
                {mediaAssets.map((m) => (
                  <option key={m.id} value={m.id}>
                    {lang === 'fr' ? m.titleFr : m.titleEn} ({m.adultClassification})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs text-[#B8AAB0]">
              {lang === 'fr' ? 'Espaces autorisés :' : 'Allowed spaces:'}
            </p>
            <div className="flex flex-wrap gap-3 text-xs text-[#F4EEF0]">
              {(Object.keys(MEDIA_SPACE_LABELS) as MediaSpace[]).map((sp) => {
                const blocked = adultClassification === 'explicit' && sp === 'public_landing';
                return (
                  <label
                    key={sp}
                    className={`flex items-center gap-1.5 ${blocked ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
                  >
                    <input
                      type="checkbox"
                      disabled={blocked}
                      checked={allowedSpaces.includes(sp)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setAllowedSpaces([...allowedSpaces, sp]);
                        } else {
                          setAllowedSpaces(allowedSpaces.filter((x) => x !== sp));
                        }
                      }}
                      className="accent-[#781D35]"
                    />
                    <span>{MEDIA_SPACE_LABELS[sp][lang]}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 bg-[#781D35] hover:bg-[#4B1028] text-xs font-medium text-[#F4EEF0] rounded-lg cursor-pointer"
            >
              {saving ? t.states.loading : lang === 'fr' ? 'Enregistrer' : 'Save'}
            </button>
            <button
              type="button"
              onClick={() => setShowEditor(false)}
              className="px-4 py-2 border border-[#32101D] text-xs text-[#B8AAB0] rounded-lg cursor-pointer"
            >
              {t.admin.cancelBtn}
            </button>
          </div>
        </form>
      )}

      {/* List */}
      <div className="bg-[#191217] border border-[#32101D] rounded-xl divide-y divide-[#32101D]">
        {loading ? (
          <p className="p-5 text-xs text-[#B8AAB0]">{t.states.loading}</p>
        ) : filtered.length === 0 ? (
          <p className="p-5 text-xs text-[#B8AAB0]">{t.states.empty}</p>
        ) : (
          filtered.map((act) => (
            <div
              key={act.id}
              className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div className="space-y-1 min-w-0">
                <p className="text-sm font-medium text-[#F4EEF0] truncate">
                  {lang === 'fr' ? act.titleFr : act.titleEn}
                </p>
                <p className="text-xs text-[#B8AAB0]">
                  {act.universeId} · {act.status} · {act.intimacyLevel}/5 · {act.durationMinutes}m
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => openEdit(act)}
                  className="p-2 border border-[#32101D] hover:border-[#C5A276] rounded-lg text-[#B8AAB0] hover:text-[#F4EEF0] cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                </button>
                {['super_admin', 'admin'].includes(actorRole) && (
                  <button
                    type="button"
                    onClick={() => void handleDelete(act.id)}
                    className="p-2 border border-[#32101D] hover:border-[#781D35] rounded-lg text-[#B8AAB0] hover:text-[#F4EEF0] cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
