import { rulesets } from '../../rulesets/registry';
import {
  jsonDepth,
  libraryBackupEntrySchema,
  libraryBackupFileSchema,
  rosterDocumentSchema,
  rosterOriginalHintSchema,
  singleRosterFileSchema,
  TRANSFER_LIMITS,
  type CatalogIdentity,
  type RosterDocument,
} from '@battlegroup/core';
import type { AppCatalogRelease } from '../../rulesets/types';
import {
  loadCatalog,
  type CatalogLoadResult,
} from '../../adapters/catalog/catalogLoader';

/**
 * M10 import pipeline, stage one: byte gate → JSON.parse → depth gate →
 * envelope detection → per-record classification. Nothing here writes to the
 * database or touches an editing session; the preview is built entirely from
 * the file and the application's own catalog index. Catalogs are only ever
 * loaded by exact identity from that index — no URL, path or hint inside a
 * file can direct a request.
 */

export type CatalogLoader = (identity: CatalogIdentity) => Promise<CatalogLoadResult>;

export type ImportFatalCode =
  | 'too-large'
  | 'not-json'
  | 'too-deep'
  | 'too-many-records'
  | 'unrecognized';

export type OriginalReason = 'unknown-catalog' | 'unknown-format';

export type ImportRecord =
  | { status: 'ready'; document: RosterDocument; release: AppCatalogRelease }
  | { status: 'original'; document: unknown; reason: OriginalReason; label: string }
  | { status: 'error'; detail: string };

export interface ImportFilePreview {
  kind: 'single-roster' | 'library-backup' | 'unknown';
  records: ImportRecord[];
  fatal: ImportFatalCode | null;
}

interface ParseInput {
  /** Byte length of the file, checked before JSON.parse is attempted. */
  byteSize: number;
  text: string;
}

function originalLabel(document: unknown): string {
  if (document !== null && typeof document === 'object') {
    const record = document as Record<string, unknown>;
    if (typeof record.name === 'string' && record.name) return record.name;
    if (typeof record.rosterId === 'string' && record.rosterId)
      return record.rosterId;
  }
  return '';
}

async function classifyDocument(
  document: unknown,
  loader: CatalogLoader,
  cache: Map<string, CatalogLoadResult>,
  validate: typeof rulesets.validateRoster,
): Promise<ImportRecord> {
  const parsed = rosterDocumentSchema.safeParse(document);
  if (!parsed.success) {
    // A recognizable-but-unsupported payload is preserved as an original;
    // anything else (scalars, junk, or a malformed file claiming a known
    // format version) is corrupt and never enters the library.
    return rosterOriginalHintSchema.safeParse(document).success
      ? {
          status: 'original',
          document,
          reason: 'unknown-format',
          label: originalLabel(document),
        }
      : {
          status: 'error',
          detail:
            parsed.error.issues[0]?.message ?? 'document is not a valid roster',
        };
  }
  const data = parsed.data;
  if (data.selections.length > TRANSFER_LIMITS.maxSelectionsPerRoster)
    return {
      status: 'error',
      detail: `roster "${data.name}" has ${data.selections.length} purchases (limit ${TRANSFER_LIMITS.maxSelectionsPerRoster})`,
    };
  const targets = data.selections.reduce(
    (sum, selection) =>
      sum +
      selection.optionChoices.reduce(
        (count, choice) => count + choice.targets.length,
        0,
      ),
    0,
  );
  if (targets > TRANSFER_LIMITS.maxOptionTargetsPerRoster)
    return {
      status: 'error',
      detail: `roster "${data.name}" has ${targets} option targets (limit ${TRANSFER_LIMITS.maxOptionTargetsPerRoster})`,
    };

  const key = `${data.catalogRef.rulesetId}/${data.catalogRef.catalogId}@${data.catalogRef.catalogRevision}`;
  let catalog = cache.get(key);
  if (!catalog) {
    catalog = await loader(data.catalogRef);
    cache.set(key, catalog);
  }
  if (catalog.status !== 'ready') {
    if (catalog.status === 'not-found' || catalog.status === 'unsupported-version')
      return {
        status: 'original',
        document,
        reason: 'unknown-catalog',
        label: data.name,
      };
    // Indexed but unverifiable right now (network, digest, data): honest
    // failure instead of guessing the record to be unsupported.
    return { status: 'error', detail: catalog.reason };
  }
  const issues = validate(data, catalog.release);
  return issues.length
    ? {
        status: 'error',
        detail: issues
          .slice(0, 3)
          .map((issue) => issue.message)
          .join(' '),
      }
    : { status: 'ready', document: data, release: catalog.release };
}

