import Dexie, { type Table } from 'dexie';
import { rosterDocumentSchema, type RosterDocument } from '@battlegroup/core';
import {
  summarize,
  type RosterStore,
  type StoredRoster,
  type WriteResult,
} from './rosterStore';

export const rosterDatabaseName = 'battlegroup-armybuilder';

export class RosterDatabase extends Dexie {
  rosters!: Table<StoredRoster, string>;

  constructor(name = rosterDatabaseName) {
    super(name);
    this.version(1).stores({ rosters: 'rosterId,updatedAt' });
    this.version(2)
      .stores({ rosters: 'rosterId,updatedAt' })
      .upgrade(async (transaction) => {
        await transaction
          .table('rosters')
          .toCollection()
          .modify((row) => {
            const parsed = rosterDocumentSchema.safeParse(row.document);
            row.summary = parsed.success ? summarize(parsed.data) : null;
            row.deleted = row.deleted === true;
          });
      });
  }
}

export class DexieRosterStore implements RosterStore {
  constructor(private readonly db = new RosterDatabase()) {}

  async list(): Promise<StoredRoster[]> {
    await this.db.open();
    return (
      await this.db.rosters.orderBy('updatedAt').reverse().toArray()
    ).filter((row) => !row.deleted);
  }

  async read(rosterId: string): Promise<StoredRoster | undefined> {
    await this.db.open();
    return this.db.rosters.get(rosterId);
  }

  async save(
    expectedRevision: number | null,
    document: RosterDocument,
  ): Promise<WriteResult> {
    await this.db.open();
    return this.db.transaction('rw', this.db.rosters, async () => {
      const current = await this.db.rosters.get(document.rosterId);
      // Retrying an acknowledged edit is idempotent, including a lost acknowledgement.
      if (
        current &&
        !current.deleted &&
        JSON.stringify(current.document) === JSON.stringify(document)
      ) {
        return { status: 'saved', row: current };
      }
      if ((current?.saveRevision ?? null) !== expectedRevision) {
        return { status: 'conflict', current };
      }
      const row: StoredRoster = {
        rosterId: document.rosterId,
        saveRevision: (expectedRevision ?? 0) + 1,
        updatedAt: new Date().toISOString(),
        document: structuredClone(document),
        summary: summarize(document),
        deleted: false,
      };
      await this.db.rosters.put(row);
      return { status: 'saved', row };
    });
  }

  async remove(
    rosterId: string,
    expectedRevision: number | null,
  ): Promise<WriteResult> {
    await this.db.open();
    return this.db.transaction('rw', this.db.rosters, async () => {
      const current = await this.db.rosters.get(rosterId);
      if ((current?.saveRevision ?? null) !== expectedRevision) {
        return { status: 'conflict', current };
      }
      const row: StoredRoster = {
        rosterId,
        saveRevision: (expectedRevision ?? 0) + 1,
        updatedAt: new Date().toISOString(),
        document: null,
        summary: null,
        deleted: true,
      };
      // A tombstone prevents an old tab from recreating a deleted roster.
      await this.db.rosters.put(row);
      return { status: 'saved', row };
    });
  }
}
