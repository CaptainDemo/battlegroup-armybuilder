import { z } from 'zod';
import { ROSTER_FORMAT_VERSION } from './versioning';

/**
 * M10 file-envelope contracts for roster import/export
 * (docs/architecture.md §7.2). Envelopes carry only a format version, a kind
 * and the player's own data. Player choices stay the single authority: no
 * totals, no catalog copies, no storage revisions — a carried revision would
 * imply a write permission this format must never grant.
 *
 * Document format version, envelope format version, database schema version
 * and catalog revisions are managed separately (§7.3). M09 recovery downloads
 * (a bare RosterDocument with no envelope) remain importable legacy input.
 */

/** Envelope for one exported roster (single-roster transfer file). */
export const SINGLE_ROSTER_FILE_VERSION = 'roster-file/1';

/** Envelope for a full local library backup. */
export const LIBRARY_BACKUP_FILE_VERSION = 'library-backup/1';

/**
 * Testable import limits. Sizes are checked before JSON.parse; structural
 * caps are checked after parsing and before any recursive validation, so a
 * hostile file cannot force an unbounded parse or walk.
 */
export const TRANSFER_LIMITS = {
  /** Any import file above this is rejected before parsing. */
  maxFileBytes: 20 * 1024 * 1024,
  /** Single-roster files are additionally capped once their kind is known. */
  singleFileBytes: 2 * 1024 * 1024,
  maxRecordsPerBackup: 200,
  maxSelectionsPerRoster: 5000,
  maxOptionTargetsPerRoster: 20000,
  maxJsonDepth: 64,
} as const;

export const singleRosterFileSchema = z.strictObject({
  formatVersion: z.literal(SINGLE_ROSTER_FILE_VERSION),
  kind: z.literal('single-roster'),
  savedAt: z.string().min(1),
  /** Unvalidated on purpose: unsupported originals must survive import intact. */
  document: z.unknown(),
});
export type SingleRosterFile = z.infer<typeof singleRosterFileSchema>;

export const libraryBackupEntrySchema = z.strictObject({
  rosterId: z.string().min(1),
  document: z.unknown(),
});
export type LibraryBackupEntry = z.infer<typeof libraryBackupEntrySchema>;

export const libraryBackupFileSchema = z.strictObject({
  formatVersion: z.literal(LIBRARY_BACKUP_FILE_VERSION),
  kind: z.literal('library-backup'),
  savedAt: z.string().min(1),
  rosters: z.array(z.unknown()),
});
export type LibraryBackupFile = z.infer<typeof libraryBackupFileSchema>;

/** Format versions this app itself defines; a malformed file claiming one is corrupt, not an original. */
export const KNOWN_FILE_FORMAT_VERSIONS = [
  ROSTER_FORMAT_VERSION,
  SINGLE_ROSTER_FILE_VERSION,
  LIBRARY_BACKUP_FILE_VERSION,
] as const;

/**
 * Minimal recognition shape for an *original*: an object that declares some
 * other format version. Such payloads are preserved verbatim as recovery
 * records — never interpreted, evaluated or migrated. Anything failing this
 * hint (scalars, arrays, objects without a format version, or malformed files
 * claiming a known version) is corrupt and must not enter the library.
 */
export const rosterOriginalHintSchema = z
  .object({ formatVersion: z.string().min(1) })
  .passthrough()
  .refine(
    (value) =>
      !KNOWN_FILE_FORMAT_VERSIONS.some(
        (version) => version === value.formatVersion,
      ),
    {
      message:
        'claims a format version this app defines; a malformed document of a known format is corrupt',
    },
  );

/**
 * Maximum nesting depth of a parsed JSON value (iterative walk — the checker
 * itself must not recurse on attacker-supplied depth). Scalars are depth 1;
 * each object/array level adds one.
 */
export function jsonDepth(value: unknown): number {
  let max = 0;
  const stack: { value: unknown; depth: number }[] = [{ value, depth: 1 }];
  while (stack.length > 0) {
    const item = stack.pop()!;
    if (item.depth > max) max = item.depth;
    if (Array.isArray(item.value)) {
      for (const child of item.value)
        stack.push({ value: child, depth: item.depth + 1 });
    } else if (item.value !== null && typeof item.value === 'object') {
      for (const child of Object.values(item.value))
        stack.push({ value: child, depth: item.depth + 1 });
    }
  }
  return max;
}
