import { useState, type ChangeEvent } from 'react';
import { TRANSFER_LIMITS, type RosterDocument } from '@battlegroup/core';
import type { AppCatalogRelease } from '../../rulesets/types';
import { t } from '../../i18n';
import type { RosterStore } from '../../adapters/storage/rosterStore';
import type { SaveQueue } from '../../adapters/storage/saveQueue';
import type { EditorSession } from '../roster-editor/session';
import {
  parseImportFile,
  type CatalogLoader,
  type ImportFilePreview,
  type ImportRecord,
} from './parseImportFile';
import {
  applyImportCopy,
  applyOverwrite,
  type ImportApplyResult,
} from './applyImport';
import { buildLibraryBackup } from './backupExport';
import { downloadLibraryBackup } from './rosterExport';

type Busy = 'idle' | 'parsing' | 'importing' | 'backup';

export interface ImportPanelProps {
  storageReady: boolean;
  store: RosterStore;
  queue: SaveQueue;
  sessions: EditorSession[];
  loader?: CatalogLoader;
  onNotice: (message: string) => void;
  onImported: (result: ImportApplyResult) => void;
  onOverwritten: (document: RosterDocument, release: AppCatalogRelease) => void;
}

function recordText(record: ImportRecord): { label: string; detail: string } {
  if (record.status === 'ready')
    return {
      label: record.document.name || record.document.rosterId,
      detail:
        `${record.document.catalogRef.rulesetId} · ${record.document.catalogRef.catalogId} · ` +
        `${t('transfer.catalogRevision')} ${record.document.catalogRef.catalogRevision}` +
        ` · ${record.document.selections.length} ${t('transfer.purchases')}`,
    };
  if (record.status === 'original')
    return {
      label: record.label || t('transfer.unnamedOriginal'),
      detail:
        record.reason === 'unknown-catalog'
          ? t('transfer.recordOriginalCatalog')
          : t('transfer.recordOriginalFormat'),
    };
  return { label: t('transfer.recordError'), detail: record.detail };
}

/**
 * Import/export surface: file selection, a read-only preview, then an
 * explicit confirm. Nothing is written while previewing; cancelling only
 * drops the preview. Overwrite is a separate explicit choice of target.
 */
