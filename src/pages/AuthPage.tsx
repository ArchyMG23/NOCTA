import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, MailCheck, ShieldAlert } from 'lucide-react';
import { translateAuthError, useAuth } from '../context/AuthContext';
import { useI18n } from '../i18n/I18nContext';
import { NoctaLogo } from '../components/NoctaLogo';

type AuthMode = 'signin' | 'signup' | 'reset' | 'action_reset' | 'action_verify';

export function AuthPage() {
  const [searchParams] = useSearchParams();
  const urlMode = searchParams.get('mode');
  const oobCode = searchParams.get('oobCode') || '';

  const initialMode: AuthMode =
    urlMode === 'resetPassword' && oobCode
      ? 'action_reset'
      : urlMode === 'verifyEmail' && oobCode
        ? 'action_verify'
        : urlMode === 'signup'
          ? 'signup'
          : urlMode === 'reset'
            ? 'reset'
            : 'signin';

  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [ageAccepted, setAgeAccepted] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);
  const [providerHint, setProviderHint] = useState(false);
  const [resetEmailTarget, setResetEmailTarget] = useState<string | null>(null);
  const [actionVerifiedDone, setActionVerifiedDone] = useState(false);

  const {
    firebaseUser,
    isEmailVerified,
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
    requestPasswordReset,
    verifyResetCode,
    confirmNewPassword,
    applyEmailVerifyCode,
    resendVerificationEmail,
    refreshUserSession,
    logout,
  } = useAuth();
  const { lang, setLang, t } = useI18n();
  const navigate = useNavigate();

  // Handle Firebase out-of-band action codes cleanly inside NOCTA
  useEffect(() => {
    let active = true;
    async function processActionLink() {
      if (mode === 'action_verify' && oobCode) {
        setLoading(true);
        setErrorMsg(null);
        try {
          await applyEmailVerifyCode(oobCode);
          if (!active) return;
          setActionVerifiedDone(true);
          setInfoMsg(t.auth.emailVerifiedSuccess);
        } catch (err) {
          if (!active) return;
          setErrorMsg(translateAuthError(err, lang));
        } finally {
          if (active) setLoading(false);
        }
      } else if (mode === 'action_reset' && oobCode) {
        setLoading(true);
        setErrorMsg(null);
        try {
          const target = await verifyResetCode(oobCode);
          if (!active) return;
          setResetEmailTarget(target);
        } catch (err) {
          if (!active) return;
          setErrorMsg(translateAuthError(err, lang));
        } finally {
          if (active) setLoading(false);
        }
      }
    }
    void processActionLink();
    return () => {
      active = false;
    };
  }, [mode, oobCode]);

  useEffect(() => {
    if (firebaseUser && isEmailVerified && mode !== 'action_reset') {
      navigate('/dashboard', { replace: true });
    }
  }, [firebaseUser, isEmailVerified, mode, navigate]);

  const handleGoogle = async () => {
    setErrorMsg(null);
    setProviderHint(false);
    setLoading(true);
    try {
      await signInWithGoogle();
      navigate('/dashboard');
    } catch (err) {
      setErrorMsg(translateAuthError(err, lang));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setInfoMsg(null);
    setProviderHint(false);

    if (mode === 'signup') {
      if (!firstName.trim()) {
        setErrorMsg(t.auth.errFirstNameRequired);
        return;
      }
      if (password.length < 6) {
        setErrorMsg(t.auth.errWeakPassword);
        return;
      }
      if (password !== confirmPassword) {
        setErrorMsg(t.auth.errPasswordMismatch);
        return;
      }
      if (!ageAccepted) {
        setErrorMsg(t.auth.errAgeRequired);
        return;
      }
      if (!termsAccepted) {
        setErrorMsg(t.auth.errTermsRequired);
        return;
      }
      if (!privacyAccepted) {
        setErrorMsg(t.auth.errPrivacyRequired);
        return;
      }
    }

    if (mode === 'action_reset') {
      if (password.length < 6) {
        setErrorMsg(t.auth.errWeakPassword);
        return;
      }
      if (password !== confirmPassword) {
        setErrorMsg(t.auth.errPasswordMismatch);
        return;
      }
    }

    setLoading(true);
    try {
      if (mode === 'signin') {
        await signInWithEmail(email, password);
      } else if (mode === 'signup') {
        await signUpWithEmail({
          firstName,
          lastName,
          email,
          password,
        });
      } else if (mode === 'reset') {
        await requestPasswordReset(email);
        setInfoMsg(t.auth.resetSent);
      } else if (mode === 'action_reset') {
        await confirmNewPassword(oobCode, password);
        setInfoMsg(t.auth.passwordResetDone);
        setPassword('');
        setConfirmPassword('');
        setMode('signin');
      }
    } catch (err) {
      const code = (err as { code?: string })?.code || '';
      if (code === 'auth/operation-not-allowed') {
        setProviderHint(true);
      } else {
        setErrorMsg(translateAuthError(err, lang));
      }
    } finally {
      setLoading(false);
    }
  };

  // Email verification pending view (unless currently processing action_verify success)
  if (firebaseUser && !isEmailVerified && mode !== 'action_verify' && mode !== 'action_reset') {
    return (
      <div className="min-h-screen bg-[#100D10] text-[#F4EEF0] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-[#191217] border border-[#32101D] rounded-xl p-8 space-y-6">
          <NoctaLogo />
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-[#C5A276] text-xs">
              <MailCheck className="w-4 h-4" />
              <span>{firebaseUser.email}</span>
            </div>
            <h1 className="font-display text-3xl font-semibold text-[#F4EEF0]">
              {t.auth.emailVerifyNoticeTitle}
            </h1>
            <p className="text-sm text-[#B8AAB0] leading-relaxed">
              {t.auth.emailVerifyNoticeBody}
            </p>
          </div>
          {infoMsg && (
            <div className="p-3 rounded-lg bg-[#100D10] border border-[#C5A276]/50 text-xs text-[#C5A276]">
              {infoMsg}
            </div>
          )}
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => void refreshUserSession()}
              className="w-full px-5 py-3 bg-[#781D35] hover:bg-[#4B1028] text-[#F4EEF0] text-sm font-medium rounded-lg transition-colors cursor-pointer"
            >
              {t.auth.refreshSessionBtn}
            </button>
            <button
              type="button"
              onClick={() => {
                void resendVerificationEmail().then(() => {
                  setInfoMsg(
                    lang === 'fr'
                      ? 'Un nouvel e-mail de vérification vient d’être envoyé.'
                      : 'A new verification email has been sent.'
                  );
                });
              }}
              className="w-full px-5 py-3 border border-[#32101D] hover:border-[#C5A276] text-[#B8AAB0] hover:text-[#F4EEF0] text-sm font-medium rounded-lg transition-colors cursor-pointer"
            >
              {t.auth.resendVerifyBtn}
            </button>
            <button
              type="button"
              onClick={() => void logout()}
              className="w-full px-5 py-2 text-xs text-[#B8AAB0] hover:text-[#F4EEF0] cursor-pointer"
            >
              {t.nav.signOut}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#100D10] text-[#F4EEF0] flex flex-col">
      <header className="h-16 px-4 sm:px-8 border-b border-[#32101D] flex items-center justify-between">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-xs text-[#B8AAB0] hover:text-[#F4EEF0] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{t.nav.backHome}</span>
        </Link>
        <NoctaLogo />
        <button
          type="button"
          onClick={() => setLang(lang === 'fr' ? 'en' : 'fr')}
          className="px-3 py-1.5 text-xs border border-[#32101D] rounded-md text-[#C5A276] cursor-pointer"
        >
          {lang.toUpperCase()}
        </button>
      </header>

      <main className="flex-1 flex items-center justify-center p-4 sm:p-8">
        <div className="max-w-md w-full bg-[#191217] border border-[#32101D] rounded-xl p-6 sm:p-8 space-y-6">
          <div className="space-y-2">
            <h1 className="font-display text-3xl font-semibold text-[#F4EEF0]">
              {mode === 'signin'
                ? t.auth.titleSignIn
                : mode === 'signup'
                  ? t.auth.titleSignUp
                  : mode === 'action_reset'
                    ? t.auth.titleNewPassword
                    : mode === 'action_verify'
                      ? t.auth.emailVerifyNoticeTitle
                      : t.auth.titleReset}
            </h1>
            <p className="text-sm text-[#B8AAB0]">
              {resetEmailTarget || t.auth.subtitle}
            </p>
          </div>

          {mode === 'action_verify' ? (
            <div className="space-y-4">
              {loading && <p className="text-sm text-[#B8AAB0]">{t.states.loading}</p>}
              {errorMsg && (
                <div className="p-3.5 rounded-lg bg-[#32101D] border border-[#781D35] text-xs text-[#F4EEF0]">
                  {errorMsg}
                </div>
              )}
              {actionVerifiedDone && (
                <div className="p-4 rounded-lg bg-[#100D10] border border-[#C5A276]/60 text-xs text-[#C5A276] flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{t.auth.emailVerifiedSuccess}</span>
                </div>
              )}
              <button
                type="button"
                onClick={() => {
                  if (firebaseUser) {
                    navigate('/dashboard', { replace: true });
                  } else {
                    setMode('signin');
                  }
                }}
                className="w-full px-5 py-3 bg-[#781D35] hover:bg-[#4B1028] text-[#F4EEF0] text-sm font-medium rounded-lg transition-colors cursor-pointer"
              >
                {firebaseUser ? t.nav.dashboard : t.auth.signInBtn}
              </button>
            </div>
          ) : (
            <>
              {(mode === 'signin' || mode === 'signup') && (
                <>
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => void handleGoogle()}
                    className="w-full px-5 py-3 bg-[#F4EEF0] hover:bg-white text-[#100D10] text-sm font-semibold rounded-lg transition-colors flex items-center justify-center gap-3 cursor-pointer disabled:opacity-50"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
                      <path
                        fill="#4285F4"
                        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
                      />
                    </svg>
                    <span>{t.auth.googleBtn}</span>
                  </button>

                  <div className="relative flex items-center py-1">
                    <div className="flex-grow border-t border-[#32101D]" />
                    <span className="shrink mx-3 text-xs text-[#B8AAB0]">{t.auth.orDivider}</span>
                    <div className="flex-grow border-t border-[#32101D]" />
                  </div>
                </>
              )}

              {errorMsg && (
                <div className="p-3.5 rounded-lg bg-[#32101D] border border-[#781D35] text-xs text-[#F4EEF0]">
                  {errorMsg}
                </div>
              )}

              {providerHint && (
                <div className="p-4 rounded-lg bg-[#32101D]/80 border border-[#C5A276]/60 text-xs text-[#F4EEF0] space-y-1.5">
                  <div className="flex items-center gap-2 text-[#C5A276] font-medium">
                    <ShieldAlert className="w-4 h-4 shrink-0" />
                    <span>Firebase Authentication</span>
                  </div>
                  <p className="text-[#B8AAB0] leading-relaxed">{t.auth.providerNotEnabledHint}</p>
                </div>
              )}

              {infoMsg && (
                <div className="p-3.5 rounded-lg bg-[#100D10] border border-[#C5A276]/50 text-xs text-[#C5A276]">
                  {infoMsg}
                </div>
              )}

              <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
                {mode === 'signup' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="block text-xs font-medium text-[#B8AAB0]">
                        {t.auth.firstNameLabel} *
                      </label>
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
                      <label className="block text-xs font-medium text-[#B8AAB0]">
                        {t.auth.lastNameLabel}
                      </label>
                      <input
                        type="text"
                        maxLength={80}
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-[#100D10] border border-[#32101D] focus:border-[#C5A276] rounded-lg text-sm text-[#F4EEF0] outline-none"
                      />
                    </div>
                  </div>
                )}

                {mode !== 'action_reset' && (
                  <div className="space-y-1.5">
                    <label className="block text-xs font-medium text-[#B8AAB0]">
                      {t.auth.emailLabel}
                    </label>
                    <input
                      type="email"
                      required
                      maxLength={254}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-[#100D10] border border-[#32101D] focus:border-[#C5A276] rounded-lg text-sm text-[#F4EEF0] outline-none"
                    />
                  </div>
                )}

                {mode !== 'reset' && (
                  <div className="space-y-1.5">
                    <label className="block text-xs font-medium text-[#B8AAB0]">
                      {mode === 'action_reset' ? t.auth.newPasswordLabel : t.auth.passwordLabel}
                    </label>
                    <input
                      type="password"
                      required
                      minLength={6}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-[#100D10] border border-[#32101D] focus:border-[#C5A276] rounded-lg text-sm text-[#F4EEF0] outline-none"
                    />
                  </div>
                )}

                {(mode === 'signup' || mode === 'action_reset') && (
                  <div className="space-y-1.5">
                    <label className="block text-xs font-medium text-[#B8AAB0]">
                      {t.auth.confirmPasswordLabel}
                    </label>
                    <input
                      type="password"
                      required
                      minLength={6}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-[#100D10] border border-[#32101D] focus:border-[#C5A276] rounded-lg text-sm text-[#F4EEF0] outline-none"
                    />
                  </div>
                )}

                {mode === 'signup' && (
                  <div className="space-y-2.5 pt-1">
                    <label className="flex items-start gap-2.5 cursor-pointer text-xs text-[#B8AAB0]">
                      <input
                        type="checkbox"
                        checked={ageAccepted}
                        onChange={(e) => setAgeAccepted(e.target.checked)}
                        className="mt-0.5 accent-[#781D35]"
                      />
                      <span>{t.auth.ageConfirmLabel}</span>
                    </label>
                    <label className="flex items-start gap-2.5 cursor-pointer text-xs text-[#B8AAB0]">
                      <input
                        type="checkbox"
                        checked={termsAccepted}
                        onChange={(e) => setTermsAccepted(e.target.checked)}
                        className="mt-0.5 accent-[#781D35]"
                      />
                      <span>
                        {t.auth.termsConfirmLabel}{' '}
                        <Link
                          to="/terms"
                          className="text-[#C5A276] underline hover:text-[#F4EEF0]"
                        >
                          {t.auth.termsLinkText}
                        </Link>
                        .
                      </span>
                    </label>
                    <label className="flex items-start gap-2.5 cursor-pointer text-xs text-[#B8AAB0]">
                      <input
                        type="checkbox"
                        checked={privacyAccepted}
                        onChange={(e) => setPrivacyAccepted(e.target.checked)}
                        className="mt-0.5 accent-[#781D35]"
                      />
                      <span>
                        {t.auth.privacyConfirmLabel}{' '}
                        <Link
                          to="/privacy"
                          className="text-[#C5A276] underline hover:text-[#F4EEF0]"
                        >
                          {t.auth.privacyLinkText}
                        </Link>
                        .
                      </span>
                    </label>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full px-5 py-3 bg-[#781D35] hover:bg-[#4B1028] text-[#F4EEF0] text-sm font-medium rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                >
                  {loading
                    ? t.states.loading
                    : mode === 'signin'
                      ? t.auth.signInBtn
                      : mode === 'signup'
                        ? t.auth.signUpBtn
                        : mode === 'action_reset'
                          ? t.auth.confirmNewPasswordBtn
                          : t.auth.resetBtn}
                </button>
              </form>

              <div className="pt-2 border-t border-[#32101D] flex flex-col gap-2 text-xs text-[#B8AAB0]">
                {mode === 'signin' && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setErrorMsg(null);
                        setInfoMsg(null);
                        setMode('reset');
                      }}
                      className="text-left hover:text-[#C5A276] cursor-pointer"
                    >
                      {t.auth.forgotPassword}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setErrorMsg(null);
                        setInfoMsg(null);
                        setMode('signup');
                      }}
                      className="text-left hover:text-[#F4EEF0] cursor-pointer"
                    >
                      {t.auth.switchToSignUp}
                    </button>
                  </>
                )}
                {mode === 'signup' && (
                  <button
                    type="button"
                    onClick={() => {
                      setErrorMsg(null);
                      setInfoMsg(null);
                      setMode('signin');
                    }}
                    className="text-left hover:text-[#F4EEF0] cursor-pointer"
                  >
                    {t.auth.switchToSignIn}
                  </button>
                )}
                {(mode === 'reset' || mode === 'action_reset') && (
                  <button
                    type="button"
                    onClick={() => {
                      setErrorMsg(null);
                      setInfoMsg(null);
                      setMode('signin');
                    }}
                    className="text-left hover:text-[#F4EEF0] cursor-pointer"
                  >
                    {t.auth.backToSignIn}
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
