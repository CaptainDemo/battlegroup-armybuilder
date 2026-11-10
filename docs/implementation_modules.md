# Implementation Modules and Delivery Plan

Updated: 2026-11-10. M01–M11 are implemented and validated locally. M12 has an earlier deployed M01–M10 snapshot; publication and hosted verification of subsequent unit-data/printing changes remain separate work. New Classic rosters use Soviet V4.1 catalog 1.1.0: 151 purchase records and 203 options. See [development](development.md), [deployment](deployment.md) and the [documentation index](README.md).

Modules are responsibility and acceptance units, not separate services, repositories or published npm packages. Use real samples to evolve the shared contracts. Completed dispatch/review/acceptance reports remain local ignored archives; this plan retains scope and progress rather than individual agent runs or historical test counts.

## 1. Overview

| ID | Module | Main location | Dependencies | Status |
|---|---|---|---|---|
| M01 | Sources and coverage baseline | docs/data, tests/fixtures | None | Complete for the declared Classic baseline |
| M02 | Engineering/build foundation | Root config, apps/web | None | Implemented |
| M03 | Domain contracts and schemas | packages/core/contracts | M01, M02 | Implemented |
| M04 | Catalog releases/loading | packages/catalogs, tools, Web catalog adapter | M03 | Implemented; exact 1.0.0 / 1.1.0 |
| M05 | Roster commands and trees | packages/core/roster | M03 | Implemented |
| M06 | Generic evaluation/tools | packages/core/evaluation | M03, M05 | Implemented |
| M07 | Classic rules | packages/rulesets/classic-coldwar | M01, M04, M06 | Implemented with explicit partial coverage |
| M08 | Browser editing/details | apps/web/features | M04, M05, M07 | Implemented; two columns and reference data |
| M09 | Local save/restore | apps/web/adapters/storage | M03, M05 | Implemented |
| M10 | JSON transfer/compatibility | core contracts, Web roster-transfer | M03, M04, M09 | Implemented and accepted |
| M11 | Print/PDF | apps/web/features/roster-output | M07, M08 | Implemented, including optional data appendix |
| M12 | Combined acceptance/deployment | Browser checks, hosting workflow | M04–M11 | Initial test deployment complete; newer publication outstanding |
| M13 | AirLand | Independent ruleset and catalog | Stable Classic workflow, sources | Not implemented |
| M14 | NORTHAG / CENTAG | Independent ruleset and catalog | Stable Classic workflow, sources | Not implemented |

Build verification facilities during each module; M12 combines them rather than postponing all tests. M13 and M14 share a readiness prerequisite; M13 is not a technical dependency of M14. The default order remains AirLand then NORTHAG unless the user chooses otherwise. Do not run external implementations concurrently in one checkout.

## 2. Scope and acceptance boundaries

### M01 — Source verification

Maintain source fingerprints, page locations, constraints, clarifications and independent fixtures. The Classic baseline has 23 accounts: B01–B04, L01–L10, S01–S02 and F01–F07. B01 uses a 500-point budget, explicit Platoon size and totals 398 Points / 23 BR. A01–A07 and A09 are resolved; A08 describes the remaining full-coverage boundary, not an invented missing rule.

Cover tank and motor-rifle formations, local/army supports and off-table purchases. Record cost, BR, composition, targets, option counts and resource sources/consumption. Review original pages for columns, crossed-out text and suspected errors. Preserve candidate interpretations until clarified; do not invent definitive rules.

Acceptance: independently traceable representative accounts and violating variants. A source/calculation fixture is not evidence that an engine has executed the rule. NORTHAG's 499/58/66 discrepancy is not a legal baseline for either ruleset. See [Classic scope](data/classic-sample-scope.md) and [calibration](data/classic-calibration.md).

### M02 — Build foundation

