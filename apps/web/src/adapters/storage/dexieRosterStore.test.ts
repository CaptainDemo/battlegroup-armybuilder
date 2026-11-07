import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { afterEach, describe, expect, it } from 'vitest';
import { b01Roster } from '@battlegroup/core/samples';
import { DexieRosterStore, RosterDatabase } from './dexieRosterStore';
import { summarize } from './rosterStore';

const databases: Dexie[] = [];
const names: string[] = [];
function setup() {
  const name = 'storage-test-' + crypto.randomUUID();
  names.push(name);
  const a = new RosterDatabase(name);
  const b = new RosterDatabase(name);
  databases.push(a, b);
  return {
    a,
    b,
    first: new DexieRosterStore(a),
    second: new DexieRosterStore(b),
    name,
  };
}
afterEach(async () => {
  for (const db of databases.splice(0)) db.close();
  for (const name of names.splice(0)) await Dexie.delete(name);
});

describe('IndexedDB compare-and-write', () => {
  it('serializes concurrent saves from two connections with exactly one winner', async () => {
    const { first, second } = setup();
    const document = b01Roster();
    await first.save(null, document);
    const results = await Promise.all([
      first.save(1, { ...document, revision: 'a', name: 'A' }),
      second.save(1, { ...document, revision: 'b', name: 'B' }),
    ]);
    expect(results.map((result) => result.status).sort()).toEqual([
      'conflict',
      'saved',
    ]);
    const saved = results.find((result) => result.status === 'saved')!;
    expect(await first.read(document.rosterId)).toEqual(saved.row);
  });

  it('keeps acknowledged snapshots idempotent and deletion prevents resurrection', async () => {
    const { first, second } = setup();
    const document = b01Roster();
    await first.save(null, document);
    const repeated = await first.save(null, document);
    expect(repeated.status).toBe('saved');
    if (repeated.status === 'saved') expect(repeated.row.saveRevision).toBe(1);
    expect((await second.remove(document.rosterId, 1)).status).toBe('saved');
    expect(
      (await first.save(1, { ...document, revision: 'stale' })).status,
    ).toBe('conflict');
    expect(await first.list()).toEqual([]);
  });

  it('a stale delete cannot erase another tab’s update', async () => {
    const { first, second } = setup();
    const document = b01Roster();
    await first.save(null, document);
    await second.save(1, { ...document, revision: 'new' });
    expect((await first.remove(document.rosterId, 1)).status).toBe('conflict');
    expect((await second.list())[0]?.document).toMatchObject({
      revision: 'new',
    });
  });

  it('rolls back a failed transaction without advancing the stored revision', async () => {
    const { a, first } = setup();
    const document = b01Roster();
    await first.save(null, document);
    const fail = () => {
      throw new Error('simulated disk failure');
    };
    a.rosters.hook('updating', fail);
    await expect(
      first.save(1, { ...document, revision: 'lost' }),
    ).rejects.toThrow('disk failure');
    a.rosters.hook('updating').unsubscribe(fail);
    expect((await first.read(document.rosterId))?.saveRevision).toBe(1);
    expect(
      (await first.save(1, { ...document, revision: 'retry' })).status,
    ).toBe('saved');
  });

  it('migrates database summaries without changing document contents or catalog identities', async () => {
    const name = 'migration-test-' + crypto.randomUUID();
    names.push(name);
    const old = new Dexie(name);
    old.version(1).stores({ rosters: 'rosterId,updatedAt' });
    const document = b01Roster();
    await old.table('rosters').put({
      rosterId: document.rosterId,
      document,
      saveRevision: 7,
      updatedAt: '2026-11-01',
    });
    await old.table('rosters').put({
      rosterId: 'unsupported',
      document: { formatVersion: 'future', original: true },
      saveRevision: 1,
      updatedAt: '2026-11-01',
    });
    old.close();
    const upgraded = new RosterDatabase(name);
    databases.push(upgraded);
    const rows = await new DexieRosterStore(upgraded).list();
    expect(
      rows.find((row) => row.rosterId === document.rosterId),
    ).toMatchObject({
      document,
      saveRevision: 7,
      summary: summarize(document),
      deleted: false,
    });
    expect(
      rows.find((row) => row.rosterId === 'unsupported')?.document,
    ).toEqual({
      formatVersion: 'future',
      original: true,
    });
  });
});
