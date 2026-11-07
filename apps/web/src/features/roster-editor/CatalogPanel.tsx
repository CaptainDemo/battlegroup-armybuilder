import type {
  RosterDocument,
  RosterSelection,
  TrackedValue,
} from '@battlegroup/core';
import {
  getClassicEntryAvailability,
  type ClassicCatalogRelease,
} from '@battlegroup/classic-coldwar';
import { t } from '../../i18n';
import type { AddTarget } from './RosterTree';
import { sectionLabel } from './sectionLabel';

export function CatalogPanel({
  document,
  release,
  target,
  search,
  onSearch,
  onAdd,
}: {
  document: RosterDocument;
  release: ClassicCatalogRelease;
  target: AddTarget;
  search: string;
  onSearch: (search: string) => void;
  onAdd: (
    entryId: string,
    parent?: RosterSelection,
    sectionId?: string,
    memberPath?: string[],
  ) => void;
}) {
  const parent =
    target.kind === 'attachment'
      ? document.selections.find(
          (item) => item.selectionId === target.parentSelectionId,
        )
      : undefined;
  const parentEntry = release.catalog.entries.find(
    (entry) => entry.localId === parent?.entryReference.localId,
  );
  const ordinal = parent
    ? document.selections
        .filter(
          (item) =>
            item.parentSelectionId === parent.parentSelectionId &&
            (parent.parentSelectionId !== null ||
              item.sectionId === parent.sectionId),
        )
        .findIndex((item) => item.selectionId === parent.selectionId) + 1
    : 0;
  const section =
    target.kind === 'section'
      ? release.catalog.armyLists
          .find((list) => list.armyListId === document.armyListId)!
          .structure.sections.find(
            (section) => section.sectionId === target.sectionId,
          )
      : undefined;
  const destination = section
    ? sectionLabel(document.catalogRef, section)
    : parentEntry
      ? parentEntry.name + ' · ' + ordinal
      : t('editor.chooseSelection');
  const entries = release.catalog.entries.filter((entry) => {
    const access = release.purchases.find(
      (item) => item.entryId === entry.localId,
    );
    return (
      (target.kind === 'section'
        ? access?.kind === 'top-level' &&
          entry.sectionIds.includes(target.sectionId)
        : !!parent &&
          access?.kind === 'attachment' &&
          access.parentEntryIds.includes(parent.entryReference.localId) &&
          (target.memberPath
            ? access.parentMemberPaths?.[parent.entryReference.localId]?.some(
                (path) =>
                  JSON.stringify(path) === JSON.stringify(target.memberPath),
              )
            : !access.parentMemberPaths?.[parent.entryReference.localId])) &&
      entry.name.toLowerCase().includes(search.toLowerCase())
    );
  });
  const cost = (value: TrackedValue): string =>
    value.state === 'known'
      ? String(value.value)
      : t(
          value.state === 'not_applicable'
            ? 'editor.notApplicable'
            : 'editor.unknown',
        );
  return (
    <section aria-label={t('editor.catalog')}>
      <h3>
        {t('editor.addTo')} {destination}
        {target.kind === 'attachment' && target.memberPath
          ? ' / ' + target.memberPath.join(' / ').replaceAll('-', ' ')
          : ''}
      </h3>
      <p className="muted">{t('editor.addingHint')}</p>
      <label>
        {t('editor.search')}
        <input
          type="search"
          value={search}
          onChange={(event) => onSearch(event.target.value)}
        />
      </label>
      {!entries.length && <p className="muted">{t('editor.noCandidates')}</p>}
      {entries.map((entry) => {
        const available = getClassicEntryAvailability(
          document,
          release,
          entry.localId,
          target.kind === 'section'
            ? { sectionId: target.sectionId }
            : {
                parentSelectionId: target.parentSelectionId,
                ...(target.memberPath
                  ? { targetMemberPath: target.memberPath }
                  : {}),
              },
        );
        return (
          <article className="catalog-item" key={entry.localId}>
            <strong>{entry.name}</strong>
            <small>
              {cost(entry.baseCost.points)} {t('editor.points')} /{' '}
              {cost(entry.baseCost.br)} BR
            </small>
            <button
              type="button"
              aria-label={t('editor.add') + ' ' + entry.name}
              disabled={available.status === 'blocked'}
              onClick={() =>
                onAdd(
                  entry.localId,
                  parent,
                  target.kind === 'section' ? target.sectionId : undefined,
                  target.kind === 'attachment' ? target.memberPath : undefined,
                )
              }
            >
              {t('editor.add')}
            </button>
          </article>
        );
      })}
    </section>
  );
}
