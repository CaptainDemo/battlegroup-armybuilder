import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { b01Roster } from '@battlegroup/core/samples';
import {
  SINGLE_ROSTER_FILE_VERSION,
  TRANSFER_LIMITS,
  type CatalogIdentity,
  type RosterDocument,
} from '@battlegroup/core';
import { classicCatalogReleaseSchema } from '@battlegroup/classic-coldwar';
import type { CatalogLoadResult } from '../../adapters/catalog/catalogLoader';
import { parseImportFile, type CatalogLoader } from './parseImportFile';

const release = classicCatalogReleaseSchema.parse(
  JSON.parse(
    readFileSync(
      'packages/catalogs/classic-coldwar/public/catalogs/classic-coldwar/soviet-armoured-division/1-1-0/catalog.json',
      'utf8',
    ),
  ),
);

/** A document bound to the exact real 1.1.0 catalog, structurally valid. */
function validDocument(): RosterDocument {
  const document = b01Roster();
  document.catalogRef = release.catalog.manifest.identity;
  document.selections = document.selections.map((selection) => ({
    ...selection,
    entryReference: {
      ...document.catalogRef,
      localId: selection.entryReference.localId,
    },
    ...(!selection.parentSelectionId
      ? {
          sectionId: release.catalog.entries.find(
            (entry) => entry.localId === selection.entryReference.localId,
          )!.sectionIds[0]!,
        }
      : {}),
  }));
  return document;
}

type ProbeLoader = CatalogLoader & { calls: CatalogIdentity[] };

function loaderFrom(
  map: Record<string, CatalogLoadResult | undefined>,
): ProbeLoader {
  const calls: CatalogIdentity[] = [];
  const loader = async (identity: CatalogIdentity): Promise<CatalogLoadResult> => {
    calls.push(identity);
    return (
      map[
        `${identity.rulesetId}/${identity.catalogId}@${identity.catalogRevision}`
      ] ?? { status: 'not-found', reason: 'No application-indexed catalog.' }
    );
  };
  return Object.assign(loader, { calls });
}

const ready11: Record<string, CatalogLoadResult | undefined> = {
  'classic-coldwar/soviet-armoured-division-v4_1@1.1.0': {
    status: 'ready',
    release,
  },
};

const bytes = (value: string): number => Buffer.byteLength(value, 'utf8');
const stringify = (value: unknown): string => JSON.stringify(value);

/** Parses a JSON value; `raw` bypasses stringify for hand-broken payloads. */
async function parse(
  value: unknown,
  options: { loader?: ProbeLoader; byteSize?: number; raw?: string } = {},
) {
  const text = options.raw ?? stringify(value);
  return parseImportFile(
    {
      byteSize: options.byteSize ?? bytes(text),
      text,
    },
    options.loader ?? loaderFrom({}),
  );
}

describe('import file gates', () => {
  it('rejects oversized files before parsing, without loading any catalog', async () => {
    const loader = loaderFrom(ready11);
    const preview = await parse('{ "a": 1 }', {
      loader,
      byteSize: TRANSFER_LIMITS.maxFileBytes + 1,
      raw: '{ "a": 1 }',
    });
    expect(preview).toMatchObject({ kind: 'unknown', fatal: 'too-large' });
    expect(loader.calls).toHaveLength(0);
  });

  it('rejects corrupt JSON and unrecognized payloads', async () => {
    expect((await parse(null, { raw: '{oops' })).fatal).toBe('not-json');
    expect((await parse([1, 2, 3])).fatal).toBe('unrecognized');
    expect((await parse({ hello: 'world' })).fatal).toBe('unrecognized');
    expect((await parse('roster')).fatal).toBe('unrecognized');
    expect((await parse(42)).fatal).toBe('unrecognized');
  });

  it('rejects nesting deeper than the limit after parsing', async () => {
    let deep: unknown = 1;
    for (let i = 0; i < TRANSFER_LIMITS.maxJsonDepth; i += 1) deep = [deep];
    expect((await parse(deep)).fatal).toBe('too-deep');
  });

  it('applies the tighter single-roster size cap once the kind is known', async () => {
    const loader = loaderFrom(ready11);
    const envelope = {
      formatVersion: SINGLE_ROSTER_FILE_VERSION,
      kind: 'single-roster',
      savedAt: 'x',
      document: validDocument(),
    };
    const preview = await parse(envelope, {
      loader,
      byteSize: TRANSFER_LIMITS.singleFileBytes + 1,
    });
    expect(preview).toMatchObject({ kind: 'single-roster', fatal: 'too-large' });
    expect(loader.calls).toHaveLength(0);
  });

  it('applies the same single-roster cap to bare M09 documents and unknown formats', async () => {
    const loader = loaderFrom(ready11);
    const bare = validDocument();
    bare.notes = 'x'.repeat(TRANSFER_LIMITS.singleFileBytes);
    expect(await parse(bare, { loader })).toMatchObject({
      kind: 'single-roster',
      fatal: 'too-large',
    });
    const future = {
      formatVersion: 'roster/9',
      rosterId: 'x',
      name: 'Big future',
      blob: 'x'.repeat(TRANSFER_LIMITS.singleFileBytes),
    };
    expect(await parse(future, { loader })).toMatchObject({
      kind: 'single-roster',
      fatal: 'too-large',
    });
    expect(loader.calls).toHaveLength(0);
  });

  it('rejects backups with more records than the limit', async () => {
    const preview = await parse({
      formatVersion: 'library-backup/1',
      kind: 'library-backup',
      savedAt: 'x',
      rosters: Array.from(
        { length: TRANSFER_LIMITS.maxRecordsPerBackup + 1 },
        (_, i) => ({
          rosterId: 'r' + i,
          document: { formatVersion: 'roster/9' },
        }),
      ),
    });
    expect(preview).toMatchObject({
      kind: 'library-backup',
      fatal: 'too-many-records',
    });
  });
});

