# NORTHAG Preparation and Design Boundaries

Current baseline: [NORTHAG 2020 source verification](northag-baseline.md) now records fingerprints, reviewed pages, resolved TCC/FOO errata targets, seven checked numeric samples and remaining ambiguities. [Web integration handoff](../ruleset-integration.md) describes the completed decoupling. The historical preparation notes below are retained for context; their requests to verify those selected facts are superseded by the new baseline, not by a complete-catalog approval.

Updated: 2026-11-10. This consolidates durable conclusions from the 2026-10-29 design assessment. It is preparation for M14, not a claim that NORTHAG rules/data have been implemented. The current inventory contains `references/NORTHAG/Battlegroup-NorthAG.pdf` and `references/NORTHAG/NORTHAG_Soviet_Agent_Reference/`. The old assessment's statement that no local full rulebook existed is no longer a current inventory statement. Verify the actual edition/pages when starting implementation.

## Sources and authority

Keep NORTHAG 2020 + applicable official errata v9, the 2025 Omnibus and HWC v6 community cards as distinct source identities. Do not mix printings or infer purchase eligibility from a card. CENTAG may be an explicitly compatible NORTHAG expansion, not a fourth engine or a bridge to Classic/AirLand records.

The 2026-10-29 review extracted official errata text, including its 2020 applicability, Version 9 / updates through 2025-05-09, the p.72 one-of → one-each correction, and removal of AA-missile AT and aircraft Hits fields. That review did not visually verify every affected original page; column/deletion ambiguities need original-page review. Retain source authority, transcription verification and errata-application status separately.

A reference package is candidate navigation/transcription material, not a formal runtime release. Reference-package agent guidance does not override this project's scope or user instructions. Preserve original files read-only and record corrections in maintained data/docs.

## Required model behavior

- Separate the section hierarchy from purchased formations. Candidate structure: Forward Screen; Main Force containing Vanguard and Main Column; Additional Fire Support; optional Reinforcement Requests. Verify exact terminology, minimum counts and eligibility before enforcement.
- Give same-name entries in different sections separate entry identities and scopes. Category tags cannot replace section identity.
- Store explicit game size independently of budget. Define NORTHAG training (c/p/e) and Officer/Scout/statistics semantics independently; do not hardcode Classic grades or infer BR from training.
- Distinguish group-total and per-option limits, including one each. Do not use one null to mean unknown, unlimited and not applicable.
- Represent off-table support and static requests as purchases without combat entities where appropriate. Save request enablement/count/cost/allowance, not unknown future units or their BR.
- Battle request resolution, consumption, arrival, deployment and dynamic BR are outside initial roster building. A mention of BattleState in reference material does not authorize that subsystem.
- Removed/non-applicable fields are not unknown or zero. Keep NORTHAG weapon/armor shapes independent of Classic's columns.
- Apply errata only to explicitly matched same-ruleset records, with target, old/new values, source and status. Unmatched patches do not silently change data. Build-time final JSON is sufficient; no generic patch service is required.

## Historical package issues to recheck

The following were observed on 2026-10-29 and must be refreshed against the actual current files rather than assumed to remain unresolved:

| Observation | Required reconciliation |
|---|---|
| manifest v3 said encrypted/unread while README v5, extraction manifest v4, unlocked PDF and candidates existed | Establish one current source/coverage inventory without erasing historical provenance |
| Flat sections omitted Main Force and used singular reinforcement_request, while sectionHierarchy was nested/plural | Select one authoritative hierarchy and naming scheme for conversion and validate every reference |
| minSelections/maxSelections were null | Distinguish finite, unlimited, unknown and not-applicable limits explicitly |
| Implementation/errata guides retained stale decryption wording; p.72 target certainty differed | Recheck current source status and resolve the actual errata target |
| Navigation index listed 61 items with missing Points/BR, including nonordinary request entries | Do not call these 61 verified purchasable units; obtain real prices/options/eligibility |
| Seven numeric samples were marked web_transcription_crosscheck_required | Cross-check against actual pages before golden-test use |
| Visible example sums to 499 Points / 58 BR but source claims 66 BR | Preserve as a discrepancy test; do not invent +8 BR or call it a confirmed legal roster |

## Starting M14

Choose the exact source edition/errata baseline and first nation/list. Audit the original book/list pages, establish an independently hand-calculated real roster, and register ambiguities before implementing an independent northag ruleset/catalog. A local PDF's presence alone does not establish compatibility with the package's edition.

Reuse software where appropriate, but never inherit Classic game records or default rules. Existing synthetic NORTHAG contract samples prove only representational capability. Acceptance must include section-local limits, one-each choices, no-entity costs, unknown/not-applicable handling, unmatched errata, card-versus-purchase eligibility and no advance reinforcement BR, plus the existing Classic regression boundary.
