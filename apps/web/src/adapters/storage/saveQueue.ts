import type { RosterDocument } from '@battlegroup/core';
import type { RosterStore } from './rosterStore';

export type SavePhase =
  'saved' | 'saving' | 'error' | 'conflict' | 'deleting' | 'deleted';
export interface SaveState {
  phase: SavePhase;
  editRevision: string;
  persistedEditRevision: string | null;
  saveRevision: number | null;
  error: string | null;
}
interface Slot extends SaveState {
  latest: RosterDocument;
  pending: RosterDocument | null;
  task: Promise<void> | null;
  deleting: boolean;
}

/** One writer per roster in this tab. The store handles concurrency across tabs. */
export class SaveQueue {
  private slots = new Map<string, Slot>();
  private listeners = new Set<() => void>();

  constructor(private readonly store: RosterStore) {}

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  snapshot(): Record<string, SaveState> {
    return Object.fromEntries(
      [...this.slots].map(([id, slot]) => [
        id,
        {
          phase: slot.phase,
          editRevision: slot.editRevision,
          persistedEditRevision: slot.persistedEditRevision,
          saveRevision: slot.saveRevision,
          error: slot.error,
        },
      ]),
    );
  }

  restore(document: RosterDocument, saveRevision: number): void {
    this.slots.set(document.rosterId, this.slot(document, saveRevision));
    this.emit();
  }

  enqueue(document: RosterDocument): void {
    let slot = this.slots.get(document.rosterId);
    if (!slot) {
      slot = this.slot(document, null);
      this.slots.set(document.rosterId, slot);
    } else if (
      slot.deleting ||
      slot.phase === 'deleted' ||
      slot.editRevision === document.revision
    ) {
      return;
    }
    slot.latest = structuredClone(document);
    slot.editRevision = document.revision;
    slot.pending = slot.latest;
    if (slot.phase !== 'conflict' && slot.phase !== 'error') this.start(slot);
    this.emit();
  }

  retry(rosterId: string): void {
    const slot = this.slots.get(rosterId);
    if (!slot || slot.phase !== 'error') return;
    slot.pending = slot.latest;
    slot.error = null;
    this.start(slot);
    this.emit();
  }

  async settle(rosterId: string): Promise<void> {
    await this.slots.get(rosterId)?.task;
  }

  async remove(rosterId: string): Promise<boolean> {
    const slot = this.slots.get(rosterId);
    if (!slot || slot.deleting || slot.phase === 'conflict') return false;
    slot.deleting = true;
    slot.pending = null;
    slot.phase = 'deleting';
    this.emit();
    await slot.task;
    if ((slot.phase as SavePhase) === 'conflict') {
      slot.deleting = false;
      return false;
    }
    try {
      const result = await this.store.remove(rosterId, slot.saveRevision);
      if (result.status === 'conflict') {
        slot.phase = 'conflict';
        return false;
      }
      slot.phase = 'deleted';
      return true;
    } catch (error) {
      slot.phase = 'error';
      slot.error = String(error);
      return false;
    } finally {
      slot.deleting = false;
      this.emit();
    }
  }

  private slot(document: RosterDocument, saveRevision: number | null): Slot {
    return {
      latest: structuredClone(document),
      pending: null,
      task: null,
      deleting: false,
      phase: 'saved',
      editRevision: document.revision,
      persistedEditRevision: saveRevision === null ? null : document.revision,
      saveRevision,
      error: null,
    };
  }

  private start(slot: Slot): void {
    slot.phase = 'saving';
    if (!slot.task) slot.task = this.drain(slot);
  }

  private async drain(slot: Slot): Promise<void> {
    try {
      while (slot.pending && !slot.deleting) {
        const document = slot.pending;
        slot.pending = null;
        const result = await this.store.save(slot.saveRevision, document);
        if (result.status === 'conflict') {
          slot.phase = 'conflict';
          return;
        }
        slot.saveRevision = result.row.saveRevision;
        slot.persistedEditRevision = document.revision;
        // A completed older snapshot cannot acknowledge a newer in-memory edit.
        slot.phase = slot.deleting
          ? 'deleting'
          : slot.pending
            ? 'saving'
            : 'saved';
        this.emit();
      }
    } catch (error) {
      slot.phase = 'error';
      slot.error = String(error);
    } finally {
      slot.task = null;
      this.emit();
    }
  }

  private emit(): void {
    for (const listener of this.listeners) listener();
  }
}