describe('single-roster classification', () => {
  it('classifies a current envelope and the bare M09 recovery document identically', async () => {
    const loader = loaderFrom(ready11);
    const document = validDocument();
    const enveloped = await parse(
      {
        formatVersion: SINGLE_ROSTER_FILE_VERSION,
        kind: 'single-roster',
        savedAt: '2026-11-09T00:00:00.000Z',
        document,
      },
      { loader },
    );
    expect(enveloped).toMatchObject({ kind: 'single-roster', fatal: null });
    expect(enveloped.records).toHaveLength(1);
    expect(enveloped.records[0]).toMatchObject({ status: 'ready', document });
    const bare = await parse(document, { loader });
    expect(bare.records[0]).toMatchObject({ status: 'ready' });
    expect(loader.calls).toHaveLength(2);
  });

  it('keeps unknown catalog revisions as originals and never falls back', async () => {
    const loader = loaderFrom({});
    const document = validDocument();
    document.catalogRef = {
      ...document.catalogRef,
      catalogRevision: '9.9.9',
    };
    for (const selection of document.selections)
      selection.entryReference = {
        ...selection.entryReference,
        catalogRevision: '9.9.9',
      };
    const preview = await parse(document, { loader });
    expect(preview.records[0]).toMatchObject({
      status: 'original',
      reason: 'unknown-catalog',
      label: document.name,
    });
    expect(loader.calls).toHaveLength(1);
    expect(loader.calls[0]).toMatchObject({ catalogRevision: '9.9.9' });
  });

  it('keeps unsupported format versions as originals without interpreting them', async () => {
    const loader = loaderFrom(ready11);
    const future = {
      formatVersion: 'roster/9',
      rosterId: 'x',
      name: 'From the future',
      payload: { deep: [1] },
    };
    for (const value of [
      future,
      {
        formatVersion: SINGLE_ROSTER_FILE_VERSION,
        kind: 'single-roster',
        savedAt: 'x',
        document: future,
      },
    ]) {
      const preview = await parse(value, { loader });
      expect(preview.records[0]).toMatchObject({
        status: 'original',
        reason: 'unknown-format',
        label: 'From the future',
      });
    }
    expect(loader.calls).toHaveLength(0);
  });

  it('rejects relation corruption such as cross-ruleset references and orphans', async () => {
    const loader = loaderFrom(ready11);
    const document = validDocument();
    document.selections[0]!.entryReference = {
      ...document.selections[0]!.entryReference,
      rulesetId: 'northag',
    };
    const preview = await parse(document, { loader });
    expect(preview.records[0]).toMatchObject({ status: 'error' });
    const orphan = validDocument();
    orphan.selections.push({
      ...orphan.selections[1]!,
      selectionId: 'ghost',
      parentSelectionId: 'no-such-parent',
    });
    delete (orphan.selections.at(-1) as { sectionId?: string }).sectionId;
    expect((await parse(orphan, { loader })).records[0]).toMatchObject({
      status: 'error',
    });
  });

  it('reports catalog verification failures honestly instead of guessing', async () => {
    const loader = loaderFrom({
      'classic-coldwar/soviet-armoured-division-v4_1@1.1.0': {
        status: 'digest-mismatch',
        reason: 'Catalog bytes differ from the indexed immutable release.',
      },
    });
    const preview = await parse(validDocument(), { loader });
    expect(preview.records[0]).toMatchObject({
      status: 'error',
      detail: 'Catalog bytes differ from the indexed immutable release.',
    });
  });

  it('enforces per-roster purchase and option-target caps before loading catalogs', async () => {
    const loader = loaderFrom(ready11);
    const many = validDocument();
    many.selections = Array.from(
      { length: TRANSFER_LIMITS.maxSelectionsPerRoster + 1 },
      (_, i) => ({ ...many.selections[1]!, selectionId: 's' + i }),
    );
    expect((await parse(many, { loader })).records[0]).toMatchObject({
      status: 'error',
    });

    const targeted = validDocument();
    targeted.selections[0] = {
      ...targeted.selections[0]!,
      optionChoices: [
        {
          optionGroupLocalId: 'g',
          optionLocalId: 'o',
          targets: Array.from(
            { length: TRANSFER_LIMITS.maxOptionTargetsPerRoster + 1 },
            () => ({ kind: 'whole-selection' }),
          ),
        },
      ],
    };
    expect((await parse(targeted, { loader })).records[0]).toMatchObject({
      status: 'error',
    });
    expect(loader.calls).toHaveLength(0);
  });
});

