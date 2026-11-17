import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import express, { type NextFunction, type Request, type Response } from 'express';
import multer from 'multer';
import { initializeApp as initializeAdminApp, getApps as getAdminApps } from 'firebase-admin/app';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';
import {
  extractDocxDeterministically,
  extractPdfDeterministically,
  validateFileMagicBytes,
} from './server/documentParser.ts';
import {
  PRIVATE_MEDIA_DIR,
  deleteStoredMediaFiles,
  findStoredMediaFile,
  generateMediaFileId,
  getCanonicalMime,
  isValidMediaId,
  loadMediaManifest,
  normalizeMediaExtension,
  upsertManifestEntry,
  validateImageMagicBytes,
  type MediaVisibilityEntry,
} from './server/mediaStorage.ts';

const firebaseConfigPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
const firebaseConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, 'utf-8')) as {
  projectId: string;
  firestoreDatabaseId: string;
};

if (getAdminApps().length === 0) {
  initializeAdminApp({
    projectId: firebaseConfig.projectId,
  });
}

const PRIVATE_IMPORT_DIR = path.resolve(process.cwd(), 'private_storage', 'imports');
const PRIVATE_AVATAR_DIR = path.resolve(process.cwd(), 'private_storage', 'avatars');
fs.mkdirSync(PRIVATE_IMPORT_DIR, { recursive: true });
fs.mkdirSync(PRIVATE_AVATAR_DIR, { recursive: true });

// Runtime one-time setup token (never hardcoded, printed only to server stdout if needed)
const SESSION_SECRET =
  process.env.NOCTA_SESSION_SECRET || crypto.randomBytes(32).toString('hex');
const BOOTSTRAP_SETUP_TOKEN =
  process.env.NOCTA_ADMIN_SETUP_TOKEN || crypto.randomBytes(18).toString('hex');

const BOOTSTRAP_OWNER_EMAIL = 'yombivictor@gmail.com';

const AVATAR_EXTENSIONS = ['.jpg', '.png', '.webp', '.avif'] as const;

function isValidUidParam(uid: string): boolean {
  return /^[a-zA-Z0-9_-]{1,128}$/.test(uid);
}

function findStoredAvatarFile(uid: string): { path: string; mimeType: string } | null {
  if (!isValidUidParam(uid)) return null;
  for (const ext of AVATAR_EXTENSIONS) {
    const candidate = path.join(PRIVATE_AVATAR_DIR, `${uid}${ext}`);
    if (fs.existsSync(candidate)) {
      return { path: candidate, mimeType: getCanonicalMime(ext) };
    }
  }
  return null;
}

function deleteStoredAvatarFiles(uid: string): void {
  if (!isValidUidParam(uid)) return;
  for (const ext of AVATAR_EXTENSIONS) {
    const candidate = path.join(PRIVATE_AVATAR_DIR, `${uid}${ext}`);
    if (fs.existsSync(candidate)) {
      fs.unlinkSync(candidate);
    }
  }
}

function createRateLimiter(windowMs: number, maxRequests: number) {
  const buckets = new Map<string, number[]>();
  return (req: Request, res: Response, next: NextFunction): void => {
    const now = Date.now();
    const key = `${req.ip || 'unknown'}:${req.path}`;
    const recent = (buckets.get(key) || []).filter((ts) => now - ts < windowMs);
    if (recent.length >= maxRequests) {
      res.status(429).json({
        error: 'RATE_LIMITED',
        message: 'Too many requests. Please wait before retrying.',
      });
      return;
    }
    recent.push(now);
    buckets.set(key, recent);
    if (buckets.size > 2000) {
      for (const [k, list] of buckets.entries()) {
        if (list.every((ts) => now - ts >= windowMs)) {
          buckets.delete(k);
        }
      }
    }
    next();
  };
}

const adminVerifyLimiter = createRateLimiter(15 * 60 * 1000, 30);
const authSessionLimiter = createRateLimiter(15 * 60 * 1000, 60);
const avatarLimiter = createRateLimiter(15 * 60 * 1000, 40);

interface AuthenticatedRequest extends Request {
  authUser?: {
    uid: string;
    email: string;
    emailVerified: boolean;
    idToken: string;
  };
  adminRole?: string;
}

