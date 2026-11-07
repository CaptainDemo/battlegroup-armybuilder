import type {
  RosterDocument,
  RosterSelection,
  TrackedValue,
  CompositionNode,
} from '@battlegroup/core';
import type { ClassicCatalogRelease } from '@battlegroup/classic-coldwar';
import { t } from '../../i18n';
import { sectionLabel } from './sectionLabel';

/** A UI destination, separate from the player's stored purchase tree. */
export type AddTarget =
  | { kind: 'section'; sectionId: string }
  | { kind: 'attachment'; parentSelectionId: string; memberPath?: string[] };

interface TreeProps {
  document: RosterDocument;
  release: ClassicCatalogRelease;
  selectedId: string | null;
  selectedMemberPath: string[] | null;
  addTarget: AddTarget | null;
  onSelect: (id: string, memberPath?: string[]) => void;
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
        .map((section) => {
          const label = sectionLabel(document.catalogRef, section);
          return (
            <section
              className="roster-section"
              key={section.sectionId}
              aria-label={label}
              data-adding={
                addTarget?.kind === 'section' &&
                addTarget.sectionId === section.sectionId
              }
            >
              <div className="roster-section-heading">
                <h4>{label}</h4>
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
                aria-label={t('editor.addTo') + ' ' + label}
                onClick={() =>
                  onAdd({ kind: 'section', sectionId: section.sectionId })
                }
              >
                ＋ {t('editor.addFormation')}
              </button>
            </section>
          );
        })}
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
    (item) =>
      item.parentSelectionId === selection.selectionId &&
      !item.targetMemberPath,
  );
  const hasAttachments = release.purchases.some(
    (access) =>
      access.kind === 'attachment' &&
      access.parentEntryIds.includes(entry.localId) &&
      !access.parentMemberPaths?.[entry.localId],
  );
  const hasPlatoonSupport = entry.resourceGrants?.some(
    (grant) =>
      grant.resourceKind === 'platoon-support-slots' &&
      grant.scope === 'parent-formation',
  );
  return (
    <div className="purchase-branch">
      <div className="purchase-row">
        <button
          type="button"
          id={'selection-' + selection.selectionId}
          className="purchase-card"
          aria-pressed={
            selectedId === selection.selectionId && !props.selectedMemberPath
          }
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
      {entry.composition.state === 'known' &&
        entry.composition.root.children
          ?.filter((node) => node.configurableSlot && node.role === 'platoon')
          .map((member) => (
            <FixedPlatoon
              key={member.nodeId}
              {...props}
              selection={selection}
              member={member}
              parentLabel={label}
            />
          ))}
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
              aria-label={
                t(
                  hasPlatoonSupport
                    ? 'editor.addAttachmentTo'
                    : 'editor.addAttachedUnitTo',
                ) +
                ' ' +
                label
              }
              aria-pressed={
                addTarget?.kind === 'attachment' &&
                addTarget.parentSelectionId === selection.selectionId &&
                !addTarget.memberPath
              }
              onClick={() =>
                onAdd({
                  kind: 'attachment',
                  parentSelectionId: selection.selectionId,
                })
              }
            >
              ＋{' '}
              {t(
                hasPlatoonSupport
                  ? 'editor.addAttachment'
                  : 'editor.addAttachedUnit',
              )}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function FixedPlatoon(
  props: TreeProps & {
    selection: RosterSelection;
    member: CompositionNode;
    parentLabel: string;
  },
) {
  const {
    selection,
    member,
    parentLabel,
    document,
    release,
    onSelect,
    onAdd,
    selectedId,
    selectedMemberPath,
    addTarget,
  } = props;
  const path = [member.nodeId];
  const label = member.nodeId.replaceAll('-', ' ');
  const children = document.selections.filter(
    (child) =>
      child.parentSelectionId === selection.selectionId &&
      JSON.stringify(child.targetMemberPath) === JSON.stringify(path),
  );
  const hasMenu = release.purchases.some(
    (access) =>
      access.kind === 'attachment' &&
      access.parentMemberPaths?.[selection.entryReference.localId]?.some(
        (target) => JSON.stringify(target) === JSON.stringify(path),
      ),
  );
  return (
    <div className="purchase-children fixed-platoon">
      <button
        type="button"
        id={'selection-' + selection.selectionId + '-member-' + path.join('-')}
        className="purchase-card"
        aria-label={label + ' — ' + parentLabel}
        aria-pressed={
          selectedId === selection.selectionId &&
          JSON.stringify(selectedMemberPath) === JSON.stringify(path)
        }
        onClick={() => onSelect(selection.selectionId, path)}
      >
        <strong>{label}</strong>
        <small>{t('editor.included')}</small>
      </button>
      {children.map((child, index) => (
        <PurchaseBranch
          key={child.selectionId}
          {...props}
          selection={child}
          ordinal={index + 1}
        />
      ))}
      {hasMenu && (
        <button
          type="button"
          className="add-slot"
          aria-label={
            t('editor.addAttachmentTo') + ' ' + label + ' — ' + parentLabel
          }
          aria-pressed={
            addTarget?.kind === 'attachment' &&
            addTarget.parentSelectionId === selection.selectionId &&
            JSON.stringify(addTarget.memberPath) === JSON.stringify(path)
          }
          onClick={() =>
            onAdd({
              kind: 'attachment',
              parentSelectionId: selection.selectionId,
              memberPath: path,
            })
          }
        >
          ＋ {t('editor.addAttachment')}
        </button>
      )}
    </div>
  );
}
