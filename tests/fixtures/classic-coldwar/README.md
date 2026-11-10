# Classic Source-Verification Fixtures

Baseline: 2026-10-30. See the [calibration guide](../../../docs/data/classic-calibration.md) for the independent accounts and their boundaries.

- `m01-sources.json`: source PDF fingerprints and actual visually reviewed pages. AFV cards were fingerprinted only during M01; later attribute verification is separate.
- `m01-calibration.json`: 23 accounts: B01–B04 combined cases, L01–L10 local cases, S01–S02 separate support-pool cases and F01–F07 clarified boundary cases. Expected totals are independent literal values.

`lines` means cost contributions, not a serialized purchase tree. Fixed members create no separate charge. `parentSelectionId` identifies a paid parent; `targetPath(s)` identifies stable members. L04/L05 distinguish included platoons by path without buying them again. The production schema represents composition and player choices separately from charge lines.

`unitBr` is numeric. Training is recorded in source/case notes and cannot be inferred for the entire army from total BR. Known zero and negative downgrade deltas are intentional.

Run `python tools/data-import/check_m01_fixtures.py` from the root. It uses only the standard library. Passing establishes source fingerprints, arithmetic and internal references, not game-rule execution. Engine implementations must compute independently and compare rather than read expectedTotals/expectedViolations as output.

A02 is resolved. A08 retains incomplete full-rule coverage: B01 is undetermined, B02–B04 have confirmed subset violations, and local cases do not establish complete-army legality. S01/S02 independently distinguish four local plus four army supports from a fifth army-support violation. Manual allowance fields are comparison inputs, not rules executed by the arithmetic checker.

The [base-book review](../../../docs/data/classic-base-rulebook-review.md) expanded reviewed source pages without changing hashes or the initial fourteen costs, and added B01 Officer=1 / Scout weight=1 auxiliary expectations. F cases preserve recursive all targets, second Fire Support slot use and PT-76 exclusions for platoons, companies, individual tanks and nested transports. L10 identifies the corrected base/upgraded models. A01/A03/A04/A07/A09 are confirmed project interpretations, not open hypotheses. `rulesClarifications` retains their provenance; original PDFs remain unchanged.