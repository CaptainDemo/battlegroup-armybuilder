# Printing and PDF Contracts

Implementation: `apps/web/src/features/roster-output/printProjection.ts`, PrintPreview.tsx and PrintUnitDataAppendix.tsx. The editor toolbar opens an overlay, not a new route. Printing is a presentation projection; it does not modify core/ruleset contracts, purchase catalogs, storage or transfer formats.

## 1. Input identity

`projectPrintableRoster({ document, release, evaluation })` is pure. Inputs are the current in-memory RosterDocument, its exact release and the same input's Evaluation. Any mismatch returns status stale with a reason and no roster content:

| Reason | Check |
|---|---|
| roster-id | evaluation rosterId matches document rosterId |
| edit-revision | evaluation inputRevision matches document revision |
| document-catalog | evaluation catalog identity matches document catalogRef |
| release-catalog | release catalog identity matches document catalogRef |
| evaluation-catalog | evaluation and release identities match |
| evaluation-schema-version | stamped schemaVersion matches the release manifest |
| evaluation-rules-revision | stamped rulesRevision matches the release manifest |
| evaluation-catalog-revision | stamped catalogRevision matches the release manifest |

On success return ready with projected data. Costs, composition, issues and coverage come from that evaluation. Do not reevaluate or reprice. The only arithmetic is summing its own charge lines into display subtotals, retaining independent measure completeness.

## 2. Snapshot lifecycle

Opening captures the current document/evaluation in React state, without writing storage. Show its edit revision. Refresh snapshot recaptures the current draft; closing/reopening always gets a fresh snapshot. Opening, refreshing, closing and printing do not alter choices, undo history or save state. Violating, unsaved and failed-save drafts are printable. Without a valid draft/evaluation, show status rather than another roster or a blank placeholder.

## 3. Paper contents

1. Header: roster/list identity, Points and BR, budget remaining only for complete Points, legality conclusion, exact catalog/rules/document/schema versions, snapshot revision, budget/size/scenario/role, selected optional rules as text, source edition and titles.
2. Player notes as plain text with line breaks preserved.
3. Every issue with ruleId, severity, message, actual/limit when present and purchase location. Global issues remain visible. An empty list means no violations within implemented checks, not full legality.
4. Complete section-ordered purchases with titles/instance ordinals, training, issue counts, base/included-member explanation, cost subtotal, actual evaluated composition, fixed platoons, direct/member-anchored attachments, selected upgrades and full charge breakdown.
5. Support ledgers with consumption/capacity/status, and named statistics.
6. A player-facing rule-coverage summary, including unknown-data/missing-input limitations when present. Do not print internal coverage IDs, user-clarification implementation notes or the historical full-army diagnostic. Raw records remain in the projection for diagnostics; concise output does not change legality.
7. Aggregated vehicle/weapon quick reference with source versions and unverified/unclassified gaps.
8. Optional full vehicle/weapon appendix, when enabled.
9. Footer identifying the memory draft/snapshot and the partial-coverage limit.

Known zero, Unknown and Not applicable stay distinct. Points/BR completeness is independent. Do not print a remaining budget based on an incomplete subtotal. Optional rule text does not itself implement a rule effect.

### Purchase hierarchy

Every stable composition member appears once in the purchase body. Fixed-platoon members print only in their titled platoon block, not again as parent rows or extra platoon wrapper rows. A composition root with a profile is itself a printable member, including the exact legacy 1.0.0 BRDM-2 leaf root. No children does not mean no composition.

Fixed platoons display parent context/training and included-price status. targetMemberPath attachments belong below their actual fixed platoon, never a name/order guess. Direct attachments recurse normally; residual paths not corresponding to fixed platoons remain visible rather than silently disappearing.

Selected upgrades print names, groups, charge mode, stable target labels, chargedUnits and Points/BR. An attachment-member label includes its explicit owner. Unselected options are absent. Charge tables contain base, paid attachments and options; fixed platoons create no additional charges.

## 4. PDF options and full data appendix

The PDF options checkbox Append vehicle and weapon data is off by default. It adds data pages at the end, beginning on a new page. Controls remain outside the paper. The option survives Refresh snapshot, resets on close/reopen, and is never stored in RosterDocument or used by evaluation/autosave.

PrintReferenceVehicle carries exact profile identity, configuration key, quantity, a nullable verified card and selected additional weapons. PrintReferenceWeapon carries the actual weapon record. Reuse the editor's CombatCard / WeaponDetails formatters instead of duplicating reference values.

Group identical profile/configurations and preserve distinct target-upgraded variants. Deduplicate actual carried/mounted generic weapon records by stable ID. Vehicle-card gun/ammunition tables remain part of each card. Hide replaced base ATGM rows only for configurations with that selected replacement; print the selected upgrade's data among the weapon records. Do not equip optional missiles just because a card lists them.

Unknown vehicles retain name/count and an unverified message; do not substitute a nearby variant. Keep missing/unclassified weapon/profile lists. Preserve known zero, not-applicable values and source differences. Source notes are always expanded in the appendix, regardless of screen disclosure state. See [unit data](../data/classic-unit-data.md) for binding/source boundaries.

## 5. Pagination and screen behavior

Print CSS hides the application header/footer, editor and preview controls. A4 uses 14mm/12mm margins. Only the print sheet is visible under print media.

Allow large formations and nested blocks to split. Keep small composition, issue and charge rows together where feasible; repeat table headers and avoid separating headings from their following content. Do not apply whole-block avoidance to an oversized company and clip it. Use fixed table layout and overflow-wrap for long names, notes and targets.

The appendix prioritizes keeping each bounded card together, uses fixed-width/wrapping tables with all range bands and 8pt data/source-note text. Large roster blocks remain breakable. The 360px preview controls/page remain usable without whole-page horizontal overflow.

## 6. Boundaries and evidence

Render all names, notes, sources and imported strings as React text, never HTML. window.print is the PDF path; no backend or PDF engine is introduced. The projection never edits domain choices or recalculates costs.

Verification covers identity/version mismatches, fixed-platoon deduplication, legacy leaf roots, optional-rule output, target upgrade isolation, default/toggle/refresh/reset behavior, missing data and actual A4 PDFs. Review real generated pages for pagination and clipping; a successful build alone is insufficient. PDF pagination can change with content/browser, so historical page counts are not product invariants. Chrome PDF output was verified; physical printers and Safari/Firefox pagination were not established by that evidence. Browser print-dialog headers/footers can add page numbering; the sheet has no custom total-page numbering.

Historical dispatches, reviews and PDF inspection reports remain local under the ignored docs/implementation/ and .tmp/ archives rather than serve as maintained specifications.