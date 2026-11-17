import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  applyActionCode,
  browserLocalPersistence,
  confirmPasswordReset,
  createUserWithEmailAndPassword,
  deleteUser,
  EmailAuthProvider,
  onAuthStateChanged,
  reauthenticateWithCredential,
  reload,
  sendEmailVerification,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updatePassword,
  updateProfile,
  verifyPasswordResetCode,
  type User,
} from 'firebase/auth';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { auth, db, googleProvider, handleFirestoreError, OperationType } from '../lib/firebase';
import {
  deleteOwnUserFirestoreData,
  ensureUserDocuments,
  unlinkDissolvedCouple,
  updateUserProfileSettings,
} from '../services/noctaService';
import { useI18n } from '../i18n/I18nContext';
import { TRANSLATIONS } from '../i18n/translations';
import type {
  AdminRoleRecord,
  Couple,
  Language,
  UserPrivateInfo,
  UserPublicProfile,
  UserRole,
} from '../types/nocta';

export interface SignUpPayload {
  firstName: string;
  lastName?: string;
  email: string;
  password: string;
}

interface AuthContextValue {
  firebaseUser: User | null;
  profile: UserPublicProfile | null;
  privateInfo: UserPrivateInfo | null;
  couple: Couple | null;
  dissolvedCoupleNotice: boolean;
  dismissDissolvedNotice: () => void;
  adminRecord: AdminRoleRecord | null;
  effectiveRole: UserRole;
  isAuthReady: boolean;
  isEmailVerified: boolean;
  ageConfirmedSession: boolean;
  confirmAgeInSession: () => void;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (payload: SignUpPayload) => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
  verifyResetCode: (oobCode: string) => Promise<string>;
  confirmNewPassword: (oobCode: string, newPassword: string) => Promise<void>;
  applyEmailVerifyCode: (oobCode: string) => Promise<void>;
  changeUserPassword: (currentPassword: string, newPassword: string) => Promise<void>;
  deactivateOwnAccount: () => Promise<void>;
  reactivateOwnAccount: () => Promise<void>;
  deleteOwnAccount: (currentPassword?: string) => Promise<void>;
  resendVerificationEmail: () => Promise<void>;
  refreshUserSession: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);
const AGE_STORAGE_KEY = 'nocta_age_18_confirmed';
const PENDING_SIGNUP_STORAGE_KEY = 'nocta_pending_signup_meta';

interface PendingSignupMeta {
  email: string;
  firstName: string;
  lastName: string;
  preferredLang: Language;
}

