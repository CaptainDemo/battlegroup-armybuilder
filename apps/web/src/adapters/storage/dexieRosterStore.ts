import Dexie, { type Table } from 'dexie';
import { rosterDocumentSchema, type RosterDocument } from '@battlegroup/core';
import {
  summarize,
  type ImportWrite,
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

  async importBatch(writes: readonly ImportWrite[]): Promise<StoredRoster[]> {
    await this.db.open();
    // One transaction: a failure anywhere rolls back every earlier put, so an
    // interrupted library import never leaves a half-imported database.
    return this.db.transaction('rw', this.db.rosters, async () => {
      const rows: StoredRoster[] = [];
      const seen = new Set<string>();
      for (const write of writes) {
        if (seen.has(write.rosterId))
          throw new Error(`import batch repeats roster id ${write.rosterId}`);
        seen.add(write.rosterId);
        if (await this.db.rosters.get(write.rosterId))
          throw new Error(`import batch target exists: ${write.rosterId}`);
        if (
          write.kind === 'document' &&
          !rosterDocumentSchema.safeParse(write.document).success
        )
          throw new Error(
            `import batch document failed schema: ${write.rosterId}`,
          );
        // 'document' writes were pre-validated by the importer; an original
        // may still be a roster/1 payload whose catalog is unavailable here —
        // summarize that case for list display, otherwise keep the row opaque.
        const parsed = rosterDocumentSchema.safeParse(write.document);
        const row: StoredRoster = {
          rosterId: write.rosterId,
          saveRevision: 1,
          updatedAt: new Date().toISOString(),
          document: structuredClone(write.document),
          summary: parsed.success ? summarize(parsed.data) : null,
          deleted: false,
        };
        await this.db.rosters.put(row);
        rows.push(row);
      }
      return rows;
    });
  }
}
