# Classic Base-Rulebook Review

Review date: 2026-10-30. Source: local `references/Coldwar/battlegroup rulebook.pdf`, cross-checked with Cold War Draft 6. This records the reviewed evidence, not a house rule or a claim to have audited the entire game. Later A05/A06 decisions are in the [clarification register](classic-ambiguities.md).

## 1. Source identity and scope

Text extraction/search covered all 66 PDF pages for roster purchasing, support, compulsory/minimum choices, BR, training and restrictions. Relevant original pages were then reviewed visually. Movement, shooting, hit tables and the full battle procedure were not all verified.

Visually reviewed base PDF pages: 5, 6, 8, 11, 13, 14, 36, 39, 40, 41, 44, 45, 47, 48, 49, 58, 59, 60, 61. Copyright page 5 says first published 2013; the filename does not establish a particular later printing.

Draft 6 pages 29/30 were reviewed in this extension; 25–27 were supporting extracted text; 28/31/32 were already reviewed. Images remain in .tmp/. The [source manifest](../../tests/fixtures/classic-coldwar/m01-sources.json) retains fingerprints and actual visual-page sets. Historical source-location strings do not change the original hashes.

References below distinguish PDF from printed numbering; cited base-book printed pages are one less than PDF pages. Some contents-page scenario references differ from actual footers, so use the actual page location.

## 2. Findings

| Topic | PDF / printed | Confirmed evidence | Project consequence |
|---|---|---|---|
| Base book versus supplements | 6 / 5; 8 / 7 | General rules are in the base book; lists/theater content are in supplements | The base book alone need not supply every Soviet restriction; an absent clause is not proof of free purchasing |
| Purchase versus game unit | 8 / 7, v. Units | Independently commanded units can be bought together as a platoon, group or battery | Separate purchase identity from battlefield count; support allowance comes from the actual list entry, not model/unit-count inference |
| Budget and game size | 11 / 10; 13–14 / 12–13 | Agreed budget; size table is a guideline; size determines command dice; record Officers | Persist budget and size separately; warn for a guideline mismatch rather than silently change size or invent minimum units |
| Artillery versus external support | 36 / 35; 40–41 / 39–40 | Artillery automatically passes Priority Check; Additional Fire Support uses priority/communications; several request priorities may exist | SOV p.8 mortar remains Artillery, p.13 request remains external support; having no model does not merge categories |
| Requests versus timed strikes | 40 / 39 | A granted request that fires can be used again later; Timed Barrage/Airstrike are prearranged one-shot events | Do not adopt NORTHAG extra-request consumption; implement static purchases only |
| Target points and Timed Barrage | 40 / 39 | Registered targets bypass ranging; timed barrage has a preset turn/target | No universal free target: Timed122 includes it because of SOV p.15; ToT exemption still comes from CW p.28 |
| BR / training | 44 / 43; CW 29 / 29 | BR is independent of Points; sum before battle; i/r/v/e = Inexperienced/Regular/Veteran/Elite; CW retains the system with changes | Include e even when samples use i/r; no cost/manpower-derived BR or arithmetic on training letters |
| BR range context | 44 / 43 versus SOV pp.2–7 | Base text discusses 0–5 for a game unit; printed platoon/company purchases have higher totals | No BR≤5 cap on purchase entries; preserve values such as 180/7 and 275/25 |
| Officer / Scout | 14 / 13; 48–49 / 47–48 | Senior Officer also counts as Officer; Scout2 counts two; Sniper Scout counts | Do not infer Officer from Platoon Commander text; opponent/scenario comparisons are not automatic roster errors |
| Unique | 49 / 48; CW 32 / 32 | Unique does not scale by game size; Restricted has additional CW rules | These passages did not resolve whole-upgrade counting; later A05 user clarification does |
| Reserves / transports | 45 / 44 | Usually one reserve roll per unit; transport/passengers share an arrival choice, including tank riders | Deployment counting is not pricing, BR or support counting; never subtract passenger BR |
| Scenarios | 58–60 / 57–59 | Flanking Attack positions existing Scouts; Defence Line includes all attacking recon in Probing Force; High Ground grants default defences | Does not require buying recon or automatically charge Soviet defence entries; verify cold-war scenario applicability separately |
| Organization sheet | 61 / 60 | Fields for Points, BR, Officers, Scouts and purchase categories | Blank columns do not establish HQ/infantry minima or support ratios |

## 3. Clarification consequences

A08's initial base-book lookup gap was addressed. No universal at-least-one HQ/infantry/recon purchase clause was found in the reviewed list-building passages or organization sheet. That limited finding is not an author guarantee for every supplement. Remaining work concerns explicit supplement/edition applicability and supported full-rule coverage, not a blanket failure to read the base book.

Do not require a nonexistent author compatibility declaration as a permanent acceptance gate. Conversely, do not infer unrestricted lists from absence of evidence.

A02 was resolved by the user, withdrawing the initial candidate interpretation: Support units are army-wide category choices; Platoon Support Options are local platoon menus. T-72's four choices and T-62's three are explicit purchase-definition values. They do not come from battlefield-unit counts.

A01/A03/A04/A07/A09 were also explicitly resolved. A05/A06 were unresolved at the original review date but have since been resolved for the expanded list; consult the maintained register rather than historical review status.

## 4. Calibration and implementation impact

B01 remains **398 Points / 23 BR**. B02–B04 arithmetic and confirmed violation expectations remain unchanged. S01/S02 independently test army/local support scopes. A08 preserves partial coverage, not a Support units interpretation blocker.

B01's HQ Senior Officer contributes one Officer. Tank/BMP platoon-command roles do not automatically add Officers. BRDM-2 contributes one Scout. Do not simulate initiative or opponent scouting. Engine results must independently reproduce those auxiliary expectations.

Keep purchase count, actual composition, reserve arrivals, Officer count, Scout weight and support allowance separate. Classic Elite support does not imply shared NORTHAG training records. Reviewing battle-rule passages does not extend the editor into battle tracking.

## 5. Evidence preservation

This review added C19–C25 and supplemented C12/C13 sources, narrowed A08 and expanded the manifest's visual-review pages. Original PDF hashes and initial cost expectations were preserved. Later fixture additions bring the maintained set to 23 cases. The arithmetic script checks evidence and accounts, not automatic execution of every reviewed rule.