describe('library backup classification', () => {
  it('classifies mixed records independently in one preview', async () => {
    const loader = loaderFrom(ready11);
    const ready = validDocument();
    const unknownCatalog = validDocument();
    unknownCatalog.catalogRef = {
      ...unknownCatalog.catalogRef,
      catalogRevision: '2.0.0',
    };
    for (const selection of unknownCatalog.selections)
      selection.entryReference = {
        ...selection.entryReference,
        catalogRevision: '2.0.0',
      };
    const preview = await parse(
      {
        formatVersion: 'library-backup/1',
        kind: 'library-backup',
        savedAt: 'x',
        rosters: [
          { rosterId: 'a', document: ready },
          { rosterId: 'b', document: unknownCatalog },
          { rosterId: 'c', document: { formatVersion: 'roster/9', name: 'Opaque' } },
          { rosterId: 'd', document: 42 },
        ],
      },
      { loader },
    );
    expect(preview.fatal).toBeNull();
    expect(preview.records.map((record) => record.status)).toEqual([
      'ready',
      'original',
      'original',
      'error',
    ]);
    expect(preview.records[1]).toMatchObject({ reason: 'unknown-catalog' });
    expect(preview.records[2]).toMatchObject({
      reason: 'unknown-format',
      label: 'Opaque',
    });
    // Each distinct catalog identity loads exactly once.
    expect(loader.calls).toHaveLength(2);
  });

  it('never loads a catalog from a file-supplied address', async () => {
    const loader = loaderFrom(ready11);
    const document = validDocument();
    // Extra envelope keys are rejected outright: the entry is not a record.
    const strict = await parse(
      {
        formatVersion: 'library-backup/1',
        kind: 'library-backup',
        savedAt: 'x',
        rosters: [
          {
            rosterId: 'a',
            catalogUrl: 'https://evil.example/catalog.json',
            document,
          },
        ],
      },
      { loader },
    );
    expect(strict.records[0]).toMatchObject({ status: 'error' });
    expect(loader.calls).toHaveLength(0);
    // A file-controlled identity string is only ever used as an index key —
    // here it resolves to nothing and the payload stays an original.
    const poisoned = validDocument();
    poisoned.catalogRef = {
      ...poisoned.catalogRef,
      catalogId: 'https://evil.example/catalog.json',
    };
    for (const selection of poisoned.selections)
      selection.entryReference = {
        ...selection.entryReference,
        catalogId: 'https://evil.example/catalog.json',
      };
    const preview = await parse(poisoned, { loader });
    expect(preview.records[0]).toMatchObject({
      status: 'original',
      reason: 'unknown-catalog',
    });
    expect(loader.calls).toHaveLength(1);
  });
});
