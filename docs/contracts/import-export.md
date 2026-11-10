# Import, Export and Backup Contracts

Implementation: `apps/web/src/features/roster-transfer/`, `apps/web/src/adapters/storage/` and `packages/core/src/contracts/transfer.ts`.

## 1. File formats

Envelopes carry format, kind and timestamp. Player data is always RosterDocument or an unsupported original. Do not export authoritative derived Points/BR/composition or database saveRevision; a file never grants local overwrite authority.

Single roster:

```json
{
  "formatVersion": "roster-file/1",
  "kind": "single-roster",
  "savedAt": "2026-11-09T00:00:00.000Z",
  "document": { "formatVersion": "roster/1", "...": "RosterDocument fields" }
}
```

Library backup:

```json
{
  "formatVersion": "library-backup/1",
  "kind": "library-backup",
  "savedAt": "2026-11-09T00:00:00.000Z",
  "rosters": [
    { "rosterId": "original-id", "document": { "...": "document or preserved original" } }
  ]
}
```

Examples show envelope structure, not complete valid roster documents. Backups merge stored rows with current memory drafts: each draft replaces its stored version, including failed/unsaved saves; memory-only drafts are included; tombstones are excluded; unsupported originals retain their payload. The bare `roster/1` recovery document remains an importable legacy shape with the same classification as an enveloped roster.

## 2. Independent version layers

| Layer | Current identity |
|---|---|
| Roster document | roster/1 |
| Single / backup envelope | roster-file/1 / library-backup/1 |
| Database schema | Dexie schema 2 |
| Supported Classic releases | Exact 1.0.0 and 1.1.0 catalog identities |

Do not infer one layer from another or silently load 1.1.0 for a 1.0.0 document.

## 3. Limits and gate order

Check File.size before reading text, byte size before JSON.parse, then bounded structural inspection before schemas/recursive relation work. Recognizable single-file shapes all use the same 2 MiB limit.

| Limit | Value | Gate |
|---|---|---|
| Any import file | 20 MiB | File.size before file.text(), and parseImportFile entry |
| Single roster | 2 MiB | Envelope, bare recovery and recognizable unknown-format single document |
| Backup entries | 200 | Before per-record classification |
| Purchases per roster | 5000 | Before catalog loading |
| Total option targets per roster | 20000 | Before catalog loading |
| JSON nesting | 64 | Iterative jsonDepth before schema/relation recursion |

TRANSFER_LIMITS in core is authoritative. The 20000-target bound accommodates roughly four targets per 5000 purchases while bounding validation work. The normal UI summarizes file sizes; this guide retains the complete technical limits.

## 4. Classification

| State | Conditions | Result |
|---|---|---|
| ready | Known roster schema, within limits, exact indexed catalog loads and command-document validation passes | Editable imported roster |
| original | Recognizable document with unindexed/not-found/unsupported catalog identity, or an unknown format version | Recovery record, not evaluated or converted; can be exported again |
| error | Invalid JSON/known-format structure, bad relationships, cross-ruleset/revision references, orphan/cycle, limits exceeded, or indexed catalog currently failing verification | Rejected from the library with a preview reason |

Unknown catalog identities are lookup keys only. No embedded URL/path directs a request. Catalogs load from the application's fixed index/base. An indexed catalog's network-error, digest-mismatch or invalid-data result is an error, not an unsupported-version original or a guessed success.

## 5. Write semantics

### Preview

Parsing/classification does not write storage or change sessions. Cancel discards only the preview. Confirm is the first write action. Source strings render as text.

### Default copy

Generate a fresh rosterId and edit revision. Preserve selection IDs, parent/member anchors, option targets, settings, notes and exact catalog versions. Internal instance identities remain scoped to the new roster.

### Explicit overwrite

Only a single ready roster supports overwrite. The player selects a target and confirms. First queue.settle drains that roster's in-flight and coalesced pending writes; use the queue slot's last acknowledged saveRevision as the page-known compare-and-write token.

Do not reread storage to obtain a newer token: that would silently authorize another tab's intervening update. With the page-known token, a remote save conflicts and both remote data and the current draft remain intact. Deleting/deleted slots reject overwrite to prevent resurrection through a tombstone.

On success, queue.restore replaces/anchors the slot at the new storage revision. Detached old drain work cannot write old contents back. Conflict/missing leaves the original record, queue slot and memory draft untouched. File version fields never supply expectedRevision.

### Backup import

Create all new rows in one Dexie read-write transaction. Any failure rolls back the whole batch. A preview with any error record is rejected entirely, with confirmation disabled and an explanation/count. Do not silently import only the good entries. Explicit per-record skipping is outside current scope.

## 6. Storage/API surface

RosterStore provides:

```ts
importBatch(writes: readonly ImportWrite[]): Promise<StoredRoster[]>
// ImportWrite =
//   | { kind: 'document'; rosterId: string; document: RosterDocument }
//   | { kind: 'original'; rosterId: string; document: unknown }
```

The transaction rejects existing IDs (including tombstones), duplicate IDs and invalid document schemas. Rebuild summaries for original payloads that still match roster/1; otherwise keep a null summary. Existing save/remove concurrency semantics remain unchanged.

Core exports file version constants, TRANSFER_LIMITS, singleRosterFileSchema, libraryBackupFileSchema, libraryBackupEntrySchema, rosterOriginalHintSchema, KNOWN_FILE_FORMAT_VERSIONS, jsonDepth and file types.

Web entry points:

- `parseImportFile({ byteSize, text }, loader?)` → ImportFilePreview; parsing/classification only.
- `buildLibraryBackup(drafts, store)` → backup envelope.
- `singleRosterFile`, `downloadSingleRoster`, `downloadLibraryBackup` → file construction/download.
- `applyImportCopy(store, queue, records, freshId)` → sessions, originals, releases.
- `applyOverwrite(store, queue, source, targetRosterId, newRevision)` → saved / conflict / missing.
- ImportPanel → real file input, per-record preview, confirm/cancel, copy/overwrite and backup download.

Export JSON reads the current memory draft even when saving failed. Unsupported originals use Download recovery JSON. Overwrite is offered only for one ready record and uses window.confirm. The panel remains usable at 360px without page overflow.