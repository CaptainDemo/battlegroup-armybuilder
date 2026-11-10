# Classic Manual Calibration and Boundary Samples

Baseline date: 2026-10-30. [m01-calibration.json](../../tests/fixtures/classic-coldwar/m01-calibration.json) contains independent source/calculation fixtures. It is neither the application RosterDocument format nor automatic rule-engine output.

## 1. Combined baseline B01

Classic Soviet Armoured Division V4.1, explicit Platoon size, 500-point budget, no house rules and no scenario-dependent defences. There is no known violation in the reviewed purchase subset; A08 retains incomplete full-rule coverage. A02 has been resolved by the user.

| Purchase / attachment | Points | BR | Source / meaning |
|---|---:|---:|---|
| Forward Headquarters | 20 | 3 | SOV p.1; includes BMP-1K, Unique |
| T-72 MBT Platoon | 180 | 7 | p.6; three base T-72A, no extra individual-tank charge |
| BMP-1 Motor Rifle Platoon | 95 | 8 | p.2; three squads/transports included |
| Its Combat Medic | 8 | 0 | p.2; training i; zero BR is known |
| Its Fire Support Section | 25 | 1 | p.2; two teams share one vehicle |
| Its AGL Section | 18 | 1 | p.2; three men and transport |
| BRDM-2 Armoured Car | 12 | 1 | p.10; reconnaissance choice from Infantry grant |
| ZSU-23-4 | 35 | 2 | p.12; Specialist choice from tank grant |
| Off-Table Artillery Support Request, 3rd Priority | 5 | 0 | p.13; Additional Fire Support choice from HQ |
| Total | **398** | **23** | **102 Points remaining** |

The BMP platoon uses 3/4 local options, one of each. It separately grants four army supports, one allocated to reconnaissance. The T-72 platoon grants four, one allocated to Specialist. HQ grants one, consumed by the request. Local options do not consume those army choices. Do not add another heading +1 or duplicate grants from included platoons.

Independent auxiliary expectations: Officer = 1 (HQ Senior Officer), Scout weight = 1 (BRDM-2). Platoon-command roles do not automatically count as Officer. Shared transports, reserve deployment and future randomly determined artillery do not change the purchased 23 BR. See [base-book evidence](classic-base-rulebook-review.md).

## 2. Combined variants

| ID | Change | Expected arithmetic | Expected rule / boundary |
|---|---|---|---|
| B02 | Add another Medic to the same BMP-1 platoon | 406 Points / 23 BR | C02 local duplication; four total local slots still fit and budget is fine; coverage remains incomplete |
| B03 | Change only budget to 397 | 398 / 23, one over budget | C01 confirmed violation despite partial coverage |
| B04 | Remove HQ, retain its request and other purchases | 378 / 20 | C09 lacks a supplying grant when no other HQ/Artillery grants exist; do not invent a mandatory-HQ rule |

B02 adds a local duplicate violation, not an army-wide one-Medic restriction. B04 depends only on the verified resource relationship.

## 3. Local modeling samples

These establish a formation/operation's arithmetic, not full-army legality.

| ID | Independent account | Points / BR | Capability |
|---|---|---|---|
| L01 | T-72 platoon 180 + whole B upgrade 30 + one KMT 5 | 215 / 7 | Once versus per-member charging; no Svir |
| L02 | T-62 platoon 75 + M 30 + one Bastion 20 + Regular 20 | 145 / 9 | Prerequisites, each cost once, BR 6+3, training i→r |
| L03 | Independent BMP-2 platoon 130 + Fire Support 45 | 175 / 13 | p.4 context, not company price 40 |
| L04 | BMP-2 company 380 + Fire Support for one fixed platoon 40 | 420 / 36 | p.5 context; no additional 390 for included platoons |
| L05 | BMP-1 company 275 + Medic on platoon 1 (8) + Medic on platoon 2 (8) | 291 / 25 | Independent local limits; no extra 3×95 |
| L06 | Independent BMP-1 platoon 95 + three BMP-1P upgrades at 5 | 110 / 8 | Three current targets without attachments; added BMPs enter all scope |
| L07 | Engineer 25 + free BTR-80 replacement | 25 / 3 | Replace BTR-60PB rather than add another transport; preserve role |
| L08 | Ambulance 20/2 + Heavy Truck delta −5/−1 | 15 / 1 | Negative Points/BR; training remains i; no inferred removal of Restricted |
| L09 | Timed122 25, no extra target charge | 25 / 0 | No entities, target included, ToT no support consumption; no six on-table guns |
| L10 | Ten-T-72A company 600 + ten B1 upgrades at 10 | 700 / 25 | A01 corrected composition; ten T-72B1; Points-only preserves BR |

## 4. Separate support pools

After A02, S01 combines BMP-1 platoon 95, four local options 8+25+18+40, and four BRDM-2 army supports at 12 each: **234 Points / 15 BR**. Both local and army pools use 4/4 independently.

S02 adds a fifth BRDM-2: **246 / 16**. It violates C07's army allowance while local options remain 4/4. These cases cover only their declared rule subset.

## 5. Clarified boundary fixtures

| ID | Scenario | Points / BR | Independent assertion |
|---|---|---|---|
| F01 | BMP-1 company 275 + fixed-platoon Fire Support 25 + another platoon's AGL 35 + twelve BMP upgrades at 5 | 395 / 27 | all covers ten base and two support vehicles once; shared transport is not doubled for two teams |
| F02 | BMP-2 company 380 + same-platoon Fire Support 40 + second Section 35 + Medic 8 + Mortar 40 | 503 / 38 | Four local slots exactly; each Section counts one |
| F03 | F02 plus same-platoon AGL 35/1 | 538 / 39 | Fifth local option violates C03 |
| F04 | B01 plus independent PT-76B 17/1 | 415 / 24 | T-72 platoon violates C16 |
| F05 | T-72 company 600/25 + PT-76B 17/1 | 617 / 26 | Company also violates C16 |
| F06 | Additional T-72A 60/3 + PT-76B 17/1 | 77 / 4 | Individual additional tank also violates C16 |
| F07 | Recon Command 22/2, free PT-76B transport, additional T-72A 60/3 | 82 / 5 | Nested transport triggers C16; free Points-only conversion preserves BR |

F fixtures do not establish unrelated budget/support/full-list validity. F01 combines defined command/platoon upgrades; it does not invent a new purchase option. Current total: 23 fixtures, B01–B04, L01–L10, S01–S02, F01–F07.

## 6. Checking method and limits

Run `python tools/data-import/check_m01_fixtures.py` from the repository root. It uses the standard library and checks source hashes, line source/parent references, cycles, line counts and literal expected totals. It does not derive prices from PDFs or execute C01–C28, Officer/Scout or resource rules.

Commands/evaluation/rules must independently compute the same player choices and compare results with literal expectations. Reading expectedTotals/expectedViolations as engine output, or merely summing fixture lines, cannot validate the implementation. Preserve local-case boundaries and the [clarification record](classic-ambiguities.md).