export function ImportPanel({
  storageReady,
  store,
  queue,
  sessions,
  loader,
  onNotice,
  onImported,
  onOverwritten,
}: ImportPanelProps) {
  const [preview, setPreview] = useState<ImportFilePreview | null>(null);
  const [busy, setBusy] = useState<Busy>('idle');
  const [mode, setMode] = useState<'copy' | 'overwrite'>('copy');
  const [target, setTarget] = useState('');
  const singleReady =
    preview?.kind === 'single-roster' &&
    preview.records[0]?.status === 'ready';
  const errorCount =
    preview?.records.filter((record) => record.status === 'error').length ?? 0;
  // A backup with error records is rejected as a whole: silently skipping
  // them and reporting a generic success would hide data loss from the user.
  const batchRejected =
    preview !== null && preview.kind === 'library-backup' && errorCount > 0;
  const importable =
    preview !== null &&
    preview.fatal === null &&
    !batchRejected &&
    preview.records.some(
      (record) => record.status === 'ready' || record.status === 'original',
    );

  async function onFile(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0];
    event.target.value = ''; // allow re-selecting the same file later
    if (!file) return;
    setPreview(null);
    setMode('copy');
    setTarget('');
    // Global read gate: reject on File.size BEFORE file.text() so an
    // oversized file is never pulled into memory just to be refused.
    if (file.size > TRANSFER_LIMITS.maxFileBytes) {
      setPreview({ kind: 'unknown', records: [], fatal: 'too-large' });
      return;
    }
    setBusy('parsing');
    try {
      // Preview stage only: no database write, no session change.
      const previewNext = await parseImportFile(
        { byteSize: file.size, text: await file.text() },
        loader,
      );
      setPreview(previewNext);
    } catch {
      onNotice(t('transfer.importFailed'));
    } finally {
      setBusy('idle');
    }
  }

  async function downloadBackup(): Promise<void> {
    setBusy('backup');
    try {
      const drafts = new Map(
        sessions.map((session) => [
          session.document.rosterId,
          session.document,
        ] as const),
      );
      downloadLibraryBackup(await buildLibraryBackup(drafts, store));
    } catch {
      onNotice(t('transfer.backupFailed'));
    } finally {
      setBusy('idle');
    }
  }

  async function confirmImport(): Promise<void> {
    if (!preview || !importable || busy !== 'idle') return;
    const record = preview.records[0];
    try {
      if (singleReady && record?.status === 'ready' && mode === 'overwrite') {
        if (!target) return;
        const name =
          sessions.find((item) => item.document.rosterId === target)?.document
            .name ?? target;
        if (!window.confirm(t('transfer.confirmOverwrite') + ' ' + name + '?'))
          return;
        setBusy('importing');
        const result = await applyOverwrite(
          store,
          queue,
          record.document,
          target,
          crypto.randomUUID(),
        );
        if (result.status === 'saved') onOverwritten(result.document, record.release);
        else
          onNotice(
            t(
              result.status === 'conflict'
                ? 'transfer.overwriteConflict'
                : 'transfer.overwriteMissing',
            ),
          );
      } else {
        setBusy('importing');
        onImported(
          await applyImportCopy(store, queue, preview.records, () =>
            crypto.randomUUID(),
          ),
        );
      }
      setPreview(null);
      setMode('copy');
      setTarget('');
    } catch {
      // The batch transaction rolled back; local rosters are untouched.
      onNotice(t('transfer.importFailed'));
    } finally {
      setBusy('idle');
    }
  }

  return (
    <section className="card" aria-label={t('transfer.title')}>
      <h2>{t('transfer.title')}</h2>
      <p className="muted">{t('transfer.intro')}</p>
      <div className="transfer-actions">
        <label className="file-button">
          {busy === 'parsing' ? t('transfer.parsing') : t('transfer.chooseFile')}
          <input
            type="file"
            accept="application/json,.json"
            disabled={!storageReady || busy !== 'idle'}
            aria-label={t('transfer.chooseFile')}
            onChange={(event) => {
              void onFile(event);
            }}
          />
        </label>
        <button
          type="button"
          disabled={!storageReady || busy !== 'idle'}
          onClick={() => {
            void downloadBackup();
          }}
        >
          {busy === 'backup' ? t('transfer.backupBusy') : t('transfer.backup')}
        </button>
      </div>
      <p className="muted transfer-limits">{t('transfer.limitsNote')}</p>
      {preview?.fatal && (
        <div role="alert" className="import-fatal">
          <p>
            {t(
              preview.fatal === 'too-large'
                ? 'transfer.fatalTooLarge'
                : preview.fatal === 'not-json'
                  ? 'transfer.fatalNotJson'
                  : preview.fatal === 'too-deep'
                    ? 'transfer.fatalTooDeep'
                    : preview.fatal === 'too-many-records'
                      ? 'transfer.fatalTooMany'
                      : 'transfer.fatalUnrecognized',
            )}
          </p>
        </div>
      )}
      {preview && preview.fatal === null && (
        <div className="import-preview">
          <h3>
            {t('transfer.previewTitle')} ·{' '}
            {t(
              preview.kind === 'library-backup'
                ? 'transfer.backupFile'
                : 'transfer.singleFile',
            )}
          </h3>
          <ul className="import-records">
            {preview.records.map((record, index) => {
              const text = recordText(record);
              return (
                <li
                  key={index}
                  className="import-record"
                  data-status={record.status}
                >
                  <strong>{text.label}</strong>
                  <span>{text.detail}</span>
                </li>
              );
            })}
          </ul>
          {batchRejected && (
            <div role="alert" className="import-fatal">
              <p>
                {t('transfer.batchRejectedPrefix')} {errorCount}{' '}
                {t('transfer.batchRejectedSuffix')}
              </p>
            </div>
          )}
          {singleReady && (
            <fieldset className="import-mode">
              <legend>{t('transfer.modeTitle')}</legend>
              <label className="checkbox-label">
                <input
                  type="radio"
                  name="import-mode"
                  checked={mode === 'copy'}
                  onChange={() => setMode('copy')}
                />
                {t('transfer.modeCopy')}
              </label>
              <label className="checkbox-label">
                <input
                  type="radio"
                  name="import-mode"
                  checked={mode === 'overwrite'}
                  disabled={!sessions.length}
                  onChange={() => setMode('overwrite')}
                />
                {t('transfer.modeOverwrite')}
              </label>
              {mode === 'overwrite' && (
                <label className="import-target">
                  {t('transfer.overwriteTarget')}
                  <select
                    value={target}
                    onChange={(event) => setTarget(event.target.value)}
                  >
                    <option value="">{t('transfer.chooseTarget')}</option>
                    {sessions.map((item) => (
                      <option
                        key={item.document.rosterId}
                        value={item.document.rosterId}
                      >
                        {item.document.name} ·{' '}
                        {item.document.settings.budgetPoints}{' '}
                        {t('editor.points')}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </fieldset>
          )}
          <div className="transfer-actions">
            <button
              type="button"
              disabled={
                busy !== 'idle' ||
                !importable ||
                (mode === 'overwrite' && singleReady && !target)
              }
              onClick={() => {
                void confirmImport();
              }}
            >
              {busy === 'importing'
                ? t('transfer.importing')
                : t('transfer.confirmImport')}
            </button>
            <button
              type="button"
              disabled={busy !== 'idle'}
              onClick={() => {
                setPreview(null);
                setMode('copy');
                setTarget('');
              }}
            >
              {t('transfer.cancelImport')}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
