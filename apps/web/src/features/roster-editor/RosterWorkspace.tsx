import { memberElementId, memberTree, flattenMembers, samePath, withinPath } from './memberTree';
import { useEffect, useMemo, useState } from 'react';
import {
  createRosterDocument,
  executeRosterCommands,
  type RosterCommand,
  type RosterDocument,
  type RosterSelection,
  type TrackedValue,
  type EvaluatedCompositionNode,
} from '@battlegroup/core';
import type { AppCatalogRelease } from '../../rulesets/types';
import { rulesets, sameCatalogIdentity as sameIdentity } from '../../rulesets/registry';
import { CreateForm, SettingsForm, type CreationChoice } from './RosterForms';
import {
  catalogIndex,
  loadCatalog,
  type CatalogLoadResult,
} from '../../adapters/catalog/catalogLoader';
import { t } from '../../i18n';
import { issueMessage } from '../../i18n/issueMessage';
import { RosterTree, type AddTarget } from './RosterTree';
import { CatalogPanel } from './CatalogPanel';
import { OptionEditor } from './OptionEditor';
import { DexieRosterStore } from '../../adapters/storage/dexieRosterStore';
import { SaveQueue, type SaveState } from '../../adapters/storage/saveQueue';
import type { StoredRoster } from '../../adapters/storage/rosterStore';
import { restoreRoster } from './restoreRoster';
import { downloadDraft } from './downloadDraft';
import { SaveControls } from './SaveControls';
import {
  makeSession,
  moveHistory,
  recordEdit,
  type EditorSession,
} from './session';
import { ImportPanel } from '../roster-transfer/ImportPanel';
import type { ImportApplyResult } from '../roster-transfer/applyImport';
import { downloadSingleRoster } from '../roster-transfer/rosterExport';
import { SpecialRulesPanel } from '../../components/SpecialRulesPanel';
import { projectSpecialRules, specialRulesForSelection } from '../../rulesets/specialRules';
import { getPresentation } from '../../rulesets/presentation';
import { UnitDataPanel } from './UnitDataPanel';
import { PrintPreview, type PrintSnapshot } from '../roster-output/PrintPreview';
import { RosterSummary } from '../../components/RosterSummary';

function sameCatalogIdentity(
  a: AppCatalogRelease,
  b: AppCatalogRelease,
): boolean {
  const left = a.catalog.manifest.identity;
  const right = b.catalog.manifest.identity;
  return (
    left.rulesetId === right.rulesetId &&
    left.catalogId === right.catalogId &&
    left.catalogRevision === right.catalogRevision
  );
}

interface WorkspaceState {
  sessions: EditorSession[];
  activeId: string | null;
  selectedId: string | null;
  selectedMemberPath: string[] | null;
  notice: string;
}
export interface WorkspaceProps {
  editor: boolean;
  hidden: boolean;
}
const id = (): string => crypto.randomUUID();
const value = (tracked: TrackedValue): string =>
  tracked.state === 'known'
    ? String(tracked.value)
    : t(
        tracked.state === 'not_applicable'
          ? 'editor.notApplicable'
          : 'editor.unknown',
      );
