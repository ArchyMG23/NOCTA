import {
  collection,
  deleteDoc,
  doc,
  getCountFromServer,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  Timestamp,
} from 'firebase/firestore';
import {
  DEFAULT_HOMEPAGE_EDITORIAL,
  DEFAULT_MEDIA_CATEGORIES,
} from '../data/editorialDefaults';
import { NOCTA_FORMATS, NOCTA_UNIVERSES, STARTER_FOUNDATION_ACTIVITIES } from '../data/universesCatalog';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import type {
  AccountStatus,
  Activity,
  ActivityFormat,
  ActivityType,
  AdminAuditLog,
  AdminRoleRecord,
  AdultClassification,
  Couple,
  CoupleFavoriteItem,
  CoupleHistoryItem,
  CoupleInvite,
  CoupleSession,
  DocumentImport,
  EditorialConfigDoc,
  FocalPoint,
  HomepageEditorialPayload,
  ImportExtractedItem,
  IndividualLedgerItem,
  Language,
  MediaAsset,
  MediaCategory,
  MediaPublicationStatus,
  MediaRole,
  MediaSpace,
  ParticipationMode,
  PublicationStatus,
  SiteSetting,
  Universe,
  UserPrivateInfo,
  UserPublicProfile,
  UserRole,
} from '../types/nocta';

function makeSafeId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 10);
  const ts = Date.now().toString(36);
  return `${prefix}_${ts}_${rand}`;
}

export function normalizeHashClient(text: string): string {
  const clean = text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  let hash = 2166136261;
  for (let i = 0; i < clean.length; i++) {
    hash ^= clean.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `h_${(hash >>> 0).toString(16).padStart(8, '0')}_${clean.length}`;
}

function generateSecureInviteCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = new Uint8Array(8);
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  let suffix = '';
  for (let i = 0; i < bytes.length; i++) {
    suffix += alphabet[bytes[i] % alphabet.length];
  }
  return `NOCTA-${suffix}`;
}