/**
 * Parses and classifies one import file without side effects. The 20 MiB
 * byte gate runs before parsing; the 2 MiB single-roster cap applies to
 * EVERY single-roster input — envelope, bare M09 recovery document and
 * recognizable unknown format alike — and is checked as soon as the single
 * kind is known, before any catalog load or recursive classification.
 * Structural caps run after parsing and before any recursive work. The M09
 * bare recovery document remains a valid input.
 */
export async function parseImportFile(
  input: ParseInput,
  loader: CatalogLoader = loadCatalog,
  validate = rulesets.validateRoster,
): Promise<ImportFilePreview> {
  if (input.byteSize > TRANSFER_LIMITS.maxFileBytes)
    return { kind: 'unknown', records: [], fatal: 'too-large' };
  let parsed: unknown;
  try {
    parsed = JSON.parse(input.text);
  } catch {
    return { kind: 'unknown', records: [], fatal: 'not-json' };
  }
  if (jsonDepth(parsed) > TRANSFER_LIMITS.maxJsonDepth)
    return { kind: 'unknown', records: [], fatal: 'too-deep' };

  const singleTooLarge = (): ImportFilePreview => ({
    kind: 'single-roster',
    records: [],
    fatal: 'too-large',
  });
  const overSingleCap = input.byteSize > TRANSFER_LIMITS.singleFileBytes;

  const cache = new Map<string, CatalogLoadResult>();
  const single = singleRosterFileSchema.safeParse(parsed);
  if (single.success) {
    if (overSingleCap) return singleTooLarge();
    return {
      kind: 'single-roster',
      records: [await classifyDocument(single.data.document, loader, cache, validate)],
      fatal: null,
    };
  }
  const backup = libraryBackupFileSchema.safeParse(parsed);
  if (backup.success) {
    if (backup.data.rosters.length > TRANSFER_LIMITS.maxRecordsPerBackup)
      return { kind: 'library-backup', records: [], fatal: 'too-many-records' };
    const records: ImportRecord[] = [];
    for (const entry of backup.data.rosters) {
      const wrapped = libraryBackupEntrySchema.safeParse(entry);
      if (wrapped.success) {
        records.push(
          await classifyDocument(wrapped.data.document, loader, cache, validate),
        );
        continue;
      }
      // Lenient legacy shape: a bare document in the record slot.
      if (rosterDocumentSchema.safeParse(entry).success) {
        records.push(await classifyDocument(entry, loader, cache, validate));
        continue;
      }
      records.push({
        status: 'error',
        detail: 'backup entry is not a recognized roster record',
      });
    }
    return { kind: 'library-backup', records, fatal: null };
  }
  // M09 recovery download: a bare RosterDocument with no envelope.
  if (rosterDocumentSchema.safeParse(parsed).success) {
    if (overSingleCap) return singleTooLarge();
    return {
      kind: 'single-roster',
      records: [await classifyDocument(parsed, loader, cache, validate)],
      fatal: null,
    };
  }
  if (rosterOriginalHintSchema.safeParse(parsed).success) {
    if (overSingleCap) return singleTooLarge();
    return {
      kind: 'single-roster',
      records: [
        {
          status: 'original',
          document: parsed,
          reason: 'unknown-format',
          label: originalLabel(parsed),
        },
      ],
      fatal: null,
    };
  }
  return { kind: 'unknown', records: [], fatal: 'unrecognized' };
}