npm workspace, locked dependencies, React/TypeScript/Vite, Vitest, Playwright, hash routing, configurable asset base and static build. Keep core/rulesets importable without a browser and exclude references/.tmp from release assets. Do not add a server or third-party identity.

Acceptance: application startup/build and dependency boundaries work through documented commands. Do not claim checks before executing them.

### M03 — Contracts and schemas

Define identities, RosterDocument/selections, sections, composition, options, sources, versions and result protocols. Separate purchase/section trees, stable member targets and charge ownership. Support known/no-entities/pending composition and known/unknown/not-applicable values. Keep combat/training schemas in each ruleset.

Acceptance: all declared manual examples are structurally representable; reject bad references, cycles and impossible targets. Same-name/same-stat synthetic records remain isolated. Synthetic NORTHAG sections, one-each limits and requests prove representation only, not real game thresholds. See [domain contracts](contracts/domain.md).

### M04 — Catalog release/loading

Maintain independent immutable JSON, manifest/index, source checks, explicit purchase contexts, SHA-256 verification and exact-version failure states. Load only indexed application assets; never substitute a same-name or latest record. Fixtures are not runtime catalogs.

Acceptance: independently load one ruleset, reject foreign references, preserve zero/unknown distinctions and differentiate unsupported versions from temporarily unverifiable indexed releases. Current default is 1.1.0; 1.0.0 remains supported separately.

### M05 — Commands and purchase trees

Pure atomic create/add/remove/copy/options/settings/notes operations with caller-supplied IDs/revisions. Cascading removal leaves no orphan; copying remaps instance/target identities. Structural failures reject the batch, while rule violations remain editable drafts. Report invalidated choices rather than guessing replacements.

Acceptance: sibling platoons remain independent, reordering preserves targets, copies do not share mutable choices, and failed batches never partially apply.

### M06 — Evaluation

One snapshot contains live option targets, derived composition, charge lines, independent Points/BR completeness, scoped limits, resource matching, statistics, issues and coverage. Support included fixed members, whole/per-target costs, free/negative changes and BR changes. Do not build an arbitrary DSL.

Acceptance: independently reproduce all 23 manual costs. Dynamic all-target sets follow actual attachments and count each vehicle once. Unknown data cannot become zero or a legal conclusion. Concrete game conclusions belong to M07.

### M07 — Classic rules

Implement verified budget, support, option, Restricted/Unique, PT-76, scenario, TOC, SAM and equipment restrictions using explicit context and sources. Keep training and BR separate. Draft availability permits rule violations but blocks invalid structure.

Acceptance: expected violations locate relevant purchases/options; unimplemented checks remain coverage gaps. Formation-data completeness does not establish complete rule coverage. See [constraints](data/classic-constraints.md).

### M08 — Browser workflow and data

My Rosters, creation, search, purchasing, options, details, Problems, totals and 50-step undo/redo use one current evaluation. Desktop is two columns; small screens switch Roster / Actions. Company platoons and attachments remain in the left roster. Normal pages hide debug examples and implementation records; `?debug=1` opts in. Actual issues appear after editing and clear when resolved.

Unit details use 51 reviewed vehicle cards and 33 Draft 6 weapon records. Display independent vehicle data or carried weapons as appropriate, follow selected target upgrades, and identify gaps without inventing values. Reference supplements do not rewrite immutable purchase catalogs, stored choices or rule coverage. See [unit data](data/classic-unit-data.md).

Acceptance: complete the representative roster without editing JSON; add/configure/delete/undo on desktop and small screens; reject stale evaluation displays and keep unknowns distinct from zero. Future rulesets are not advertised as available.

### M09 — Persistence

Dexie storage port, summaries, schema migration, serialized/coalesced save queue, compare-and-write revisions, tombstones, conflict recovery and raw draft recovery JSON. Separate edit and save revisions. Failures preserve the current memory draft; undo/redo does not roll back concurrency state.

