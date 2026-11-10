# Classic Constraints

Source baseline: 2026-10-30, with subsequent user clarifications applied for Soviet V4.1 release 1.1.0. Source IDs are in the [fingerprint manifest](../../tests/fixtures/classic-coldwar/m01-sources.json): SOV = Soviet V4.1, CW = Cold War Draft 6, BASE = base rulebook. Page references are PDF / printed page. Visual review does not itself establish complete rule coverage.

| ID | Rule / counted object | Scope and expected behavior | Source PDF / printed | Interpretation |
|---|---|---|---|---|
| C01 | Budget from purchases and options | Army Points must not exceed the chosen budget; do not infer formation prices from profile prices | BASE 11 / 10; SOV 2, 6 / same | Confirmed budget check; violating drafts remain editable |
| C02 | Independent BMP-1 platoon's Platoon Support Options | At most four in that platoon; listed Medic, Fire Support, AGL and Mortar each at most once | SOV 2 / 2 | Local, not one Medic in the entire army |
| C03 | Options in a company's fixed platoons | Each of three platoons has up to four; second Fire Support Section consumes one slot, so first and second together consume two | SOV 3, 5 / same; A04 | Explicit repeat exception does not exempt slot consumption |
| C04 | Formation base price and BR | Parent includes fixed members/platoons; do not add independent child purchase prices again | SOV 2–7 / same | 275 is not 3 × 95 plus command |
| C05 | Model upgrades / member equipment | T-72 platoon B/B1 +30 once; AV +15; KMT on at most one vehicle +5 | SOV 6 / 6 | Alternative target models cannot be selected together |
| C06 | Training change | T-62 platoon Regular +20 Points / +3 BR; company +55 / +10; training becomes r | SOV 7 / 7 | Use explicit changes, not a vehicle-count reconstruction of BR |
| C07 | Infantry army-wide support choices | Eligible categories follow the list heading; independent BMP platoon grants four choices, BMP company twelve | SOV 2–5 / same; user clarification | Separate from local Platoon Support Options; no extra heading +1 or duplicate grants from included platoons |
| C08 | Tank army-wide support choices | T-80/T-72/T-64 platoons grant four; T-62 platoon three; tank companies nine | SOV 6–7 / same; user clarification | Army-support category allowance, not local tank options; do not add one |
| C09 | HQ / Artillery support grants | HQ grants one choice of Logistics or Additional Fire Support; Artillery grants Additional Fire Support | SOV 1, 8 / same | Main fixture allocates HQ to a 5-point request; no duplicate child grants |
| C10 | ToT exception | ToT consumes no Additional Support Choice; Timed122 includes its target point | CW 28 / 28; SOV 15 / 15 | Do not charge another 10 points or invent a third fixed allowance pool |
| C11 | Restricted threshold | Squad 2, Platoon 3, Company 4, Battalion 5; repeated purchases each count | CW 31 / 31; A05 | A complete upgrade event counts once; printed cost mode remains unchanged |
| C12 | Unique | At most one per Unique group across the army; Restricted+Unique also consumes Restricted allowance | BASE 49 / 48; CW 32 / 32; SOV 7 / 7; A05 | Up to three Bastion tanks in one T-62 company count as one event, sharing the group with independent T-62MB and platoon upgrades |
| C13 | Explicit game size | Guidelines: Squad 100–350, Platoon 351–750, Company 751–1250, Battalion 1251–2000+; standard 250/500/1000/1500 | BASE 11, 13–14 / 10, 12–13 | Size affects command dice; mismatched guideline can warn, never silently reselect size |
| C14 | Defences | Only defender in Attack-Defence; these purchases do not grant support | SOV 9 / 9 | Missing scenario/role is missing input, not a guessed answer |
| C15 | WARPAC TOC | Battalion only | CW 32 / 32; SOV 1 / 1 | Do not borrow NATO Company/Battalion eligibility; Soviet TOC and attachments are in 1.1.0 |
| C16 | PT-76 tank exclusions | Independent PT-76 or Recon Command conversion excludes every non-T-62 tank company, platoon and additional individual tank | SOV 10 / 10; A07 | Inspect nested choices and actual profiles; T-62M/MB remain T-62 family |
| C17 | Company SAM / squad SA-7 | At most one platoon per company buys one SAM Section; it conflicts with SA-7 upgrades in that company | SOV 3, 5 / same; A06 | SA-14 replacement preserves Section identity; companies are independent |
| C18 | Transport replacement / negative deltas | Engineer BTR-60PB → BTR-70/80 is free; Ambulance → Heavy Truck is −5 Points / −1 BR | SOV 11 / 11 | Preserve role rules; do not infer a different purchase definition |
| C19 | Purchase versus battlefield units | One purchase may include several independently acting game units | BASE 8 / 7 | Composition count is not purchase count; does not alone determine support or Restricted counting |
| C20 | Fire-request types | Artillery automatically passes Priority Check; Additional Fire Support requires it; approved normal requests can be reused, Timed Barrage is one-shot | BASE 36, 40 / 35, 39; CW 25 retains base artillery rules | Static purchase only; do not import NORTHAG extra-request consumption semantics |
| C21 | BR and training | Sum pre-game BR; no fixed Points-to-BR conversion; i/r/v/e are independent training grades | BASE 44 / 43; CW 29 / 29 | Do not cap a formation's BR at 5 or assign army-wide uniform training |
| C22 | Officer statistics | Count actual units with Officer; Senior Officer also counts; a Platoon Commander name alone does not | BASE 14, 48–49 / 13, 47–48; CW 31–32 retains rules | B01 expected Officer count 1; later battle losses are outside scope |
| C23 | Scout weight | Scout counts one, Scout2 two, Sniper Scout also counts | BASE 49 / 48; CW 32 | B01 expected weight 1; not every reconnaissance-category purchase is automatically a Scout |
| C24 | Reserves | Normally one roll per unit; transport and passengers share an arrival choice, including tank riders | BASE 45 / 44 | Deployment counting must not merge Points, BR or purchase allowances |
| C25 | Scenario / deployment separation | Flanking Attack locates existing Scouts; Defence Line puts all attacking recon in Probing Force; High Ground grants default defences | BASE 58–60 / 57–59 | Does not require buying recon, nor automatically buy/charge Soviet defences; verify scenario applicability separately |
| C26 | T-72 company correction | Ten T-72A: one company command, three platoon command, six ordinary; 600 Points / 25 BR | SOV 6 / 6; A01 | Source T-80B summary is a user-confirmed typo; do not reconstruct BR from single tanks |
| C27 | all-BMP target scope | Include matching BMPs in all fixed platoons and purchased Platoon Support Options | SOV 2–5 / same; A03 | Rebuild targets after attachment changes; each actual vehicle once; no duplicate local replacement charge |
| C28 | Points-only options | Explicit BR delta is zero, preserving base BR | A09; printed cost source per option | Does not turn an unknown base BR into zero |
| C29 | BMP-1 helicopter conversion | Platoon gets one Mi-8, company three; remove relevant BMP transports from purchase/attachments while retaining personnel | SOV 2, 3 / same | Extra Mi-8 requires conversion; removed ground transports cannot also be upgraded |
| C30 | Model-dependent equipment | Refleks requires its selected target to have become T-80U | SOV 6 / 6 | Inspect each target's evaluated model |

## Implementation semantics

Keep stable parent/member identity for local constraints. C07–C09 grants identify producers and eligible consumers. A valid automatic allocation proves feasibility; players need not manually assign every support purchase to a grant.

Support units are army-wide purchases from the categories allowed by the relevant list (Reconnaissance, Engineer, Logistics, Specialist, Additional Fire Support, as applicable). Platoon Support Options are that platoon's own menu. The user clarified this on 2026-10-30; the original A02 ambiguity claim was withdrawn. Local attachments neither consume nor generate the army-wide pool.

Distinguish a checked applicable rule, an untriggered rule and a check blocked by data/input. B01 contains no ToT, Restricted, PT-76 or MANPADS selection; that sample cannot prove their implementation merely by having no violations. Coverage IDs can group rules and are implementation diagnostics, not a player checklist or an exhaustive proof of legality.

Fixture expectedViolations values are manual expectations. The arithmetic checker does not execute these rules. Ruleset tests must independently generate results and compare them. See the [base-rulebook review](classic-base-rulebook-review.md) for source boundaries: no universal HQ/infantry minimum was found in the reviewed passages, which is not proof that every supplement permits unrestricted buying.