import type { Timestamp } from 'firebase/firestore';

export type Language = 'fr' | 'en';

export type UserRole =
  | 'user'
  | 'moderator'
  | 'content_manager'
  | 'admin'
  | 'super_admin';

export type ParticipationMode =
  | 'individual'
  | 'couple'
  | 'remote_sync'
  | 'pass_device';

export type ActivityType =
  | 'question'
  | 'challenge'
  | 'scenario'
  | 'educational'
  | 'instruction';

export type PublicationStatus = 'draft' | 'scheduled' | 'published' | 'archived';

export type AdultClassification =
  | 'general'
  | 'romantic'
  | 'sensual'
  | 'erotic'
  | 'explicit'
  | 'educational';

export type MediaSpace =
  | 'public_landing'
  | 'universes'
  | 'couple_space'
  | 'individual_space'
  | 'education';

export type MediaRole =
  | 'banner'
  | 'primary'
  | 'secondary'
  | 'gallery'
  | 'universe_cover'
  | 'activity';

export type FocalPoint = 'center' | 'top' | 'bottom' | 'left' | 'right';

export type MediaPublicationStatus = 'draft' | 'published' | 'unpublished';

export type AccountStatus = 'active' | 'deactivated';

export interface UserPublicProfile {
  uid: string;
  displayName: string;
  firstName?: string;
  lastName?: string;
  photoUrl?: string | null;
  preferredLang: Language;
  coupleId?: string | null;
  role: UserRole;
  accountStatus?: AccountStatus;
  ageConfirmed: boolean;
  onboardingCompleted?: boolean;
  lastLoginAt?: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface UserPrivateInfo {
  uid: string;
  email?: string;
  ageConfirmedAt?: Timestamp;
  termsAcceptedAt?: Timestamp;
  privacyAcceptedAt?: Timestamp;
  boundaries?: string[];
  preferences?: string[];
  maxIntimacyLevel: number;
  discreetMode: boolean;
  mfaReminderEnabled?: boolean;
  updatedAt: Timestamp;
}

export interface AdminRoleRecord {
  uid: string;
  email: string;
  displayName?: string;
  role: Exclude<UserRole, 'user'>;
  grantedBy: string;
  mfaVerified?: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Couple {
  id: string;
  name: string;
  memberIds: string[];
  partnerAId: string;
  partnerBId?: string | null;
  status: 'pending' | 'active' | 'paused' | 'dissolved';
  activeMode: Exclude<ParticipationMode, 'individual'>;
  leftByUid?: string | null;
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface CoupleInvite {
  code: string;
  coupleId: string;
  inviterId: string;
  inviterName: string;
  inviteeEmail?: string | null;
  acceptedBy?: string | null;
  status: 'pending' | 'accepted' | 'declined' | 'revoked' | 'expired';
  expiresAt?: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface CoupleHistoryItem {
  activityId: string;
  universeId: string;
  formatId: string;
  status: 'presented' | 'completed' | 'skipped';
  mode: Exclude<ParticipationMode, 'individual'>;
  presentedBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface CoupleFavoriteItem {
  activityId: string;
  universeId: string;
  formatId: string;
  addedBy: string;
  replayCount: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface CoupleSession {
  id: string;
  mode: Exclude<ParticipationMode, 'individual'>;
  universeId: string;
  formatId: string;
  activityId: string;
  status: 'waiting' | 'active' | 'revealing' | 'completed' | 'aborted';
  currentTurnUid?: string | null;
  partnerAReady?: boolean;
  partnerBReady?: boolean;
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface IndividualLedgerItem {
  activityId: string;
  universeId: string;
  formatId: string;
  kind: 'history' | 'favorite';
  status: 'presented' | 'completed' | 'skipped' | 'saved';
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Universe {
  id: string;
  slug: string;
  order: number;
  category: string;
  titleFr: string;
  titleEn: string;
  descriptionFr: string;
  descriptionEn: string;
  isActive: boolean;
  formatsCount?: number;
  updatedAt?: Timestamp;
}

export interface ActivityFormat {
  id: string;
  universeId: string;
  order: number;
  slug: string;
  titleFr: string;
  titleEn: string;
  descriptionFr: string;
  descriptionEn: string;
  participationModes?: ParticipationMode[];
  isActive: boolean;
  updatedAt?: Timestamp;
}

export interface Activity {
  id: string;
  universeId: string;
  formatId: string;
  type: ActivityType;
  titleFr: string;
  titleEn: string;
  bodyFr: string;
  bodyEn: string;
  instructionsFr?: string;
  instructionsEn?: string;
  intimacyLevel: number;
  durationMinutes: number;
  participationModes?: ParticipationMode[];
  status: PublicationStatus;
  scheduledAt?: Timestamp | null;
  adultClassification?: AdultClassification;
  allowedSpaces?: MediaSpace[];
  mediaId?: string | null;
  contentHash: string;
  sourceImportId?: string | null;
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface DocumentImport {
  id: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  serverFileId: string;
  status: 'extracted' | 'in_review' | 'partially_published' | 'published' | 'cancelled';
  totalExtracted: number;
  acceptedCount: number;
  rejectedCount: number;
  duplicateCount: number;
  requiresOcr: boolean;
  errors?: string[];
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface ImportExtractedItem {
  id: string;
  importId: string;
  order: number;
  detectedKind:
    | 'heading'
    | 'subheading'
    | 'paragraph'
    | 'question'
    | 'answer'
    | 'list_item'
    | 'numbered_item'
    | 'instruction'
    | 'description';
  assignedType: ActivityType | 'ignore';
  universeId?: string | null;
  formatId?: string | null;
  title: string;
  body: string;
  contentHash: string;
  reviewState: 'pending' | 'accepted' | 'rejected' | 'published';
  isDuplicate: boolean;
  duplicateActivityId?: string | null;
  publishedActivityId?: string | null;
  updatedAt?: Timestamp;
}

export interface AdminAuditLog {
  id: string;
  actorUid: string;
  actorRole: string;
  action: string;
  targetCollection: string;
  targetId: string;
  summary: string;
  createdAt: Timestamp;
}

export interface SiteSetting {
  id: string;
  defaultLang: Language;
  monetizationEnabled: boolean;
  remoteSyncEnabled: boolean;
  maintenanceMode: boolean;
  brandTaglineFr?: string;
  brandTaglineEn?: string;
  updatedAt?: Timestamp;
}

export interface MediaCategory {
  id: string;
  slug: string;
  labelFr: string;
  labelEn: string;
  order: number;
  isSystem: boolean;
  updatedAt?: Timestamp;
}

export interface MediaAsset {
  id: string;
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
  publicLandingSafe: boolean;
  status: MediaPublicationStatus;
  mimeType?: string;
  fileSize?: number;
  createdBy: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export type EditorialSectionId =
  | 'hero'
  | 'editorial_spread'
  | 'pillars'
  | 'universes'
  | 'privacy';

export type EditorialLayoutVariant =
  | 'full_bleed'
  | 'editorial_split'
  | 'asymmetric_magazine';

export interface EditorialPillarItem {
  index: string;
  titleFr: string;
  titleEn: string;
  descFr: string;
  descEn: string;
}

export interface HomepageEditorialPayload {
  layoutVariant: EditorialLayoutVariant;
  sectionOrder: EditorialSectionId[];
  visibleSections: Record<EditorialSectionId, boolean>;
  heroPrimaryMediaId: string;
  heroFallbackUrl: string;
  heroFocalPoint: FocalPoint;
  heroTitleFr: string;
  heroTitleEn: string;
  heroSecondaryTaglineFr: string;
  heroSecondaryTaglineEn: string;
  heroSubtitleFr: string;
  heroSubtitleEn: string;
  heroPrimaryCtaFr: string;
  heroPrimaryCtaEn: string;
  heroPrimaryCtaLink: string;
  heroSecondaryCtaFr: string;
  heroSecondaryCtaEn: string;
  heroSecondaryCtaLink: string;
  heroExploreLinkFr: string;
  heroExploreLinkEn: string;
  spreadTitleFr: string;
  spreadTitleEn: string;
  spreadSubtitleFr: string;
  spreadSubtitleEn: string;
  spreadPrimaryMediaId: string;
  spreadPrimaryFallbackUrl: string;
  spreadPrimaryFocalPoint: FocalPoint;
  spreadSecondaryMediaId: string;
  spreadSecondaryFallbackUrl: string;
  spreadSecondaryFocalPoint: FocalPoint;
  pillars: EditorialPillarItem[];
  universesTitleFr: string;
  universesTitleEn: string;
  universesSubtitleFr: string;
  universesSubtitleEn: string;
  privacyTitleFr: string;
  privacyTitleEn: string;
  privacyBodyFr: string;
  privacyBodyEn: string;
  privacyPointsFr: string[];
  privacyPointsEn: string[];
  privacyMediaId: string;
  privacyFallbackUrl: string;
  privacyFocalPoint: FocalPoint;
}

export interface EditorialConfigDoc {
  id: 'homepage_draft' | 'homepage_published' | 'texts_draft' | 'texts_published';
  payloadJson: string;
  version: number;
  updatedBy: string;
  updatedAt?: Timestamp;
}