Acceptance: real browser close/reopen, rapid editing, older-save acknowledgement, concurrent tabs, stale-tab deletion and failed-write recovery. Database migration must not change catalog versions.

### M10 — Transfer and compatibility

Single `roster-file/1`, full `library-backup/1`, bare `roster/1` recovery compatibility, bounded parsing, preview-before-write, default copy, explicit overwrite, all-or-nothing backups and unsupported-original recovery. Indexed-but-unverifiable catalogs are errors, not unsupported originals. See [transfer contracts](contracts/import-export.md).

Acceptance: choices, hierarchy, targets/settings and exact versions survive round trips. Another tab's commit conflicts with page-known overwrite; failed writes preserve both sides. Reject mixed backups containing errors and arbitrary file-directed catalog fetches.

### M11 — Printing

A pure projection validates roster/edit/catalog identity and the evaluation schema/rules/catalog version triple. Freeze the current draft/evaluation, print every member once, and preserve fixed platoons, anchored attachments, selected upgrades, optional rules, notes, versions, issues and incomplete values. Report the existing Problems list; keep coverage declarations and raw engine diagnostics out of paper output.

The optional vehicle/weapon appendix is off by default. Group identical configurations, preserve targeted upgrades, deduplicate weapon IDs and show unavailable data explicitly. The option survives snapshot refresh but resets on reopening and is not saved to the roster. See [printing contracts](contracts/printing.md).

Acceptance: totals match the same editor snapshot, collapsed purchases still print, long blocks paginate without clipping, and actual long/violating/legacy PDF output is checked. Compilation alone is not layout evidence.

### M12 — Combined checks and deployment

Combine source/data gates, core tests, user workflows, artifact inspection and an actual deployed test. Record source/data revisions, supported versions and access audience. Initial Sites publication contains M01–M10; later printing/unit-data work has local validation but needs a separately authorized site update and hosted verification.

Acceptance: hosted create/configure/check/save/reopen/transfer/print, resource paths, direct routes and refresh, intended access, and no reference-source assets. Distinguish built, deployed and browser-verified states. See [deployment](deployment.md).

### M13 — AirLand

Audit independent sources and purchase differences before adapting reusable algorithms. Implement independent catalogs, section/eligibility/pricing rules and real hand-calculated rosters. Do not inherit or overlay Classic records.

Acceptance: independent loading/releasing, actual player workflow, isolation and unchanged Classic regressions. Do not open a usable list until sources/data are ready.

### M14 — NORTHAG / CENTAG

Verify source editions/errata, section naming, purchase costs/options, explicit size, one-each limits, training/statistics, non-entity purchases and static reinforcement requests. Add CENTAG only as an explicitly compatible NORTHAG expansion. See [preparation notes](data/northag-notes.md).

Acceptance: independent same-name section entries, distinct unknown/not-applicable states, exact errata-target matching, no purchase eligibility inferred from community cards, no advance BR for unknown arrivals, and an independently verified real roster. The 499/58/66 discrepancy is only a discrepancy test. Battle rolls/arrivals/dynamic BR are excluded.

## 3. Delivery order

Sources → contracts and evaluable core → minimal Classic editor/save/transfer/print → Sites test → feedback/stabilization and hosting decision → additional rulesets.

A partial first data set can be tested when its coverage is clear. Save-failure retention, basic errors and conflict protection are minimum requirements before exposing user drafts, not optional later polish. Public Classic testing need not wait for AirLand or NORTHAG.

## 4. Deferred work

Complete catalogs/all nations and combat attributes; a generic rule DSL or visual editor; executable user scripts; battle state, casualties, requests/arrival simulation and dynamic BR; accounts/cloud/public libraries/PWA; automatic historical-data conversion without a concrete supported mapping. Cross-ruleset data sharing or automatic conversion conflicts with the established boundary and is not a default future feature.

This plan specifies scope and evidence, not time estimates. Source verification cannot be replaced by finishing UI early.
