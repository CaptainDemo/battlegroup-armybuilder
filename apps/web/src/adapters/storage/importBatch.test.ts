import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { afterEach, describe, expect, it } from 'vitest';
import { b01Roster } from '@battlegroup/core/samples';
import { DexieRosterStore, RosterDatabase } from './dexieRosterStore';
import { summarize } from './rosterStore';

const databases: Dexie[] = [];
const names: string[] = [];
function setup() {
  const name = 'import-test-' + crypto.randomUUID();
  names.push(name);
  const a = new RosterDatabase(name);
  const b = new RosterDatabase(name);
  databases.push(a, b);
  return {
    a,
    first: new DexieRosterStore(a),
    second: new DexieRosterStore(b),
  };
}
afterEach(async () => {
  for (const db of databases.splice(0)) db.close();
  for (const name of names.splice(0)) await Dexie.delete(name);
});

describe('atomic batch import', () => {
  it('writes documents and opaque originals with fresh revisions in one transaction', async () => {
    const { first } = setup();
    const document = b01Roster();
    const rows = await first.importBatch([
      { kind: 'document', rosterId: 'fresh-1', document },
      {
        kind: 'original',
        rosterId: 'fresh-2',
        document: { formatVersion: 'roster/9', rosterId: 'old', blob: true },
      },
    ]);
    expect(rows.map((row) => row.rosterId)).toEqual(['fresh-1', 'fresh-2']);
    expect(rows.map((row) => row.saveRevision)).toEqual([1, 1]);
    expect(rows[0]).toMatchObject({
      document,
      summary: summarize(document),
      deleted: false,
    });
    expect(rows[1]).toMatchObject({
      document: { formatVersion: 'roster/9', rosterId: 'old', blob: true },
      summary: null,
      deleted: false,
    });
  });

  it('rolls back every earlier row when a later write fails', async () => {
    const { a, first } = setup();
    let calls = 0;
    const fail = () => {
      calls += 1;
      if (calls > 1) throw new Error('simulated disk failure');
    };
    a.rosters.hook('creating', fail);
    await expect(
      first.importBatch([
        { kind: 'document', rosterId: 'one', document: b01Roster() },
        { kind: 'document', rosterId: 'two', document: b01Roster() },
      ]),
    ).rejects.toThrow('disk failure');
    a.rosters.hook('creating').unsubscribe(fail);
    expect(await first.read('one')).toBeUndefined();
    expect(await first.read('two')).toBeUndefined();
  });

  it('refuses to touch an existing roster id, keeping all-or-nothing behaviour', async () => {
    const { first } = setup();
    const document = b01Roster();
    await first.save(null, { ...document, rosterId: 'taken' });
    await expect(
      first.importBatch([
        { kind: 'document', rosterId: 'fresh', document },
        { kind: 'document', rosterId: 'taken', document: { ...document } },
      ]),
    ).rejects.toThrow('import batch target exists: taken');
    expect(await first.read('fresh')).toBeUndefined();
    // Even a tombstone is an existing row: imports never resurrect over it.
    await first.remove('taken', 1);
    await expect(
      first.importBatch([
        { kind: 'document', rosterId: 'taken', document },
      ]),
    ).rejects.toThrow('import batch target exists: taken');
  });

  it('rejects a batch whose document fails the roster schema', async () => {
    const { first } = setup();
    await expect(
      first.importBatch([
        {
          kind: 'document',
          rosterId: 'bad',
          document: { formatVersion: 'roster/1' } as never,
        },
      ]),
    ).rejects.toThrow('import batch document failed schema: bad');
    expect(await first.read('bad')).toBeUndefined();
  });

  it('summarizes an original that is a roster/1 payload with an unavailable catalog', async () => {
    const { first } = setup();
    const document = b01Roster();
    const rows = await first.importBatch([
      {
        kind: 'original',
        rosterId: 'unknown-catalog',
        document: { ...document, catalogRef: { ...document.catalogRef, catalogRevision: '9.9.9' } },
      },
    ]);
    expect(rows[0]?.summary).toMatchObject({
      name: document.name,
      catalogRevision: '9.9.9',
    });
    // It stays unopenable as a normal roster and preserves the original bytes.
    expect((await first.read('unknown-catalog'))?.document).toMatchObject({
      catalogRef: { catalogRevision: '9.9.9' },
    });
  });
});
