# NORTHAG 2020 Soviet source baseline

Verified: 2026-11-10. Scope: source identification, selected roster-building facts, targeted errata and small calibration fixtures. This is not a published catalog, a complete transcription, or an implemented NORTHAG ruleset.

## Authority and reproducibility

Use the local 2020 book with applicable official errata v9 (9 May 2025) for the first Soviet/Russian Armoured Battlegroup. Do not combine this baseline with the 2025 Omnibus or CENTAG. The book's chapter locations, original wording and table layouts match the 2020 targets in the errata; September 2020 PDF metadata is corroboration, not the sole edition evidence.

Exact local paths, SHA-256 fingerprints, PDF page counts and reviewed page numbers are recorded in `tests/fixtures/northag/source-baseline.json`. All three inspected PDFs open without passwords. Original files remain read-only and outside Git. Local inspection images/text are under `.tmp/northag-baseline/` and `.tmp/northag-assessment/`; text was used for navigation and the findings below were checked against rendered original pages.

| Source | Role | Review boundary |
|---|---|---|
| `Battlegroup-NorthAG.pdf`, 117 PDF pages | Primary 2020 rules/list/arsenal | Printed pp.10, 38, 40, 51–53, 56–59, 69–75 and 94–100; unnumbered QRS PDF pp.114–115. List structure, selected prices/composition and correction targets reviewed. Arsenal review is not row-by-row transcription approval. |
| `NORTHAG_2020_Official_Errata_v9.pdf`, 12 PDF pages | Official corrections applicable to that printing | PDF pp.1, 6–10 and 12 reviewed, including cover applicability/version and changelog. Other combat-only corrections are outside this roster audit, not declared inapplicable. |
| `WARPAC_Unit_Cards_HWC_v6_UNLOCKED.pdf`, 8 PDF pages | Secondary community reference | Cover/index checked: HWC, Ian Garbutt, version 6. Individual cards have not been fully verified. A card cannot establish purchase eligibility, cost or list limits. |

Book page references below are **printed** pages; for the reviewed numbered pages the one-based PDF page is printed page + 1. Errata references are one-based PDF pages. QRS pages have no ordinary printed page number.

## Confirmed roster-building facts

