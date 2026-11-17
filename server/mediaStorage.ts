import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const PRIVATE_MEDIA_DIR = path.resolve(process.cwd(), 'private_storage', 'media');
const MANIFEST_PATH = path.join(PRIVATE_MEDIA_DIR, '_manifest.json');

fs.mkdirSync(PRIVATE_MEDIA_DIR, { recursive: true });

export type MediaExtension = '.jpg' | '.jpeg' | '.png' | '.webp' | '.avif';

export interface MediaVisibilityEntry {
  fileId: string;
  ext: MediaExtension;
  mimeType: string;
  fileSize: number;
  status: 'draft' | 'published' | 'unpublished';
  adultClassification:
    | 'general'
    | 'romantic'
    | 'sensual'
    | 'erotic'
    | 'explicit'
    | 'educational';
  allowedSpaces: string[];
  updatedAt: string;
}

const ALLOWED_IMAGE_EXTS: MediaExtension[] = ['.jpg', '.jpeg', '.png', '.webp', '.avif'];

const EXT_TO_MIME: Record<MediaExtension, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
};

const ALLOWED_MIMES: Record<MediaExtension, string[]> = {
  '.jpg': ['image/jpeg', 'image/pjpeg'],
  '.jpeg': ['image/jpeg', 'image/pjpeg'],
  '.png': ['image/png'],
  '.webp': ['image/webp'],
  '.avif': ['image/avif'],
};

export function isValidMediaId(id: string): boolean {
  return /^med_[a-zA-Z0-9_]{8,64}$/.test(id);
}

export function normalizeMediaExtension(originalName: string, mimeType: string): MediaExtension | null {
  const ext = path.extname(path.basename(originalName || '')).toLowerCase() as MediaExtension;
  if (ALLOWED_IMAGE_EXTS.includes(ext)) {
    const allowedMimes = ALLOWED_MIMES[ext];
    if (allowedMimes.includes(mimeType) || mimeType === 'application/octet-stream') {
      return ext;
    }
    return null;
  }

  // Infer extension from MIME if filename lacked one
  if (mimeType === 'image/jpeg') return '.jpg';
  if (mimeType === 'image/png') return '.png';
  if (mimeType === 'image/webp') return '.webp';
  if (mimeType === 'image/avif') return '.avif';
  return null;
}

export function validateImageMagicBytes(buffer: Buffer, ext: MediaExtension): boolean {
  if (!buffer || buffer.length < 12) return false;

  if (ext === '.jpg' || ext === '.jpeg') {
    // JPEG starts with FF D8 FF
    return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }

  if (ext === '.png') {
    // PNG signature: 89 50 4E 47 0D 0A 1A 0A
    return (
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47 &&
      buffer[4] === 0x0d &&
      buffer[5] === 0x0a &&
      buffer[6] === 0x1a &&
      buffer[7] === 0x0a
    );
  }

  if (ext === '.webp') {
    // RIFF....WEBP
    const riff = buffer.subarray(0, 4).toString('ascii');
    const webp = buffer.subarray(8, 12).toString('ascii');
    return riff === 'RIFF' && webp === 'WEBP';
  }

  if (ext === '.avif') {
    // ISO Base Media File Format: ....ftypavif or ....ftypavis or ....ftypmif1
    const box = buffer.subarray(4, 12).toString('ascii');
    return box === 'ftypavif' || box === 'ftypavis' || box === 'ftypmif1';
  }

  return false;
}

export function loadMediaManifest(): Record<string, MediaVisibilityEntry> {
  try {
    if (!fs.existsSync(MANIFEST_PATH)) return {};
    const raw = fs.readFileSync(MANIFEST_PATH, 'utf-8');
    const parsed = JSON.parse(raw) as Record<string, MediaVisibilityEntry>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function saveMediaManifest(manifest: Record<string, MediaVisibilityEntry>): void {
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2), { mode: 0o600 });
}

export function upsertManifestEntry(entry: MediaVisibilityEntry): void {
  const manifest = loadMediaManifest();
  manifest[entry.fileId] = entry;
  saveMediaManifest(manifest);
}

export function removeManifestEntry(fileId: string): void {
  const manifest = loadMediaManifest();
  delete manifest[fileId];
  saveMediaManifest(manifest);
}

export function generateMediaFileId(): string {
  return `med_${crypto.randomUUID().replace(/-/g, '')}`;
}

export function getCanonicalMime(ext: MediaExtension): string {
  return EXT_TO_MIME[ext];
}

export function findStoredMediaFile(fileId: string): { path: string; ext: MediaExtension; mimeType: string } | null {
  if (!isValidMediaId(fileId)) return null;
  for (const ext of ALLOWED_IMAGE_EXTS) {
    const candidate = path.join(PRIVATE_MEDIA_DIR, `${fileId}${ext}`);
    if (fs.existsSync(candidate)) {
      return { path: candidate, ext, mimeType: EXT_TO_MIME[ext] };
    }
  }
  return null;
}

export function deleteStoredMediaFiles(fileId: string): boolean {
  if (!isValidMediaId(fileId)) return false;
  let removed = false;
  for (const ext of ALLOWED_IMAGE_EXTS) {
    const candidate = path.join(PRIVATE_MEDIA_DIR, `${fileId}${ext}`);
    if (fs.existsSync(candidate)) {
      fs.unlinkSync(candidate);
      removed = true;
    }
  }
  removeManifestEntry(fileId);
  return removed;
}
