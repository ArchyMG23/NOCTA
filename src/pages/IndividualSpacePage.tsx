import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BookOpen,
  Camera,
  Check,
  KeyRound,
  Lock,
  Plus,
  ShieldAlert,
  Trash2,
  User as UserIcon,
} from 'lucide-react';
import { translateAuthError, useAuth } from '../context/AuthContext';
import { useI18n } from '../i18n/I18nContext';
import {
  declineOrRevokeInvite,
  fetchPublishedActivities,
  listMyCoupleInvites,
  updateUserPrivateSettings,
  updateUserProfileSettings,
} from '../services/noctaService';
import { AppShell } from '../components/AppShell';
import { SafeImage } from '../components/SafeImage';
import type { Activity, CoupleInvite, Language } from '../types/nocta';

export function IndividualSpacePage() {
  const {
    firebaseUser,
    profile,
    privateInfo,
    changeUserPassword,
    deactivateOwnAccount,
    reactivateOwnAccount,
    deleteOwnAccount,
  } = useAuth();
  const { lang, setLang, t } = useI18n();
  const navigate = useNavigate();

  const [firstName, setFirstName] = useState(profile?.firstName || '');
  const [lastName, setLastName] = useState(profile?.lastName || '');
  const [displayName, setDisplayName] = useState(profile?.displayName || '');
  const [preferredLang, setPreferredLang] = useState<Language>(profile?.preferredLang || lang);
  const [maxIntimacyLevel, setMaxIntimacyLevel] = useState<number>(
    privateInfo?.maxIntimacyLevel ?? 3
  );
  const [discreetMode, setDiscreetMode] = useState<boolean>(privateInfo?.discreetMode ?? false);
  const [mfaReminderEnabled, setMfaReminderEnabled] = useState<boolean>(
    privateInfo?.mfaReminderEnabled ?? false
  );
  const [boundaries, setBoundaries] = useState<string[]>(privateInfo?.boundaries || []);
  const [preferences, setPreferences] = useState<string[]>(privateInfo?.preferences || []);
  const [boundaryInput, setBoundaryInput] = useState('');
  const [prefInput, setPrefInput] = useState('');

  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Password Change State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  // Self Account Deletion Modal State
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deletingAccount, setDeletingAccount] = useState(false);

  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const [invites, setInvites] = useState<CoupleInvite[]>([]);
  const [educationalActivities, setEducationalActivities] = useState<Activity[]>([]);

  const hasPasswordProvider = Boolean(
    firebaseUser?.providerData.some((p) => p.providerId === 'password')
  );

  useEffect(() => {
    if (profile) {
      setFirstName(profile.firstName || '');
      setLastName(profile.lastName || '');
      setDisplayName(profile.displayName || '');
      setPreferredLang(profile.preferredLang);
    }
  }, [profile]);

  useEffect(() => {
    if (privateInfo) {
      setMaxIntimacyLevel(privateInfo.maxIntimacyLevel ?? 3);
      setDiscreetMode(privateInfo.discreetMode ?? false);
      setMfaReminderEnabled(privateInfo.mfaReminderEnabled ?? false);
      setBoundaries(privateInfo.boundaries || []);
      setPreferences(privateInfo.preferences || []);
    }
  }, [privateInfo]);

  useEffect(() => {
    if (!firebaseUser) return;
    listMyCoupleInvites(firebaseUser.uid)
      .then(setInvites)
      .catch(() => setInvites([]));
    fetchPublishedActivities('education-sexuelle')
      .then(setEducationalActivities)
      .catch(() => setEducationalActivities([]));
  }, [firebaseUser]);

  const formatTs = (ts: unknown): string => {
    if (!ts) return '—';
    try {
      const maybe = ts as { toDate?: () => Date };
      const date = typeof maybe.toDate === 'function' ? maybe.toDate() : new Date(String(ts));
      return date.toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-US', {
        dateStyle: 'medium',
        timeStyle: 'short',
      });
    } catch {
      return '—';
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser) return;
    setSaving(true);
    setSavedNotice(null);
    setErrorMsg(null);
    try {
      const nextDisplay =
        displayName.trim() ||
        [firstName.trim(), lastName.trim()].filter(Boolean).join(' ') ||
        'Membre NOCTA';
      await updateUserProfileSettings(firebaseUser.uid, {
        firstName,
        lastName,
        displayName: nextDisplay,
        preferredLang,
      });
      setLang(preferredLang);
      setSavedNotice(t.individual.savedSuccess);
    } catch (err) {
      setErrorMsg(translateAuthError(err, lang));
    } finally {
      setSaving(false);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !firebaseUser) return;
    setUploadingPhoto(true);
    setErrorMsg(null);
    setSavedNotice(null);
    try {
      const token = await firebaseUser.getIdToken();
      const formData = new FormData();
      formData.append('avatar', file);
      const resp = await fetch('/api/profile/avatar', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const json = (await resp.json()) as { photoUrl?: string; message?: string };
      if (!resp.ok || !json.photoUrl) {
        throw new Error(json.message || t.states.errorTitle);
      }
      await updateUserProfileSettings(firebaseUser.uid, { photoUrl: json.photoUrl });
      setSavedNotice(t.individual.savedSuccess);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : t.states.errorTitle);
    } finally {
      setUploadingPhoto(false);
      if (photoInputRef.current) photoInputRef.current.value = '';
    }
  };

  const handleRemovePhoto = async () => {
    if (!firebaseUser) return;
    setUploadingPhoto(true);
    setErrorMsg(null);
    try {
      const token = await firebaseUser.getIdToken();
      await fetch('/api/profile/avatar', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      await updateUserProfileSettings(firebaseUser.uid, { photoUrl: null });
      setSavedNotice(t.individual.savedSuccess);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : t.states.errorTitle);
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleSavePrivacyAndLimits = async () => {
    if (!firebaseUser) return;
    setSaving(true);
    setSavedNotice(null);
    setErrorMsg(null);
    try {
      await updateUserPrivateSettings(firebaseUser.uid, {
        boundaries,
        preferences,
        maxIntimacyLevel,
        discreetMode,
        mfaReminderEnabled,
      });
      setSavedNotice(t.individual.savedSuccess);
    } catch (err) {
      setErrorMsg(translateAuthError(err, lang));
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSavedNotice(null);
    if (newPassword.length < 6) {
      setErrorMsg(t.auth.errWeakPassword);
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setErrorMsg(t.auth.errPasswordMismatch);
      return;
    }
    setSaving(true);
    try {
      await changeUserPassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      setSavedNotice(t.individual.passwordChangedSuccess);
    } catch (err) {
      setErrorMsg(translateAuthError(err, lang));
    } finally {
      setSaving(false);
    }
  };

  const handleToggleAccountStatus = async () => {
    setErrorMsg(null);
    setSavedNotice(null);
    setSaving(true);
    try {
      if (profile?.accountStatus === 'deactivated') {
        await reactivateOwnAccount();
      } else {
        await deactivateOwnAccount();
      }
      setSavedNotice(t.individual.savedSuccess);
    } catch (err) {
      setErrorMsg(translateAuthError(err, lang));
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDeleteAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setDeletingAccount(true);
    try {
      await deleteOwnAccount(hasPasswordProvider ? deletePassword : undefined);
      setShowDeleteModal(false);
      navigate('/', { replace: true });
    } catch (err) {
      setErrorMsg(translateAuthError(err, lang));
    } finally {
      setDeletingAccount(false);
    }
  };

  const handleRevoke = async (code: string) => {
    await declineOrRevokeInvite(code, 'revoked');
    setInvites((prev) =>
      prev.map((inv) => (inv.code === code ? { ...inv, status: 'revoked' } : inv))
    );
  };

  return (
    <AppShell>
      <div className="space-y-8">
        <header className="space-y-1.5 border-b border-[#32101D] pb-6">
          <h1 className="font-display text-3xl sm:text-4xl font-semibold text-[#F4EEF0]">
            {t.individual.title}
          </h1>
          <p className="text-sm text-[#B8AAB0]">{t.individual.subtitle}</p>
        </header>

        {savedNotice && (
          <div className="p-3.5 rounded-lg bg-[#191217] border border-[#C5A276]/60 text-xs text-[#C5A276] flex items-center gap-2">
            <Check className="w-4 h-4 shrink-0" />
            <span>{savedNotice}</span>
          </div>
        )}

        {errorMsg && (
          <div className="p-3.5 rounded-lg bg-[#32101D] border border-[#781D35] text-xs text-[#F4EEF0]">
            {errorMsg}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Profile, Photo & Language */}
          <form
            onSubmit={(e) => void handleSaveProfile(e)}
            className="lg:col-span-5 bg-[#191217] border border-[#32101D] rounded-xl p-6 space-y-5"
          >
            <h2 className="font-display text-2xl font-semibold text-[#F4EEF0]">
              {t.individual.profileSection}
            </h2>

            {/* Optional Profile Photo */}
            <div className="space-y-2.5 pb-4 border-b border-[#32101D]">
              <p className="text-xs text-[#B8AAB0]">{t.individual.photoSectionLabel}</p>
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full overflow-hidden bg-[#100D10] border border-[#32101D] flex items-center justify-center shrink-0">
                  {profile?.photoUrl ? (
                    <SafeImage
                      src={profile.photoUrl}
                      alt={profile.displayName || 'NOCTA'}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <UserIcon className="w-6 h-6 text-[#C5A276]" />
                  )}
                </div>
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-2">
                    <input
                      ref={photoInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/avif"
                      onChange={(e) => void handlePhotoUpload(e)}
                      className="hidden"
                    />
                    <button
                      type="button"
                      disabled={uploadingPhoto}
                      onClick={() => photoInputRef.current?.click()}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#32101D] hover:bg-[#4B1028] text-xs text-[#F4EEF0] rounded-lg cursor-pointer disabled:opacity-50"
                    >
                      <Camera className="w-3.5 h-3.5 text-[#C5A276]" />
                      <span>{t.individual.uploadPhotoBtn}</span>
                    </button>
                    {profile?.photoUrl && (
                      <button
                        type="button"
                        disabled={uploadingPhoto}
                        onClick={() => void handleRemovePhoto()}
                        className="px-3 py-1.5 border border-[#32101D] hover:border-[#781D35] text-xs text-[#B8AAB0] hover:text-[#F4EEF0] rounded-lg cursor-pointer"
                      >
                        {t.individual.removePhotoBtn}
                      </button>
                    )}
                  </div>
                  <p className="text-[11px] text-[#B8AAB0]">{t.individual.photoHint}</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="block text-xs text-[#B8AAB0]">{t.individual.firstNameLabel}</label>
                <input
                  type="text"
                  required
                  maxLength={80}
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[#100D10] border border-[#32101D] focus:border-[#C5A276] rounded-lg text-sm text-[#F4EEF0] outline-none"
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs text-[#B8AAB0]">{t.individual.lastNameLabel}</label>
                <input
                  type="text"
                  maxLength={80}
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[#100D10] border border-[#32101D] focus:border-[#C5A276] rounded-lg text-sm text-[#F4EEF0] outline-none"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs text-[#B8AAB0]">{t.individual.displayName}</label>
              <input
                type="text"
                required
                maxLength={100}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-[#100D10] border border-[#32101D] focus:border-[#C5A276] rounded-lg text-sm text-[#F4EEF0] outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs text-[#B8AAB0]">{t.individual.preferredLang}</label>
              <select
                value={preferredLang}
                onChange={(e) => setPreferredLang(e.target.value as Language)}
                className="w-full px-3.5 py-2.5 bg-[#100D10] border border-[#32101D] focus:border-[#C5A276] rounded-lg text-sm text-[#F4EEF0] outline-none"
              >
                <option value="fr">Français</option>
                <option value="en">English</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 bg-[#781D35] hover:bg-[#4B1028] text-[#F4EEF0] text-xs font-medium rounded-lg transition-colors cursor-pointer disabled:opacity-50"
            >
              {t.individual.saveProfile}
            </button>

            {/* Account Metadata */}
            <div className="pt-4 border-t border-[#32101D] space-y-2 text-xs">
              <p className="font-semibold text-[#F4EEF0]">{t.individual.accountMetaTitle}</p>
              <div className="flex justify-between gap-3 text-[#B8AAB0]">
                <span>{t.individual.emailLabel}</span>
                <span className="text-[#F4EEF0] truncate">{privateInfo?.email || firebaseUser?.email}</span>
              </div>
              <div className="flex justify-between gap-3 text-[#B8AAB0]">
                <span>{t.individual.statusLabel}</span>
                <span className="text-[#C5A276]">
                  {profile?.accountStatus === 'deactivated'
                    ? t.individual.statusDeactivated
                    : t.individual.statusActive}
                </span>
              </div>
              <div className="flex justify-between gap-3 text-[#B8AAB0]">
                <span>{t.individual.createdAtLabel}</span>
                <span className="text-[#F4EEF0]">{formatTs(profile?.createdAt)}</span>
              </div>
              <div className="flex justify-between gap-3 text-[#B8AAB0]">
                <span>{t.individual.lastLoginLabel}</span>
                <span className="text-[#F4EEF0]">{formatTs(profile?.lastLoginAt)}</span>
              </div>
              <div className="flex justify-between gap-3 text-[#B8AAB0]">
                <span>{t.individual.uidLabel}</span>
                <span className="font-mono-tabular text-[11px] text-[#B8AAB0] truncate max-w-[180px]">
                  {profile?.uid || firebaseUser?.uid}
                </span>
              </div>
            </div>
          </form>

          {/* Boundaries, Preferences & Privacy */}
          <div className="lg:col-span-7 bg-[#191217] border border-[#32101D] rounded-xl p-6 space-y-6">
            <h2 className="font-display text-2xl font-semibold text-[#F4EEF0]">
              {t.individual.boundariesSection}
            </h2>

            <div className="space-y-2">
              <label className="block text-xs text-[#B8AAB0]">
                {t.individual.maxIntimacyLabel}
              </label>
              <select
                value={maxIntimacyLevel}
                onChange={(e) => setMaxIntimacyLevel(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 bg-[#100D10] border border-[#32101D] focus:border-[#C5A276] rounded-lg text-sm text-[#F4EEF0] outline-none"
              >
                {t.individual.intimacyLevels.map((lbl, idx) => (
                  <option key={idx} value={idx + 1}>
                    {lbl}
                  </option>
                ))}
              </select>
            </div>

            {/* Boundaries input */}
            <div className="space-y-2">
              <div className="flex gap-2">
                <input
                  type="text"
                  maxLength={120}
                  value={boundaryInput}
                  onChange={(e) => setBoundaryInput(e.target.value)}
                  placeholder={t.individual.boundariesPlaceholder}
                  className="flex-1 px-3.5 py-2 bg-[#100D10] border border-[#32101D] rounded-lg text-sm text-[#F4EEF0] outline-none"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (boundaryInput.trim() && boundaries.length < 30) {
                      setBoundaries([...boundaries, boundaryInput.trim()]);
                      setBoundaryInput('');
                    }
                  }}
                  className="px-3.5 py-2 bg-[#32101D] hover:bg-[#4B1028] text-[#F4EEF0] text-xs rounded-lg flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{t.individual.addBoundary}</span>
                </button>
              </div>
              {boundaries.length > 0 && (
                <div className="divide-y divide-[#32101D] border border-[#32101D] rounded-lg bg-[#100D10]">
                  {boundaries.map((b, i) => (
                    <div key={i} className="px-3.5 py-2 flex items-center justify-between text-xs">
                      <span className="text-[#F4EEF0]">{b}</span>
                      <button
                        type="button"
                        onClick={() => setBoundaries(boundaries.filter((_, idx) => idx !== i))}
                        className="text-[#B8AAB0] hover:text-[#F4EEF0] cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Preferences input */}
            <div className="space-y-2">
              <div className="flex gap-2">
                <input
                  type="text"
                  maxLength={120}
                  value={prefInput}
                  onChange={(e) => setPrefInput(e.target.value)}
                  placeholder={t.individual.preferencesPlaceholder}
                  className="flex-1 px-3.5 py-2 bg-[#100D10] border border-[#32101D] rounded-lg text-sm text-[#F4EEF0] outline-none"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (prefInput.trim() && preferences.length < 30) {
                      setPreferences([...preferences, prefInput.trim()]);
                      setPrefInput('');
                    }
                  }}
                  className="px-3.5 py-2 bg-[#32101D] hover:bg-[#4B1028] text-[#F4EEF0] text-xs rounded-lg flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{t.individual.addBoundary}</span>
                </button>
              </div>
              {preferences.length > 0 && (
                <div className="divide-y divide-[#32101D] border border-[#32101D] rounded-lg bg-[#100D10]">
                  {preferences.map((p, i) => (
                    <div key={i} className="px-3.5 py-2 flex items-center justify-between text-xs">
                      <span className="text-[#F4EEF0]">{p}</span>
                      <button
                        type="button"
                        onClick={() => setPreferences(preferences.filter((_, idx) => idx !== i))}
                        className="text-[#B8AAB0] hover:text-[#F4EEF0] cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Privacy Settings */}
            <div className="pt-4 border-t border-[#32101D] space-y-3">
              <h3 className="text-sm font-semibold text-[#F4EEF0] flex items-center gap-2">
                <Lock className="w-4 h-4 text-[#C5A276]" />
                <span>{t.individual.privacySection}</span>
              </h3>
              <label className="flex items-start gap-2.5 text-xs text-[#B8AAB0] cursor-pointer">
                <input
                  type="checkbox"
                  checked={discreetMode}
                  onChange={(e) => setDiscreetMode(e.target.checked)}
                  className="mt-0.5 accent-[#781D35]"
                />
                <span>{t.individual.discreetModeLabel}</span>
              </label>
              <label className="flex items-start gap-2.5 text-xs text-[#B8AAB0] cursor-pointer">
                <input
                  type="checkbox"
                  checked={mfaReminderEnabled}
                  onChange={(e) => setMfaReminderEnabled(e.target.checked)}
                  className="mt-0.5 accent-[#781D35]"
                />
                <span>{t.individual.mfaReminderLabel}</span>
              </label>
            </div>

            <button
              type="button"
              disabled={saving}
              onClick={() => void handleSavePrivacyAndLimits()}
              className="px-5 py-2.5 bg-[#781D35] hover:bg-[#4B1028] text-[#F4EEF0] text-xs font-medium rounded-lg transition-colors cursor-pointer disabled:opacity-50"
            >
              {t.individual.savePrivacy}
            </button>
          </div>
        </div>

        {/* Password Change & Account Lifecycle */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {hasPasswordProvider && (
            <form
              onSubmit={(e) => void handlePasswordChange(e)}
              className="bg-[#191217] border border-[#32101D] rounded-xl p-6 space-y-4"
            >
              <div className="flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-[#C5A276]" />
                <h2 className="font-display text-2xl font-semibold text-[#F4EEF0]">
                  {t.individual.passwordSectionTitle}
                </h2>
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs text-[#B8AAB0]">
                  {t.individual.currentPasswordLabel}
                </label>
                <input
                  type="password"
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[#100D10] border border-[#32101D] focus:border-[#C5A276] rounded-lg text-sm text-[#F4EEF0] outline-none"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="block text-xs text-[#B8AAB0]">
                    {t.individual.newPasswordLabel}
                  </label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#100D10] border border-[#32101D] focus:border-[#C5A276] rounded-lg text-sm text-[#F4EEF0] outline-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs text-[#B8AAB0]">
                    {t.individual.confirmNewPasswordLabel}
                  </label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#100D10] border border-[#32101D] focus:border-[#C5A276] rounded-lg text-sm text-[#F4EEF0] outline-none"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2.5 bg-[#32101D] hover:bg-[#4B1028] text-[#F4EEF0] text-xs font-medium rounded-lg transition-colors cursor-pointer disabled:opacity-50"
              >
                {t.individual.changePasswordBtn}
              </button>
            </form>
          )}

          <section
            className={`bg-[#191217] border border-[#32101D] rounded-xl p-6 space-y-5 ${
              hasPasswordProvider ? '' : 'lg:col-span-2'
            }`}
          >
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-[#C5A276]" />
              <h2 className="font-display text-2xl font-semibold text-[#F4EEF0]">
                {t.individual.accountLifecycleTitle}
              </h2>
            </div>

            <div className="p-4 rounded-lg bg-[#100D10] border border-[#32101D] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <p className="text-sm font-medium text-[#F4EEF0]">{t.individual.deactivateTitle}</p>
                <p className="text-xs text-[#B8AAB0]">{t.individual.deactivateDesc}</p>
              </div>
              <button
                type="button"
                disabled={saving}
                onClick={() => void handleToggleAccountStatus()}
                className="px-4 py-2 border border-[#32101D] hover:border-[#C5A276] text-xs text-[#F4EEF0] rounded-lg cursor-pointer shrink-0"
              >
                {profile?.accountStatus === 'deactivated'
                  ? t.individual.reactivateBtn
                  : t.individual.deactivateBtn}
              </button>
            </div>

            <div className="p-4 rounded-lg bg-[#32101D]/40 border border-[#781D35]/70 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <p className="text-sm font-medium text-[#F4EEF0]">
                  {t.individual.deleteAccountTitle}
                </p>
                <p className="text-xs text-[#B8AAB0]">{t.individual.deleteAccountDesc}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setDeletePassword('');
                  setShowDeleteModal(true);
                }}
                className="px-4 py-2 bg-[#781D35] hover:bg-[#4B1028] text-xs font-medium text-[#F4EEF0] rounded-lg cursor-pointer shrink-0"
              >
                {t.individual.deleteAccountBtn}
              </button>
            </div>
          </section>
        </div>

        {/* Educational Resources & Sent Invites */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <section className="bg-[#191217] border border-[#32101D] rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-2xl font-semibold text-[#F4EEF0]">
                {t.individual.educationalResourcesTitle}
              </h2>
              <BookOpen className="w-4 h-4 text-[#C5A276]" />
            </div>
            {educationalActivities.length === 0 ? (
              <p className="text-xs text-[#B8AAB0]">{t.states.empty}</p>
            ) : (
              <div className="space-y-3">
                {educationalActivities.map((act) => (
                  <div
                    key={act.id}
                    className="p-4 rounded-lg bg-[#100D10] border border-[#32101D] space-y-1.5"
                  >
                    <h3 className="text-sm font-semibold text-[#F4EEF0]">
                      {lang === 'fr' ? act.titleFr : act.titleEn}
                    </h3>
                    <p className="text-xs text-[#B8AAB0] leading-relaxed">
                      {lang === 'fr' ? act.bodyFr : act.bodyEn}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="bg-[#191217] border border-[#32101D] rounded-xl p-6 space-y-4">
            <h2 className="font-display text-2xl font-semibold text-[#F4EEF0]">
              {t.individual.invitesManagementTitle}
            </h2>
            {invites.length === 0 ? (
              <p className="text-xs text-[#B8AAB0]">{t.states.empty}</p>
            ) : (
              <div className="divide-y divide-[#32101D] border border-[#32101D] rounded-lg bg-[#100D10]">
                {invites.map((inv) => (
                  <div key={inv.code} className="p-3.5 flex items-center justify-between gap-3">
                    <div>
                      <p className="font-mono-tabular text-xs font-semibold text-[#C5A276]">
                        {inv.code}
                      </p>
                      <p className="text-xs text-[#B8AAB0]">
                        {inv.status}
                        {inv.inviteeEmail ? ` · ${inv.inviteeEmail}` : ''}
                      </p>
                    </div>
                    {inv.status === 'pending' && (
                      <button
                        type="button"
                        onClick={() => void handleRevoke(inv.code)}
                        className="px-3 py-1.5 text-xs border border-[#32101D] hover:border-[#781D35] rounded text-[#B8AAB0] hover:text-[#F4EEF0] cursor-pointer"
                      >
                        {t.couple.revokeInviteBtn}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>

      {/* Self-Account Deletion Confirmation Modal */}
      {showDeleteModal && (
        <div
          className="fixed inset-0 z-50 bg-[#100D10]/90 backdrop-blur-sm flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <form
            onSubmit={(e) => void handleConfirmDeleteAccount(e)}
            className="max-w-md w-full bg-[#191217] border border-[#781D35] rounded-xl p-6 space-y-5"
          >
            <h3 className="font-display text-2xl font-semibold text-[#F4EEF0]">
              {t.individual.deleteConfirmTitle}
            </h3>
            <p className="text-sm text-[#B8AAB0] leading-relaxed">
              {t.individual.deleteConfirmBody}
            </p>
            {hasPasswordProvider && (
              <div className="space-y-1.5">
                <label className="block text-xs text-[#B8AAB0]">
                  {t.individual.deleteConfirmPasswordLabel}
                </label>
                <input
                  type="password"
                  required
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[#100D10] border border-[#32101D] focus:border-[#C5A276] rounded-lg text-sm text-[#F4EEF0] outline-none"
                />
              </div>
            )}
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                type="submit"
                disabled={deletingAccount}
                className="flex-1 px-4 py-2.5 bg-[#781D35] hover:bg-[#4B1028] text-[#F4EEF0] text-xs font-medium rounded-lg cursor-pointer disabled:opacity-50"
              >
                {deletingAccount ? t.states.loading : t.individual.deleteConfirmAction}
              </button>
              <button
                type="button"
                disabled={deletingAccount}
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2.5 border border-[#32101D] text-[#B8AAB0] hover:text-[#F4EEF0] text-xs rounded-lg cursor-pointer"
              >
                {t.individual.cancelBtn}
              </button>
            </div>
          </form>
        </div>
      )}
    </AppShell>
  );
}
