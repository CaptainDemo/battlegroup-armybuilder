import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  createRosterDocument,
  executeRosterCommands,
  type RosterCommand,
  type RosterDocument,
  type RosterSelection,
  type TrackedValue,
  type EvaluatedCompositionNode,
} from '@battlegroup/core';
import {
  evaluateClassicRoster,
  type ClassicCatalogRelease,
} from '@battlegroup/classic-coldwar';
import {
  catalogIndex,
  loadCatalog,
  type CatalogLoadResult,
} from '../../adapters/catalog/catalogLoader';
import { t } from '../../i18n';
import { RosterTree, type AddTarget } from './RosterTree';
import { CatalogPanel } from './CatalogPanel';
import { OptionEditor } from './OptionEditor';
import {
  makeSession,
  moveHistory,
  recordEdit,
  type EditorSession,
} from './session';

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
  const [load, setLoad] = useState<CatalogLoadResult | null>(null);
  const [retry, setRetry] = useState(0);
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
  useEffect(() => {
    let cancelled = false;
    const identity = catalogIndex.releases[0]?.identity;
    if (identity)
      void loadCatalog(identity)
        .then((result) => {
          if (!cancelled) setLoad(result);
        })
        .catch(() => {
          if (!cancelled)
            setLoad({ status: 'invalid-data', reason: t('editor.loadFailed') });
        });
    return () => {
      cancelled = true;
    };
  }, [retry]);
  const release = load?.status === 'ready' ? load.release : null;
  const session = state.sessions.find(
    (item) => item.document.rosterId === state.activeId,
  );
  const roster = session?.document;
  const evaluation = useMemo(
    () => (roster && release ? evaluateClassicRoster(roster, release) : null),
    [roster, release],
  );
  const currentEvaluation =
    evaluation && evaluation.identity.inputRevision === roster?.revision
      ? evaluation
      : null;
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
          'selection-' +
            state.selectedId +
            (state.selectedMemberPath
              ? '-member-' + state.selectedMemberPath.join('-')
              : ''),
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
    if (!release) return;
    const created = createRosterDocument(
      {
        rosterId: id(),
        revision: id(),
        name,
        catalogRef: release.catalog.manifest.identity,
        armyListId: release.catalog.armyLists[0]!.armyListId,
        settings: { budgetPoints: budget, gameSizeId: size, optionalRules: [] },
      },
      release,
    );
    if (!created.ok) {
      setState((current) => ({
        ...current,
        notice: created.problems.map((problem) => problem.message).join(' '),
      }));
      return;
    }
    let document = created.document;
    if (example) {
      const plan = [
        'fhq',
        't72-platoon',
        'bmp1-platoon',
        'bmp1-platoon-medic',
        'bmp1-platoon-fire-support',
        'bmp1-platoon-agl',
        'brdm2-recon',
        'zsu23-4',
        'artillery-request-priority3',
      ];
      const ids = plan.map(() => id());
      const commands: RosterCommand[] = plan.map((entryId, i) => {
        const entry = release!.catalog.entries.find(
          (item) => item.localId === entryId,
        )!;
        const attachment =
          release!.purchases.find((item) => item.entryId === entryId)!.kind ===
          'attachment';
        return {
          kind: 'add',
          selection: {
            selectionId: ids[i]!,
            entryReference: { ...document.catalogRef, localId: entryId },
            parentSelectionId: attachment ? ids[2]! : null,
            ...(!attachment ? { sectionId: entry.sectionIds[0]! } : {}),
            optionChoices: [],
          },
        };
      });
      const populated = executeRosterCommands(
        document,
        commands,
        release,
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

  const totals = currentEvaluation?.totals;
  return (
    <div hidden={hidden} className="page workspace">
      <section className="preview-note">
        <strong>{t('editor.preview')}</strong>
        <span>{t('editor.sessionOnly')}</span>
      </section>
      <p role="status" className="workspace-notice">
        {state.notice ||
          (!load
            ? t('editor.loading')
            : load.status !== 'ready'
              ? load.reason
              : t('editor.ready'))}
      </p>
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
                    onClick={() =>
                      setState((current) => ({
                        ...current,
                        sessions: current.sessions.filter(
                          (session) =>
                            session.document.rosterId !==
                            item.document.rosterId,
                        ),
                        activeId:
                          current.activeId === item.document.rosterId
                            ? null
                            : current.activeId,
                      }))
                    }
                  >
                    {t('editor.deleteRoster')}
                  </button>
                </article>
              ))}
            </div>
          </section>
          <section className="card">
            <h2>{t('home.createTitle')}</h2>
            <CreateForm disabled={!release} onCreate={create} />
            <button
              type="button"
              disabled={!release}
              onClick={() =>
                create(t('editor.exampleName'), 500, 'platoon', true)
              }
            >
              {t('editor.createExample')}
            </button>
          </section>
          <section className="card">
            <h2>{t('editor.coverageTitle')}</h2>
            <p>
              {t('editor.coverageBody')}{' '}
              {release ? release.catalog.entries.length : ''}
            </p>
            {release?.coverage.omitted.map((text) => (
              <p className="muted" key={text}>
                {text === 'A05 and A06 ambiguous combinations'
                  ? t('editor.omittedOptions')
                  : text}
              </p>
            ))}
          </section>
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
              <p className="eyebrow">Classic Cold War · Soviet · V4.1</p>
              <h2>{roster.name}</h2>
              <p className="muted">
                {t('editor.catalogVersion')} {roster.catalogRef.catalogRevision}{' '}
                · {t('editor.sessionBadge')}
              </p>
            </div>
            <div className="toolbar">
              <a href="#/">{t('editor.back')}</a>
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
          <div className="totals-strip">
            <Metric
              label={t('editor.points')}
              amount={
                totals
                  ? (totals.points.complete
                      ? ''
                      : t('editor.knownSubtotal') + ' ') +
                    totals.points.knownSubtotal
                  : '—'
              }
            />
            <Metric
              label={t('editor.br')}
              amount={
                totals
                  ? (totals.br.complete
                      ? ''
                      : t('editor.knownSubtotal') + ' ') +
                    totals.br.knownSubtotal
                  : '—'
              }
            />
            <Metric
              label={t('editor.remaining')}
              amount={
                totals?.points.complete
                  ? String(
                      roster.settings.budgetPoints -
                        totals.points.knownSubtotal,
                    )
                  : '—'
              }
            />
            <div
              className={
                'metric ' +
                (currentEvaluation?.legality === 'violations-confirmed'
                  ? 'metric--error'
                  : '')
              }
            >
              <span>{t('editor.checks')}</span>
              <strong>
                {t(
                  currentEvaluation?.legality === 'violations-confirmed'
                    ? 'editor.violations'
                    : 'editor.incomplete',
                )}
              </strong>
            </div>
          </div>
          <SettingsForm
            key={roster.revision}
            document={roster}
            onApply={(name, patch) =>
              edit([
                { kind: 'rename', name },
                { kind: 'settings', patch },
              ])
            }
          />
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
                document={roster}
                release={release}
                selectedId={state.selectedId}
                selectedMemberPath={state.selectedMemberPath}
                addTarget={addTarget}
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
                        {state.selectedMemberPath
                          ? ' / ' +
                            state.selectedMemberPath
                              .join(' / ')
                              .replaceAll('-', ' ')
                          : ''}
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
                      <OptionEditor
                        document={roster}
                        selection={selected}
                        entry={selectedEntry}
                        catalog={release.catalog}
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
                        <CompositionTree
                          node={selectedComposition}
                          release={release}
                        />
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
                          setState((current) => ({
                            ...current,
                            selectedId: issue.selectionId!,
                            selectedMemberPath: null,
                          }));
                          setAddTarget(null);
                          setTab('roster');
                        } else
                          window.document
                            .getElementById('budget-input')
                            ?.focus();
                      }}
                    >
                      <strong>{issue.ruleId}</strong> {issue.message}
                    </button>
                  </li>
                ))}
              </ul>
              <details>
                <summary>{t('editor.support')}</summary>
                <ul>
                  {currentEvaluation?.resources.map((resource, index) => (
                    <li key={index}>
                      {resource.resourceKind} · {resource.scope}:{' '}
                      {resource.consumed} / {value(resource.capacity)}
                    </li>
                  ))}
                  {currentEvaluation?.statistics.map((stat) => (
                    <li key={stat.statId}>
                      {stat.label}: {stat.value}
                    </li>
                  ))}
                </ul>
              </details>
              <details>
                <summary>{t('editor.coverage')}</summary>
                <ul>
                  {currentEvaluation?.coverage.map((check, index) => (
                    <li key={index}>
                      {check.checkId}: {check.status.replaceAll('-', ' ')}
                      {check.note ? ' — ' + check.note : ''}
                    </li>
                  ))}
                </ul>
              </details>
            </section>
          </div>
        </>
      )}
    </div>
  );
}

