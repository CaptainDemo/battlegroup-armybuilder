import type { RosterDocument } from '@battlegroup/core';

export interface RosterSummary {
  name: string;
  budgetPoints: number;
  gameSizeId: string;
  catalogRevision: string;
}

/** The storage revision advances independently of the document's edit revision. */
export interface StoredRoster {
  rosterId: string;
  saveRevision: number;
  updatedAt: string;
  document: unknown;
  summary: RosterSummary | null;
  deleted: boolean;
}

export type WriteResult =
  | { status: 'saved'; row: StoredRoster }
  | { status: 'conflict'; current: StoredRoster | undefined };

/** Storage failures reject. Conflicts never write over the stored row. */
export interface RosterStore {
  list(): Promise<StoredRoster[]>;
  read(rosterId: string): Promise<StoredRoster | undefined>;
  save(
    expectedRevision: number | null,
    document: RosterDocument,
  ): Promise<WriteResult>;
  remove(
    rosterId: string,
    expectedRevision: number | null,
  ): Promise<WriteResult>;
}

export function summarize(document: RosterDocument): RosterSummary {
  return {
    name: document.name,
    budgetPoints: document.settings.budgetPoints,
    gameSizeId: document.settings.gameSizeId,
    catalogRevision: document.catalogRef.catalogRevision,
  };
}
