import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import type { Evaluation, RosterDocument, TrackedValue } from '@battlegroup/core';
import type { ClassicCatalogRelease } from '@battlegroup/classic-coldwar';
import { t } from '../../i18n';
import {
  projectPrintableRoster,
  type PrintableRoster,
  type PrintChargeLineView,
  type PrintCompositionRow,
  type PrintMeasure,
  type PrintOptionChoiceView,
  type PrintPurchaseView,
} from './printProjection';
import { PrintUnitDataAppendix } from './PrintUnitDataAppendix';
import { RuleCoverage } from '../../components/RuleCoverage';

/**
 * Frozen print preview (M11). The snapshot is captured when the preview opens
 * (or is explicitly refreshed); closing and reopening always re-captures the
 * current draft. The preview never edits the roster, so undo history, save
 * state and the draft itself are untouched by printing.
 */
export interface PrintSnapshot {
  readonly document: RosterDocument;
  readonly release: ClassicCatalogRelease;
  readonly evaluation: Evaluation;
}

export interface PrintOptions {
  readonly includeUnitData: boolean;
}

export function PrintPreview({
  snapshot,
  onClose,
  onRefresh,
}: {
  snapshot: PrintSnapshot;
  onClose: () => void;
  onRefresh: () => void;
}) {
  const [options, setOptions] = useState<PrintOptions>({ includeUnitData: false });
  const projection = useMemo(
    () => projectPrintableRoster(snapshot),
    [snapshot],
  );
  // The print stylesheet keys off this attribute to show only the paper sheet.
  useEffect(() => {
    document.body.setAttribute('data-print-preview', 'open');
    return () => document.body.removeAttribute('data-print-preview');
  }, []);
  return (
    <div className="print-overlay" role="dialog" aria-modal="true" aria-label={t('print.title')}>
      <div className="print-overlay-bar">
        <span className="print-snapshot-note">
          {t('print.snapshotOf')} <code>{snapshot.document.revision}</code>
        </span>
        <button type="button" onClick={onRefresh}>
          {t('print.refresh')}
        </button>
        <button type="button" onClick={() => window.print()}>
          {t('print.printNow')}
        </button>
        <button type="button" onClick={onClose} autoFocus>
          {t('print.close')}
        </button>
        <fieldset className="print-export-options">
          <legend>{t('print.options')}</legend>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={options.includeUnitData}
              onChange={event => setOptions({ ...options, includeUnitData: event.target.checked })}
            />
            {t('print.includeUnitData')}
          </label>
        </fieldset>
      </div>
      {projection.status === 'stale' ? (
        <div className="print-sheet print-sheet--stale" role="alert">
          <h2>{t('print.staleTitle')}</h2>
          <p>{t('print.staleBody')}</p>
          <p className="muted" data-testid="print-stale-reason">
            {t('print.staleReason')}: {projection.reason} ({projection.detail})
          </p>
        </div>
      ) : (
        <RosterSheet roster={projection.roster} options={options} />
      )}
    </div>
  );
}

const tracked = (value: TrackedValue): string =>
  value.state === 'known'
    ? String(value.value)
    : t(value.state === 'not_applicable' ? 'editor.notApplicable' : 'editor.unknown');

function amount(measure: PrintMeasure): string {
  return measure.complete
    ? String(measure.knownSubtotal)
    : t('editor.knownSubtotal') + ' ' + measure.knownSubtotal;
}

