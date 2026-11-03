import type {
  RosterDocument,
  RosterSelection,
  TrackedValue,
} from '@battlegroup/core';
import type { ClassicCatalogRelease } from '@battlegroup/classic-coldwar';
import { t } from '../../i18n';

/** A UI destination, separate from the player's stored purchase tree. */
export type AddTarget =
  | { kind: 'section'; sectionId: string }
  | { kind: 'attachment'; parentSelectionId: string };

interface TreeProps {
  document: RosterDocument;
  release: ClassicCatalogRelease;
  selectedId: string | null;
  addTarget: AddTarget | null;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
  onAdd: (target: AddTarget) => void;
}

const cost = (value: TrackedValue): string =>
  value.state === 'known'
    ? String(value.value)
    : t(
        value.state === 'not_applicable'
          ? 'editor.notApplicable'
          : 'editor.unknown',
      );

export function RosterTree(props: TreeProps) {
  const { document, release, addTarget, onAdd } = props;
  const sections = release.catalog.armyLists.find(
    (list) => list.armyListId === document.armyListId,
  )!.structure.sections;
  return (
    <>
      {!document.selections.length && (
        <p className="muted">{t('editor.emptyRoster')}</p>
      )}
      {sections
        .filter((section) =>
          release.catalog.entries.some(
            (entry) =>
              entry.sectionIds.includes(section.sectionId) &&
              release.purchases.some(
                (access) =>
                  access.kind === 'top-level' &&
                  access.entryId === entry.localId,
              ),
          ),
        )
        .map((section) => (
          <section
            className="roster-section"
            key={section.sectionId}
            aria-label={section.name}
            data-adding={
              addTarget?.kind === 'section' &&
              addTarget.sectionId === section.sectionId
            }
          >
            <div className="roster-section-heading">
              <h4>{section.name}</h4>
            </div>
            {document.selections
              .filter(
                (selection) =>
                  selection.parentSelectionId === null &&
                  selection.sectionId === section.sectionId,
              )
              .map((selection, index) => (
                <PurchaseBranch
                  key={selection.selectionId}
                  {...props}
                  selection={selection}
                  ordinal={index + 1}
                />
              ))}
            <button
              type="button"
              className="add-slot"
              aria-label={t('editor.addTo') + ' ' + section.name}
              onClick={() =>
                onAdd({ kind: 'section', sectionId: section.sectionId })
              }
            >
              ＋ {t('editor.addFormation')}
            </button>
          </section>
        ))}
    </>
  );
}

function PurchaseBranch(
  props: TreeProps & { selection: RosterSelection; ordinal: number },
) {
  const {
    selection,
    ordinal,
    document,
    release,
    selectedId,
    addTarget,
    onSelect,
    onRemove,
    onAdd,
  } = props;
  const entry = release.catalog.entries.find(
    (item) => item.localId === selection.entryReference.localId,
  )!;
  const label = entry.name + ' · ' + ordinal;
  const children = document.selections.filter(
    (item) => item.parentSelectionId === selection.selectionId,
  );
  const hasAttachments = release.purchases.some(
    (access) =>
      access.kind === 'attachment' &&
      access.parentEntryIds.includes(entry.localId),
  );
  return (
    <div className="purchase-branch">
      <div className="purchase-row">
        <button
          type="button"
          id={'selection-' + selection.selectionId}
          className="purchase-card"
          aria-pressed={selectedId === selection.selectionId}
          onClick={() => onSelect(selection.selectionId)}
        >
          <strong>{label}</strong>
          <span>
            {cost(entry.baseCost.points)} {t('editor.points')} /{' '}
            {cost(entry.baseCost.br)} BR
          </span>
        </button>
        <button
          type="button"
          className="purchase-remove"
          aria-label={t('editor.remove') + ' ' + label}
          onClick={() => onRemove(selection.selectionId)}
        >
          {t('editor.delete')}
        </button>
      </div>
      {(children.length > 0 || hasAttachments) && (
        <div className="purchase-children">
          {children.map((child, index) => (
            <PurchaseBranch
              key={child.selectionId}
              {...props}
              selection={child}
              ordinal={index + 1}
            />
          ))}
          {hasAttachments && (
            <button
              type="button"
              className="add-slot"
              aria-label={t('editor.addAttachmentTo') + ' ' + label}
              aria-pressed={
                addTarget?.kind === 'attachment' &&
                addTarget.parentSelectionId === selection.selectionId
              }
              onClick={() =>
                onAdd({
                  kind: 'attachment',
                  parentSelectionId: selection.selectionId,
                })
              }
            >
              ＋ {t('editor.addAttachment')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