export function RosterWorkspace({ editor, hidden }: WorkspaceProps) {
  // Explicit, non-persistent opt-in; works with the same static production build.
  const [debugToolsEnabled] = useState(
    () => new URLSearchParams(window.location.search).get('debug') === '1',
  );
  const creationChoices = useMemo(() => rulesets.creationChoices(catalogIndex), []);
  const [creationChoice, setCreationChoice] = useState<CreationChoice>(() => creationChoices[0]!);
  const [load, setLoad] = useState<CatalogLoadResult | null>(null);
  const [retry, setRetry] = useState(0);
  const [store] = useState(() => new DexieRosterStore());
  const [queue] = useState(() => new SaveQueue(store));
  const [saves, setSaves] = useState<Record<string, SaveState>>({});
  const [storageReady, setStorageReady] = useState(false);
  const [storageError, setStorageError] = useState(false);
  const [storageRetry, setStorageRetry] = useState(0);
  const [unavailable, setUnavailable] = useState<StoredRoster[]>([]);
  const [catalogs, setCatalogs] = useState<AppCatalogRelease[]>([]);
  const [state, setState] = useState<WorkspaceState>({
    sessions: [],
    activeId: null,
    selectedId: null,
    selectedMemberPath: null,
    notice: '',
  });
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState('roster');
  const [addTarget, setAddTarget] = useState<AddTarget | null>(null);
  const [printSnapshot, setPrintSnapshot] = useState<PrintSnapshot | null>(null);
  useEffect(() => queue.subscribe(() => setSaves(queue.snapshot())), [queue]);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const rows = await store.list();
        const restored = await Promise.all(
          rows.map(async (row) => ({
            row,
            restored: await restoreRoster(row),
          })),
        );
        if (cancelled) return;
        // A retry merges recovered records without replacing edited memory drafts.
        for (const item of restored) {
          if (item.restored && !queue.snapshot()[item.row.rosterId]) {
            queue.restore(item.restored.document, item.row.saveRevision);
          }
        }
        setCatalogs((current) => [
          ...current,
          ...restored.flatMap((item) =>
            item.restored ? [item.restored.catalog.release] : [],
          ),
        ]);
        setUnavailable(
          restored.filter((item) => !item.restored).map((item) => item.row),
        );
        setState((current) => ({
          ...current,
          sessions: [
            ...current.sessions,
            ...restored.flatMap((item) =>
              item.restored &&
              !current.sessions.some(
                (session) => session.document.rosterId === item.row.rosterId,
              )
                ? [makeSession(item.restored.document)]
                : [],
            ),
          ],
        }));
        setStorageError(false);
      } catch {
        if (!cancelled) setStorageError(true);
      } finally {
        if (!cancelled) setStorageReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [store, queue, storageRetry]);
  useEffect(() => {
    if (storageReady)
      for (const session of state.sessions) queue.enqueue(session.document);
  }, [queue, storageReady, state.sessions]);
  useEffect(() => {
    const protectDrafts = (event: BeforeUnloadEvent) => {
      if (
        state.sessions.some((session) => {
          const save = saves[session.document.rosterId];
          return (
            save?.phase !== 'saved' ||
            save.persistedEditRevision !== session.document.revision
          );
        })
      ) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', protectDrafts);
    return () => window.removeEventListener('beforeunload', protectDrafts);
  }, [state.sessions, saves]);
  useEffect(() => {
    let cancelled = false;
    const identity = creationChoice?.army.identity;
    setLoad(null);
    if (identity)
      void loadCatalog(identity)
        .then((result) => {
          if (!cancelled) {
            setLoad(result);
            if (result.status === 'ready') setCatalogs(current => current.some(item => sameCatalogIdentity(item, result.release)) ? current : [...current, result.release]);
          }
        })
        .catch(() => {
          if (!cancelled)
            setLoad({ status: 'invalid-data', reason: t('editor.loadFailed') });
        });
    return () => {
      cancelled = true;
    };
  }, [retry, creationChoice]);
  const defaultRelease = load?.status === 'ready' && sameIdentity(load.release.catalog.manifest.identity, creationChoice.army.identity) ? load.release : null;
  const session = state.sessions.find(
    (item) => item.document.rosterId === state.activeId,
  );
  const roster = session?.document;
  const release = roster
    ? ([defaultRelease, ...catalogs].find(
        (item) =>
          item &&
          item.catalog.manifest.identity.rulesetId ===
            roster.catalogRef.rulesetId &&
          item.catalog.manifest.identity.catalogId ===
            roster.catalogRef.catalogId &&
          item.catalog.manifest.identity.catalogRevision ===
            roster.catalogRef.catalogRevision,
      ) ?? null)
    : defaultRelease;
  const evaluation = useMemo(
    () => (roster && release ? rulesets.require(roster.catalogRef.rulesetId).evaluate(roster, release) : null),
    [roster, release],
  );
  const currentEvaluation =
    evaluation && evaluation.identity.inputRevision === roster?.revision
      ? evaluation
      : null;
  const specialRulesView = useMemo(() => roster && release && currentEvaluation
    ? projectSpecialRules(roster, release.catalog, currentEvaluation, getPresentation(roster.catalogRef.rulesetId)?.specialRules)
    : {supported: false, uses: [], rules: []}, [roster, release, currentEvaluation]);
  const selected = roster?.selections.find(
    (item) => item.selectionId === state.selectedId,
  );
  const selectedEntry = release?.catalog.entries.find(
    (item) => item.localId === selected?.entryReference.localId,
  );
  let selectedComposition = currentEvaluation?.composition.find(
    (item) => item.selectionId === selected?.selectionId,
  )?.node;
  for (const id of state.selectedMemberPath ?? [])
    selectedComposition = selectedComposition?.children?.find(
      (child) => child.nodeId === id,
    );
  const selectedRoot = currentEvaluation?.composition.find(item => item.selectionId === selected?.selectionId)?.node;
  const selectedMemberLabel = release && roster ? flattenMembers(memberTree(selectedRoot, release.catalog, rulesets.require(roster.catalogRef.rulesetId)))
    .filter(member => withinPath(state.selectedMemberPath ?? [], member.path)).map(member => member.label).join(' / ') : '';
  useEffect(() => {
    if (!state.selectedMemberPath || !selectedRoot) return;
    const path = [...state.selectedMemberPath];
    const visible = release && roster ? flattenMembers(memberTree(selectedRoot, release.catalog, rulesets.require(roster.catalogRef.rulesetId))) : [];
    while (path.length && !visible.some(member => samePath(member.path, path))) path.pop();
    if (!samePath(path, state.selectedMemberPath)) setState(current => ({...current, selectedMemberPath: path.length ? path : null}));
  }, [selectedRoot, state.selectedMemberPath, release, roster]);
  const selectedOrdinal =
    selected && roster
      ? roster.selections
          .filter(
            (item) =>
              item.parentSelectionId === selected.parentSelectionId &&
              (selected.parentSelectionId !== null ||
                item.sectionId === selected.sectionId),
          )
          .findIndex((item) => item.selectionId === selected.selectionId) + 1
      : 0;
  useEffect(() => {
    if (editor && !hidden && state.selectedId)
      window.document
        .getElementById(
          state.selectedMemberPath ? memberElementId(state.selectedId, state.selectedMemberPath) : 'selection-' + state.selectedId,
        )
        ?.scrollIntoView({ block: 'nearest' });
  }, [editor, hidden, state.selectedId, state.selectedMemberPath, tab]);
  useEffect(() => {
    if (
      addTarget?.kind === 'attachment' &&
      roster &&
      !roster.selections.some(
        (item) => item.selectionId === addTarget.parentSelectionId,
      )
    ) {
      setAddTarget(null);
    }
  }, [addTarget, roster]);
  useEffect(() => {
    if (editor && !hidden)
      window.document.getElementById('editor-actions')?.scrollTo({ top: 0 });
    if (
      editor &&
      !hidden &&
      tab === 'actions' &&
      window.matchMedia('(max-width: 760px)').matches
    ) {
      window.document
        .getElementById('editor-actions')
        ?.scrollIntoView({ block: 'start' });
    }
  }, [
    editor,
    hidden,
    tab,
    addTarget,
    state.selectedId,
    state.selectedMemberPath,
  ]);

  function beginAdding(target: AddTarget): void {
    setAddTarget(target);
    setSearch('');
    setTab('actions');
  }

  // Printing freezes the current draft + its evaluation. Nothing is saved or
  // edited by the preview; closing and reopening captures the latest draft.
  function openPrint(): void {
    if (!roster || !release || !currentEvaluation) {
      setPrintSnapshot(null);
      setState((current) => ({ ...current, notice: t('print.notReady') }));
      return;
    }
    setPrintSnapshot({ document: roster, release, evaluation: currentEvaluation });
  }

  function selectPurchase(selectionId: string, memberPath?: string[]): void {
    setState((current) => ({
      ...current,
      selectedId: selectionId,
      selectedMemberPath: memberPath ?? null,
    }));
    setAddTarget(null);
    setTab('actions');
  }

  function edit(commands: readonly RosterCommand[], selectId?: string): void {
    if (!release) return;
    const revision = id();
    setState((current) => {
      const active = current.sessions.find(
        (item) => item.document.rosterId === current.activeId,
      );
      if (!active) return current;
      const result = executeRosterCommands(
        active.document,
        commands,
        release!,
        revision,
      );
      if (!result.ok)
        return {
          ...current,
          notice: result.problems.map((problem) => problem.message).join(' '),
        };
      const boundary = rulesets.validateRoster(result.document, release!);
      if (boundary.length) return {...current, notice: boundary.map(issue => issue.message).join(' ')};
      const desired = selectId ?? current.selectedId;
      const selectedId = result.document.selections.some(
        (item) => item.selectionId === desired,
      )
        ? desired
        : (result.document.selections[0]?.selectionId ?? null);
      return {
        ...current,
        sessions: current.sessions.map((item) =>
          item === active ? recordEdit(item, result.document) : item,
        ),
        selectedId,
        selectedMemberPath:
          selectedId === current.selectedId ? current.selectedMemberPath : null,
        notice: result.notices.length
          ? result.notices.map((notice) => notice.message).join(' ')
          : t('editor.updated'),
      };
    });
  }

  function create(
    name: string,
    budget: number,
    size: string,
    example = false,
  ): void {
    if (!defaultRelease || !storageReady) return;
    const creationRelease = defaultRelease;
    const created = createRosterDocument(
      {
        rosterId: id(),
        revision: id(),
        name,
        catalogRef: creationRelease.catalog.manifest.identity,
        armyListId: creationChoice.army.armyListId,
        settings: { budgetPoints: budget, gameSizeId: size, optionalRules: [] },
      },
      creationRelease,
    );
    if (!created.ok) {
      setState((current) => ({
        ...current,
        notice: created.problems.map((problem) => problem.message).join(' '),
      }));
      return;
    }
    const boundary = rulesets.validateRoster(created.document, creationRelease);
    if (boundary.length) {
      setState(current => ({...current, notice: boundary.map(issue => issue.message).join(' ')}));
      return;
    }
    let document = created.document;
    if (example) {
      const commands = creationChoice.runtime.exampleCommands?.(creationRelease, id) ?? [];
      const populated = executeRosterCommands(
        document,
        commands,
        creationRelease,
        id(),
      );
      if (!populated.ok) {
        setState((current) => ({
          ...current,
          notice: populated.problems
            .map((problem) => problem.message)
            .join(' '),
        }));
        return;
      }
      document = populated.document;
    }
    setState((current) => ({
      ...current,
      sessions: [...current.sessions, makeSession(document)],
      activeId: document.rosterId,
      selectedId: document.selections[0]?.selectionId ?? null,
      selectedMemberPath: null,
      notice: t('editor.created'),
    }));
    setAddTarget(null);
    setSearch('');
    setTab('roster');
    window.location.hash = '/editor';
  }

  function add(
    entryId: string,
    parent?: RosterSelection,
    sectionId?: string,
    memberPath?: string[],
  ): void {
    if (!release || !roster) return;
    const entry = release.catalog.entries.find(
      (item) => item.localId === entryId,
    )!;
    const selectionId = id();
    edit(
      [
        {
          kind: 'add',
          selection: {
            selectionId,
            entryReference: { ...roster.catalogRef, localId: entryId },
            parentSelectionId: parent?.selectionId ?? null,
            ...(memberPath ? { targetMemberPath: memberPath } : {}),
            ...(!parent
              ? { sectionId: sectionId ?? entry.sectionIds[0]! }
              : {}),
            optionChoices: [],
          },
        },
      ],
      selectionId,
    );
    setTab('actions');
  }

  function history(direction: 'undo' | 'redo'): void {
    const revision = id();
    setState((current) => {
      const active = current.sessions.find(
        (item) => item.document.rosterId === current.activeId,
      );
      if (!active) return current;
      const next = moveHistory(active, direction, revision);
      return {
        ...current,
        sessions: current.sessions.map((item) =>
          item === active ? next : item,
        ),
        selectedMemberPath: next.document.selections.some(
          (item) => item.selectionId === current.selectedId,
        )
          ? current.selectedMemberPath
          : null,
        selectedId: next.document.selections.some(
          (item) => item.selectionId === current.selectedId,
        )
          ? current.selectedId
          : (next.document.selections[0]?.selectionId ?? null),
        notice: t('editor.updated'),
      };
    });
  }

  async function reloadSaved(rosterId: string): Promise<void> {
    try {
      await queue.settle(rosterId);
      const row = await store.read(rosterId);
      if (!row || row.deleted) {
        setState((current) => ({
          ...current,
          sessions: current.sessions.filter(
            (item) => item.document.rosterId !== rosterId,
          ),
          activeId: current.activeId === rosterId ? null : current.activeId,
        }));
        return;
      }
      const restored = await restoreRoster(row);
      if (!restored) {
        setState((current) => ({
          ...current,
          notice: t('storage.unavailable'),
        }));
        return;
      }
      queue.restore(restored.document, row.saveRevision);
      setCatalogs((current) => [...current, restored.catalog.release]);
      setState((current) => ({
        ...current,
        sessions: current.sessions.map((item) =>
          item.document.rosterId === rosterId
            ? makeSession(restored.document)
            : item,
        ),
        selectedId: null,
        selectedMemberPath: null,
      }));
      setAddTarget(null);
    } catch {
      setState((current) => ({ ...current, notice: t('storage.loadError') }));
    }
  }

  function saveCopy(document: RosterDocument): void {
    const copy = {
      ...structuredClone(document),
      rosterId: id(),
      revision: id(),
      name: document.name + t('storage.copySuffix'),
    };
    setState((current) => ({
      ...current,
      sessions: [...current.sessions, makeSession(copy)],
      activeId: copy.rosterId,
      selectedId: null,
      selectedMemberPath: null,
    }));
    setAddTarget(null);
    window.location.hash = '/editor';
  }

  async function deleteRoster(document: RosterDocument): Promise<void> {
    if (!window.confirm(t('storage.confirmDelete') + ' ' + document.name + '?'))
      return;
    queue.enqueue(document);
    if (await queue.remove(document.rosterId)) {
      setState((current) => ({
        ...current,
        sessions: current.sessions.filter(
          (item) => item.document.rosterId !== document.rosterId,
        ),
        activeId:
          current.activeId === document.rosterId ? null : current.activeId,
      }));
    }
  }

  function transferImported(result: ImportApplyResult): void {
    // Copies are already persisted at their batch revisions; registering the
    // sessions here lets the autosave effect re-enqueue as a no-op.
    setCatalogs((current) => [
      ...current,
      ...result.releases.filter(
        (release) => !current.some((item) => sameCatalogIdentity(item, release)),
      ),
    ]);
    setUnavailable((current) => [...current, ...result.originals]);
    setState((current) => ({
      ...current,
      sessions: [...current.sessions, ...result.sessions],
      notice: t('transfer.imported'),
    }));
  }

  function transferOverwritten(
    document: RosterDocument,
    release: AppCatalogRelease,
  ): void {
    setCatalogs((current) =>
      current.some((item) => sameCatalogIdentity(item, release))
        ? current
        : [...current, release],
    );
    setState((current) => {
      const exists = current.sessions.some(
        (item) => item.document.rosterId === document.rosterId,
      );
      const active = current.activeId === document.rosterId;
      return {
        ...current,
        sessions: exists
          ? current.sessions.map((item) =>
              item.document.rosterId === document.rosterId
                ? makeSession(document)
                : item,
            )
          : [...current.sessions, makeSession(document)],
        // The replaced content invalidates the old selection and history.
        selectedId: active ? null : current.selectedId,
        selectedMemberPath: active ? null : current.selectedMemberPath,
        notice: t('transfer.overwritten'),
      };
    });
    setAddTarget(null);
  }

  function saveControls(document: RosterDocument) {
    return (
      <SaveControls
        state={saves[document.rosterId]}
        revision={document.revision}
        onRetry={() => queue.retry(document.rosterId)}
        onReload={() => {
          void reloadSaved(document.rosterId);
        }}
        onCopy={() => saveCopy(document)}
        onDownload={() => downloadDraft(document, document.rosterId)}
      />
    );
  }

  const totals = currentEvaluation?.totals;
  const sectionAllowances = useMemo(
    () => roster && release && currentEvaluation
      ? rulesets.require(roster.catalogRef.rulesetId).sectionAllowances(roster, release, currentEvaluation)
      : new Map(),
    [roster, release, currentEvaluation],
  );
  const notice = state.notice || (
    !load
      ? t('editor.loading')
      : load.status !== 'ready' ? t('editor.loadFailed') : ''
  );
  return (
    <div hidden={hidden} className="page workspace">
      {!storageReady && <p role="status">{t('storage.loading')}</p>}
      {storageError && (
        <div role="alert">
          <p>{t('storage.loadError')}</p>
          <button
            type="button"
            onClick={() => setStorageRetry((value) => value + 1)}
          >
            {t('storage.retryLoad')}
          </button>
        </div>
      )}
      {notice && <p role="status" className="workspace-notice">{notice}</p>}
      {load && load.status !== 'ready' && (
        <button
          type="button"
          onClick={() => {
            setLoad(null);
            setRetry((value) => value + 1);
          }}
        >
          {t('editor.retry')}
        </button>
      )}
      {!editor ? (
        <>
          <section className="card">
            <h2>{t('home.myRostersTitle')}</h2>
            {!state.sessions.length && (
              <p className="muted">{t('editor.emptyLibrary')}</p>
            )}
            <div className="roster-library">
              {state.sessions.map((item) => (
                <article className="library-item" key={item.document.rosterId}>
                  <h3>{item.document.name}</h3>
                  <p>
                    {item.document.settings.budgetPoints} {t('editor.points')} ·{' '}
                    {item.document.settings.gameSizeId}
                  </p>
                  {saveControls(item.document)}
                  <button
                    type="button"
                    onClick={() => {
                      setState((current) => ({
                        ...current,
                        activeId: item.document.rosterId,
                        selectedId:
                          item.document.selections[0]?.selectionId ?? null,
                        selectedMemberPath: null,
                      }));
                      setAddTarget(null);
                      setSearch('');
                      setTab('roster');
                      window.location.hash = '/editor';
                    }}
                  >
                    {t('editor.open')}
                  </button>{' '}
                  <button
                    type="button"
                    onClick={() => downloadSingleRoster(item.document)}
                  >
                    {t('transfer.exportRoster')}
                  </button>{' '}
                  <button
                    type="button"
                    disabled={
                      saves[item.document.rosterId]?.phase === 'deleting'
                    }
                    onClick={() => {
                      void deleteRoster(item.document);
                    }}
                  >
                    {t('editor.deleteRoster')}
                  </button>
                </article>
              ))}
            </div>
            {unavailable.map((row) => (
              <article className="library-item" key={row.rosterId}>
                <h3>{row.summary?.name ?? row.rosterId}</h3>
                <p>{t('storage.unavailable')}</p>
                <button
                  type="button"
                  onClick={() => downloadDraft(row.document, row.rosterId)}
                >
                  {t('storage.download')}
                </button>
              </article>
            ))}
          </section>
          <ImportPanel
            storageReady={storageReady}
            store={store}
            queue={queue}
            sessions={state.sessions}
            onNotice={(message) =>
              setState((current) => ({ ...current, notice: message }))
            }
            onImported={transferImported}
            onOverwritten={transferOverwritten}
          />
          <section className="card">
            <h2>{t('home.createTitle')}</h2>
            <CreateForm
              choices={creationChoices}
              selected={creationChoice}
              onSelect={setCreationChoice}
              disabled={!defaultRelease || !storageReady}
              onCreate={create}
            />
          </section>
          {debugToolsEnabled && creationChoice.runtime.exampleCommands && (
            <section className="card" aria-labelledby="debug-tools-heading">
              <h2 id="debug-tools-heading">{t('debug.title')}</h2>
              <button
                type="button"
                disabled={!defaultRelease || !storageReady}
                onClick={() => create(t('editor.exampleName'), creationChoice.runtime.settings.defaultBudget, creationChoice.runtime.settings.defaultSize, true)}
              >
                {t('editor.createExample')}
              </button>
              <p>{t('debug.catalogEntries')} {defaultRelease?.catalog.entries.length ?? ''}</p>
              <details>
                <summary>{t('debug.omitted')}</summary>
                <ul>
                  {defaultRelease?.coverage.omitted.map((text) => <li key={text}>{text}</li>)}
                </ul>
              </details>
            </section>
          )}
        </>
      ) : !roster || !release ? (
        <section className="card">
          <h2>{t('editor.noRoster')}</h2>
          <a href="#/">{t('editor.back')}</a>
        </section>
      ) : (
        <>
          <div className="editor-heading">
            <div>
              <p className="eyebrow">{rulesets.require(roster.catalogRef.rulesetId).label} · {release.catalog.armyLists.find(list => list.armyListId === roster.armyListId)?.name ?? roster.armyListId}</p>
              <h2>{roster.name}</h2>
              <p className="muted">
                {t('editor.catalogVersion')}{' '}
                {roster.catalogRef.catalogRevision}{' '}
              </p>
              {saveControls(roster)}
            </div>
            <div className="toolbar">
              <a href="#/">{t('editor.back')}</a>
              <button
                type="button"
                onClick={() => downloadSingleRoster(roster)}
              >
                {t('transfer.exportRoster')}
              </button>
              <button type="button" onClick={openPrint}>
                {t('print.open')}
              </button>
              <button
                type="button"
                disabled={!session?.past.length}
                onClick={() => history('undo')}
              >
                {t('editor.undo')}
              </button>
              <button
                type="button"
                disabled={!session?.future.length}
                onClick={() => history('redo')}
              >
                {t('editor.redo')}
              </button>
            </div>
          </div>
          <SettingsForm
            runtime={rulesets.require(roster.catalogRef.rulesetId)}
            key={roster.revision}
            document={roster}
            onApply={(name, patch) =>
              edit([
                { kind: 'rename', name },
                { kind: 'settings', patch },
              ])
            }
          />
          {totals && <RosterSummary totals={totals} budget={roster.settings.budgetPoints} statistics={currentEvaluation?.statistics ?? []} />}
          <section className="card roster-problems" aria-label={t('editor.problems')}>
            <h3>{t('editor.problems')}</h3>
            {!currentEvaluation?.issues.length && (
              <p>{t('editor.noProblems')}</p>
            )}
            <ul className="issue-list">
              {currentEvaluation?.issues.map((issue, index) => (
                <li key={index}>
                  <button
                    type="button"
                    className="issue-link"
                    onClick={() => {
                      if (issue.selectionId) {
                        selectPurchase(issue.selectionId);
                      } else
                        window.document
                          .getElementById('budget-input')
                          ?.focus();
                    }}
                  >
                      <strong>{issue.ruleId}</strong> {issueMessage(issue.message, roster.catalogRef.rulesetId)}
                  </button>
                </li>
              ))}
            </ul>
          </section>
          <nav className="editor-tabs" aria-label={t('editor.panels')}>
            {['roster', 'actions'].map((value) => (
              <button
                type="button"
                key={value}
                aria-pressed={tab === value}
                onClick={() => setTab(value)}
              >
                {t('editor.' + value)}
              </button>
            ))}
          </nav>
          <div className="editor-grid">
            <section
              className="card editor-pane"
              data-active={tab === 'roster'}
              aria-label={t('editor.roster')}
            >
              <h3>{t('editor.roster')}</h3>
              <RosterTree
                evaluation={currentEvaluation ?? undefined}
                specialRules={specialRulesView}
                document={roster}
                release={release}
                selectedId={state.selectedId}
                selectedMemberPath={state.selectedMemberPath}
                addTarget={addTarget}
                allowances={sectionAllowances}
                onSelect={selectPurchase}
                onAdd={beginAdding}
                onRemove={(selectionId) =>
                  edit([{ kind: 'remove', selectionId }])
                }
              />
            </section>
            <section
              id="editor-actions"
              className="card editor-pane"
              data-active={tab === 'actions'}
              aria-label={t('editor.actions')}
            >
              <div className="action-toolbar">
                <button
                  type="button"
                  className="mobile-roster-back"
                  onClick={() => setTab('roster')}
                >
                  {t('editor.backToRoster')}
                </button>
                {addTarget && (
                  <button type="button" onClick={() => setAddTarget(null)}>
                    {t('editor.doneAdding')}
                  </button>
                )}
              </div>
              {addTarget ? (
                <CatalogPanel
                  document={roster}
                  release={release}
                  target={addTarget}
                  search={search}
                  onSearch={setSearch}
                  onAdd={add}
                />
              ) : (
                <>
                  <h3>{t('editor.details')}</h3>
                  {selected && selectedEntry ? (
                    <>
                      <h4>
                        {selectedEntry.name} · {selectedOrdinal}
                        {state.selectedMemberPath ? ' / ' + (selectedMemberLabel || state.selectedMemberPath.join(' / ').replaceAll('-', ' ')) : ''}
                      </h4>
                      {!state.selectedMemberPath && (
                        <div className="toolbar">
                          <button
                            type="button"
                            onClick={() => {
                              const ids = new Set([selected.selectionId]);
                              let added = true;
                              while (added) {
                                added = false;
                                for (const item of roster.selections)
                                  if (
                                    item.parentSelectionId &&
                                    ids.has(item.parentSelectionId) &&
                                    !ids.has(item.selectionId)
                                  ) {
                                    ids.add(item.selectionId);
                                    added = true;
                                  }
                              }
                              edit([
                                {
                                  kind: 'copy',
                                  selectionId: selected.selectionId,
                                  ids: Object.fromEntries(
                                    [...ids].map((old) => [old, id()]),
                                  ),
                                },
                              ]);
                            }}
                          >
                            {t('editor.copy')}
                          </button>
                        </div>
                      )}
                      {state.selectedMemberPath && (
                        <p className="muted">{t('editor.included')}</p>
                      )}
                      {selectedComposition && (
                        <UnitDataPanel
                          key={selected.selectionId + '/' + (state.selectedMemberPath ?? []).join('/')}
                          node={selectedComposition}
                          release={release}
                        />
                      )}
                      {currentEvaluation && <SpecialRulesPanel view={specialRulesForSelection(
                        specialRulesView,
                        roster, selected.selectionId, state.selectedMemberPath ?? [],
                      )} />}
                      <OptionEditor
                        document={roster}
                        selection={selected}
                        entry={selectedEntry}
                        catalog={release.catalog}
                        composition={currentEvaluation?.composition.find(item => item.selectionId === selected.selectionId)?.node}
                        memberPath={state.selectedMemberPath}
                        onChoices={(choices) =>
                          edit([
                            {
                              kind: 'options',
                              selectionId: selected.selectionId,
                              choices,
                            },
                          ])
                        }
                      />
                      <h4>
                        {t(
                          state.selectedMemberPath
                            ? 'editor.companyCharges'
                            : 'editor.charges',
                        )}
                      </h4>
                      <ul className="charge-list">
                        {currentEvaluation?.chargeLines
                          .filter(
                            (line) => line.selectionId === selected.selectionId,
                          )
                          .map((line) => (
                            <li key={line.chargeLineId}>
                              {line.optionChoiceRef
                                ? release.catalog.optionGroups
                                    .find(
                                      (group) =>
                                        group.localId ===
                                        line.optionChoiceRef
                                          ?.optionGroupLocalId,
                                    )
                                    ?.options.find(
                                      (option) =>
                                        option.localId ===
                                        line.optionChoiceRef?.optionLocalId,
                                    )?.name
                                : t('editor.baseCost')}{' '}
                              · {line.chargedUnits} × · {value(line.points)}{' '}
                              {t('editor.points')} / {value(line.br)} BR
                            </li>
                          ))}
                      </ul>
                      <h4>{t('editor.composition')}</h4>
                      {selectedComposition ? (
                        <CompositionTree node={selectedComposition} release={release} />
                      ) : (
                        <p>
                          {selectedEntry.composition.state === 'no-entities'
                            ? t('editor.noEntities')
                            : t('editor.unknown')}
                        </p>
                      )}
                      <p className="muted">{t('editor.attributesUnknown')}</p>
                      <h4>{t('editor.sources')}</h4>
                      <ul>
                        {selectedEntry.sourceRefs.map((source, index) => (
                          <li key={index}>
                            {
                              release.catalog.manifest.sources.find(
                                (item) => item.documentId === source.documentId,
                              )?.title
                            }{' '}
                            · PDF {source.pdfPage ?? '—'}
                            {source.printedPage !== undefined &&
                            source.printedPage !== source.pdfPage
                              ? ` (${source.printedPage})`
                              : ''}
                          </li>
                        ))}
                      </ul>
                    </>
                  ) : (
                    <p className="muted">{t('editor.chooseSelection')}</p>
                  )}
                </>
              )}

            </section>
          </div>
        </>
      )}
      {printSnapshot && (
        <PrintPreview
          snapshot={printSnapshot}
          onClose={() => setPrintSnapshot(null)}
          onRefresh={openPrint}
        />
      )}
    </div>
  );
}

function CompositionTree({
  node,
  release,
}: {
  node: EvaluatedCompositionNode;
  release: AppCatalogRelease;
}) {
  return (
    <ul className="composition-tree">
      <li>
        {node.quantity} ×{' '}
        {release.catalog.profiles.find(
          (profile) => profile.localId === node.profileLocalId,
        )?.name ?? node.role.replaceAll('-', ' ')}
        {node.training?.state === 'known' ? ' · ' + (rulesets.get(release.catalog.manifest.identity.rulesetId)?.trainingLabels[node.training.value] ?? node.training.value) : ''}
        {node.children?.map((child) => (
          <CompositionTree key={child.nodeId} node={child} release={release} />
        ))}
      </li>
    </ul>
  );
}
