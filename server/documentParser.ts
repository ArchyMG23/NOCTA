import crypto from 'node:crypto';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import mammoth from 'mammoth';

export type DetectedBlockKind =
  | 'heading'
  | 'subheading'
  | 'paragraph'
  | 'question'
  | 'answer'
  | 'list_item'
  | 'numbered_item'
  | 'instruction'
  | 'description';

export type SuggestedActivityType =
  | 'question'
  | 'challenge'
  | 'scenario'
  | 'educational'
  | 'instruction'
  | 'ignore';

export interface ExtractedBlock {
  order: number;
  detectedKind: DetectedBlockKind;
  assignedType: SuggestedActivityType;
  title: string;
  body: string;
  contentHash: string;
}

export interface DeterministicExtractionResult {
  requiresOcr: boolean;
  pageCount: number;
  rawCharacterCount: number;
  blocks: ExtractedBlock[];
  warnings: string[];
}

export function normalizeTextForHash(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function computeContentHash(title: string, body: string): string {
  const normalized = normalizeTextForHash(`${title} ${body}`);
  return crypto.createHash('sha256').update(normalized).digest('hex').slice(0, 32);
}

export function validateFileMagicBytes(buffer: Buffer, ext: '.pdf' | '.docx'): boolean {
  if (buffer.length < 5) return false;
  if (ext === '.pdf') {
    return buffer.subarray(0, 5).toString('ascii') === '%PDF-';
  }
  // DOCX is a ZIP container starting with PK\x03\x04
  return (
    buffer[0] === 0x50 &&
    buffer[1] === 0x4b &&
    buffer[2] === 0x03 &&
    buffer[3] === 0x04
  );
}

interface RawLine {
  text: string;
  isHeading?: boolean;
  isSubheading?: boolean;
  isListItem?: boolean;
  isNumbered?: boolean;
}

function classifyLinesDeterministically(lines: RawLine[]): ExtractedBlock[] {
  const blocks: ExtractedBlock[] = [];
  let currentHeading = '';
  let order = 0;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const clean = raw.text.replace(/\s+/g, ' ').trim();
    if (!clean || clean.length < 3) continue;

    // Skip pure page numbers like "1", "Page 2", "2 / 14"
    if (/^(page\s*)?\d+(\s*[/|]\s*\d+)?$/i.test(clean)) {
      continue;
    }

    let detectedKind: DetectedBlockKind = 'paragraph';
    let assignedType: SuggestedActivityType = 'educational';
    let title = '';
    let body = clean;

    const isUpperShort =
      clean.length <= 90 &&
      clean === clean.toUpperCase() &&
      /[A-ZÀ-ÖØ-Þ]/.test(clean) &&
      !clean.endsWith('?');

    if (raw.isHeading || isUpperShort) {
      detectedKind = 'heading';
      assignedType = 'ignore';
      currentHeading = clean;
      title = clean;
      body = clean;
    } else if (raw.isSubheading) {
      detectedKind = 'subheading';
      assignedType = 'ignore';
      currentHeading = clean;
      title = clean;
      body = clean;
    } else if (/^(réponse|reponse|answer)\s*[:\-]/i.test(clean)) {
      detectedKind = 'answer';
      assignedType = 'educational';
      title = currentHeading || 'Réponse / Answer';
    } else if (
      /^(consigne|règle|regle|instruction|durée|duree|étape|etape|rule|step)\s*[:\-]/i.test(clean)
    ) {
      detectedKind = 'instruction';
      assignedType = 'instruction';
      title = currentHeading || 'Consigne';
    } else if (
      clean.endsWith('?') ||
      /^(question|q\d*|q)\s*[:\-]/i.test(clean)
    ) {
      detectedKind = 'question';
      assignedType = 'question';
      title = currentHeading || clean.slice(0, 72);
    } else if (
      /^(défi|defi|challenge|action|mission)\s*[:\-]/i.test(clean)
    ) {
      detectedKind = 'instruction';
      assignedType = 'challenge';
      title = currentHeading || clean.slice(0, 72);
    } else if (
      /^(scénario|scenario|mise en scène|expérience|experience)\s*[:\-]/i.test(clean)
    ) {
      detectedKind = 'description';
      assignedType = 'scenario';
      title = currentHeading || clean.slice(0, 72);
    } else if (raw.isNumbered || /^\d+[.)]\s+/.test(clean)) {
      detectedKind = 'numbered_item';
      assignedType = clean.includes('?') ? 'question' : 'challenge';
      body = clean.replace(/^\d+[.)]\s+/, '').trim();
      title = currentHeading || body.slice(0, 72);
    } else if (raw.isListItem || /^[-•*▪◦]\s+/.test(clean)) {
      detectedKind = 'list_item';
      assignedType = clean.includes('?') ? 'question' : 'educational';
      body = clean.replace(/^[-•*▪◦]\s+/, '').trim();
      title = currentHeading || body.slice(0, 72);
    } else {
      detectedKind = clean.length > 220 ? 'description' : 'paragraph';
      assignedType = clean.length > 220 ? 'scenario' : 'educational';
      title = currentHeading || clean.slice(0, 72);
    }

    if (body.length < 3) continue;

    blocks.push({
      order: order++,
      detectedKind,
      assignedType,
      title: title.slice(0, 280),
      body: body.slice(0, 4800),
      contentHash: computeContentHash(title, body),
    });
  }

  return blocks;
}