function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  const result: Record<string, string> = {};
  if (!cookieHeader) return result;
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const val = decodeURIComponent(part.slice(idx + 1).trim());
    result[key] = val;
  }
  return result;
}

function signAdminSessionCookie(uid: string, role: string): string {
  const payload = Buffer.from(
    JSON.stringify({ uid, role, exp: Date.now() + 1000 * 60 * 60 * 12 })
  ).toString('base64url');
  const sig = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(payload)
    .digest('base64url');
  return `${payload}.${sig}`;
}

function verifyAdminSessionCookie(token: string | undefined): { uid: string; role: string } | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;
  const expectedSig = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(payload)
    .digest('base64url');
  if (sig.length !== expectedSig.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8')) as {
      uid: string;
      role: string;
      exp: number;
    };
    if (!parsed.uid || !parsed.role || parsed.exp < Date.now()) return null;
    return { uid: parsed.uid, role: parsed.role };
  } catch {
    return null;
  }
}

function signMediaSessionCookie(uid: string): string {
  const payload = Buffer.from(
    JSON.stringify({ uid, adultConfirmed: true, exp: Date.now() + 1000 * 60 * 60 * 12 })
  ).toString('base64url');
  const sig = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(`media:${payload}`)
    .digest('base64url');
  return `${payload}.${sig}`;
}

function verifyMediaSessionCookie(token: string | undefined): { uid: string; adultConfirmed: boolean } | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;
  const expectedSig = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(`media:${payload}`)
    .digest('base64url');
  if (sig.length !== expectedSig.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8')) as {
      uid: string;
      adultConfirmed: boolean;
      exp: number;
    };
    if (!parsed.uid || !parsed.adultConfirmed || parsed.exp < Date.now()) return null;
    return { uid: parsed.uid, adultConfirmed: true };
  } catch {
    return null;
  }
}

async function checkPublicMediaAllowedInFirestore(mediaId: string): Promise<boolean> {
  try {
    const url = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/${firebaseConfig.firestoreDatabaseId}/documents/media_assets/${encodeURIComponent(
      mediaId
    )}`;
    const resp = await fetch(url);
    if (!resp.ok) return false;
    const doc = (await resp.json()) as {
      fields?: {
        status?: { stringValue?: string };
        adultClassification?: { stringValue?: string };
      };
    };
    const status = doc.fields?.status?.stringValue;
    const classification = doc.fields?.adultClassification?.stringValue;
    return status === 'published' && classification !== 'explicit';
  } catch {
    return false;
  }
}

async function fetchUserAdminRoleFromFirestore(
  uid: string,
  idToken: string
): Promise<string | null> {
  try {
    const url = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/${firebaseConfig.firestoreDatabaseId}/documents/admins/${encodeURIComponent(
      uid
    )}`;
    const resp = await fetch(url, {
      headers: {
        Authorization: `Bearer ${idToken}`,
      },
    });
    if (!resp.ok) return null;
    const doc = (await resp.json()) as {
      fields?: {
        role?: { stringValue?: string };
      };
    };
    return doc.fields?.role?.stringValue || null;
  } catch {
    return null;
  }
}

async function requireFirebaseAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'AUTH_REQUIRED', message: 'Authentication token required.' });
    return;
  }
  const idToken = authHeader.slice(7).trim();
  try {
    const decoded = await getAdminAuth().verifyIdToken(idToken);
    req.authUser = {
      uid: decoded.uid,
      email: decoded.email || '',
      emailVerified: Boolean(decoded.email_verified),
      idToken,
    };
    next();
  } catch {
    res.status(401).json({ error: 'INVALID_TOKEN', message: 'Invalid or expired session token.' });
  }
}

async function requireAdminStaff(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!req.authUser) {
    res.status(401).json({ error: 'AUTH_REQUIRED' });
    return;
  }
  const role = await fetchUserAdminRoleFromFirestore(req.authUser.uid, req.authUser.idToken);
  const isBootstrap =
    req.authUser.emailVerified && req.authUser.email === BOOTSTRAP_OWNER_EMAIL;

  const effectiveRole = role || (isBootstrap ? 'super_admin' : null);
  if (
    !effectiveRole ||
    !['super_admin', 'admin', 'content_manager', 'moderator'].includes(effectiveRole)
  ) {
    res.status(403).json({
      error: 'FORBIDDEN_ADMIN',
      message: 'Administrative privileges required on server.',
    });
    return;
  }

  req.adminRole = effectiveRole;
  next();
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 15 * 1024 * 1024, // 15 MB strict limit
    files: 1,
  },
});

const mediaUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 15 * 1024 * 1024, // 15 MB per image
    files: 20, // Up to 20 images in a batch
  },
});

const avatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB max for profile photos
    files: 1,
  },
});

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  // Hardened HTTP response headers
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  // Health probe
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'nocta-server' });
  });

  // Server-side Admin Verification & Session Cookie Issuance
  app.post(
    '/api/admin/verify',
    adminVerifyLimiter,
    requireFirebaseAuth,
    async (req: AuthenticatedRequest, res: Response) => {
      if (!req.authUser) {
        res.status(401).json({ authorized: false });
        return;
      }

      const firestoreRole = await fetchUserAdminRoleFromFirestore(
        req.authUser.uid,
        req.authUser.idToken
      );
      const isBootstrap =
        req.authUser.emailVerified && req.authUser.email === BOOTSTRAP_OWNER_EMAIL;

      const role = firestoreRole || (isBootstrap ? 'super_admin' : null);
      if (!role) {
        res.status(403).json({
          authorized: false,
          canBootstrap: false,
          message: 'Account does not hold administrative privileges.',
        });
        return;
      }

      const signed = signAdminSessionCookie(req.authUser.uid, role);
      res.cookie('nocta_admin_session', signed, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 1000 * 60 * 60 * 12,
        path: '/',
      });

      res.json({
        authorized: true,
        role,
        isBootstrapOwner: isBootstrap,
        hasPersistedAdminRecord: Boolean(firestoreRole),
      });
    }
  );

  // Verify server-issued setup token (if an alternative super admin needs bootstrap)
  app.post(
    '/api/admin/verify-setup-token',
    adminVerifyLimiter,
    requireFirebaseAuth,
    (req: AuthenticatedRequest, res: Response) => {
      const provided = typeof req.body?.token === 'string' ? req.body.token.trim() : '';
      if (!provided || provided.length !== BOOTSTRAP_SETUP_TOKEN.length) {
        res.status(403).json({ valid: false });
        return;
      }
      const valid = crypto.timingSafeEqual(
        Buffer.from(provided),
        Buffer.from(BOOTSTRAP_SETUP_TOKEN)
      );
      if (!valid) {
        res.status(403).json({ valid: false });
        return;
      }
      res.json({ valid: true });
    }
  );

  app.post('/api/admin/logout', (_req, res) => {
    res.clearCookie('nocta_admin_session', { path: '/' });
    res.clearCookie('nocta_media_session', { path: '/' });
    res.json({ ok: true });
  });

  // Issue signed HttpOnly adult media session cookie for authenticated members
  app.post(
    '/api/media/session',
    authSessionLimiter,
    requireFirebaseAuth,
    (req: AuthenticatedRequest, res: Response) => {
      if (!req.authUser || !req.authUser.emailVerified) {
        res.status(403).json({ error: 'VERIFIED_ADULT_ACCOUNT_REQUIRED' });
        return;
      }
      const signed = signMediaSessionCookie(req.authUser.uid);
      res.cookie('nocta_media_session', signed, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 1000 * 60 * 60 * 12,
        path: '/',
      });
      res.json({ ok: true });
    }
  );

  // Private User Profile Avatar Upload / Fetch / Delete
  app.post(
    '/api/profile/avatar',
    avatarLimiter,
    requireFirebaseAuth,
    (req: AuthenticatedRequest, res: Response) => {
      if (!req.authUser || !req.authUser.emailVerified) {
        res.status(403).json({ error: 'VERIFIED_ADULT_ACCOUNT_REQUIRED' });
        return;
      }
      avatarUpload.single('avatar')(req, res, (uploadErr) => {
        if (uploadErr) {
          res.status(400).json({
            error: 'UPLOAD_REJECTED',
            message: uploadErr instanceof Error ? uploadErr.message : 'Avatar upload failed.',
          });
          return;
        }
        const file = req.file;
        if (!file) {
          res.status(400).json({ error: 'NO_FILE', message: 'No image file received.' });
          return;
        }
        const originalName = path.basename(file.originalname || 'avatar');
        const ext = normalizeMediaExtension(originalName, file.mimetype);
        if (!ext || !validateImageMagicBytes(file.buffer, ext)) {
          res.status(400).json({
            error: 'INVALID_IMAGE',
            message: 'Accepted formats: PNG, JPEG, WebP, AVIF.',
          });
          return;
        }
        const uid = req.authUser!.uid;
        deleteStoredAvatarFiles(uid);
        const targetPath = path.join(PRIVATE_AVATAR_DIR, `${uid}${ext}`);
        fs.writeFileSync(targetPath, file.buffer, { mode: 0o600 });
        res.json({
          ok: true,
          photoUrl: `/api/profile/avatar/${encodeURIComponent(uid)}?t=${Date.now()}`,
        });
      });
    }
  );

  app.get('/api/profile/avatar/:uid', avatarLimiter, (req: Request, res: Response) => {
    const uid = String(req.params.uid || '');
    if (!isValidUidParam(uid)) {
      res.status(400).json({ error: 'INVALID_UID' });
      return;
    }
    const cookies = parseCookies(req.headers.cookie);
    const adminSess = verifyAdminSessionCookie(cookies.nocta_admin_session);
    const mediaSess = verifyMediaSessionCookie(cookies.nocta_media_session);
    if (!adminSess && !mediaSess) {
      res.status(403).json({ error: 'SESSION_REQUIRED' });
      return;
    }
    const stored = findStoredAvatarFile(uid);
    if (!stored) {
      res.status(404).json({ error: 'AVATAR_NOT_FOUND' });
      return;
    }
    res.setHeader('Content-Type', stored.mimeType);
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.sendFile(stored.path);
  });

  app.delete(
    '/api/profile/avatar',
    avatarLimiter,
    requireFirebaseAuth,
    (req: AuthenticatedRequest, res: Response) => {
      if (!req.authUser) {
        res.status(401).json({ error: 'AUTH_REQUIRED' });
        return;
      }
      deleteStoredAvatarFiles(req.authUser.uid);
      res.json({ ok: true });
    }
  );

  // Upload single or multiple images to private server storage (content staff only)
  app.post(
    '/api/media/upload',
    requireFirebaseAuth,
    requireAdminStaff,
    (req: AuthenticatedRequest, res: Response) => {
      if (!['super_admin', 'admin', 'content_manager'].includes(req.adminRole || '')) {
        res.status(403).json({ error: 'FORBIDDEN_CONTENT_ROLE' });
        return;
      }

      mediaUpload.array('images', 20)(req, res, (uploadErr) => {
        if (uploadErr) {
          res.status(400).json({
            error: 'UPLOAD_REJECTED',
            message:
              uploadErr instanceof Error ? uploadErr.message : 'Image upload validation failed.',
          });
          return;
        }

        const files = (req.files as Express.Multer.File[] | undefined) || [];
        if (files.length === 0) {
          res.status(400).json({ error: 'NO_FILES', message: 'No image files received.' });
          return;
        }

        const uploaded: Array<{
          fileId: string;
          originalName: string;
          ext: string;
          mimeType: string;
          fileSize: number;
        }> = [];
        const rejected: Array<{ originalName: string; reason: string }> = [];

        for (const file of files) {
          const originalName = path.basename(file.originalname || 'image');
          const ext = normalizeMediaExtension(originalName, file.mimetype);
          if (!ext) {
            rejected.push({
              originalName,
              reason: 'Unsupported format. Accepted: PNG, JPEG, WebP, AVIF.',
            });
            continue;
          }

          if (!validateImageMagicBytes(file.buffer, ext)) {
            rejected.push({
              originalName,
              reason: 'Invalid image signature (magic bytes mismatch).',
            });
            continue;
          }

          const fileId = generateMediaFileId();
          const targetPath = path.join(PRIVATE_MEDIA_DIR, `${fileId}${ext}`);
          fs.writeFileSync(targetPath, file.buffer, { mode: 0o600 });

          const mimeType = getCanonicalMime(ext);
          upsertManifestEntry({
            fileId,
            ext,
            mimeType,
            fileSize: file.size,
            status: 'draft',
            adultClassification: 'general',
            allowedSpaces: ['universes', 'couple_space'],
            updatedAt: new Date().toISOString(),
          });

          uploaded.push({
            fileId,
            originalName,
            ext,
            mimeType,
            fileSize: file.size,
          });
        }

        if (uploaded.length === 0) {
          res.status(400).json({
            error: 'ALL_IMAGES_REJECTED',
            message: rejected[0]?.reason || 'All uploaded images failed validation.',
            rejected,
          });
          return;
        }

        res.json({ uploaded, rejected });
      });
    }
  );

  // Replace existing image file while preserving mediaId/fileId
  app.post(
    '/api/media/replace/:fileId',
    requireFirebaseAuth,
    requireAdminStaff,
    (req: AuthenticatedRequest, res: Response) => {
      if (!['super_admin', 'admin', 'content_manager'].includes(req.adminRole || '')) {
        res.status(403).json({ error: 'FORBIDDEN_CONTENT_ROLE' });
        return;
      }

      const fileId = String(req.params.fileId || '');
      if (!isValidMediaId(fileId)) {
        res.status(400).json({ error: 'INVALID_MEDIA_ID' });
        return;
      }

      mediaUpload.single('image')(req, res, (uploadErr) => {
        if (uploadErr) {
          res.status(400).json({
            error: 'UPLOAD_REJECTED',
            message: uploadErr instanceof Error ? uploadErr.message : 'Image upload failed.',
          });
          return;
        }

        const file = req.file;
        if (!file) {
          res.status(400).json({ error: 'NO_FILE', message: 'No replacement image received.' });
          return;
        }

        const originalName = path.basename(file.originalname || 'image');
        const ext = normalizeMediaExtension(originalName, file.mimetype);
        if (!ext || !validateImageMagicBytes(file.buffer, ext)) {
          res.status(400).json({
            error: 'INVALID_IMAGE',
            message: 'Invalid image format or corrupted file signature.',
          });
          return;
        }

        const existingManifest = loadMediaManifest()[fileId];
        deleteStoredMediaFiles(fileId);
        const targetPath = path.join(PRIVATE_MEDIA_DIR, `${fileId}${ext}`);
        fs.writeFileSync(targetPath, file.buffer, { mode: 0o600 });

        const mimeType = getCanonicalMime(ext);
        upsertManifestEntry({
          fileId,
          ext,
          mimeType,
          fileSize: file.size,
          status: existingManifest?.status || 'draft',
          adultClassification: existingManifest?.adultClassification || 'general',
          allowedSpaces: existingManifest?.allowedSpaces || ['universes', 'couple_space'],
          updatedAt: new Date().toISOString(),
        });

        res.json({
          fileId,
          ext,
          mimeType,
          fileSize: file.size,
        });
      });
    }
  );

  // Sync media publication & adult classification rules with server enforcement
  app.post(
    '/api/media/visibility/:fileId',
    requireFirebaseAuth,
    requireAdminStaff,
    (req: AuthenticatedRequest, res: Response) => {
      if (!['super_admin', 'admin', 'content_manager'].includes(req.adminRole || '')) {
        res.status(403).json({ error: 'FORBIDDEN_CONTENT_ROLE' });
        return;
      }
      const fileId = String(req.params.fileId || '');
      if (!isValidMediaId(fileId)) {
        res.status(400).json({ error: 'INVALID_MEDIA_ID' });
        return;
      }

      const stored = findStoredMediaFile(fileId);
      const manifest = loadMediaManifest();
      const prev = manifest[fileId];

      const status = ['draft', 'published', 'unpublished'].includes(req.body?.status)
        ? (req.body.status as MediaVisibilityEntry['status'])
        : 'draft';

      const adultClassification = [
        'general',
        'romantic',
        'sensual',
        'erotic',
        'explicit',
        'educational',
      ].includes(req.body?.adultClassification)
        ? (req.body.adultClassification as MediaVisibilityEntry['adultClassification'])
        : 'general';

      let allowedSpaces: string[] = Array.isArray(req.body?.allowedSpaces)
        ? req.body.allowedSpaces.filter((s: unknown): s is string => typeof s === 'string')
        : ['universes', 'couple_space'];

      // Strict Isolation: explicit content is NEVER allowed on public_landing
      if (adultClassification === 'explicit') {
        allowedSpaces = allowedSpaces.filter((s) => s !== 'public_landing');
      }

      const statSize = stored ? fs.statSync(stored.path).size : prev?.fileSize || 0;
      upsertManifestEntry({
        fileId,
        ext: stored?.ext || prev?.ext || '.jpg',
        mimeType: stored?.mimeType || prev?.mimeType || 'image/jpeg',
        fileSize: statSize,
        status,
        adultClassification,
        allowedSpaces,
        updatedAt: new Date().toISOString(),
      });

      res.json({ ok: true, fileId, status, adultClassification, allowedSpaces });
    }
  );

  // Securely serve private media according to admin session, adult session, or published public policy
  app.get('/api/media/file/:fileId', async (req: Request, res: Response) => {
    const fileId = String(req.params.fileId || '');
    if (!isValidMediaId(fileId)) {
      res.status(400).json({ error: 'INVALID_MEDIA_ID' });
      return;
    }

    const stored = findStoredMediaFile(fileId);
    if (!stored) {
      res.status(404).json({ error: 'MEDIA_NOT_FOUND' });
      return;
    }

    const cookies = parseCookies(req.headers.cookie);
    const adminSess = verifyAdminSessionCookie(cookies.nocta_admin_session);
    const mediaSess = verifyMediaSessionCookie(cookies.nocta_media_session);

    // Verified staff can preview all stored media (draft, unpublished, explicit) inside /admin
    if (adminSess) {
      res.setHeader('Content-Type', stored.mimeType);
      res.setHeader('Cache-Control', 'private, no-store');
      res.sendFile(stored.path);
      return;
    }

    const entry = loadMediaManifest()[fileId];

    // If manifest is present on disk, enforce strict publication + classification gate
    if (entry) {
      if (entry.status !== 'published') {
        res.status(403).json({ error: 'MEDIA_NOT_PUBLISHED' });
        return;
      }

      const isExplicit = entry.adultClassification === 'explicit';
      const isPublicLandingAllowed =
        !isExplicit && entry.allowedSpaces.includes('public_landing');

      if (isExplicit || !isPublicLandingAllowed) {
        if (!mediaSess || !mediaSess.adultConfirmed) {
          res.status(403).json({ error: 'ADULT_SESSION_REQUIRED' });
          return;
        }
      }

      res.setHeader('Content-Type', stored.mimeType);
      res.setHeader('Cache-Control', 'private, max-age=300');
      res.sendFile(stored.path);
      return;
    }

    // Fallback check against Firestore Rules if manifest absent (e.g. cold container)
    const publicAllowed = await checkPublicMediaAllowedInFirestore(fileId);
    if (publicAllowed) {
      res.setHeader('Content-Type', stored.mimeType);
      res.setHeader('Cache-Control', 'private, max-age=300');
      res.sendFile(stored.path);
      return;
    }

    res.status(403).json({ error: 'FORBIDDEN_MEDIA' });
  });

  // Delete image binary from private server storage (Admin / Super Admin)
  app.delete(
    '/api/media/file/:fileId',
    requireFirebaseAuth,
    requireAdminStaff,
    (req: AuthenticatedRequest, res: Response) => {
      if (!['super_admin', 'admin', 'content_manager'].includes(req.adminRole || '')) {
        res.status(403).json({ error: 'FORBIDDEN_CONTENT_ROLE' });
        return;
      }
      const fileId = String(req.params.fileId || '');
      if (!isValidMediaId(fileId)) {
        res.status(400).json({ error: 'INVALID_MEDIA_ID' });
        return;
      }
      deleteStoredMediaFiles(fileId);
      res.json({ ok: true, deleted: fileId });
    }
  );

  // Deterministic PDF / DOCX Document Import (NO AI)
  app.post(
    '/api/import/extract',
    requireFirebaseAuth,
    requireAdminStaff,
    (req: AuthenticatedRequest, res: Response) => {
      if (!['super_admin', 'admin', 'content_manager'].includes(req.adminRole || '')) {
        res.status(403).json({
          error: 'FORBIDDEN_CONTENT_ROLE',
          message: 'Content manager or administrator role required.',
        });
        return;
      }

      upload.single('document')(req, res, async (uploadErr) => {
        if (uploadErr) {
          res.status(400).json({
            error: 'UPLOAD_REJECTED',
            message:
              uploadErr instanceof Error ? uploadErr.message : 'File upload validation failed.',
          });
          return;
        }

        const file = req.file;
        if (!file) {
          res.status(400).json({ error: 'NO_FILE', message: 'No document uploaded.' });
          return;
        }

        const originalName = path.basename(file.originalname || 'document');
        const ext = path.extname(originalName).toLowerCase();
        const allowedPdfMimes = ['application/pdf', 'application/x-pdf'];
        const allowedDocxMimes = [
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/octet-stream',
        ];

        if (ext !== '.pdf' && ext !== '.docx') {
          res.status(400).json({
            error: 'INVALID_EXTENSION',
            message: 'Only .pdf and .docx files are accepted. Macro-enabled files are rejected.',
          });
          return;
        }

        if (ext === '.pdf' && !allowedPdfMimes.includes(file.mimetype)) {
          res.status(400).json({ error: 'INVALID_MIME', message: 'Invalid PDF MIME type.' });
          return;
        }

        if (ext === '.docx' && !allowedDocxMimes.includes(file.mimetype)) {
          res.status(400).json({ error: 'INVALID_MIME', message: 'Invalid DOCX MIME type.' });
          return;
        }

        if (!validateFileMagicBytes(file.buffer, ext)) {
          res.status(400).json({
            error: 'INVALID_MAGIC_BYTES',
            message: 'File signature does not match declared extension.',
          });
          return;
        }

        // Persist original document strictly in private server directory (never publicly served)
        const serverFileId = `imp_${crypto.randomUUID().replace(/-/g, '')}`;
        const safeFilename = `${serverFileId}${ext}`;
        const storagePath = path.join(PRIVATE_IMPORT_DIR, safeFilename);

        try {
          fs.writeFileSync(storagePath, file.buffer, { mode: 0o600 });

          const extraction =
            ext === '.pdf'
              ? await extractPdfDeterministically(file.buffer)
              : await extractDocxDeterministically(file.buffer);

          res.json({
            serverFileId,
            fileName: originalName,
            mimeType:
              ext === '.pdf'
                ? 'application/pdf'
                : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            fileSize: file.size,
            requiresOcr: extraction.requiresOcr,
            pageCount: extraction.pageCount,
            rawCharacterCount: extraction.rawCharacterCount,
            warnings: extraction.warnings,
            blocks: extraction.blocks,
          });
        } catch (err) {
          if (fs.existsSync(storagePath)) {
            fs.unlinkSync(storagePath);
          }
          res.status(500).json({
            error: 'EXTRACTION_FAILED',
            message: err instanceof Error ? err.message : 'Deterministic parsing failed.',
          });
        }
      });
    }
  );

  // Restricted Private Download of Original Imported File (Admin Staff Only)
  app.get(
    '/api/import/original/:serverFileId',
    requireFirebaseAuth,
    requireAdminStaff,
    (req: AuthenticatedRequest, res: Response) => {
      const serverFileId = String(req.params.serverFileId || '');
      if (!/^imp_[a-zA-Z0-9]+$/.test(serverFileId)) {
        res.status(400).json({ error: 'INVALID_FILE_ID' });
        return;
      }

      const pdfPath = path.join(PRIVATE_IMPORT_DIR, `${serverFileId}.pdf`);
      const docxPath = path.join(PRIVATE_IMPORT_DIR, `${serverFileId}.docx`);
      const targetPath = fs.existsSync(pdfPath)
        ? pdfPath
        : fs.existsSync(docxPath)
          ? docxPath
          : null;

      if (!targetPath) {
        res.status(404).json({ error: 'FILE_NOT_FOUND' });
        return;
      }

      res.download(targetPath);
    }
  );

  // Server-side guard metadata on /admin route requests
  app.use('/admin', (req: Request, res: Response, next: NextFunction) => {
    const cookies = parseCookies(req.headers.cookie);
    const session = verifyAdminSessionCookie(cookies.nocta_admin_session);
    res.setHeader('X-NOCTA-Admin-Session', session ? 'verified' : 'gate-required');
    res.setHeader('Cache-Control', 'no-store');
    next();
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  const port = Number(process.env.PORT || 3000);
  app.listen(port, '0.0.0.0', () => {
    console.log(`NOCTA server listening on http://0.0.0.0:${port}`);
    if (!process.env.NOCTA_ADMIN_SETUP_TOKEN) {
      console.log(`NOCTA one-time admin setup token (server-only): ${BOOTSTRAP_SETUP_TOKEN}`);
    }
  });
}

startServer().catch((err) => {
  console.error('Failed to start NOCTA server:', err);
  process.exit(1);
});
