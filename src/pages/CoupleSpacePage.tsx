import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bookmark,
  Check,
  Copy,
  EyeOff,
  HeartHandshake,
  LogOut,
  RefreshCw,
  ShieldCheck,
  Shuffle,
  SkipForward,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../i18n/I18nContext';
import { FOCAL_POINT_CLASSES } from '../data/editorialDefaults';
import {
  acceptCoupleInvite,
  createCouplePlaySession,
  createCoupleWithInvite,
  declineOrRevokeInvite,
  dissolveCoupleSpace,
  drawNextActivity,
  fetchPublishedMemberMedia,
  fetchUniverses,
  listIncomingInvitesByEmail,
  listMyCoupleInvites,
  lookupInviteByCode,
  markActivityOutcome,
  reissueCoupleInvite,
  saveActivityToFavorites,
  updateCouplePreferences,
} from '../services/noctaService';
import { AppShell } from '../components/AppShell';
import { SafeImage } from '../components/SafeImage';
import type {
  Activity,
  CoupleInvite,
  MediaAsset,
  ParticipationMode,
  Universe,
} from '../types/nocta';

export function CoupleSpacePage() {
  const { firebaseUser, profile, privateInfo, couple } = useAuth();
  const { lang, t } = useI18n();
  const navigate = useNavigate();

  const [coupleName, setCoupleName] = useState('');
  const [inviteeEmail, setInviteeEmail] = useState('');
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [foundInvite, setFoundInvite] = useState<CoupleInvite | null>(null);
  const [myPendingInvites, setMyPendingInvites] = useState<CoupleInvite[]>([]);
  const [incomingInvites, setIncomingInvites] = useState<CoupleInvite[]>([]);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showDissolveModal, setShowDissolveModal] = useState(false);

  // Activity Player & Anti-Repetition State
  const [universes, setUniverses] = useState<Universe[]>([]);
  const [memberMedia, setMemberMedia] = useState<MediaAsset[]>([]);
  const [selectedUniverseId, setSelectedUniverseId] = useState('decouverte');
  const [selectedMode, setSelectedMode] = useState<ParticipationMode>('couple');
  const [consentGiven, setConsentGiven] = useState(false);
  const [showConsentGate, setShowConsentGate] = useState(false);
  const [currentActivity, setCurrentActivity] = useState<Activity | null>(null);
  const [exhaustedInfo, setExhaustedInfo] = useState<{
    exhausted: boolean;
    suggested?: Universe;
  } | null>(null);
  const [savedFavFlag, setSavedFavFlag] = useState(false);

  // Pass-and-play hidden response buffer
  const [passTurnPartner, setPassTurnPartner] = useState<'A' | 'B'>('A');
  const [passMaskedInput, setPassMaskedInput] = useState('');
  const [passResponses, setPassResponses] = useState<{ a?: string; b?: string }>({});
  const [passRevealed, setPassRevealed] = useState(false);

  useEffect(() => {
    fetchUniverses()
      .then((list) => setUniverses(list.filter((u) => u.isActive)))
      .catch(() => {});
    fetchPublishedMemberMedia()
      .then(setMemberMedia)
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (firebaseUser) {
      listMyCoupleInvites(firebaseUser.uid)
        .then((list) => setMyPendingInvites(list.filter((i) => i.status === 'pending')))
        .catch(() => {});
      if (firebaseUser.email) {
        listIncomingInvitesByEmail(firebaseUser.email)
          .then((list) =>
            setIncomingInvites(list.filter((i) => i.inviterId !== firebaseUser.uid))
          )
          .catch(() => setIncomingInvites([]));
      }
    }
  }, [firebaseUser, couple?.id]);

  useEffect(() => {
    if (couple?.activeMode) {
      setSelectedMode(couple.activeMode);
    }
  }, [couple?.activeMode]);

  const mapInviteError = (err: unknown): string => {
    const msg = err instanceof Error ? err.message : '';
    if (msg === 'ALREADY_IN_COUPLE') return t.couple.alreadyInCoupleErr;
    if (msg === 'INVITE_EXPIRED') return t.couple.inviteExpiredErr;
    if (msg === 'INVITE_EMAIL_MISMATCH') return t.couple.inviteEmailMismatchErr;
    if (msg === 'CANNOT_JOIN_OWN_INVITE') {
      return lang === 'fr'
        ? 'Vous ne pouvez pas rejoindre votre propre invitation.'
        : 'You cannot join your own invitation.';
    }
    if (msg === 'INVITE_NO_LONGER_PENDING' || msg === 'INVITE_NOT_FOUND') {
      return lang === 'fr'
        ? 'Code invalide, déjà utilisé ou invitation expirée.'
        : 'Invalid, already used, or expired invitation code.';
    }
    return err instanceof Error ? err.message : t.states.errorTitle;
  };

  const formatExpiresAt = (ts: unknown): string => {
    if (!ts) return '—';
    try {
      const maybe = ts as { toDate?: () => Date };
      const date = typeof maybe.toDate === 'function' ? maybe.toDate() : new Date(String(ts));
      return date.toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-US', {
        dateStyle: 'medium',
      });
    } catch {
      return '—';
    }
  };

  const handleCreateCouple = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser || !profile) return;
    setErrorMsg(null);
    setBusy(true);
    try {
      const res = await createCoupleWithInvite({
        uid: firebaseUser.uid,
        displayName: profile.displayName,
        coupleName: coupleName || 'NOCTA Duo',
        inviteeEmail: inviteeEmail || undefined,
      });
      const list = await listMyCoupleInvites(firebaseUser.uid);
      setMyPendingInvites(list.filter((i) => i.status === 'pending'));
      setCoupleName('');
      setInviteeEmail('');
      setCopiedCode(res.inviteCode);
    } catch (err) {
      setErrorMsg(mapInviteError(err));
    } finally {
      setBusy(false);
    }
  };

  const handleReissueInvite = async () => {
    if (!firebaseUser || !profile || !couple?.id) return;
    setErrorMsg(null);
    setBusy(true);
    try {
      const code = await reissueCoupleInvite({
        coupleId: couple.id,
        uid: firebaseUser.uid,
        displayName: profile.displayName,
        inviteeEmail: inviteeEmail || undefined,
      });
      const list = await listMyCoupleInvites(firebaseUser.uid);
      setMyPendingInvites(list.filter((i) => i.status === 'pending'));
      setCopiedCode(code);
    } catch (err) {
      setErrorMsg(mapInviteError(err));
    } finally {
      setBusy(false);
    }
  };

  const handleLookupInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setBusy(true);
    try {
      const inv = await lookupInviteByCode(joinCodeInput);
      const isExpired = inv?.expiresAt && inv.expiresAt.toMillis() <= Date.now();
      if (!inv || inv.status !== 'pending' || isExpired) {
        setFoundInvite(null);
        setErrorMsg(isExpired ? t.couple.inviteExpiredErr : mapInviteError(new Error('INVITE_NOT_FOUND')));
      } else {
        setFoundInvite(inv);
      }
    } finally {
      setBusy(false);
    }
  };

  const handleAcceptInviteCode = async (codeToAccept: string) => {
    if (!firebaseUser) return;
    setErrorMsg(null);
    setBusy(true);
    try {
      await acceptCoupleInvite({
        code: codeToAccept,
        uid: firebaseUser.uid,
        userEmail: firebaseUser.email || undefined,
      });
      setFoundInvite(null);
      setJoinCodeInput('');
      setIncomingInvites((prev) => prev.filter((i) => i.code !== codeToAccept));
    } catch (err) {
      setErrorMsg(mapInviteError(err));
    } finally {
      setBusy(false);
    }
  };

  const handleDeclineInviteCode = async (codeToDecline: string) => {
    setErrorMsg(null);
    setBusy(true);
    try {
      await declineOrRevokeInvite(codeToDecline, 'declined');
      if (foundInvite?.code === codeToDecline) {
        setFoundInvite(null);
        setJoinCodeInput('');
      }
      setIncomingInvites((prev) => prev.filter((i) => i.code !== codeToDecline));
    } catch (err) {
      setErrorMsg(mapInviteError(err));
    } finally {
      setBusy(false);
    }
  };

  const executeDraw = async () => {
    if (!firebaseUser) return;
    if (selectedMode !== 'individual' && (!couple || couple.status !== 'active')) {
      setErrorMsg(t.couple.coupleRequiredNotice);
      return;
    }

    setErrorMsg(null);
    setBusy(true);
    setSavedFavFlag(false);
    setPassResponses({});
    setPassRevealed(false);
    setPassTurnPartner('A');

    try {
      const res = await drawNextActivity({
        mode: selectedMode,
        uid: firebaseUser.uid,
        coupleId: couple?.id || null,
        universeId: selectedUniverseId,
        maxIntimacyLevel: privateInfo?.maxIntimacyLevel ?? 5,
      });

      if (res.exhausted || !res.activity) {
        setCurrentActivity(null);
        setExhaustedInfo({ exhausted: true, suggested: res.suggestedUniverse });
      } else {
        setExhaustedInfo(null);
        setCurrentActivity(res.activity);
        if (selectedMode !== 'individual' && couple?.id) {
          await createCouplePlaySession({
            coupleId: couple.id,
            mode: selectedMode,
            universeId: res.activity.universeId,
            formatId: res.activity.formatId,
            activityId: res.activity.id,
            createdBy: firebaseUser.uid,
          });
        }
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : t.states.errorTitle);
    } finally {
      setBusy(false);
    }
  };

  const handleDrawClick = () => {
    if (!consentGiven) {
      setShowConsentGate(true);
      return;
    }
    void executeDraw();
  };

  const handleOutcome = async (status: 'completed' | 'skipped') => {
    if (!firebaseUser || !currentActivity) return;
    await markActivityOutcome({
      mode: selectedMode,
      uid: firebaseUser.uid,
      coupleId: couple?.id || null,
      activityId: currentActivity.id,
      status,
    });
    setCurrentActivity(null);
  };

  const handleSaveFavorite = async () => {
    if (!firebaseUser || !currentActivity) return;
    await saveActivityToFavorites({
      mode: selectedMode,
      uid: firebaseUser.uid,
      coupleId: couple?.id || null,
      activity: currentActivity,
    });
    setSavedFavFlag(true);
  };

  const handleModeSelect = async (mode: ParticipationMode) => {
    setSelectedMode(mode);
    if (couple?.id && mode !== 'individual') {
      await updateCouplePreferences(couple.id, { activeMode: mode });
    }
  };

  const handleInterruptExperience = () => {
    setCurrentActivity(null);
    setShowConsentGate(false);
    setPassResponses({});
    setPassRevealed(false);
    navigate('/dashboard');
  };

  const handleConfirmDissolve = async () => {
    if (!couple?.id || !firebaseUser) return;
    setBusy(true);
    try {
      await dissolveCoupleSpace(couple.id, firebaseUser.uid);
      setCurrentActivity(null);
      setShowDissolveModal(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppShell>
      <div className="space-y-8">
        <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-[#32101D] pb-6">
          <div className="space-y-1.5">
            <h1 className="font-display text-3xl sm:text-4xl font-semibold text-[#F4EEF0]">
              {t.couple.title}
            </h1>
            <p className="text-sm text-[#B8AAB0]">{t.couple.subtitle}</p>
          </div>
          {currentActivity && (
            <button
              type="button"
              onClick={handleInterruptExperience}
              className="inline-flex items-center gap-2 px-4 py-2 border border-[#781D35] text-[#F4EEF0] hover:bg-[#32101D] text-xs font-medium rounded-lg transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>{t.nav.interruptExperience}</span>
            </button>
          )}
        </header>

        {errorMsg && (
          <div className="p-4 rounded-lg bg-[#32101D] border border-[#781D35] text-xs text-[#F4EEF0]">
            {errorMsg}
          </div>
        )}

        {/* Incoming Pending Invites addressed to user's email */}
        {!couple && incomingInvites.length > 0 && (
          <section className="bg-[#191217] border border-[#C5A276]/60 rounded-xl p-6 space-y-4">
            <h2 className="font-display text-2xl font-semibold text-[#F4EEF0]">
              {t.couple.incomingInvitesTitle}
            </h2>
            <div className="space-y-3">
              {incomingInvites.map((inv) => (
                <div
                  key={inv.code}
                  className="p-4 rounded-lg bg-[#100D10] border border-[#32101D] flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-[#F4EEF0]">
                      {t.couple.incomingInviteFrom} {inv.inviterName}
                    </p>
                    <p className="text-xs text-[#C5A276] font-mono-tabular">
                      {inv.code}
                      {inv.expiresAt
                        ? ` · ${t.couple.expiresLabel} ${formatExpiresAt(inv.expiresAt)}`
                        : ''}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void handleAcceptInviteCode(inv.code)}
                      className="px-4 py-2 bg-[#781D35] hover:bg-[#4B1028] text-[#F4EEF0] text-xs font-medium rounded-lg cursor-pointer"
                    >
                      {t.couple.acceptInviteBtn}
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void handleDeclineInviteCode(inv.code)}
                      className="px-4 py-2 border border-[#32101D] text-[#B8AAB0] hover:text-[#F4EEF0] text-xs rounded-lg cursor-pointer"
                    >
                      {t.couple.declineInviteBtn}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Case 1: No Couple yet */}
        {!couple && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <form
              onSubmit={(e) => void handleCreateCouple(e)}
              className="bg-[#191217] border border-[#32101D] rounded-xl p-6 space-y-4"
            >
              <h2 className="font-display text-2xl font-semibold text-[#F4EEF0]">
                {t.couple.createTitle}
              </h2>
              <p className="text-sm text-[#B8AAB0] leading-relaxed">{t.couple.createDesc}</p>
              <div className="space-y-1.5">
                <label className="block text-xs text-[#B8AAB0]">{t.couple.coupleNameLabel}</label>
                <input
                  type="text"
                  required
                  maxLength={120}
                  value={coupleName}
                  onChange={(e) => setCoupleName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[#100D10] border border-[#32101D] focus:border-[#C5A276] rounded-lg text-sm text-[#F4EEF0] outline-none"
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs text-[#B8AAB0]">
                  {t.couple.inviteeEmailLabel}
                </label>
                <input
                  type="email"
                  maxLength={254}
                  value={inviteeEmail}
                  onChange={(e) => setInviteeEmail(e.target.value)}
                  placeholder={t.couple.inviteeEmailPlaceholder}
                  className="w-full px-3.5 py-2.5 bg-[#100D10] border border-[#32101D] focus:border-[#C5A276] rounded-lg text-sm text-[#F4EEF0] outline-none"
                />
              </div>
              <button
                type="submit"
                disabled={busy}
                className="px-5 py-2.5 bg-[#781D35] hover:bg-[#4B1028] text-[#F4EEF0] text-xs font-medium rounded-lg transition-colors cursor-pointer"
              >
                {t.couple.createBtn}
              </button>
            </form>

            <div className="bg-[#191217] border border-[#32101D] rounded-xl p-6 space-y-4">
              <h2 className="font-display text-2xl font-semibold text-[#F4EEF0]">
                {t.couple.joinTitle}
              </h2>
              <p className="text-sm text-[#B8AAB0] leading-relaxed">{t.couple.joinDesc}</p>
              <form onSubmit={(e) => void handleLookupInvite(e)} className="flex gap-2">
                <input
                  type="text"
                  required
                  value={joinCodeInput}
                  onChange={(e) => setJoinCodeInput(e.target.value)}
                  placeholder="NOCTA-XXXXXXXX"
                  className="flex-1 px-3.5 py-2.5 bg-[#100D10] border border-[#32101D] focus:border-[#C5A276] rounded-lg text-sm text-[#F4EEF0] font-mono-tabular outline-none"
                />
                <button
                  type="submit"
                  disabled={busy}
                  className="px-4 py-2.5 bg-[#32101D] hover:bg-[#4B1028] text-[#F4EEF0] text-xs font-medium rounded-lg transition-colors cursor-pointer"
                >
                  {t.couple.joinPreviewBtn}
                </button>
              </form>

              {foundInvite && (
                <div className="p-4 rounded-lg bg-[#100D10] border border-[#C5A276]/50 space-y-3">
                  <p className="text-xs text-[#C5A276]">
                    {foundInvite.inviterName} · {foundInvite.code}
                    {foundInvite.expiresAt
                      ? ` · ${t.couple.expiresLabel} ${formatExpiresAt(foundInvite.expiresAt)}`
                      : ''}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void handleAcceptInviteCode(foundInvite.code)}
                      className="px-4 py-2 bg-[#781D35] hover:bg-[#4B1028] text-[#F4EEF0] text-xs font-medium rounded-lg cursor-pointer"
                    >
                      {t.couple.acceptInviteBtn}
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void handleDeclineInviteCode(foundInvite.code)}
                      className="px-4 py-2 border border-[#32101D] text-[#B8AAB0] hover:text-[#F4EEF0] text-xs rounded-lg cursor-pointer"
                    >
                      {t.couple.declineInviteBtn}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Case 2: Couple Created & Awaiting Partner B */}
        {couple && couple.status === 'pending' && (
          <div className="bg-[#191217] border border-[#C5A276]/50 rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <p className="text-xs text-[#C5A276]">{t.dashboard.couplePending}</p>
                <h2 className="font-display text-2xl font-semibold text-[#F4EEF0]">
                  {couple.name}
                </h2>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void handleReissueInvite()}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 border border-[#C5A276]/50 text-xs text-[#C5A276] hover:bg-[#32101D] rounded-lg cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>{t.couple.reissueInviteBtn}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowDissolveModal(true)}
                  className="px-3.5 py-2 border border-[#32101D] hover:border-[#781D35] text-xs text-[#B8AAB0] hover:text-[#F4EEF0] rounded-lg cursor-pointer"
                >
                  {t.couple.dissolveCoupleBtn}
                </button>
              </div>
            </div>
            {myPendingInvites.map((inv) => (
              <div
                key={inv.code}
                className="p-4 rounded-lg bg-[#100D10] border border-[#32101D] flex flex-wrap items-center justify-between gap-4"
              >
                <div>
                  <p className="text-xs text-[#B8AAB0]">{t.couple.shareCodeLabel}</p>
                  <p className="font-mono-tabular text-lg font-semibold text-[#C5A276]">
                    {inv.code}
                  </p>
                  <p className="text-[11px] text-[#B8AAB0] mt-0.5">
                    {inv.inviteeEmail ? `${inv.inviteeEmail} · ` : ''}
                    {inv.expiresAt
                      ? `${t.couple.expiresLabel} ${formatExpiresAt(inv.expiresAt)}`
                      : ''}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    void navigator.clipboard?.writeText(inv.code);
                    setCopiedCode(inv.code);
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-[#4B1028] hover:bg-[#781D35] text-[#F4EEF0] text-xs font-medium rounded-lg cursor-pointer"
                >
                  {copiedCode === inv.code ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>{t.couple.copied}</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>{t.couple.copyCodeBtn}</span>
                    </>
                  )}
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Participation Modes Architecture */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-2xl font-semibold text-[#F4EEF0]">
              {t.couple.modesTitle}
            </h2>
            {couple?.status === 'active' && (
              <div className="flex items-center gap-3 text-xs text-[#C5A276]">
                <HeartHandshake className="w-4 h-4" />
                <span>{couple.name}</span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {(['individual', 'couple', 'remote_sync', 'pass_device'] as ParticipationMode[]).map(
              (modeKey) => {
                const modeInfo = t.couple.modes[modeKey];
                const disabled = modeKey !== 'individual' && couple?.status !== 'active';
                return (
                  <button
                    key={modeKey}
                    type="button"
                    disabled={disabled}
                    onClick={() => void handleModeSelect(modeKey)}
                    className={`text-left p-4 rounded-xl border transition-colors cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed ${
                      selectedMode === modeKey
                        ? 'bg-[#32101D] border-[#C5A276]'
                        : 'bg-[#191217] border-[#32101D] hover:border-[#4B1028]'
                    }`}
                  >
                    <p className="text-sm font-semibold text-[#F4EEF0]">{modeInfo.title}</p>
                    <p className="text-xs text-[#B8AAB0] mt-1 leading-relaxed">{modeInfo.desc}</p>
                  </button>
                );
              }
            )}
          </div>
        </section>

        {/* Anti-Repetition Draw Player */}
        <section className="bg-[#191217] border border-[#32101D] rounded-xl p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#32101D] pb-4">
            <div>
              <h2 className="font-display text-2xl font-semibold text-[#F4EEF0]">
                {t.couple.playerTitle}
              </h2>
              <p className="text-xs text-[#B8AAB0]">
                {selectedMode === 'individual'
                  ? t.couple.modes.individual.title
                  : couple?.status === 'active'
                    ? `${couple.name} · ${t.couple.modes[selectedMode].title}`
                    : t.couple.coupleRequiredNotice}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <select
                value={selectedUniverseId}
                onChange={(e) => setSelectedUniverseId(e.target.value)}
                className="px-3.5 py-2.5 bg-[#100D10] border border-[#32101D] rounded-lg text-xs text-[#F4EEF0] outline-none"
              >
                {universes.map((u) => (
                  <option key={u.id} value={u.id}>
                    {String(u.order).padStart(2, '0')}. {lang === 'fr' ? u.titleFr : u.titleEn}
                  </option>
                ))}
              </select>

              <button
                type="button"
                disabled={busy || (selectedMode !== 'individual' && couple?.status !== 'active')}
                onClick={handleDrawClick}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#781D35] hover:bg-[#4B1028] disabled:opacity-45 text-[#F4EEF0] text-xs font-medium rounded-lg transition-colors cursor-pointer"
              >
                <Shuffle className="w-3.5 h-3.5" />
                <span>{t.couple.drawActivityBtn}</span>
              </button>
            </div>
          </div>

          {exhaustedInfo?.exhausted && (
            <div className="p-6 rounded-xl bg-[#100D10] border border-[#C5A276]/40 space-y-3">
              <h3 className="font-display text-2xl text-[#F4EEF0]">
                {t.couple.universeExhaustedTitle}
              </h3>
              <p className="text-sm text-[#B8AAB0]">{t.couple.universeExhaustedBody}</p>
              {exhaustedInfo.suggested && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedUniverseId(exhaustedInfo.suggested!.id);
                    setExhaustedInfo(null);
                  }}
                  className="px-4 py-2 bg-[#4B1028] hover:bg-[#781D35] text-xs text-[#F4EEF0] rounded-lg cursor-pointer"
                >
                  {lang === 'fr' ? 'Essayer :' : 'Try:'}{' '}
                  {lang === 'fr'
                    ? exhaustedInfo.suggested.titleFr
                    : exhaustedInfo.suggested.titleEn}
                </button>
              )}
            </div>
          )}

          {currentActivity && (
            <div className="bg-[#100D10] border border-[#4B1028] rounded-xl p-6 sm:p-8 space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-[#C5A276]">
                <span>
                  {currentActivity.type} · {currentActivity.durationMinutes} min ·{' '}
                  {lang === 'fr' ? 'Intensité' : 'Intimacy'} {currentActivity.intimacyLevel}/5
                </span>
                <button
                  type="button"
                  onClick={handleInterruptExperience}
                  className="text-[#B8AAB0] hover:text-[#F4EEF0] underline cursor-pointer"
                >
                  {t.nav.interruptExperience}
                </button>
              </div>

              {(() => {
                const actMedia =
                  (currentActivity.mediaId &&
                    memberMedia.find((m) => m.id === currentActivity.mediaId)) ||
                  memberMedia.find(
                    (m) =>
                      m.activityId === currentActivity.id ||
                      (m.universeId === currentActivity.universeId &&
                        m.allowedSpaces.includes('couple_space'))
                  );
                if (!actMedia || privateInfo?.discreetMode) return null;
                return (
                  <div className="aspect-[16/9] max-h-80 w-full overflow-hidden">
                    <SafeImage
                      src={`/api/media/file/${actMedia.fileId}`}
                      alt={lang === 'fr' ? actMedia.titleFr : actMedia.titleEn}
                      className={`w-full h-full object-cover ${FOCAL_POINT_CLASSES[actMedia.focalPoint || 'center']}`}
                    />
                  </div>
                );
              })()}

              <div className="space-y-3">
                <h3 className="font-display text-3xl font-semibold text-[#F4EEF0]">
                  {lang === 'fr' ? currentActivity.titleFr : currentActivity.titleEn}
                </h3>
                <p className="text-base text-[#F4EEF0]/90 leading-relaxed">
                  {lang === 'fr' ? currentActivity.bodyFr : currentActivity.bodyEn}
                </p>
                {(currentActivity.instructionsFr || currentActivity.instructionsEn) && (
                  <p className="text-xs text-[#B8AAB0] border-t border-[#32101D] pt-3">
                    {lang === 'fr'
                      ? currentActivity.instructionsFr
                      : currentActivity.instructionsEn}
                  </p>
                )}
              </div>

              {/* Single-device alternating turn capture when in pass_device mode */}
              {selectedMode === 'pass_device' && (
                <div className="p-4 rounded-lg bg-[#191217] border border-[#32101D] space-y-3">
                  <div className="flex items-center justify-between text-xs text-[#C5A276]">
                    <span>
                      {t.couple.passDeviceTurnLabel}:{' '}
                      {passRevealed ? 'A & B' : `Partner ${passTurnPartner}`}
                    </span>
                    <EyeOff className="w-4 h-4" />
                  </div>
                  {!passRevealed ? (
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        type="password"
                        value={passMaskedInput}
                        onChange={(e) => setPassMaskedInput(e.target.value)}
                        placeholder={
                          lang === 'fr'
                            ? `Réponse masquée — Partenaire ${passTurnPartner}`
                            : `Masked response — Partner ${passTurnPartner}`
                        }
                        className="flex-1 px-3 py-2 bg-[#100D10] border border-[#32101D] rounded-lg text-xs text-[#F4EEF0]"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (passTurnPartner === 'A') {
                            setPassResponses((r) => ({ ...r, a: passMaskedInput }));
                            setPassMaskedInput('');
                            setPassTurnPartner('B');
                          } else {
                            setPassResponses((r) => ({ ...r, b: passMaskedInput }));
                            setPassMaskedInput('');
                            setPassRevealed(true);
                          }
                        }}
                        className="px-4 py-2 bg-[#4B1028] hover:bg-[#781D35] text-xs text-[#F4EEF0] rounded-lg cursor-pointer"
                      >
                        {t.couple.passDeviceRevealBtn}
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div className="p-3 rounded bg-[#100D10] border border-[#32101D]">
                        <p className="text-[#C5A276]">Partner A</p>
                        <p className="text-[#F4EEF0] mt-1">{passResponses.a || '—'}</p>
                      </div>
                      <div className="p-3 rounded bg-[#100D10] border border-[#32101D]">
                        <p className="text-[#C5A276]">Partner B</p>
                        <p className="text-[#F4EEF0] mt-1">{passResponses.b || '—'}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-[#32101D]">
                <button
                  type="button"
                  onClick={() => void handleOutcome('completed')}
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#781D35] hover:bg-[#4B1028] text-[#F4EEF0] text-xs font-medium rounded-lg cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>{t.couple.markCompletedBtn}</span>
                </button>
                <button
                  type="button"
                  onClick={() => void handleOutcome('skipped')}
                  className="inline-flex items-center gap-2 px-4 py-2.5 border border-[#32101D] hover:border-[#781D35] text-[#B8AAB0] hover:text-[#F4EEF0] text-xs font-medium rounded-lg cursor-pointer"
                >
                  <SkipForward className="w-3.5 h-3.5" />
                  <span>{t.couple.skipActivityBtn}</span>
                </button>
                <button
                  type="button"
                  disabled={savedFavFlag}
                  onClick={() => void handleSaveFavorite()}
                  className="inline-flex items-center gap-2 px-4 py-2.5 border border-[#C5A276]/50 text-[#C5A276] hover:bg-[#32101D] disabled:opacity-50 text-xs font-medium rounded-lg cursor-pointer"
                >
                  <Bookmark className="w-3.5 h-3.5" />
                  <span>{savedFavFlag ? t.couple.copied : t.couple.addToFavoritesBtn}</span>
                </button>
              </div>
            </div>
          )}
        </section>

        {couple?.status === 'active' && (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setShowDissolveModal(true)}
              className="text-xs text-[#B8AAB0] hover:text-[#781D35] underline cursor-pointer"
            >
              {t.couple.dissolveCoupleBtn}
            </button>
          </div>
        )}
      </div>

      {/* Inline Dissolve Confirmation Modal */}
      {showDissolveModal && (
        <div
          className="fixed inset-0 z-50 bg-[#100D10]/90 backdrop-blur-sm flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="max-w-md w-full bg-[#191217] border border-[#781D35] rounded-xl p-6 space-y-5">
            <h3 className="font-display text-2xl font-semibold text-[#F4EEF0]">
              {t.couple.dissolveTitle}
            </h3>
            <p className="text-sm text-[#B8AAB0] leading-relaxed">{t.couple.dissolveConfirm}</p>
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleConfirmDissolve()}
                className="flex-1 px-4 py-2.5 bg-[#781D35] hover:bg-[#4B1028] text-[#F4EEF0] text-xs font-medium rounded-lg cursor-pointer disabled:opacity-50"
              >
                {t.couple.confirmDissolveAction}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => setShowDissolveModal(false)}
                className="px-4 py-2.5 border border-[#32101D] text-[#B8AAB0] text-xs rounded-lg cursor-pointer"
              >
                {t.couple.cancelDissolveAction}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Explicit Consent Modal before launching intimate draw */}
      {showConsentGate && (
        <div
          className="fixed inset-0 z-50 bg-[#100D10]/90 backdrop-blur-sm flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="max-w-md w-full bg-[#191217] border border-[#4B1028] rounded-xl p-6 space-y-5">
            <div className="flex items-center gap-2 text-xs text-[#C5A276]">
              <ShieldCheck className="w-4 h-4" />
              <span>NOCTA · 18+</span>
            </div>
            <h3 className="font-display text-2xl font-semibold text-[#F4EEF0]">
              {t.ageGate.consentModalTitle}
            </h3>
            <p className="text-sm text-[#B8AAB0] leading-relaxed">
              {t.ageGate.consentModalBody}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setConsentGiven(true);
                  setShowConsentGate(false);
                  void executeDraw();
                }}
                className="flex-1 px-4 py-2.5 bg-[#781D35] hover:bg-[#4B1028] text-[#F4EEF0] text-xs font-medium rounded-lg cursor-pointer"
              >
                {t.ageGate.consentModalConfirm}
              </button>
              <button
                type="button"
                onClick={() => setShowConsentGate(false)}
                className="px-4 py-2.5 border border-[#32101D] text-[#B8AAB0] text-xs rounded-lg cursor-pointer"
              >
                {t.ageGate.consentModalCancel}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
