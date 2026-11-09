import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  jsonDepth,
  libraryBackupFileSchema,
  rosterOriginalHintSchema,
  singleRosterFileSchema,
  TRANSFER_LIMITS,
} from './contracts/transfer';

describe('transfer file envelopes', () => {
  it('accepts a well-formed single-roster envelope without validating its document', () => {
    const parsed = singleRosterFileSchema.safeParse({
      formatVersion: 'roster-file/1',
      kind: 'single-roster',
      savedAt: '2026-11-09T00:00:00.000Z',
      document: { formatVersion: 'anything', opaque: true },
    });
    expect(parsed.success).toBe(true);
  });

  it('rejects envelope shape drift such as extra keys or a wrong kind', () => {
    expect(
      singleRosterFileSchema.safeParse({
        formatVersion: 'roster-file/1',
        kind: 'single-roster',
        savedAt: 'x',
        document: {},
        storageRevision: 3,
      }).success,
    ).toBe(false);
    expect(
      singleRosterFileSchema.safeParse({
        formatVersion: 'roster-file/1',
        kind: 'library-backup',
        savedAt: 'x',
        document: {},
      }).success,
    ).toBe(false);
  });

  it('keeps backup entries opaque so unsupported originals round-trip', () => {
    const parsed = libraryBackupFileSchema.safeParse({
      formatVersion: 'library-backup/1',
      kind: 'library-backup',
      savedAt: 'x',
      rosters: [
        { rosterId: 'a', document: { formatVersion: 'future', blob: [1] } },
        { rosterId: 'b', document: 42 },
      ],
    });
    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.rosters).toHaveLength(2);
  });

  it('recognizes only unknown format versions as originals', () => {
    expect(
      rosterOriginalHintSchema.safeParse({
        formatVersion: 'roster/9',
        rosterId: 'x',
      }).success,
    ).toBe(true);
    // A file claiming a version this app defines, but failing that format's
    // schema, is corrupt — it must not hide as an "unsupported original".
    expect(
      rosterOriginalHintSchema.safeParse({ formatVersion: 'roster/1' })
        .success,
    ).toBe(false);
    expect(
      rosterOriginalHintSchema.safeParse({ formatVersion: 'roster-file/1' })
        .success,
    ).toBe(false);
    expect(rosterOriginalHintSchema.safeParse(42).success).toBe(false);
    expect(
      rosterOriginalHintSchema.safeParse({ noVersionHere: true }).success,
    ).toBe(false);
  });
});

describe('jsonDepth', () => {
  it('measures scalar, nested and array depth without recursion', () => {
    expect(jsonDepth(7)).toBe(1);
    expect(jsonDepth({ a: { b: [1, { c: 2 }] } })).toBe(5);
    expect(jsonDepth([[[[1]]]])).toBe(5);
    expect(jsonDepth({ a: null, b: 'x' })).toBe(2);
  });

  it('walks structures deeper than the import limit without blowing the stack', () => {
    let deep: unknown = 1;
    for (let i = 0; i < 5000; i += 1) deep = [deep];
    expect(jsonDepth(deep)).toBe(5001);
    expect(jsonDepth(deep)).toBeGreaterThan(TRANSFER_LIMITS.maxJsonDepth);
  });

  it('exports limits as plain readonly data usable by the web layer', () => {
    expect(
      z
        .object({
          maxFileBytes: z.number(),
          singleFileBytes: z.number(),
          maxRecordsPerBackup: z.number(),
          maxSelectionsPerRoster: z.number(),
          maxOptionTargetsPerRoster: z.number(),
          maxJsonDepth: z.number(),
        })
        .safeParse(TRANSFER_LIMITS).success,
    ).toBe(true);
  });
});
