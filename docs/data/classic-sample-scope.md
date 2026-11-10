# Classic Source and Sample Baseline

Established: 2026-10-30. This document preserves the original M01 source/calculation scope, not a current runtime-catalog inventory. Catalog 1.1.0 later expanded to 151 purchase records / 203 options; see the [catalog guide](../../packages/catalogs/classic-coldwar/README.md). A01–A07 and A09 are now resolved; A08 remains a coverage question.

The source identity is local Cold War Draft 6 plus Soviet Armoured Division V4.1, without borrowed AirLand/NORTHAG records. The filename says ARMOURED DIVISION while the PDF title says SOVIET TANK DIVISION; preserve both rather than infer an additional version.

## 1. Evidence

- [Constraints](classic-constraints.md): checked rules, scopes, counted objects and source pages.
- [Clarifications](classic-ambiguities.md): source inconsistencies, user decisions and coverage limits.
- [Base-book review](classic-base-rulebook-review.md): units, BR, training, fire requests, scenarios and A08.
- [Calibration guide](classic-calibration.md): baseline, violating variants and local cases.
- [Manual fixture](../../tests/fixtures/classic-coldwar/m01-calibration.json): independent expectations, not application output or published catalog data.
- [Source fingerprints](../../tests/fixtures/classic-coldwar/m01-sources.json): PDF SHA-256, page counts and reviewed pages.
- [Arithmetic checker](../../tools/data-import/check_m01_fixtures.py): source/account/reference checking, not a game-rule engine.

The initial visual review used rendered Soviet list pages 1–13 and 15; page 14's support table was viewed but excluded from numeric samples. It reviewed Draft 6 pp.28/31/32 and base PDF11 / printed10. Soviet and Draft 6 cited printed pages match PDF numbering. Images remain under .tmp/m01-pages/, not runtime assets or an alternative data authority.

A same-day base review additionally covered PDF5/6/8/13/14/36/39–41/44–45/47–49/58–61 and CW29–30. Full-text search and actual page review are separately recorded. Classic includes Elite (e), even though initial selections use i/r.

AFV cards were fingerprinted only during M01, so initial combat values stayed unknown rather than zero. Later vehicle/weapon review is documented separately in [unit data](classic-unit-data.md); it does not retroactively change the meaning of the initial review record.

## 2. Representative purchase contexts

Core means selected for the initial 1.0.0 sample release. Modeling sample means evidence used to exercise contracts and later expansion, not a complete army or a claim of initial UI availability. All IDs belong to classic-coldwar.