function CreateForm({
  disabled,
  onCreate,
}: {
  disabled: boolean;
  onCreate: (name: string, budget: number, size: string) => void;
}) {
  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    onCreate(
      String(data.get('name')),
      Number(data.get('budget')),
      String(data.get('size')),
    );
  };
  return (
    <form className="settings-form" onSubmit={submit}>
      <label>
        {t('editor.name')}
        <input name="name" required defaultValue="New Soviet roster" />
      </label>
      <label>
        {t('editor.ruleset')}
        <select disabled>
          <option>Classic Cold War</option>
        </select>
      </label>
      <label>
        {t('editor.army')}
        <select disabled>
          <option>Soviet Armoured Division V4.1</option>
        </select>
      </label>
      <label>
        {t('editor.budget')}
        <input
          name="budget"
          type="number"
          min="1"
          required
          defaultValue="500"
        />
      </label>
      <label>
        {t('editor.gameSize')}
        <SizeSelect name="size" defaultValue="platoon" />
      </label>
      <button type="submit" disabled={disabled}>
        {t('editor.create')}
      </button>
    </form>
  );
}
function SizeSelect(props: { name: string; defaultValue: string }) {
  return (
    <select {...props}>
      {['squad', 'platoon', 'company', 'battalion'].map((size) => (
        <option key={size} value={size}>
          {size}
        </option>
      ))}
    </select>
  );
}
function SettingsForm({
  document,
  onApply,
}: {
  document: RosterDocument;
  onApply: (name: string, patch: Partial<RosterDocument['settings']>) => void;
}) {
  return (
    <form
      className="settings-form card settings-card"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        onApply(String(data.get('roster-name')), {
          budgetPoints: Number(data.get('budget')),
          gameSizeId: String(data.get('size')),
          scenarioId: String(data.get('scenario') ?? '') || undefined,
          playerRoleId: String(data.get('player-role') ?? '') || undefined,
        });
      }}
    >
      <label>
        {t('editor.name')}
        <input name="roster-name" required defaultValue={document.name} />
      </label>
      <label>
        {t('editor.budget')}
        <input
          id="budget-input"
          name="budget"
          type="number"
          min="1"
          required
          defaultValue={document.settings.budgetPoints}
        />
      </label>
      <label>
        {t('editor.gameSize')}
        <SizeSelect name="size" defaultValue={document.settings.gameSizeId} />
      </label>
      <label>
        {t('editor.scenario')}
        <select
          name="scenario"
          defaultValue={document.settings.scenarioId ?? ''}
        >
          <option value="">{t('editor.unspecified')}</option>
          <option value="attack-defence">{t('editor.attackDefence')}</option>
        </select>
      </label>
      <label>
        {t('editor.playerRole')}
        <select
          name="player-role"
          defaultValue={document.settings.playerRoleId ?? ''}
        >
          <option value="">{t('editor.unspecified')}</option>
          <option value="attacker">{t('editor.attacker')}</option>
          <option value="defender">{t('editor.defender')}</option>
        </select>
      </label>
      <button type="submit">{t('editor.applySettings')}</button>
    </form>
  );
}
function Metric({ label, amount }: { label: string; amount: string }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong
        data-testid={
          label === 'Points'
            ? 'points-total'
            : label === 'Battle rating'
              ? 'br-total'
              : undefined
        }
      >
        {amount}
      </strong>
    </div>
  );
}
function CompositionTree({
  node,
  release,
}: {
  node: EvaluatedCompositionNode;
  release: ClassicCatalogRelease;
}) {
  return (
    <ul className="composition-tree">
      <li>
        {node.quantity} ×{' '}
        {release.catalog.profiles.find(
          (profile) => profile.localId === node.profileLocalId,
        )?.name ?? node.role.replaceAll('-', ' ')}
        {node.training?.state === 'known' ? ' · ' + node.training.value : ''}
        {node.children?.map((child) => (
          <CompositionTree key={child.nodeId} node={child} release={release} />
        ))}
      </li>
    </ul>
  );
}