function readPendingSignupMeta(email: string | null): PendingSignupMeta | null {
  if (!email) return null;
  try {
    const raw = sessionStorage.getItem(PENDING_SIGNUP_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingSignupMeta;
    if (parsed.email?.toLowerCase() === email.toLowerCase()) {
      return parsed;
    }
  } catch {
    // ignore storage errors
  }
  return null;
}

function writePendingSignupMeta(meta: PendingSignupMeta): void {
  try {
    sessionStorage.setItem(PENDING_SIGNUP_STORAGE_KEY, JSON.stringify(meta));
  } catch {
    // ignore
  }
}

function clearPendingSignupMeta(): void {
  try {
    sessionStorage.removeItem(PENDING_SIGNUP_STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function translateAuthError(err: unknown, lang: Language): string {
  const dict = TRANSLATIONS[lang].auth;
  const code = (err as { code?: string })?.code || '';
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return dict.errInvalidCredential;
    case 'auth/email-already-in-use':
      return dict.errEmailInUse;
    case 'auth/invalid-email':
      return dict.errInvalidEmail;
    case 'auth/weak-password':
      return dict.errWeakPassword;
    case 'auth/too-many-requests':
      return dict.errTooManyRequests;
    case 'auth/user-disabled':
      return dict.errUserDisabled;
    case 'auth/requires-recent-login':
      return dict.errRequiresRecentLogin;
    case 'auth/invalid-action-code':
    case 'auth/expired-action-code':
      return dict.invalidActionCode;
    case 'auth/popup-closed-by-user':
      return lang === 'fr' ? 'Connexion annulée.' : 'Sign-in popup closed.';
    default:
      return err instanceof Error ? err.message : TRANSLATIONS[lang].states.errorTitle;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { lang, setLang } = useI18n();
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserPublicProfile | null>(null);
  const [privateInfo, setPrivateInfo] = useState<UserPrivateInfo | null>(null);
  const [couple, setCouple] = useState<Couple | null>(null);
  const [dissolvedCoupleNotice, setDissolvedCoupleNotice] = useState(false);
  const [adminRecord, setAdminRecord] = useState<AdminRoleRecord | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);

  const [ageConfirmedSession, setAgeConfirmedSession] = useState<boolean>(() => {
    try {
      return (
        sessionStorage.getItem(AGE_STORAGE_KEY) === 'true' ||
        localStorage.getItem(AGE_STORAGE_KEY) === 'true'
      );
    } catch {
      return false;
    }
  });

  const confirmAgeInSession = () => {
    setAgeConfirmedSession(true);
    try {
      localStorage.setItem(AGE_STORAGE_KEY, 'true');
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    void setPersistence(auth, browserLocalPersistence).catch(() => {});
  }, []);

  useEffect(() => {
    const unsubs: {
      profile?: () => void;
      priv?: () => void;
    } = {};

    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      unsubs.profile?.();
      unsubs.priv?.();

      setFirebaseUser(user);

      if (!user) {
        setProfile(null);
        setPrivateInfo(null);
        setCouple(null);
        setDissolvedCoupleNotice(false);
        setAdminRecord(null);
        setIsAuthReady(true);
        return;
      }

      if (user.emailVerified) {
        try {
          const token = await user.getIdToken();
          await fetch('/api/media/session', {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
          });
        } catch {
          // non-blocking
        }

        const pendingMeta = readPendingSignupMeta(user.email);
        try {
          await ensureUserDocuments({
            uid: user.uid,
            email: user.email || '',
            firstName: pendingMeta?.firstName,
            lastName: pendingMeta?.lastName,
            displayName: user.displayName || user.email?.split('@')[0] || 'Membre NOCTA',
            photoUrl: user.photoURL || null,
            preferredLang: pendingMeta?.preferredLang || lang,
            ageConfirmed: true,
          });
          if (pendingMeta) clearPendingSignupMeta();
        } catch (err) {
          console.error('Bootstrap user docs warning:', err);
        }

        unsubs.profile = onSnapshot(
          doc(db, 'users', user.uid),
          (snap) => {
            if (snap.exists()) {
              const data = snap.data() as UserPublicProfile;
              setProfile(data);
              if (data.preferredLang === 'fr' || data.preferredLang === 'en') {
                setLang(data.preferredLang);
              }
            }
          },
          (error) => {
            handleFirestoreError(error, OperationType.GET, `users/${user.uid}`);
          }
        );

        unsubs.priv = onSnapshot(
          doc(db, 'users', user.uid, 'private', 'profile'),
          (snap) => {
            if (snap.exists()) {
              setPrivateInfo(snap.data() as UserPrivateInfo);
            }
          },
          (error) => {
            handleFirestoreError(error, OperationType.GET, `users/${user.uid}/private/profile`);
          }
        );

        try {
          const admSnap = await getDoc(doc(db, 'admins', user.uid));
          if (admSnap.exists()) {
            setAdminRecord(admSnap.data() as AdminRoleRecord);
          } else {
            setAdminRecord(null);
          }
        } catch {
          setAdminRecord(null);
        }
      }

      setIsAuthReady(true);
    });

    return () => {
      unsubAuth();
      unsubs.profile?.();
      unsubs.priv?.();
    };
  }, []);

  // Subscribe to linked couple document when profile.coupleId changes
  useEffect(() => {
    if (!firebaseUser || !firebaseUser.emailVerified || !profile?.coupleId) {
      setCouple(null);
      return;
    }

    const unsubCouple = onSnapshot(
      doc(db, 'couples', profile.coupleId),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as Couple;
          if (data.status === 'dissolved') {
            setCouple(null);
            setDissolvedCoupleNotice(true);
            void unlinkDissolvedCouple(firebaseUser.uid).catch(() => {});
          } else {
            setCouple(data);
            setDissolvedCoupleNotice(false);
          }
        } else {
          setCouple(null);
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, `couples/${profile.coupleId}`);
      }
    );

    return () => unsubCouple();
  }, [firebaseUser, profile?.coupleId]);

  const signInWithGoogle = async () => {
    await signInWithPopup(auth, googleProvider);
  };

  const signInWithEmail = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email.trim(), password);
  };

  const signUpWithEmail = async (payload: SignUpPayload) => {
    const cleanFirst = payload.firstName.trim().slice(0, 80);
    const cleanLast = (payload.lastName || '').trim().slice(0, 80);
    const cleanDisplay = [cleanFirst, cleanLast].filter(Boolean).join(' ').slice(0, 100);
    const cleanEmail = payload.email.trim();

    writePendingSignupMeta({
      email: cleanEmail,
      firstName: cleanFirst,
      lastName: cleanLast,
      preferredLang: lang,
    });

    const cred = await createUserWithEmailAndPassword(auth, cleanEmail, payload.password);
    if (cleanDisplay) {
      await updateProfile(cred.user, { displayName: cleanDisplay });
    }
    const actionUrl =
      typeof window !== 'undefined' ? `${window.location.origin}/auth` : undefined;
    await sendEmailVerification(
      cred.user,
      actionUrl ? { url: actionUrl, handleCodeInApp: false } : undefined
    );
  };

  const requestPasswordReset = async (email: string) => {
    const actionUrl =
      typeof window !== 'undefined' ? `${window.location.origin}/auth` : undefined;
    await sendPasswordResetEmail(
      auth,
      email.trim(),
      actionUrl ? { url: actionUrl, handleCodeInApp: false } : undefined
    );
  };

  const verifyResetCode = async (oobCode: string) => {
    return verifyPasswordResetCode(auth, oobCode);
  };

  const confirmNewPassword = async (oobCode: string, newPassword: string) => {
    await confirmPasswordReset(auth, oobCode, newPassword);
  };

  const applyEmailVerifyCode = async (oobCode: string) => {
    await applyActionCode(auth, oobCode);
    if (auth.currentUser) {
      await reload(auth.currentUser);
      setFirebaseUser({ ...auth.currentUser });
    }
  };

  const changeUserPassword = async (currentPassword: string, newPassword: string) => {
    const user = auth.currentUser;
    if (!user || !user.email) {
      throw new Error('AUTH_REQUIRED');
    }
    const credential = EmailAuthProvider.credential(user.email, currentPassword);
    await reauthenticateWithCredential(user, credential);
    await updatePassword(user, newPassword);
  };

  const deactivateOwnAccount = async () => {
    if (!auth.currentUser) return;
    await updateUserProfileSettings(auth.currentUser.uid, { accountStatus: 'deactivated' });
  };

  const reactivateOwnAccount = async () => {
    if (!auth.currentUser) return;
    await updateUserProfileSettings(auth.currentUser.uid, { accountStatus: 'active' });
  };

  const deleteOwnAccount = async (currentPassword?: string) => {
    const user = auth.currentUser;
    if (!user) throw new Error('AUTH_REQUIRED');

    const hasPasswordProvider = user.providerData.some((p) => p.providerId === 'password');
    if (hasPasswordProvider && user.email) {
      if (!currentPassword) {
        const err = new Error('REAUTH_REQUIRED') as Error & { code?: string };
        err.code = 'auth/requires-recent-login';
        throw err;
      }
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);
    }

    try {
      const idToken = await user.getIdToken();
      await fetch('/api/profile/avatar', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${idToken}` },
      });
    } catch {
      // non-blocking if avatar missing
    }

    await deleteOwnUserFirestoreData(user.uid, profile?.coupleId || couple?.id || null);

    await deleteUser(user);

    try {
      await fetch('/api/admin/logout', { method: 'POST' });
    } catch {
      // ignore
    }
  };

  const resendVerificationEmail = async () => {
    if (auth.currentUser) {
      const actionUrl =
        typeof window !== 'undefined' ? `${window.location.origin}/auth` : undefined;
      await sendEmailVerification(
        auth.currentUser,
        actionUrl ? { url: actionUrl, handleCodeInApp: false } : undefined
      );
    }
  };

  const refreshUserSession = async () => {
    if (auth.currentUser) {
      await reload(auth.currentUser);
      setFirebaseUser({ ...auth.currentUser });
      if (auth.currentUser.emailVerified) {
        const pendingMeta = readPendingSignupMeta(auth.currentUser.email);
        await ensureUserDocuments({
          uid: auth.currentUser.uid,
          email: auth.currentUser.email || '',
          firstName: pendingMeta?.firstName,
          lastName: pendingMeta?.lastName,
          displayName: auth.currentUser.displayName || 'Membre NOCTA',
          photoUrl: auth.currentUser.photoURL || null,
          preferredLang: pendingMeta?.preferredLang || lang,
          ageConfirmed: true,
        });
        if (pendingMeta) clearPendingSignupMeta();
      }
    }
  };

  const logout = async () => {
    try {
      await fetch('/api/admin/logout', { method: 'POST' });
    } catch {
      // ignore network error on logout
    }
    await signOut(auth);
  };

  const effectiveRole: UserRole =
    adminRecord?.role ||
    (firebaseUser?.emailVerified && firebaseUser.email === 'yombivictor@gmail.com'
      ? 'super_admin'
      : profile?.role || 'user');

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        profile,
        privateInfo,
        couple,
        dissolvedCoupleNotice,
        dismissDissolvedNotice: () => setDissolvedCoupleNotice(false),
        adminRecord,
        effectiveRole,
        isAuthReady,
        isEmailVerified: Boolean(firebaseUser?.emailVerified),
        ageConfirmedSession,
        confirmAgeInSession,
        signInWithGoogle,
        signInWithEmail,
        signUpWithEmail,
        requestPasswordReset,
        verifyResetCode,
        confirmNewPassword,
        applyEmailVerifyCode,
        changeUserPassword,
        deactivateOwnAccount,
        reactivateOwnAccount,
        deleteOwnAccount,
        resendVerificationEmail,
        refreshUserSession,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