function RosterSheet({ roster, options }: { roster: PrintableRoster; options: PrintOptions }) {
  return (
    <div className="print-sheet" id="print-sheet">
      <header className="print-head">
        <h1>{roster.name}</h1>
        <p className="print-sub">{roster.armyListLabel}</p>
        <div className="print-totals" data-testid="print-totals">
          <div>
            <span>{t('editor.points')}</span>
            <strong data-testid="print-points-total">
              {amount(roster.totals.points)}
              {!roster.totals.points.complete && <small> {t('print.someUnknown')}</small>}
            </strong>
          </div>
          <div>
            <span>{t('editor.br')}</span>
            <strong data-testid="print-br-total">
              {amount(roster.totals.br)}
              {!roster.totals.br.complete && <small> {t('print.someUnknown')}</small>}
            </strong>
          </div>
          <div>
            <span>{t('editor.remaining')}</span>
            <strong data-testid="print-remaining">
              {roster.budgetRemaining === null ? '—' : String(roster.budgetRemaining)}
            </strong>
          </div>
          <div>
            <span>{t('editor.checks')}</span>
            <strong data-testid="print-legality">{t('print.legality.' + roster.legality)}</strong>
          </div>
        </div>
        <dl className="print-meta">
          <div>
            <dt>{t('print.meta.ruleset')}</dt>
            <dd>{roster.versions.rulesetId}</dd>
          </div>
          <div>
            <dt>{t('print.meta.catalog')}</dt>
            <dd>
              {roster.versions.catalogId} · {roster.versions.catalogRevision}
            </dd>
          </div>
          <div>
            <dt>{t('print.meta.rules')}</dt>
            <dd>{roster.versions.rulesRevision}</dd>
          </div>
          <div>
            <dt>{t('print.meta.format')}</dt>
            <dd>
              {roster.versions.rosterFormat} · {roster.versions.catalogSchema}
            </dd>
          </div>
          <div>
            <dt>{t('print.meta.snapshot')}</dt>
            <dd data-testid="print-edit-revision">{roster.versions.editRevision}</dd>
          </div>
          <div>
            <dt>{t('editor.budget')}</dt>
            <dd>{roster.settings.budgetPoints}</dd>
          </div>
          <div>
            <dt>{t('editor.gameSize')}</dt>
            <dd>{roster.settings.gameSizeId}</dd>
          </div>
          <div>
            <dt>{t('editor.scenario')}</dt>
            <dd>
              {roster.settings.scenarioId ?? t('editor.unspecified')}
              {roster.settings.playerRoleId
                ? ' · ' + t(roster.settings.playerRoleId === 'attacker' ? 'editor.attacker' : 'editor.defender')
                : ''}
            </dd>
          </div>
          {roster.settings.optionalRules.length > 0 && (
            <div>
              <dt>{t('print.meta.optionalRules')}</dt>
              <dd data-testid="print-optional-rules">{roster.settings.optionalRules.join(', ')}</dd>
            </div>
          )}
        </dl>
        <p className="print-edition muted">
          {roster.versions.baseEdition} — {roster.versions.sourceTitles.join(' · ')}
        </p>
      </header>

      {roster.notes !== null && (
        <section className="print-block print-notes" aria-label={t('print.notes')}>
          <h2>{t('print.notes')}</h2>
          <p className="print-prewrap">{roster.notes}</p>
        </section>
      )}

      <section className="print-block" aria-label={t('editor.problems')}>
        <h2>{t('editor.problems')}</h2>
        {roster.issues.length === 0 ? (
          <p>{t('editor.noProblems')}</p>
        ) : (
          <ul className="print-issues" data-testid="print-issues">
            {roster.issues.map((issue, index) => (
              <li key={index} data-severity={issue.severity}>
                <strong>{issue.ruleId}</strong> {issue.message}
                {issue.actual !== undefined || issue.limit !== undefined ? (
                  <span className="muted">
                    {' '}
                    ({issue.actual !== undefined ? String(issue.actual) : '—'} /{' '}
                    {issue.limit !== undefined ? String(issue.limit) : '—'})
                  </span>
                ) : null}
                {issue.purchaseHeading ? <span className="muted"> — {issue.purchaseHeading}</span> : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      {roster.sections.map((section) => (
        <section className="print-block" key={section.sectionId} aria-label={section.label}>
          <h2>{section.label}</h2>
          {section.purchases.map((purchase) => (
            <PurchaseBlock key={purchase.selectionId} purchase={purchase} />
          ))}
        </section>
      ))}

      <section className="print-block" aria-label={t('editor.support')}>
        <h2>{t('editor.support')}</h2>
        {roster.resources.length === 0 && roster.statistics.length === 0 && <p>—</p>}
        {roster.resources.length > 0 && (
          <ul className="print-plain">
            {roster.resources.map((resource, index) => (
              <li key={index}>
                {resource.resourceKind} · {resource.scope}: {resource.consumed} /{' '}
                {tracked(resource.capacity)} ({resource.status.replaceAll('-', ' ')})
              </li>
            ))}
          </ul>
        )}
        {roster.statistics.length > 0 && (
          <ul className="print-plain">
            {roster.statistics.map((stat) => (
              <li key={stat.statId}>
                {stat.label}: {stat.value}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="print-block" aria-label={t('editor.coverage')}>
        <h2>{t('editor.coverage')}</h2>
        <div className="print-coverage" data-testid="print-coverage">
          <RuleCoverage checks={roster.coverage} />
        </div>
      </section>

      <section className="print-block" aria-label={t('print.reference.title')}>
        <h2>{t('print.reference.title')}</h2>
        <p className="muted">{t('print.reference.note')}</p>
        {!roster.reference.supported && <p className="muted">{t('unitData.unsupported')}</p>}
        {roster.reference.vehicles.length > 0 && (
          <ul className="print-plain" data-testid="print-reference-vehicles">
            {roster.reference.vehicles.map((vehicle, index) => (
              <li key={index}>
                {vehicle.quantity} × {vehicle.label}
                {vehicle.weaponNames.length ? ' — ' + vehicle.weaponNames.join(', ') : ''}
                {vehicle.upgraded ? ' · ' + t('unitData.upgradedWeapons') : ''}
              </li>
            ))}
          </ul>
        )}
        {roster.reference.weapons.length > 0 && (
          <ul className="print-plain" data-testid="print-reference-weapons">
            {roster.reference.weapons.map((weapon, index) => (
              <li key={index}>
                {weapon.unitEquipment ? '' : weapon.quantity + ' × '}
                {weapon.label}
                {weapon.unitEquipment ? ' (' + t('unitData.equipmentNote') + ')' : ''}
              </li>
            ))}
          </ul>
        )}
        {roster.reference.missingWeaponProfiles.length > 0 && (
          <p className="print-gap">
            {t('unitData.weaponMissing')} {roster.reference.missingWeaponProfiles.join('; ')}
          </p>
        )}
        {roster.reference.unclassifiedProfiles.length > 0 && (
          <p className="print-gap">
            {t('unitData.missing')} {roster.reference.unclassifiedProfiles.join(', ')}
          </p>
        )}
        <p className="muted print-reference-source">
          {roster.reference.combatSource} · {roster.reference.weaponSource}
        </p>
      </section>

      {options.includeUnitData && <PrintUnitDataAppendix reference={roster.reference} />}
      <footer className="print-footer">
        <p>
          {t('print.footerNote')} · {t('print.meta.snapshot')}: {roster.versions.editRevision}
        </p>
      </footer>
    </div>
  );
}

function PurchaseBlock({ purchase }: { purchase: PrintPurchaseView }) {
  return (
    <article className="print-unit" data-selection-id={purchase.selectionId} data-issues={purchase.issueCount}>
      <h3>
        {purchase.heading}
        {purchase.trainingLabel ? <span className="muted"> · {purchase.trainingLabel}</span> : null}
        {purchase.issueCount > 0 && (
          <span className="print-issue-badge" data-testid="print-issue-badge">
            {' '}
            [{purchase.issueCount} {t('print.issueCountLabel')}]
          </span>
        )}
      </h3>
      <p className="print-unit-cost">
        {t(purchase.baseKind === 'base-cost' ? 'editor.baseCost' : 'print.attachmentPrice')} ·{' '}
        {tracked(purchase.baseCost.points)} {t('editor.points')} / {tracked(purchase.baseCost.br)} {t('editor.br')} ·{' '}
        {t('print.subtotal')} {amount(purchase.subtotal.points)} {t('editor.points')} /{' '}
        {amount(purchase.subtotal.br)} {t('editor.br')}
      </p>
      {purchase.rows.length > 0 && <CompositionRows rows={purchase.rows} />}
      {purchase.compositionNote && <p className="muted">{purchase.compositionNote}</p>}
      {purchase.platoons.map((platoon) => (
        <div className="print-platoon" key={platoon.nodeId}>
          <h4>
            {purchase.heading} — {platoon.label}
            {platoon.trainingLabel ? <span className="muted"> · {platoon.trainingLabel}</span> : null}
          </h4>
          <p className="muted">{t('editor.included')}</p>
          {platoon.rows.length > 0 && <CompositionRows rows={platoon.rows} />}
          {platoon.attachments.map((child) => (
            <PurchaseBlock key={child.selectionId} purchase={child} />
          ))}
        </div>
      ))}
      {purchase.attachments.length > 0 && (
        <div className="print-attachments">
          <h4>{t('print.attachedUnits')}</h4>
          {purchase.attachments.map((child) => (
            <PurchaseBlock key={child.selectionId} purchase={child} />
          ))}
        </div>
      )}
      {purchase.otherAnchored.map(({ pathLabel, purchase: child }) => (
        <div className="print-attachments" key={child.selectionId}>
          <h4>
            {t('print.attachedAt')} {pathLabel}
          </h4>
          <PurchaseBlock purchase={child} />
        </div>
      ))}
      {purchase.options.length > 0 && (
        <div className="print-options">
          <h4>{t('print.selectedOptions')}</h4>
          <ul>
            {purchase.options.map((option) => (
              <OptionRow key={option.optionGroupLocalId + '/' + option.optionLocalId} option={option} />
            ))}
          </ul>
        </div>
      )}
      <ChargeTable charges={purchase.charges} />
    </article>
  );
}

function CompositionRows({ rows }: { rows: readonly PrintCompositionRow[] }) {
  return (
    <ul className="print-composition">
      {rows.map((row) => (
        <li
          key={row.key}
          style={{ paddingInlineStart: `calc(0.6rem + ${row.depth} * 0.9rem)` } as CSSProperties}
        >
          <span className="print-qty">{row.quantity} ×</span> {row.label}
          {row.trainingLabel ? <span className="muted"> ({row.trainingLabel})</span> : null}
        </li>
      ))}
    </ul>
  );
}

function OptionRow({ option }: { option: PrintOptionChoiceView }) {
  return (
    <li>
      <strong>{option.optionName}</strong>
      <span className="muted">
        {' '}
        ({option.groupName}
        {option.chargeMode === 'per-target' ? ' · ' + t('editor.perTarget') : ''})
      </span>
      <ul className="print-option-targets">
        {option.targetLabels.map((label, index) => (
          <li key={index}>
            {label === 'whole-selection' ? t('print.wholeFormation') : label}
          </li>
        ))}
      </ul>
      <span className="print-option-cost">
        {option.chargedUnits} × · {amount(option.points)} {t('editor.points')} / {amount(option.br)} {t('editor.br')}
      </span>
    </li>
  );
}

function ChargeTable({ charges }: { charges: readonly PrintChargeLineView[] }) {
  if (charges.length === 0) return null;
  return (
    <table className="print-charges">
      <caption className="muted">{t('editor.charges')}</caption>
      <thead>
        <tr>
          <th scope="col">{t('print.chargeLine')}</th>
          <th scope="col">{t('print.units')}</th>
          <th scope="col">{t('editor.points')}</th>
          <th scope="col">{t('editor.br')}</th>
        </tr>
      </thead>
      <tbody>
        {charges.map((line) => (
          <tr key={line.chargeLineId}>
            <th scope="row">
              {line.optionName ?? t(line.kind === 'base-cost' ? 'editor.baseCost' : 'print.attachmentPrice')}
            </th>
            <td>{line.chargedUnits}</td>
            <td>{tracked(line.points)}</td>
            <td>{tracked(line.br)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