| Candidate ID | Purchase/context | Points / BR+training | Composition/source | Baseline use |
|---|---|---|---|---|
| fhq | Forward Headquarters | 20 / 3r | Three men + BMP-1K; p.1 upper left | Core; Unique; free BMP-1Ksh/BTR-50PU replacement sample |
| t72-platoon | T-72 MBT Platoon | 180 / 7r | Three T-72A: one command, two ordinary; p.6 upper right | Core; one KMT +5; whole B/B1 +30, AV +15; Svir excluded from initial sample |
| bmp1-platoon | BMP-1 Motor Rifle Platoon | 95 / 8r | Command, assistant and ordinary squads with three BMP-1; p.2 | Core; stable squad slots; BMP-1P +5 per vehicle; squad UGL +5 |
| bmp1-platoon-medic | Combat Medic / independent BMP-1 platoon | 8 / 0i | One man; p.2 lower left | Core; locally once |
| bmp1-platoon-fire-support | Fire Support / independent BMP-1 platoon | 25 / 1r | Two two-man PKM teams share one BMP-1; p.2 upper right | Core; not two vehicles; BMP-1P +5 |
| bmp1-platoon-agl | AGL / independent BMP-1 platoon | 18 / 1r | Three men + AGS-17 + BMP-1; p.2 right | Core; locally once |
| bmp1-platoon-mortar | Heavy Mortar / independent BMP-1 platoon | 40 / 1r | 120mm, three men, GAZ-66 tow; p.2 right | Core; MTLB +5; not in B01 |
| brdm2-recon | BRDM-2 Armoured Car | 12 / 1r | One vehicle, Scout / Mortar Spotter; p.10 lower left | Core; one allocated reconnaissance choice |
| zsu23-4 | ZSU-23-4 SP AA Gun | 35 / 2i | One vehicle; p.12 upper left | Core; separate Specialist purchase |
| artillery-request-priority3 | Off-Table Artillery Support Request / 3rd Priority | 5 / 0 | Request without initial on-table formation; p.13 upper left | Core; HQ Additional Fire Support choice; no random artillery models |
| t80-company | T-80 MBT Company | 650 / 25r | Ten T-80B: 1+3+6; p.6 upper left | Modeling; Restricted upgrades initially deferred, later clarified |
| t72-company | T-72 MBT Company | 600 / 25r | Ten T-72A: 1+3+6; p.6 lower left | Modeling; corrected summary typo per A01 |
| t62-platoon | T-62 Tank Platoon | 75 / 6i | Three T-62A; p.7 lower left | Modeling; whole M +30, one Bastion +20, Regular +20/+3 BR |
| t62-company | T-62 Tank Company | 240 / 20i | Ten T-62A; p.7 upper left | Modeling; Regular +55/+10 BR; Unique event clarified in A05 |
| bmp1-company | BMP-1 Motor Rifle Company | 275 / 25r | Command plus three included platoons; p.3 | Modeling; local options independent; no extra 3 × 95 |
| bmp2-platoon | BMP-2 Motor Rifle Platoon | 130 / 12r | Three squads and three BMP-2; p.4 | Modeling; BMP-2D scope later clarified |
| bmp2-platoon-fire-support | Fire Support / independent BMP-2 platoon | 45 / 1r | Two two-man PKM teams share one BMP-2; p.4 | Modeling; distinct context entry |
| bmp2-company | BMP-2 Motor Rifle Company | 380 / 35r | Command plus three included platoons; p.5 | Modeling; no extra 3 × 130 |
| bmp2-company-platoon-fire-support | Fire Support / company platoon | 40 / 1r | Two teams share BMP-2; p.5 | Modeling; second Section +35/+1 BR, one local slot |
| combat-engineers | Combat Engineer Squad | 25 / 3r | Eight men, RPG-7V, BTR-60PB; p.11 left | Modeling; free BTR-70/80 replacement |
| ambulance | Ambulance | 20 / 2i | Ural-452, Restricted; p.11 lower right | Modeling; Heavy Truck −5/−1 BR, no inferred loss of Medic rule |
| timed122 | Timed 122mm HE Barrage | 25 / 0 | Six-gun scheduled strike, not six purchased on-table models; p.15 left | Modeling; target included; ToT exemption C10 |
| off-table120 | Off-Table Mortar Fire / 2×120mm | 85 / 0 | Off-table artillery purchase; p.8 right | Modeling; Artillery rather than Additional Fire Support |

Other nations, complete combat data, the full list, random aircraft payloads and complete logistics were outside the initial source/calculation batch. MANPADS, PT-76, TOC and defences were initially boundary cases rather than B01 purchases. Later catalog support must be assessed from its own version, not this historical sample table.

## 3. Option boundaries

- Included vehicles, squads and fixed platoons do not create extra purchase charges. Paid supports and upgrades each charge once at their declared level.
- Sum Points and numeric BR separately. Training belongs to the applicable formation/member; do not label the whole army Regular.
- all includes matching BMPs in fixed platoons and purchased local supports. Three base vehicles without supports cost +15 for a +5 upgrade; actual added transports increase the target set.
- Apply only verified replacements and prerequisites. BMP-1P is required for its Konkurs upgrade. No sample claims exhaustive validation of every squad equipment combination.
- A T-72 platoon's +30 is once for the formation; a company's +10 each is per vehicle. Ten T-72A follow A01. Points-only options preserve BR.

## 4. Meaning of the baseline

B01 has explicit Platoon size and a 500-point budget, totaling 398 Points / 23 BR with 102 remaining. Within the checked subset, budget, local option count/uniqueness and allocated army support are satisfied. It uses no Restricted or disputed upgrade.

The BMP-1 platoon and T-72 platoon each grant four army choices; the BMP platoon separately has four local option slots. A02 is resolved. A08 limits the full-legality conclusion to undetermined, without requiring an unavailable author compatibility statement forever.

All 23 accounts are durable independent expectations for later commands/evaluation/rules. A complete sample baseline does not mean the entire game or runtime engine was already complete when the evidence was recorded. Keep source PDFs unchanged and trace corrections in the clarification/data records.