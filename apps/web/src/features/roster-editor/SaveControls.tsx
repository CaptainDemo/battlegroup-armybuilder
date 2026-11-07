import type { SaveState } from '../../adapters/storage/saveQueue';
import { t } from '../../i18n';

export function SaveControls({
  state,
  revision,
  onRetry,
  onReload,
  onCopy,
  onDownload,
}: {
  state: SaveState | undefined;
  revision: string;
  onRetry: () => void;
  onReload: () => void;
  onCopy: () => void;
  onDownload: () => void;
}) {
  const phase =
    state?.phase === 'saved' && state.persistedEditRevision !== revision
      ? 'saving'
      : (state?.phase ?? 'saving');
  return (
    <div className="save-controls" data-save-state={phase}>
      <span role="status">{t('storage.' + phase)}</span>{' '}
      {phase === 'error' && (
        <button type="button" onClick={onRetry}>
          {t('storage.retry')}
        </button>
      )}
      {phase === 'conflict' && (
        <button type="button" onClick={onReload}>
          {t('storage.reload')}
        </button>
      )}
      {(phase === 'error' || phase === 'conflict') && (
        <>
          <button type="button" onClick={onCopy}>
            {t('storage.copy')}
          </button>{' '}
          <button type="button" onClick={onDownload}>
            {t('storage.download')}
          </button>
        </>
      )}
    </div>
  );
}