| Topic | Verified baseline | Implementation consequence |
|---|---|---|
| Game size, p.10 | Platoon/Company/Battalion; recommended 500/750/1000 Points, with player variation allowed | Keep size explicit and independent of budget; do not import Classic Squad or derive size from Points. |
| BR and experience, pp.10, 38, 40 | c/p/e = Conscript/Professional/Elite. The 0–4 description concerns an individual tabletop unit. Purchased formations can have larger combined BR. | Numeric BR and training are separate. Do not cap purchase BR at 4; Tank Company is 20 and Motor Rifle Company is 30. |
| Sections, pp.56, 69–74 | Forward Screen; Main Force containing Vanguard and Main Column; Additional Fire Support; optional Reinforcement Requests | Preserve grouping-only Main Force. Minimum one Forward Screen selection; exactly one Soviet Vanguard; Main Column may be empty. Same-name section entries have independent IDs/limits. |
| Restricted, p.56 | Maximum 2/3/4 for Platoon/Company/Battalion | NORTHAG-owned limits; Classic uses different values. The eventual evaluator must define and test the counting of Restricted purchase/upgrade events. |
| Forward Screen FOO, p.69 + errata p.7 | 12 Points / 2 BR, c; command team in foxholes; Officer, Mortar Spotter, Dug-in. Delete the +5 Artillery Spotter option. | Apply deletion only to the matched Forward Screen entry, not every FOO. |
| Vanguard Tank Company, p.70 | 180/20, c; ten T-62. Whole-company replacement prices: T-64A +30, T-64B +120, T-80 +60 Restricted, T-80B +180 Restricted. One tank can receive KMT +5. | One charge for a company replacement; a stable individual target for KMT. Main Column Tank Company has a separate 0–1 limit. |
| Motor Rifle Company, p.70 | 132/30, c; three fixed platoons, each with three Fire Teams and three AT Teams in three BTR-60/70. Each platoon may add up to two different weapon teams, no repeated type in that platoon. Whole-company BTR to BMP-1 replacement +108. | Included platoons are not separately purchased. Scope weapon-team limits per fixed platoon; see NAG-01 below for extra transport interpretation. |
| Motor Rifle Platoon, p.71 | 44/10, c; three Fire Teams and three AT Teams in three BTR-60/70. Up to two different extra weapon teams. All BTR to BMP-1 +36; a maximum of one Motor Rifle Platoon may replace all BMP-1 with BMP-2 for +16. | Explicit replacement prerequisites and a cross-selection limit are needed; do not infer Classic transport or upgrade semantics. |
| Tactical Command Centre, p.72 + errata p.7 | TCC 16/3, c; command team in ACRV-2; Officer/Communications. Add up to one **each** of FAC 12/2, EW Team 16/3 Restricted, Supply Truck 9/0, Ambulance 10/0. FAC has its own vehicle options. | Four independently optional children, each max one under the TCC. They are not reinforcement requests or four independent main-column purchases. Keep parent ownership and child options. |
| Mortar batteries, p.72 | Off-table 82mm battery 32/0 and 120mm battery 48/0, each four mortars. A Mortar Spotter is required to use them. | Explicit zero BR and no on-table entity. Do not silently turn a battlefield-use condition into a hard purchase prerequisite. |
| Support, p.73 | Repeated timed strikes have their own maxima and zero BR. CAP and off-table SAM cover are static purchases; Soviet Gunship is a conditional battle-counter reference. | Separate purchase records from reference profiles; do not make every printed heading/card purchasable. Model repeatable strikes as distinct selections. |
| Reinforcement requests, pp.57–59, 74–75 | Optional rule; one free initial Russian request when enabled, total request caps 3/4/5, each additional request +30 Points / 0 BR. Reinforcement BR is added on arrival. Airborne reinforcements use p training. | Store enablement and paid request choices; derive free/total requests. Do not pre-buy random future formations, add arrival BR to initial totals, or implement request rolls/arrival/consumption. |
| Officers and Scouts, pp.51–53 + errata p.6 | Separate special-rule semantics, including Senior Officer and Scout weights (2)/(3) | Independent NORTHAG statistics; do not reuse Classic counting or copy parent special rules onto every member. Mixed composition counting still needs the decision below. |

## Targeted errata reconciliation

These are **verified instructions for future transcription**, not claims that patches have been applied to a production catalog. Store target identity, old/new values, source and application status when that catalog is built. Fail explicitly on unmatched targets.

| Book target | Errata PDF page | Verified correction / scope |
|---|---|---|
| p.69 Forward Screen FOO | 7 | Delete the +5 Artillery Spotter option (struck out in the original errata). |
| p.72 TCC extra-unit menu | 7 | Replace one-of with one-each. The page layout ties the four child entries to this menu. |
| p.72 close-support gun; p.74 engineer reinforcement; p.97 arsenal | 7, 9 | S21 → 2S1; TO-62A → TO-62 at the explicitly named locations. |
| p.94 BRM-1 | 9 | Add Amphibious. Keep BRM-1 distinct from BTR variants. |
| p.96 BTR-60, BTR-70 and BTR-60K row (also BTR-70K) | 9, 12 | Errata p.9 misprints these as BRM-60/70/60K. Original p.96 contains BTR rows and the changelog says all BTR-60/70 models are amphibious. Match those explicit BTR rows; do not invent BRM-60 records. Record the spelling discrepancy with the eventual patch. |
| p.96 command vehicle and ferry | 9 | ARCV-2 → ACRV-2; add Amphibious to PMM-2. |
| p.98 Shilka/Hind | 9 | Starred ROF note permits rolling twice for an attack. This is different from missile ammunition notation. |
| p.98 Mi-24D Hind | 9–10 | Replace numeric armor 1/0/0 with Soft Skin; add (2) to the AT-6 Spiral entry. Remove aircraft Hits fields, rather than writing zero or unknown. Normalize Gvozdika spelling where targeted. |
| p.99 weapons table | 10 | SB4 → S24; MB.27 → BM.27. Grom AP penetration becomes 2/2/2 in the first three bands. Later dash cells remain not applicable; do not rewrite the HE row as penetration. |
| p.100 AA missiles | 10 | Remove AT values from AA missile rows; preserve their applicable HE classification. Removed AT is not zero. |
| Unnumbered QRS, PDF p.115 | 10 | AGS-17 maximum range 30 inches → 40 inches; retain the ROF/Light HE alternatives. |