// ---------------------------------------------------------------------------
// User & Private Profile Services
// ---------------------------------------------------------------------------
export async function ensureUserDocuments(params: {
  uid: string;
  email: string;
  firstName?: string;
  lastName?: string;
  displayName?: string;
  photoUrl?: string | null;
  preferredLang: Language;
  ageConfirmed: boolean;
}): Promise<{ profile: UserPublicProfile; privateInfo: UserPrivateInfo }> {
  const userRef = doc(db, 'users', params.uid);
  const privRef = doc(db, 'users', params.uid, 'private', 'profile');

  try {
    const [userSnap, privSnap] = await Promise.all([getDoc(userRef), getDoc(privRef)]);
    if (!userSnap.exists()) {
      const safeFirst = (
        params.firstName ||
        (params.displayName ? params.displayName.split(/\s+/)[0] : '') ||
        params.email.split('@')[0] ||
        'Membre'
      )
        .trim()
        .slice(0, 80);
      const safeLast = (params.lastName || '').trim().slice(0, 80);
      const safeDisplay = (
        params.displayName ||
        [safeFirst, safeLast].filter(Boolean).join(' ') ||
        'Membre NOCTA'
      )
        .trim()
        .slice(0, 100);

      await setDoc(userRef, {
        uid: params.uid,
        displayName: safeDisplay,
        firstName: safeFirst,
        lastName: safeLast,
        photoUrl: params.photoUrl || null,
        preferredLang: params.preferredLang,
        coupleId: null,
        role: 'user',
        accountStatus: 'active',
        ageConfirmed: params.ageConfirmed,
        onboardingCompleted: false,
        lastLoginAt: serverTimestamp(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      const existing = userSnap.data() as UserPublicProfile;
      const loginUpdates: Record<string, unknown> = {
        lastLoginAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      if (!existing.firstName && params.firstName) {
        loginUpdates.firstName = params.firstName.trim().slice(0, 80);
      }
      if (!existing.lastName && params.lastName) {
        loginUpdates.lastName = params.lastName.trim().slice(0, 80);
      }
      if (!existing.accountStatus) {
        loginUpdates.accountStatus = 'active';
      }
      await updateDoc(userRef, loginUpdates);
    }

    if (!privSnap.exists()) {
      await setDoc(privRef, {
        uid: params.uid,
        email: params.email.slice(0, 254),
        ageConfirmedAt: serverTimestamp(),
        termsAcceptedAt: serverTimestamp(),
        privacyAcceptedAt: serverTimestamp(),
        boundaries: [],
        preferences: [],
        maxIntimacyLevel: 3,
        discreetMode: false,
        mfaReminderEnabled: false,
        updatedAt: serverTimestamp(),
      });
    }

    const [freshUser, freshPriv] = await Promise.all([getDoc(userRef), getDoc(privRef)]);
    return {
      profile: freshUser.data() as UserPublicProfile,
      privateInfo: freshPriv.data() as UserPrivateInfo,
    };
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `users/${params.uid}`);
  }
}

export async function recordUserLastLogin(uid: string): Promise<void> {
  try {
    await updateDoc(doc(db, 'users', uid), {
      lastLoginAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch {
    // non-blocking
  }
}

export async function updateUserProfileSettings(
  uid: string,
  updates: {
    displayName?: string;
    firstName?: string;
    lastName?: string;
    photoUrl?: string | null;
    preferredLang?: Language;
    ageConfirmed?: boolean;
    accountStatus?: AccountStatus;
    onboardingCompleted?: boolean;
  }
): Promise<void> {
  const userRef = doc(db, 'users', uid);
  try {
    const payload: Record<string, unknown> = { updatedAt: serverTimestamp() };
    if (typeof updates.firstName === 'string') {
      payload.firstName = updates.firstName.trim().slice(0, 80);
    }
    if (typeof updates.lastName === 'string') {
      payload.lastName = updates.lastName.trim().slice(0, 80);
    }
    if (typeof updates.displayName === 'string' && updates.displayName.trim()) {
      payload.displayName = updates.displayName.trim().slice(0, 100);
    }
    if (updates.photoUrl !== undefined) {
      payload.photoUrl = updates.photoUrl ? updates.photoUrl.slice(0, 500) : null;
    }
    if (updates.preferredLang) {
      payload.preferredLang = updates.preferredLang;
    }
    if (typeof updates.ageConfirmed === 'boolean') {
      payload.ageConfirmed = updates.ageConfirmed;
    }
    if (updates.accountStatus) {
      payload.accountStatus = updates.accountStatus;
    }
    if (typeof updates.onboardingCompleted === 'boolean') {
      payload.onboardingCompleted = updates.onboardingCompleted;
    }
    await updateDoc(userRef, payload);
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `users/${uid}`);
  }
}

export async function unlinkDissolvedCouple(uid: string): Promise<void> {
  try {
    await updateDoc(doc(db, 'users', uid), {
      coupleId: null,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `users/${uid}`);
  }
}

export async function deleteOwnUserFirestoreData(
  uid: string,
  activeCoupleId?: string | null
): Promise<void> {
  try {
    // 1. Cleanly dissolve user's couple without erasing partner's personal data or shared couple archive
    if (activeCoupleId) {
      const coupleRef = doc(db, 'couples', activeCoupleId);
      const coupleSnap = await getDoc(coupleRef);
      if (coupleSnap.exists()) {
        const c = coupleSnap.data() as Couple;
        if (c.status !== 'dissolved') {
          await updateDoc(coupleRef, {
            status: 'dissolved',
            leftByUid: uid,
            updatedAt: serverTimestamp(),
          });
        }
      }
    }

    // 2. Revoke any pending invitations issued by this user
    const invSnap = await getDocs(
      query(collection(db, 'couple_invites'), where('inviterId', '==', uid))
    );
    if (!invSnap.empty) {
      const invBatch = writeBatch(db);
      let hasRevoke = false;
      for (const d of invSnap.docs) {
        const inv = d.data() as CoupleInvite;
        if (inv.status === 'pending') {
          invBatch.update(d.ref, {
            status: 'revoked',
            updatedAt: serverTimestamp(),
          });
          hasRevoke = true;
        }
      }
      if (hasRevoke) await invBatch.commit();
    }

    // 3. Delete user's individual ledger entries
    const ledgerSnap = await getDocs(collection(db, 'users', uid, 'ledger'));
    if (!ledgerSnap.empty) {
      for (let i = 0; i < ledgerSnap.docs.length; i += 400) {
        const batch = writeBatch(db);
        for (const d of ledgerSnap.docs.slice(i, i + 400)) {
          batch.delete(d.ref);
        }
        await batch.commit();
      }
    }

    // 4. Delete user's private profile and public workspace profile
    const profileBatch = writeBatch(db);
    profileBatch.delete(doc(db, 'users', uid, 'private', 'profile'));
    profileBatch.delete(doc(db, 'users', uid));
    await profileBatch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `users/${uid}`);
  }
}

export async function updateUserPrivateSettings(
  uid: string,
  updates: {
    boundaries?: string[];
    preferences?: string[];
    maxIntimacyLevel?: number;
    discreetMode?: boolean;
    mfaReminderEnabled?: boolean;
  }
): Promise<void> {
  const privRef = doc(db, 'users', uid, 'private', 'profile');
  try {
    const payload: Record<string, unknown> = { updatedAt: serverTimestamp() };
    if (Array.isArray(updates.boundaries)) {
      payload.boundaries = updates.boundaries
        .map((s) => s.trim().slice(0, 120))
        .filter(Boolean)
        .slice(0, 30);
    }
    if (Array.isArray(updates.preferences)) {
      payload.preferences = updates.preferences
        .map((s) => s.trim().slice(0, 120))
        .filter(Boolean)
        .slice(0, 30);
    }
    if (typeof updates.maxIntimacyLevel === 'number') {
      payload.maxIntimacyLevel = Math.min(5, Math.max(1, Math.round(updates.maxIntimacyLevel)));
    }
    if (typeof updates.discreetMode === 'boolean') {
      payload.discreetMode = updates.discreetMode;
    }
    if (typeof updates.mfaReminderEnabled === 'boolean') {
      payload.mfaReminderEnabled = updates.mfaReminderEnabled;
    }
    await updateDoc(privRef, payload);
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `users/${uid}/private/profile`);
  }
}

// ---------------------------------------------------------------------------
// Couple Sanctuary & Invitation Services
// ---------------------------------------------------------------------------
const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export async function createCoupleWithInvite(params: {
  uid: string;
  displayName: string;
  coupleName: string;
  inviteeEmail?: string;
}): Promise<{ coupleId: string; inviteCode: string }> {
  const coupleId = makeSafeId('cpl');
  const inviteCode = generateSecureInviteCode();
  const normalizedInviteeEmail = params.inviteeEmail?.trim().toLowerCase().slice(0, 254) || null;
  const expiresAt = Timestamp.fromMillis(Date.now() + INVITE_TTL_MS);

  try {
    const userRef = doc(db, 'users', params.uid);
    const userSnap = await getDoc(userRef);
    const userData = userSnap.data() as UserPublicProfile | undefined;
    if (userData?.coupleId) {
      const existingCoupleSnap = await getDoc(doc(db, 'couples', userData.coupleId));
      if (existingCoupleSnap.exists()) {
        const existingCouple = existingCoupleSnap.data() as Couple;
        if (existingCouple.status !== 'dissolved') {
          throw new Error('ALREADY_IN_COUPLE');
        }
      }
    }

    const batch = writeBatch(db);
    batch.set(doc(db, 'couples', coupleId), {
      id: coupleId,
      name: params.coupleName.trim().slice(0, 120) || 'NOCTA Duo',
      memberIds: [params.uid],
      partnerAId: params.uid,
      partnerBId: null,
      leftByUid: null,
      status: 'pending',
      activeMode: 'couple',
      createdBy: params.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    batch.set(doc(db, 'couple_invites', inviteCode), {
      code: inviteCode,
      coupleId,
      inviterId: params.uid,
      inviterName: params.displayName.slice(0, 100),
      inviteeEmail: normalizedInviteeEmail,
      acceptedBy: null,
      status: 'pending',
      expiresAt,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    batch.update(userRef, {
      coupleId,
      updatedAt: serverTimestamp(),
    });

    await batch.commit();
    return { coupleId, inviteCode };
  } catch (err) {
    if (err instanceof Error && err.message === 'ALREADY_IN_COUPLE') throw err;
    handleFirestoreError(err, OperationType.WRITE, `couples/${coupleId}`);
  }
}

export async function reissueCoupleInvite(params: {
  coupleId: string;
  uid: string;
  displayName: string;
  inviteeEmail?: string;
}): Promise<string> {
  const inviteCode = generateSecureInviteCode();
  const normalizedInviteeEmail = params.inviteeEmail?.trim().toLowerCase().slice(0, 254) || null;
  const expiresAt = Timestamp.fromMillis(Date.now() + INVITE_TTL_MS);

  try {
    const existingInvites = await listMyCoupleInvites(params.uid);
    const batch = writeBatch(db);
    for (const inv of existingInvites) {
      if (inv.coupleId === params.coupleId && inv.status === 'pending') {
        batch.update(doc(db, 'couple_invites', inv.code), {
          status: 'revoked',
          updatedAt: serverTimestamp(),
        });
      }
    }
    batch.set(doc(db, 'couple_invites', inviteCode), {
      code: inviteCode,
      coupleId: params.coupleId,
      inviterId: params.uid,
      inviterName: params.displayName.slice(0, 100),
      inviteeEmail: normalizedInviteeEmail,
      acceptedBy: null,
      status: 'pending',
      expiresAt,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await batch.commit();
    return inviteCode;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `couple_invites/${inviteCode}`);
  }
}

export async function lookupInviteByCode(code: string): Promise<CoupleInvite | null> {
  const clean = code.trim().toUpperCase();
  if (!/^[a-zA-Z0-9_\-]{6,32}$/.test(clean)) return null;
  try {
    const snap = await getDoc(doc(db, 'couple_invites', clean));
    return snap.exists() ? (snap.data() as CoupleInvite) : null;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, `couple_invites/${clean}`);
  }
}

export async function listMyCoupleInvites(uid: string): Promise<CoupleInvite[]> {
  try {
    const q = query(collection(db, 'couple_invites'), where('inviterId', '==', uid));
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.data() as CoupleInvite);
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'couple_invites');
  }
}

export async function listIncomingInvitesByEmail(email: string): Promise<CoupleInvite[]> {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail) return [];
  try {
    const q = query(collection(db, 'couple_invites'), where('inviteeEmail', '==', cleanEmail));
    const snap = await getDocs(q);
    const now = Date.now();
    return snap.docs
      .map((d) => d.data() as CoupleInvite)
      .filter(
        (inv) =>
          inv.status === 'pending' &&
          (!inv.expiresAt || inv.expiresAt.toMillis() > now)
      );
  } catch {
    return [];
  }
}

export async function acceptCoupleInvite(params: {
  code: string;
  uid: string;
  userEmail?: string;
}): Promise<string> {
  const cleanCode = params.code.trim().toUpperCase();
  const inviteRef = doc(db, 'couple_invites', cleanCode);

  try {
    const userRef = doc(db, 'users', params.uid);
    const [inviteSnap, userSnap] = await Promise.all([getDoc(inviteRef), getDoc(userRef)]);

    if (!inviteSnap.exists()) {
      throw new Error('INVITE_NOT_FOUND');
    }
    const invite = inviteSnap.data() as CoupleInvite;
    if (invite.status !== 'pending') {
      throw new Error('INVITE_NO_LONGER_PENDING');
    }
    if (invite.inviterId === params.uid) {
      throw new Error('CANNOT_JOIN_OWN_INVITE');
    }
    if (invite.expiresAt && invite.expiresAt.toMillis() <= Date.now()) {
      throw new Error('INVITE_EXPIRED');
    }
    if (
      invite.inviteeEmail &&
      params.userEmail &&
      invite.inviteeEmail.toLowerCase() !== params.userEmail.trim().toLowerCase()
    ) {
      throw new Error('INVITE_EMAIL_MISMATCH');
    }

    const userData = userSnap.data() as UserPublicProfile | undefined;
    if (userData?.coupleId) {
      const currentCoupleSnap = await getDoc(doc(db, 'couples', userData.coupleId));
      if (currentCoupleSnap.exists()) {
        const currentCouple = currentCoupleSnap.data() as Couple;
        if (currentCouple.status !== 'dissolved') {
          throw new Error('ALREADY_IN_COUPLE');
        }
      }
      // Clean stale reference to an already-dissolved couple before joining the new one
      await updateDoc(userRef, { coupleId: null, updatedAt: serverTimestamp() });
    }

    const coupleRef = doc(db, 'couples', invite.coupleId);
    const coupleSnap = await getDoc(coupleRef);
    if (!coupleSnap.exists()) {
      throw new Error('COUPLE_NOT_FOUND');
    }
    const couple = coupleSnap.data() as Couple;
    if (couple.status !== 'pending' || couple.memberIds.length >= 2) {
      throw new Error('INVITE_NO_LONGER_PENDING');
    }

    const batch = writeBatch(db);
    batch.update(coupleRef, {
      partnerBId: params.uid,
      memberIds: [couple.partnerAId, params.uid],
      status: 'active',
      updatedAt: serverTimestamp(),
    });
    batch.update(inviteRef, {
      status: 'accepted',
      acceptedBy: params.uid,
      updatedAt: serverTimestamp(),
    });
    batch.update(userRef, {
      coupleId: invite.coupleId,
      updatedAt: serverTimestamp(),
    });

    await batch.commit();
    return invite.coupleId;
  } catch (err) {
    if (
      err instanceof Error &&
      [
        'INVITE_NOT_FOUND',
        'INVITE_NO_LONGER_PENDING',
        'CANNOT_JOIN_OWN_INVITE',
        'COUPLE_NOT_FOUND',
        'INVITE_EXPIRED',
        'INVITE_EMAIL_MISMATCH',
        'ALREADY_IN_COUPLE',
      ].includes(err.message)
    ) {
      throw err;
    }
    handleFirestoreError(err, OperationType.UPDATE, `couple_invites/${cleanCode}`);
  }
}

export async function declineOrRevokeInvite(
  code: string,
  action: 'declined' | 'revoked' | 'expired'
): Promise<void> {
  const clean = code.trim().toUpperCase();
  try {
    await updateDoc(doc(db, 'couple_invites', clean), {
      status: action,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `couple_invites/${clean}`);
  }
}

export async function updateCouplePreferences(
  coupleId: string,
  updates: { name?: string; activeMode?: Exclude<ParticipationMode, 'individual'>; status?: Couple['status'] }
): Promise<void> {
  try {
    const payload: Record<string, unknown> = { updatedAt: serverTimestamp() };
    if (updates.name) payload.name = updates.name.trim().slice(0, 120);
    if (updates.activeMode) payload.activeMode = updates.activeMode;
    if (updates.status) payload.status = updates.status;
    await updateDoc(doc(db, 'couples', coupleId), payload);
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `couples/${coupleId}`);
  }
}

export async function dissolveCoupleSpace(coupleId: string, uid: string): Promise<void> {
  try {
    const batch = writeBatch(db);
    batch.update(doc(db, 'couples', coupleId), {
      status: 'dissolved',
      leftByUid: uid,
      updatedAt: serverTimestamp(),
    });
    batch.update(doc(db, 'users', uid), {
      coupleId: null,
      updatedAt: serverTimestamp(),
    });
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `couples/${coupleId}`);
  }
}

export async function createCouplePlaySession(params: {
  coupleId: string;
  mode: Exclude<ParticipationMode, 'individual'>;
  universeId: string;
  formatId: string;
  activityId: string;
  createdBy: string;
}): Promise<CoupleSession> {
  const sessionId = makeSafeId('sess');
  const sessionRef = doc(db, 'couples', params.coupleId, 'sessions', sessionId);
  try {
    await setDoc(sessionRef, {
      id: sessionId,
      mode: params.mode,
      universeId: params.universeId,
      formatId: params.formatId,
      activityId: params.activityId,
      status: 'active',
      currentTurnUid: params.createdBy,
      partnerAReady: true,
      partnerBReady: params.mode === 'pass_device',
      createdBy: params.createdBy,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    const snap = await getDoc(sessionRef);
    return snap.data() as CoupleSession;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `couples/${params.coupleId}/sessions/${sessionId}`);
  }
}

// ---------------------------------------------------------------------------
// Catalog Services (12 Universes, 60 Formats, Published Activities)
// ---------------------------------------------------------------------------
export async function fetchUniverses(): Promise<Universe[]> {
  try {
    const snap = await getDocs(query(collection(db, 'universes'), orderBy('order', 'asc')));
    if (snap.empty) return NOCTA_UNIVERSES;
    return snap.docs.map((d) => d.data() as Universe);
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'universes');
  }
}

export async function fetchFormats(universeId?: string): Promise<ActivityFormat[]> {
  try {
    const q = universeId
      ? query(collection(db, 'formats'), where('universeId', '==', universeId))
      : query(collection(db, 'formats'));
    const snap = await getDocs(q);
    if (snap.empty) {
      return universeId
        ? NOCTA_FORMATS.filter((f) => f.universeId === universeId)
        : NOCTA_FORMATS;
    }
    return snap.docs
      .map((d) => d.data() as ActivityFormat)
      .sort((a, b) => a.order - b.order);
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'formats');
  }
}

export async function fetchPublishedActivities(universeId?: string): Promise<Activity[]> {
  try {
    const q = universeId
      ? query(
          collection(db, 'activities'),
          where('status', '==', 'published'),
          where('universeId', '==', universeId)
        )
      : query(collection(db, 'activities'), where('status', '==', 'published'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.data() as Activity);
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'activities');
  }
}

// ---------------------------------------------------------------------------
// Anti-Repetition Content Engine
// ---------------------------------------------------------------------------
export interface DrawResult {
  activity: Activity | null;
  exhausted: boolean;
  suggestedUniverse?: Universe;
}

export async function drawNextActivity(params: {
  mode: ParticipationMode;
  uid: string;
  coupleId?: string | null;
  universeId: string;
  formatId?: string | null;
  maxIntimacyLevel: number;
}): Promise<DrawResult> {
  if (params.mode !== 'individual' && !params.coupleId) {
    throw new Error('COUPLE_REQUIRED');
  }

  try {
    const [allPublished, universes] = await Promise.all([
      fetchPublishedActivities(params.universeId),
      fetchUniverses(),
    ]);

    const pool = allPublished.filter((act) => {
      if (params.formatId && act.formatId !== params.formatId) return false;
      if (act.intimacyLevel > params.maxIntimacyLevel) return false;
      return true;
    });

    // Exclude already-used activities AND favorites (favorites stay in separate library)
    const excludedIds = new Set<string>();

    if (params.mode === 'individual') {
      const ledgerSnap = await getDocs(collection(db, 'users', params.uid, 'ledger'));
      for (const d of ledgerSnap.docs) {
        const item = d.data() as IndividualLedgerItem;
        excludedIds.add(item.activityId);
      }
    } else if (params.coupleId) {
      const [histSnap, favSnap] = await Promise.all([
        getDocs(collection(db, 'couples', params.coupleId, 'history')),
        getDocs(collection(db, 'couples', params.coupleId, 'favorites')),
      ]);
      for (const d of histSnap.docs) excludedIds.add(d.id);
      for (const d of favSnap.docs) excludedIds.add(d.id);
    }

    const candidates = pool.filter((act) => !excludedIds.has(act.id));

    if (candidates.length === 0) {
      const alt = universes.find((u) => u.isActive && u.id !== params.universeId);
      return { activity: null, exhausted: true, suggestedUniverse: alt };
    }

    // Attempt transactional lock so concurrent partner sessions cannot draw the same activity
    for (const candidate of candidates) {
      if (params.mode === 'individual') {
        const ref = doc(db, 'users', params.uid, 'ledger', candidate.id);
        const claimed = await runTransaction(db, async (tx) => {
          const snap = await tx.get(ref);
          if (snap.exists()) return false;
          tx.set(ref, {
            activityId: candidate.id,
            universeId: candidate.universeId,
            formatId: candidate.formatId,
            kind: 'history',
            status: 'presented',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          return true;
        });
        if (claimed) return { activity: candidate, exhausted: false };
      } else if (params.coupleId) {
        const ref = doc(db, 'couples', params.coupleId, 'history', candidate.id);
        const claimed = await runTransaction(db, async (tx) => {
          const snap = await tx.get(ref);
          if (snap.exists()) return false;
          tx.set(ref, {
            activityId: candidate.id,
            universeId: candidate.universeId,
            formatId: candidate.formatId,
            status: 'presented',
            mode: params.mode,
            presentedBy: params.uid,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          return true;
        });
        if (claimed) return { activity: candidate, exhausted: false };
      }
    }

    const alt = universes.find((u) => u.isActive && u.id !== params.universeId);
    return { activity: null, exhausted: true, suggestedUniverse: alt };
  } catch (err) {
    if (err instanceof Error && err.message === 'COUPLE_REQUIRED') throw err;
    handleFirestoreError(err, OperationType.WRITE, 'anti_repetition_draw');
  }
}

export async function markActivityOutcome(params: {
  mode: ParticipationMode;
  uid: string;
  coupleId?: string | null;
  activityId: string;
  status: 'completed' | 'skipped';
}): Promise<void> {
  try {
    if (params.mode === 'individual') {
      await updateDoc(doc(db, 'users', params.uid, 'ledger', params.activityId), {
        status: params.status,
        updatedAt: serverTimestamp(),
      });
    } else if (params.coupleId) {
      await updateDoc(doc(db, 'couples', params.coupleId, 'history', params.activityId), {
        status: params.status,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `history/${params.activityId}`);
  }
}

export async function saveActivityToFavorites(params: {
  mode: ParticipationMode;
  uid: string;
  coupleId?: string | null;
  activity: Activity;
}): Promise<void> {
  try {
    if (params.mode === 'individual') {
      const favId = `fav_${params.activity.id}`;
      await setDoc(doc(db, 'users', params.uid, 'ledger', favId), {
        activityId: favId,
        universeId: params.activity.universeId,
        formatId: params.activity.formatId,
        kind: 'favorite',
        status: 'saved',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else if (params.coupleId) {
      await setDoc(doc(db, 'couples', params.coupleId, 'favorites', params.activity.id), {
        activityId: params.activity.id,
        universeId: params.activity.universeId,
        formatId: params.activity.formatId,
        addedBy: params.uid,
        replayCount: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `favorites/${params.activity.id}`);
  }
}

export async function fetchCoupleHistoryAndFavorites(coupleId: string): Promise<{
  history: CoupleHistoryItem[];
  favorites: CoupleFavoriteItem[];
}> {
  try {
    const [hSnap, fSnap] = await Promise.all([
      getDocs(collection(db, 'couples', coupleId, 'history')),
      getDocs(collection(db, 'couples', coupleId, 'favorites')),
    ]);
    return {
      history: hSnap.docs.map((d) => d.data() as CoupleHistoryItem),
      favorites: fSnap.docs.map((d) => d.data() as CoupleFavoriteItem),
    };
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, `couples/${coupleId}/history`);
  }
}

export async function fetchIndividualLedger(uid: string): Promise<IndividualLedgerItem[]> {
  try {
    const snap = await getDocs(collection(db, 'users', uid, 'ledger'));
    return snap.docs.map((d) => d.data() as IndividualLedgerItem);
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, `users/${uid}/ledger`);
  }
}

export async function replayCoupleFavorite(coupleId: string, activityId: string): Promise<void> {
  try {
    const ref = doc(db, 'couples', coupleId, 'favorites', activityId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return;
    const current = snap.data() as CoupleFavoriteItem;
    await updateDoc(ref, {
      replayCount: (current.replayCount || 0) + 1,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `couples/${coupleId}/favorites/${activityId}`);
  }
}

export async function removeCoupleFavorite(coupleId: string, activityId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'couples', coupleId, 'favorites', activityId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `couples/${coupleId}/favorites/${activityId}`);
  }
}

// ---------------------------------------------------------------------------
// Administration & Audit Services
// ---------------------------------------------------------------------------
export async function logAdminOperation(params: {
  actorUid: string;
  actorRole: string;
  action: string;
  targetCollection: string;
  targetId: string;
  summary: string;
}): Promise<void> {
  const id = makeSafeId('log');
  try {
    await setDoc(doc(db, 'admin_logs', id), {
      id,
      actorUid: params.actorUid,
      actorRole: params.actorRole.slice(0, 40),
      action: params.action.slice(0, 120),
      targetCollection: params.targetCollection.slice(0, 80),
      targetId: params.targetId.slice(0, 128),
      summary: params.summary.slice(0, 500),
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `admin_logs/${id}`);
  }
}

export async function bootstrapSuperAdminRecord(params: {
  uid: string;
  email: string;
  displayName: string;
}): Promise<AdminRoleRecord> {
  const adminRef = doc(db, 'admins', params.uid);
  try {
    await setDoc(adminRef, {
      uid: params.uid,
      email: params.email.slice(0, 254),
      displayName: params.displayName.slice(0, 100),
      role: 'super_admin',
      grantedBy: params.uid,
      mfaVerified: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    const snap = await getDoc(adminRef);
    return snap.data() as AdminRoleRecord;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `admins/${params.uid}`);
  }
}

export async function seedCatalogToFirestore(actorUid: string, actorRole: string): Promise<void> {
  try {
    const batch = writeBatch(db);
    for (const u of NOCTA_UNIVERSES) {
      batch.set(doc(db, 'universes', u.id), {
        id: u.id,
        slug: u.slug,
        order: u.order,
        category: u.category,
        titleFr: u.titleFr,
        titleEn: u.titleEn,
        descriptionFr: u.descriptionFr,
        descriptionEn: u.descriptionEn,
        isActive: u.isActive,
        formatsCount: 5,
        updatedAt: serverTimestamp(),
      });
    }
    for (const f of NOCTA_FORMATS) {
      batch.set(doc(db, 'formats', f.id), {
        id: f.id,
        universeId: f.universeId,
        order: f.order,
        slug: f.slug,
        titleFr: f.titleFr,
        titleEn: f.titleEn,
        descriptionFr: f.descriptionFr,
        descriptionEn: f.descriptionEn,
        participationModes: f.participationModes || ['individual', 'couple', 'remote_sync', 'pass_device'],
        isActive: f.isActive,
        updatedAt: serverTimestamp(),
      });
    }
    await batch.commit();
    await logAdminOperation({
      actorUid,
      actorRole,
      action: 'SEED_CATALOG_STRUCTURE',
      targetCollection: 'universes',
      targetId: 'all_12_universes',
      summary: 'Synchronized 12 NOCTA universes and 60 formats into Firestore.',
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'universes_formats_seed');
  }
}

export async function seedStarterActivitiesToFirestore(
  actorUid: string,
  actorRole: string
): Promise<number> {
  try {
    let created = 0;
    const batch = writeBatch(db);
    for (const act of STARTER_FOUNDATION_ACTIVITIES) {
      const ref = doc(db, 'activities', act.id);
      const existing = await getDoc(ref);
      if (!existing.exists()) {
        batch.set(ref, {
          ...act,
          participationModes: ['individual', 'couple', 'remote_sync', 'pass_device'],
          status: 'published',
          scheduledAt: null,
          sourceImportId: null,
          createdBy: actorUid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        created++;
      }
    }
    if (created > 0) {
      await batch.commit();
      await logAdminOperation({
        actorUid,
        actorRole,
        action: 'SEED_STARTER_ACTIVITIES',
        targetCollection: 'activities',
        targetId: 'starter_batch',
        summary: `Seeded ${created} starter foundation activities.`,
      });
    }
    return created;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'activities_starter_seed');
  }
}

export interface AdminDashboardMetrics {
  usersCount: number;
  couplesCount: number;
  publishedActivitiesCount: number;
  draftActivitiesCount: number;
  activeUniversesCount: number;
  importsCount: number;
  recentLogs: AdminAuditLog[];
}

export async function fetchAdminDashboardMetrics(): Promise<AdminDashboardMetrics> {
  try {
    const [
      usersCountSnap,
      couplesCountSnap,
      publishedCountSnap,
      draftCountSnap,
      activeUnivSnap,
      importsCountSnap,
      logsSnap,
    ] = await Promise.all([
      getCountFromServer(collection(db, 'users')),
      getCountFromServer(collection(db, 'couples')),
      getCountFromServer(query(collection(db, 'activities'), where('status', '==', 'published'))),
      getCountFromServer(query(collection(db, 'activities'), where('status', '==', 'draft'))),
      getCountFromServer(query(collection(db, 'universes'), where('isActive', '==', true))),
      getCountFromServer(collection(db, 'imports')),
      getDocs(query(collection(db, 'admin_logs'), orderBy('createdAt', 'desc'), limit(20))),
    ]);

    return {
      usersCount: usersCountSnap.data().count,
      couplesCount: couplesCountSnap.data().count,
      publishedActivitiesCount: publishedCountSnap.data().count,
      draftActivitiesCount: draftCountSnap.data().count,
      activeUniversesCount: activeUnivSnap.data().count,
      importsCount: importsCountSnap.data().count,
      recentLogs: logsSnap.docs.map((d) => d.data() as AdminAuditLog),
    };
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'admin_dashboard_metrics');
  }
}

export async function fetchAllActivitiesForAdmin(): Promise<Activity[]> {
  try {
    const snap = await getDocs(query(collection(db, 'activities'), orderBy('updatedAt', 'desc')));
    return snap.docs.map((d) => d.data() as Activity);
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'activities');
  }
}

export async function upsertActivity(params: {
  activity: Partial<Activity> & {
    universeId: string;
    formatId: string;
    type: ActivityType;
    titleFr: string;
    titleEn: string;
    bodyFr: string;
    bodyEn: string;
    intimacyLevel: number;
    durationMinutes: number;
    status: PublicationStatus;
  };
  actorUid: string;
  actorRole: string;
}): Promise<string> {
  const id = params.activity.id || makeSafeId('act');
  const ref = doc(db, 'activities', id);
  try {
    const existing = await getDoc(ref);
    const contentHash = normalizeHashClient(
      `${params.activity.titleFr} ${params.activity.bodyFr}`
    );

    const cleanClassification: AdultClassification =
      params.activity.adultClassification || 'general';
    let cleanSpaces: MediaSpace[] =
      params.activity.allowedSpaces || ['universes', 'couple_space', 'individual_space'];
    if (cleanClassification === 'explicit') {
      cleanSpaces = cleanSpaces.filter((s) => s !== 'public_landing');
    }

    if (!existing.exists()) {
      await setDoc(ref, {
        id,
        universeId: params.activity.universeId,
        formatId: params.activity.formatId,
        type: params.activity.type,
        titleFr: params.activity.titleFr.slice(0, 300),
        titleEn: params.activity.titleEn.slice(0, 300),
        bodyFr: params.activity.bodyFr.slice(0, 5000),
        bodyEn: params.activity.bodyEn.slice(0, 5000),
        instructionsFr: (params.activity.instructionsFr || '').slice(0, 2000),
        instructionsEn: (params.activity.instructionsEn || '').slice(0, 2000),
        intimacyLevel: Math.min(5, Math.max(1, params.activity.intimacyLevel)),
        durationMinutes: Math.min(240, Math.max(1, params.activity.durationMinutes)),
        participationModes: params.activity.participationModes || ['individual', 'couple', 'remote_sync', 'pass_device'],
        status: params.activity.status,
        scheduledAt: params.activity.scheduledAt || null,
        adultClassification: cleanClassification,
        allowedSpaces: cleanSpaces,
        mediaId: params.activity.mediaId || null,
        contentHash,
        sourceImportId: params.activity.sourceImportId || null,
        createdBy: params.actorUid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(ref, {
        universeId: params.activity.universeId,
        formatId: params.activity.formatId,
        type: params.activity.type,
        titleFr: params.activity.titleFr.slice(0, 300),
        titleEn: params.activity.titleEn.slice(0, 300),
        bodyFr: params.activity.bodyFr.slice(0, 5000),
        bodyEn: params.activity.bodyEn.slice(0, 5000),
        instructionsFr: (params.activity.instructionsFr || '').slice(0, 2000),
        instructionsEn: (params.activity.instructionsEn || '').slice(0, 2000),
        intimacyLevel: Math.min(5, Math.max(1, params.activity.intimacyLevel)),
        durationMinutes: Math.min(240, Math.max(1, params.activity.durationMinutes)),
        status: params.activity.status,
        adultClassification: cleanClassification,
        allowedSpaces: cleanSpaces,
        mediaId: params.activity.mediaId || null,
        contentHash,
        updatedAt: serverTimestamp(),
      });
    }

    await logAdminOperation({
      actorUid: params.actorUid,
      actorRole: params.actorRole,
      action: existing.exists() ? 'UPDATE_ACTIVITY' : 'CREATE_ACTIVITY',
      targetCollection: 'activities',
      targetId: id,
      summary: `${existing.exists() ? 'Updated' : 'Created'} ${params.activity.type} "${params.activity.titleFr.slice(0, 80)}" (${params.activity.status})`,
    });
    return id;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `activities/${id}`);
  }
}

export async function removeActivity(
  id: string,
  actorUid: string,
  actorRole: string
): Promise<void> {
  try {
    await deleteDoc(doc(db, 'activities', id));
    await logAdminOperation({
      actorUid,
      actorRole,
      action: 'DELETE_ACTIVITY',
      targetCollection: 'activities',
      targetId: id,
      summary: `Permanently deleted activity ${id}.`,
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `activities/${id}`);
  }
}

export async function updateUniverseAdmin(
  universe: Universe,
  actorUid: string,
  actorRole: string
): Promise<void> {
  try {
    await setDoc(doc(db, 'universes', universe.id), {
      id: universe.id,
      slug: universe.slug,
      order: universe.order,
      category: universe.category,
      titleFr: universe.titleFr.slice(0, 160),
      titleEn: universe.titleEn.slice(0, 160),
      descriptionFr: universe.descriptionFr.slice(0, 1000),
      descriptionEn: universe.descriptionEn.slice(0, 1000),
      isActive: universe.isActive,
      formatsCount: universe.formatsCount ?? 5,
      updatedAt: serverTimestamp(),
    });
    await logAdminOperation({
      actorUid,
      actorRole,
      action: 'UPDATE_UNIVERSE',
      targetCollection: 'universes',
      targetId: universe.id,
      summary: `Updated universe ${universe.titleFr} (active=${String(universe.isActive)})`,
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `universes/${universe.id}`);
  }
}

export async function updateFormatAdmin(
  format: ActivityFormat,
  actorUid: string,
  actorRole: string
): Promise<void> {
  try {
    await setDoc(doc(db, 'formats', format.id), {
      id: format.id,
      universeId: format.universeId,
      order: format.order,
      slug: format.slug,
      titleFr: format.titleFr.slice(0, 160),
      titleEn: format.titleEn.slice(0, 160),
      descriptionFr: format.descriptionFr.slice(0, 1000),
      descriptionEn: format.descriptionEn.slice(0, 1000),
      participationModes: format.participationModes || ['individual', 'couple', 'remote_sync', 'pass_device'],
      isActive: format.isActive,
      updatedAt: serverTimestamp(),
    });
    await logAdminOperation({
      actorUid,
      actorRole,
      action: 'UPDATE_FORMAT',
      targetCollection: 'formats',
      targetId: format.id,
      summary: `Updated format ${format.titleFr} (active=${String(format.isActive)})`,
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `formats/${format.id}`);
  }
}

export async function fetchAdminUsersList(): Promise<UserPublicProfile[]> {
  try {
    const snap = await getDocs(query(collection(db, 'users'), orderBy('createdAt', 'desc'), limit(100)));
    return snap.docs.map((d) => d.data() as UserPublicProfile);
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'users');
  }
}

export async function fetchAdminCouplesList(): Promise<Couple[]> {
  try {
    const snap = await getDocs(query(collection(db, 'couples'), orderBy('createdAt', 'desc'), limit(100)));
    return snap.docs.map((d) => d.data() as Couple);
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'couples');
  }
}

export async function fetchAdminRolesList(): Promise<AdminRoleRecord[]> {
  try {
    const snap = await getDocs(collection(db, 'admins'));
    return snap.docs.map((d) => d.data() as AdminRoleRecord);
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'admins');
  }
}

export async function assignStaffRole(params: {
  targetUid: string;
  targetEmail: string;
  displayName: string;
  role: UserRole;
  actorUid: string;
  actorRole: string;
}): Promise<void> {
  try {
    const batch = writeBatch(db);
    batch.update(doc(db, 'users', params.targetUid), {
      role: params.role,
      updatedAt: serverTimestamp(),
    });

    if (params.role === 'user') {
      batch.delete(doc(db, 'admins', params.targetUid));
    } else {
      batch.set(doc(db, 'admins', params.targetUid), {
        uid: params.targetUid,
        email: params.targetEmail.slice(0, 254),
        displayName: params.displayName.slice(0, 100),
        role: params.role,
        grantedBy: params.actorUid,
        mfaVerified: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    await batch.commit();
    await logAdminOperation({
      actorUid: params.actorUid,
      actorRole: params.actorRole,
      action: 'ASSIGN_ROLE',
      targetCollection: 'admins',
      targetId: params.targetUid,
      summary: `Assigned role ${params.role} to ${params.targetEmail}`,
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `admins/${params.targetUid}`);
  }
}

export async function fetchSiteSettings(): Promise<SiteSetting> {
  try {
    const snap = await getDoc(doc(db, 'site_settings', 'public'));
    if (!snap.exists()) {
      return {
        id: 'public',
        defaultLang: 'fr',
        monetizationEnabled: false,
        remoteSyncEnabled: true,
        maintenanceMode: false,
        brandTaglineFr: 'Découvrez-vous autrement.',
        brandTaglineEn: 'A private world for two.',
      };
    }
    return snap.data() as SiteSetting;
  } catch {
    return {
      id: 'public',
      defaultLang: 'fr',
      monetizationEnabled: false,
      remoteSyncEnabled: true,
      maintenanceMode: false,
      brandTaglineFr: 'Découvrez-vous autrement.',
      brandTaglineEn: 'A private world for two.',
    };
  }
}

export async function saveSiteSettings(
  settings: SiteSetting,
  actorUid: string,
  actorRole: string
): Promise<void> {
  try {
    await setDoc(doc(db, 'site_settings', 'public'), {
      id: 'public',
      defaultLang: settings.defaultLang,
      monetizationEnabled: Boolean(settings.monetizationEnabled),
      remoteSyncEnabled: Boolean(settings.remoteSyncEnabled),
      maintenanceMode: Boolean(settings.maintenanceMode),
      brandTaglineFr: (settings.brandTaglineFr || 'Découvrez-vous autrement.').slice(0, 200),
      brandTaglineEn: (settings.brandTaglineEn || 'A private world for two.').slice(0, 200),
      updatedAt: serverTimestamp(),
    });
    await logAdminOperation({
      actorUid,
      actorRole,
      action: 'UPDATE_SITE_SETTINGS',
      targetCollection: 'site_settings',
      targetId: 'public',
      summary: `Updated general settings (defaultLang=${settings.defaultLang}, remoteSync=${String(settings.remoteSyncEnabled)})`,
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'site_settings/public');
  }
}

// ---------------------------------------------------------------------------
// Deterministic Document Import Persistence Services (No AI)
// ---------------------------------------------------------------------------
export async function createImportJobWithItems(params: {
  fileName: string;
  mimeType: string;
  fileSize: number;
  serverFileId: string;
  requiresOcr: boolean;
  warnings: string[];
  blocks: Array<{
    order: number;
    detectedKind: ImportExtractedItem['detectedKind'];
    assignedType: ImportExtractedItem['assignedType'];
    title: string;
    body: string;
    contentHash: string;
  }>;
  actorUid: string;
  actorRole: string;
}): Promise<{ importDoc: DocumentImport; items: ImportExtractedItem[] }> {
  const importId = makeSafeId('docimp');

  try {
    // Check existing activities for duplicate contentHash matches (without auto-deleting)
    const existingActivities = await fetchAllActivitiesForAdmin();
    const hashToActivityId = new Map<string, string>();
    for (const act of existingActivities) {
      hashToActivityId.set(act.contentHash, act.id);
      hashToActivityId.set(normalizeHashClient(`${act.titleFr} ${act.bodyFr}`), act.id);
    }

    let duplicateCount = 0;
    const preparedItems: ImportExtractedItem[] = params.blocks.map((blk, idx) => {
      const clientHash = normalizeHashClient(`${blk.title} ${blk.body}`);
      const dupId =
        hashToActivityId.get(blk.contentHash) || hashToActivityId.get(clientHash) || null;
      if (dupId) duplicateCount++;

      return {
        id: `item_${String(idx).padStart(4, '0')}`,
        importId,
        order: blk.order,
        detectedKind: blk.detectedKind,
        assignedType: blk.assignedType,
        universeId: 'decouverte',
        formatId: 'decouverte__premiers-eclairages',
        title: blk.title.slice(0, 300),
        body: blk.body.slice(0, 5000),
        contentHash: blk.contentHash,
        reviewState: blk.assignedType === 'ignore' ? 'rejected' : 'pending',
        isDuplicate: Boolean(dupId),
        duplicateActivityId: dupId,
        publishedActivityId: null,
      };
    });

    await setDoc(doc(db, 'imports', importId), {
      id: importId,
      fileName: params.fileName.slice(0, 255),
      mimeType: params.mimeType.slice(0, 160),
      fileSize: params.fileSize,
      serverFileId: params.serverFileId,
      status: 'in_review',
      totalExtracted: preparedItems.length,
      acceptedCount: 0,
      rejectedCount: preparedItems.filter((i) => i.reviewState === 'rejected').length,
      duplicateCount,
      requiresOcr: params.requiresOcr,
      errors: params.warnings.slice(0, 50),
      createdBy: params.actorUid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    // Write items in batches of 400
    for (let i = 0; i < preparedItems.length; i += 400) {
      const batch = writeBatch(db);
      for (const item of preparedItems.slice(i, i + 400)) {
        batch.set(doc(db, 'imports', importId, 'items', item.id), {
          ...item,
          updatedAt: serverTimestamp(),
        });
      }
      await batch.commit();
    }

    await logAdminOperation({
      actorUid: params.actorUid,
      actorRole: params.actorRole,
      action: 'CREATE_DOCUMENT_IMPORT',
      targetCollection: 'imports',
      targetId: importId,
      summary: `Extracted ${preparedItems.length} blocks deterministically from ${params.fileName} (${duplicateCount} potential duplicates).`,
    });

    const freshSnap = await getDoc(doc(db, 'imports', importId));
    return {
      importDoc: freshSnap.data() as DocumentImport,
      items: preparedItems,
    };
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `imports/${importId}`);
  }
}

export async function fetchDocumentImportsHistory(): Promise<DocumentImport[]> {
  try {
    const snap = await getDocs(query(collection(db, 'imports'), orderBy('createdAt', 'desc'), limit(50)));
    return snap.docs.map((d) => d.data() as DocumentImport);
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'imports');
  }
}

export async function fetchImportItems(importId: string): Promise<ImportExtractedItem[]> {
  try {
    const snap = await getDocs(
      query(collection(db, 'imports', importId, 'items'), orderBy('order', 'asc'))
    );
    return snap.docs.map((d) => d.data() as ImportExtractedItem);
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, `imports/${importId}/items`);
  }
}

export async function updateImportItemReview(
  importId: string,
  item: ImportExtractedItem
): Promise<void> {
  try {
    await updateDoc(doc(db, 'imports', importId, 'items', item.id), {
      assignedType: item.assignedType,
      universeId: item.universeId || null,
      formatId: item.formatId || null,
      title: item.title.slice(0, 300),
      body: item.body.slice(0, 5000),
      reviewState: item.reviewState,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `imports/${importId}/items/${item.id}`);
  }
}

export async function commitImportItemsToCatalog(params: {
  importDoc: DocumentImport;
  items: ImportExtractedItem[];
  targetStatus: 'draft' | 'published';
  actorUid: string;
  actorRole: string;
}): Promise<number> {
  const acceptedItems = params.items.filter(
    (item) => item.reviewState === 'accepted' && item.assignedType !== 'ignore'
  );
  if (acceptedItems.length === 0) return 0;

  try {
    let saved = 0;
    for (const item of acceptedItems) {
      const actId = makeSafeId('act');
      const universeId = item.universeId || 'decouverte';
      const formatId = item.formatId || `${universeId}__premiers-eclairages`;
      const type = item.assignedType === 'ignore' ? 'educational' : item.assignedType;

      await setDoc(doc(db, 'activities', actId), {
        id: actId,
        universeId,
        formatId,
        type,
        titleFr: item.title.slice(0, 300) || item.body.slice(0, 80),
        titleEn: item.title.slice(0, 300) || item.body.slice(0, 80),
        bodyFr: item.body.slice(0, 5000),
        bodyEn: item.body.slice(0, 5000),
        instructionsFr: '',
        instructionsEn: '',
        intimacyLevel: 2,
        durationMinutes: 10,
        participationModes: ['individual', 'couple', 'remote_sync', 'pass_device'],
        status: params.targetStatus,
        scheduledAt: null,
        contentHash: item.contentHash,
        sourceImportId: params.importDoc.id,
        createdBy: params.actorUid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      await updateDoc(doc(db, 'imports', params.importDoc.id, 'items', item.id), {
        reviewState: 'published',
        publishedActivityId: actId,
        updatedAt: serverTimestamp(),
      });
      saved++;
    }

    const rejectedCount = params.items.filter((i) => i.reviewState === 'rejected').length;
    await updateDoc(doc(db, 'imports', params.importDoc.id), {
      status: params.targetStatus === 'published' ? 'published' : 'partially_published',
      acceptedCount: saved,
      rejectedCount,
      updatedAt: serverTimestamp(),
    });

    await logAdminOperation({
      actorUid: params.actorUid,
      actorRole: params.actorRole,
      action: 'COMMIT_DOCUMENT_IMPORT',
      targetCollection: 'imports',
      targetId: params.importDoc.id,
      summary: `Committed ${saved} items as ${params.targetStatus} from ${params.importDoc.fileName}.`,
    });

    return saved;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `imports/${params.importDoc.id}`);
  }
}

export async function cancelImportJob(
  importId: string,
  actorUid: string,
  actorRole: string
): Promise<void> {
  try {
    await updateDoc(doc(db, 'imports', importId), {
      status: 'cancelled',
      updatedAt: serverTimestamp(),
    });
    await logAdminOperation({
      actorUid,
      actorRole,
      action: 'CANCEL_DOCUMENT_IMPORT',
      targetCollection: 'imports',
      targetId: importId,
      summary: `Cancelled import job ${importId} prior to publication.`,
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `imports/${importId}`);
  }
}

export type TimestampLike = Timestamp | { seconds: number } | null | undefined;

// ---------------------------------------------------------------------------
// Media Categories, Adult/Editorial Media Assets & Homepage CMS Services
// ---------------------------------------------------------------------------
export async function fetchMediaCategories(): Promise<MediaCategory[]> {
  try {
    const snap = await getDocs(query(collection(db, 'media_categories'), orderBy('order', 'asc')));
    if (snap.empty) {
      return DEFAULT_MEDIA_CATEGORIES as MediaCategory[];
    }
    return snap.docs.map((d) => d.data() as MediaCategory);
  } catch {
    return DEFAULT_MEDIA_CATEGORIES as MediaCategory[];
  }
}

export async function seedDefaultMediaCategories(
  actorUid: string,
  actorRole: string
): Promise<void> {
  try {
    const batch = writeBatch(db);
    for (const cat of DEFAULT_MEDIA_CATEGORIES) {
      batch.set(doc(db, 'media_categories', cat.id), {
        ...cat,
        updatedAt: serverTimestamp(),
      });
    }
    await batch.commit();
    await logAdminOperation({
      actorUid,
      actorRole,
      action: 'SEED_MEDIA_CATEGORIES',
      targetCollection: 'media_categories',
      targetId: 'defaults',
      summary: 'Seeded default NOCTA media categories.',
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'media_categories');
  }
}

export async function upsertMediaCategory(params: {
  category: Omit<MediaCategory, 'updatedAt'>;
  actorUid: string;
  actorRole: string;
}): Promise<void> {
  const cleanId = params.category.id || makeSafeId('cat');
  const cleanSlug =
    params.category.slug
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '-')
      .slice(0, 80) || cleanId;
  try {
    await setDoc(doc(db, 'media_categories', cleanId), {
      id: cleanId,
      slug: cleanSlug,
      labelFr: params.category.labelFr.trim().slice(0, 120),
      labelEn: params.category.labelEn.trim().slice(0, 120),
      order: Math.max(0, Math.min(200, params.category.order)),
      isSystem: Boolean(params.category.isSystem),
      updatedAt: serverTimestamp(),
    });
    await logAdminOperation({
      actorUid: params.actorUid,
      actorRole: params.actorRole,
      action: 'UPSERT_MEDIA_CATEGORY',
      targetCollection: 'media_categories',
      targetId: cleanId,
      summary: `Saved media category ${params.category.labelFr} / ${params.category.labelEn}`,
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `media_categories/${cleanId}`);
  }
}

export async function deleteMediaCategory(
  categoryId: string,
  actorUid: string,
  actorRole: string
): Promise<void> {
  try {
    await deleteDoc(doc(db, 'media_categories', categoryId));
    await logAdminOperation({
      actorUid,
      actorRole,
      action: 'DELETE_MEDIA_CATEGORY',
      targetCollection: 'media_categories',
      targetId: categoryId,
      summary: `Deleted media category ${categoryId}`,
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `media_categories/${categoryId}`);
  }
}

function computePublicLandingSafe(
  status: MediaPublicationStatus,
  classification: AdultClassification,
  allowedSpaces: MediaSpace[]
): boolean {
  return status === 'published' && classification !== 'explicit' && allowedSpaces.includes('public_landing');
}

function sanitizeAllowedSpaces(
  classification: AdultClassification,
  spaces: MediaSpace[]
): MediaSpace[] {
  const unique = Array.from(new Set(spaces));
  if (classification === 'explicit') {
    return unique.filter((s) => s !== 'public_landing');
  }
  return unique;
}

export async function syncMediaVisibilityToServer(params: {
  idToken: string;
  fileId: string;
  status: MediaPublicationStatus;
  adultClassification: AdultClassification;
  allowedSpaces: MediaSpace[];
}): Promise<void> {
  await fetch(`/api/media/visibility/${encodeURIComponent(params.fileId)}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${params.idToken}`,
    },
    body: JSON.stringify({
      status: params.status,
      adultClassification: params.adultClassification,
      allowedSpaces: params.allowedSpaces,
    }),
  });
}

export async function fetchAllMediaAssetsForAdmin(): Promise<MediaAsset[]> {
  try {
    const snap = await getDocs(query(collection(db, 'media_assets'), orderBy('displayOrder', 'asc')));
    return snap.docs.map((d) => d.data() as MediaAsset);
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'media_assets');
  }
}

export async function fetchPublicLandingMedia(): Promise<MediaAsset[]> {
  try {
    const snap = await getDocs(
      query(collection(db, 'media_assets'), where('publicLandingSafe', '==', true))
    );
    return snap.docs
      .map((d) => d.data() as MediaAsset)
      .filter((m) => m.adultClassification !== 'explicit' && m.status === 'published')
      .sort((a, b) => a.displayOrder - b.displayOrder);
  } catch {
    return [];
  }
}

export async function fetchPublishedMemberMedia(): Promise<MediaAsset[]> {
  try {
    const snap = await getDocs(
      query(collection(db, 'media_assets'), where('status', '==', 'published'))
    );
    return snap.docs
      .map((d) => d.data() as MediaAsset)
      .sort((a, b) => a.displayOrder - b.displayOrder);
  } catch {
    return [];
  }
}

export async function createMediaAssetDoc(params: {
  fileId: string;
  titleFr: string;
  titleEn: string;
  descriptionFr?: string;
  descriptionEn?: string;
  keywords?: string[];
  categoryId: string;
  collectionName?: string;
  universeId?: string | null;
  formatId?: string | null;
  activityId?: string | null;
  role: MediaRole;
  focalPoint: FocalPoint;
  displayOrder: number;
  adultClassification: AdultClassification;
  allowedSpaces: MediaSpace[];
  status: MediaPublicationStatus;
  mimeType?: string;
  fileSize?: number;
  actorUid: string;
  actorRole: string;
  idToken: string;
}): Promise<MediaAsset> {
  // Use fileId as mediaId so server public verification checks match directly
  const id = params.fileId;
  const cleanSpaces = sanitizeAllowedSpaces(params.adultClassification, params.allowedSpaces);
  const publicLandingSafe = computePublicLandingSafe(
    params.status,
    params.adultClassification,
    cleanSpaces
  );

  try {
    await setDoc(doc(db, 'media_assets', id), {
      id,
      fileId: params.fileId,
      titleFr: (params.titleFr || 'Média NOCTA').trim().slice(0, 200),
      titleEn: (params.titleEn || params.titleFr || 'NOCTA Media').trim().slice(0, 200),
      descriptionFr: (params.descriptionFr || '').trim().slice(0, 1000),
      descriptionEn: (params.descriptionEn || '').trim().slice(0, 1000),
      keywords: (params.keywords || []).map((k) => k.trim().slice(0, 60)).filter(Boolean).slice(0, 30),
      categoryId: params.categoryId || 'cat_autres',
      collectionName: (params.collectionName || '').trim().slice(0, 120),
      universeId: params.universeId || null,
      formatId: params.formatId || null,
      activityId: params.activityId || null,
      role: params.role,
      focalPoint: params.focalPoint,
      displayOrder: Math.max(0, Math.min(10000, Math.round(params.displayOrder))),
      adultClassification: params.adultClassification,
      allowedSpaces: cleanSpaces,
      publicLandingSafe,
      status: params.status,
      mimeType: (params.mimeType || 'image/jpeg').slice(0, 120),
      fileSize: Math.max(0, Math.round(params.fileSize || 0)),
      createdBy: params.actorUid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    await syncMediaVisibilityToServer({
      idToken: params.idToken,
      fileId: params.fileId,
      status: params.status,
      adultClassification: params.adultClassification,
      allowedSpaces: cleanSpaces,
    });

    await logAdminOperation({
      actorUid: params.actorUid,
      actorRole: params.actorRole,
      action: 'CREATE_MEDIA_ASSET',
      targetCollection: 'media_assets',
      targetId: id,
      summary: `Created media asset "${params.titleFr.slice(0, 60)}" (${params.adultClassification}, ${params.status}).`,
    });

    const snap = await getDoc(doc(db, 'media_assets', id));
    return snap.data() as MediaAsset;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `media_assets/${id}`);
  }
}

export async function updateMediaAssetDoc(params: {
  media: MediaAsset;
  actorUid: string;
  actorRole: string;
  idToken: string;
}): Promise<void> {
  const m = params.media;
  const cleanSpaces = sanitizeAllowedSpaces(m.adultClassification, m.allowedSpaces);
  const publicLandingSafe = computePublicLandingSafe(m.status, m.adultClassification, cleanSpaces);

  try {
    await updateDoc(doc(db, 'media_assets', m.id), {
      titleFr: (m.titleFr || 'Média NOCTA').trim().slice(0, 200),
      titleEn: (m.titleEn || m.titleFr || 'NOCTA Media').trim().slice(0, 200),
      descriptionFr: (m.descriptionFr || '').trim().slice(0, 1000),
      descriptionEn: (m.descriptionEn || '').trim().slice(0, 1000),
      keywords: (m.keywords || []).map((k) => k.trim().slice(0, 60)).filter(Boolean).slice(0, 30),
      categoryId: m.categoryId || 'cat_autres',
      collectionName: (m.collectionName || '').trim().slice(0, 120),
      universeId: m.universeId || null,
      formatId: m.formatId || null,
      activityId: m.activityId || null,
      role: m.role,
      focalPoint: m.focalPoint,
      displayOrder: Math.max(0, Math.min(10000, Math.round(m.displayOrder))),
      adultClassification: m.adultClassification,
      allowedSpaces: cleanSpaces,
      publicLandingSafe,
      status: m.status,
      mimeType: (m.mimeType || 'image/jpeg').slice(0, 120),
      fileSize: Math.max(0, Math.round(m.fileSize || 0)),
      updatedAt: serverTimestamp(),
    });

    await syncMediaVisibilityToServer({
      idToken: params.idToken,
      fileId: m.fileId,
      status: m.status,
      adultClassification: m.adultClassification,
      allowedSpaces: cleanSpaces,
    });

    await logAdminOperation({
      actorUid: params.actorUid,
      actorRole: params.actorRole,
      action: 'UPDATE_MEDIA_ASSET',
      targetCollection: 'media_assets',
      targetId: m.id,
      summary: `Updated media "${m.titleFr.slice(0, 60)}" (${m.adultClassification}, ${m.status}).`,
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `media_assets/${m.id}`);
  }
}

export async function deleteMediaAssetFull(params: {
  mediaId: string;
  fileId: string;
  actorUid: string;
  actorRole: string;
  idToken: string;
}): Promise<void> {
  try {
    await fetch(`/api/media/file/${encodeURIComponent(params.fileId)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${params.idToken}` },
    });
    await deleteDoc(doc(db, 'media_assets', params.mediaId));
    await logAdminOperation({
      actorUid: params.actorUid,
      actorRole: params.actorRole,
      action: 'DELETE_MEDIA_ASSET',
      targetCollection: 'media_assets',
      targetId: params.mediaId,
      summary: `Permanently deleted media asset ${params.mediaId}.`,
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `media_assets/${params.mediaId}`);
  }
}

export function parseHomepageEditorial(docData?: EditorialConfigDoc | null): HomepageEditorialPayload {
  if (!docData?.payloadJson) return DEFAULT_HOMEPAGE_EDITORIAL;
  try {
    const parsed = JSON.parse(docData.payloadJson) as Partial<HomepageEditorialPayload>;
    return {
      ...DEFAULT_HOMEPAGE_EDITORIAL,
      ...parsed,
      visibleSections: {
        ...DEFAULT_HOMEPAGE_EDITORIAL.visibleSections,
        ...(parsed.visibleSections || {}),
      },
      sectionOrder:
        Array.isArray(parsed.sectionOrder) && parsed.sectionOrder.length > 0
          ? parsed.sectionOrder
          : DEFAULT_HOMEPAGE_EDITORIAL.sectionOrder,
      pillars:
        Array.isArray(parsed.pillars) && parsed.pillars.length > 0
          ? parsed.pillars
          : DEFAULT_HOMEPAGE_EDITORIAL.pillars,
    };
  } catch {
    return DEFAULT_HOMEPAGE_EDITORIAL;
  }
}

export async function fetchHomepageEditorial(
  target: 'homepage_published' | 'homepage_draft' = 'homepage_published'
): Promise<{ payload: HomepageEditorialPayload; version: number; exists: boolean }> {
  try {
    const snap = await getDoc(doc(db, 'editorial_config', target));
    if (!snap.exists()) {
      return { payload: DEFAULT_HOMEPAGE_EDITORIAL, version: 1, exists: false };
    }
    const data = snap.data() as EditorialConfigDoc;
    return {
      payload: parseHomepageEditorial(data),
      version: data.version || 1,
      exists: true,
    };
  } catch {
    return { payload: DEFAULT_HOMEPAGE_EDITORIAL, version: 1, exists: false };
  }
}

export async function saveHomepageEditorial(params: {
  target: 'homepage_draft' | 'homepage_published';
  payload: HomepageEditorialPayload;
  currentVersion?: number;
  actorUid: string;
  actorRole: string;
}): Promise<number> {
  const nextVersion = Math.max(1, (params.currentVersion || 0) + 1);
  try {
    await setDoc(doc(db, 'editorial_config', params.target), {
      id: params.target,
      payloadJson: JSON.stringify(params.payload),
      version: nextVersion,
      updatedBy: params.actorUid,
      updatedAt: serverTimestamp(),
    });
    await logAdminOperation({
      actorUid: params.actorUid,
      actorRole: params.actorRole,
      action:
        params.target === 'homepage_published'
          ? 'PUBLISH_HOMEPAGE_EDITORIAL'
          : 'SAVE_HOMEPAGE_DRAFT',
      targetCollection: 'editorial_config',
      targetId: params.target,
      summary: `Saved ${params.target} v${nextVersion}.`,
    });
    return nextVersion;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `editorial_config/${params.target}`);
  }
}