export async function extractPdfDeterministically(
  buffer: Buffer
): Promise<DeterministicExtractionResult> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const workerPath = path.resolve(
    process.cwd(),
    'node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs'
  );
  pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(workerPath).href;

  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(buffer),
    useSystemFonts: true,
  });

  const pdfDoc = await loadingTask.promise;
  const pageCount = pdfDoc.numPages;
  const rawLines: RawLine[] = [];
  const warnings: string[] = [];
  let totalChars = 0;

  for (let p = 1; p <= pageCount; p++) {
    const page = await pdfDoc.getPage(p);
    const textContent = await page.getTextContent();

    // Group text items by Y coordinate to reconstruct real lines deterministically
    const lineBuckets = new Map<number, Array<{ x: number; str: string; height: number }>>();
    for (const item of textContent.items) {
      if (!('str' in item) || typeof item.str !== 'string') continue;
      const text = item.str;
      if (!text.trim()) continue;

      totalChars += text.trim().length;
      const transform = Array.isArray(item.transform) ? item.transform : [1, 0, 0, 12, 0, 0];
      const x = Number(transform[4] || 0);
      const y = Math.round(Number(transform[5] || 0) / 3) * 3;
      const height = Math.abs(Number(item.height || transform[3] || 11));

      if (!lineBuckets.has(y)) lineBuckets.set(y, []);
      lineBuckets.get(y)!.push({ x, str: text, height });
    }

    const sortedYs = Array.from(lineBuckets.keys()).sort((a, b) => b - a);
    const heights: number[] = [];
    for (const items of lineBuckets.values()) {
      for (const it of items) heights.push(it.height);
    }
    const medianHeight =
      heights.length > 0
        ? [...heights].sort((a, b) => a - b)[Math.floor(heights.length / 2)]
        : 11;

    for (const y of sortedYs) {
      const chunks = lineBuckets.get(y)!.sort((a, b) => a.x - b.x);
      const lineText = chunks.map((c) => c.str).join(' ').replace(/\s+/g, ' ').trim();
      if (!lineText) continue;
      const avgHeight = chunks.reduce((acc, c) => acc + c.height, 0) / chunks.length;

      rawLines.push({
        text: lineText,
        isHeading: avgHeight >= medianHeight * 1.35 && lineText.length <= 120,
        isSubheading:
          avgHeight >= medianHeight * 1.15 &&
          avgHeight < medianHeight * 1.35 &&
          lineText.length <= 120,
        isListItem: /^[-•*▪◦]\s+/.test(lineText),
        isNumbered: /^\d+[.)]\s+/.test(lineText),
      });
    }
  }

  const requiresOcr = pageCount > 0 && totalChars < 30;
  if (requiresOcr) {
    warnings.push(
      'OCR_REQUIRED: Le PDF ne contient pratiquement aucun texte sélectionnable (document scanné ou images uniquement). Aucun OCR automatique n’a été simulé.'
    );
  }

  const blocks = requiresOcr ? [] : classifyLinesDeterministically(rawLines);
  return {
    requiresOcr,
    pageCount,
    rawCharacterCount: totalChars,
    blocks,
    warnings,
  };
}

function stripHtmlEntities(text: string): string {
  return text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function extractDocxDeterministically(
  buffer: Buffer
): Promise<DeterministicExtractionResult> {
  // Parse DOCX purely deterministically without executing any scripts or macros
  const htmlResult = await mammoth.convertToHtml({ buffer });
  const rawResult = await mammoth.extractRawText({ buffer });
  const warnings: string[] = htmlResult.messages
    .filter((m) => m.type === 'warning')
    .map((m) => m.message)
    .slice(0, 20);

  const html = htmlResult.value || '';
  const rawLines: RawLine[] = [];

  // Deterministic HTML tag matcher for h1..h4, p, li
  const tagRegex = /<(h1|h2|h3|h4|p|li)\b[^>]*>([\s\S]*?)<\/\1>/gi;
  let match: RegExpExecArray | null;
  while ((match = tagRegex.exec(html)) !== null) {
    const tag = match[1].toLowerCase();
    const inner = stripHtmlEntities(match[2]);
    if (!inner) continue;
    rawLines.push({
      text: inner,
      isHeading: tag === 'h1' || tag === 'h2',
      isSubheading: tag === 'h3' || tag === 'h4',
      isListItem: tag === 'li' && !/^\d+[.)]\s+/.test(inner),
      isNumbered: tag === 'li' && /^\d+[.)]\s+/.test(inner),
    });
  }

  // Fallback to raw text lines if no structural HTML tags were emitted
  if (rawLines.length === 0 && rawResult.value) {
    for (const line of rawResult.value.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (trimmed) rawLines.push({ text: trimmed });
    }
  }

  const rawCharacterCount = (rawResult.value || '').trim().length;
  const blocks = classifyLinesDeterministically(rawLines);

  return {
    requiresOcr: false,
    pageCount: 1,
    rawCharacterCount,
    blocks,
    warnings,
  };
}