NORTHAG vehicle armor uses Front/Side/Rear or Soft Skin. Its p.99 penetration table uses five bands (0–20, 20–30, 30–40, 40–50, 50–70), not Classic's eight-band table. Movement, mounts, ROF, HE/AP/ATGM and non-applicable cells need NORTHAG-owned schemas and views. Combat resolution is outside this task.

## Calibration and remaining decisions

`tests/fixtures/northag/calibration.json` contains seven original-page-checked small samples and independently summed purchase fragments. The scope is deliberately limited: base Points/BR, printed training or absence of a grade, a short composition description, and source location. They are evidence fixtures, not catalog-ready entries or proof of full legality.

The hand calculations are 204 Points / 22 BR for Armoured Car Patrol + Vanguard Tank Company, 267/30 after adding the TCC and all four different children, and 327/30 after enabling requests and buying two extras (three requests including the free one). This last fragment is within the Platoon request cap; the fixture makes no full-legality or Officer/Scout claim.

| ID | Open decision / coverage boundary | Required treatment |
|---|---|---|
| NAG-01 | Extra weapon-team transport count/grouping and whether whole-formation BTR/BMP replacement includes those transports | Preserve the wording and model alternatives explicitly before filling those options. Do not inherit the earlier Classic transport decision. |
| NAG-02 | Counting Officer/Scout contributions in mixed infantry/transport patrols, including errata Scout weights | Check individual unit ownership of the special rule; document the chosen interpretation and add independent examples before claiming full statistics coverage. |
| NAG-03 | Whether the p.71 maximum-one BMP-2 platoon scope interacts with a fixed platoon inside the p.70 company | Keep section/entry context and cite wording. Do not silently extend or narrow the restriction when encoding company options. |
| NAG-04 | The reference-package example totals 499 Points / 58 BR from its visible items but claims 66 BR | Retain the discrepancy; do not invent +8 BR or use it as a confirmed golden roster. |
| NAG-05 | Full catalog, arsenals and card transcription | All remaining entry/option values, combat rows and bindings require review. Cover/index review does not verify all HWC cards. |
| NAG-06 | Use-only rules versus roster checks, Restricted upgrade counting events, and whether non-entity Forward Screen items satisfy the minimum-one-unit requirement | Define each check's applicability and coverage in the NORTHAG module; missing coverage must remain explicit in evaluation metadata even when there are no errors. |

## Candidate package reconciliation

The package under `references/NORTHAG/NORTHAG_Soviet_Agent_Reference/` remains candidate material. Its stale claims that the full book is absent or cards unreadable are superseded by the fingerprinted local inventory above. Its flat and nested section names disagree; use the verified hierarchy rather than treating both as runtime IDs. Its 61 navigation items are not 61 verified purchases. The seven sample base values have now been checked, but the original package is intentionally unchanged. The TCC menu and forward FOO correction have been resolved above; other uncertainties are explicitly retained.

Continue with [the Web integration handoff](../ruleset-integration.md). The earlier [assessment](northag-integration-assessment.md) explains the pre-change architecture and remaining rules/data work.
