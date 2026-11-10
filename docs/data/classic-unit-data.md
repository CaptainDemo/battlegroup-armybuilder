# Classic Vehicle and Weapon Reference Data

The editor displays independent vehicle attributes and carried-weapon properties for infantry/weapon teams. Printing reuses these supplements and can append full data through its optional appendix. This reference layer does not change purchase prices, game rules, stored choices or immutable catalogs.

## Sources and scope

Vehicle source: `references/Coldwar/BGCW Soviet AFV data cards.pdf`, SHA-256 `80e560ea58f716ca1b49075f1635d2ed557209c18bc607fe7c6902875fb8cbd1`. Nine original pages and 51 cards were reviewed, retaining PDF page/card position. M01's fingerprinted-only record retains its historical meaning.

`packages/catalogs/classic-coldwar/reference/soviet-afv-v1.json` uses reference version `soviet-afv/1`. Explicit full-identity bindings cover 52 profiles in catalog 1.1.0 and seven in 1.0.0. BMP-1 and BMP-1AA bind to the same card because its title explicitly names both. No name-based, cross-catalog or foreign-ruleset inference is used.

Cards include road/off-road movement, F/S/R/T armor, size, NBC, amphibious capability, night sights, machine-gun mounts, special rules and ammunition-specific HE/generation/eight range bands. Distances are inches; preserve original labels such as 0–5 versus 0–10. Known armor zero stays zero; source dashes are not applicable, not numeric zero.

Weapon source: `references/Coldwar/Unofficial Battlegroup CW Rules. - Draft 6pdf.pdf`, SHA-256 `56595a4c83a35e6acf5242800361285381a16b0f44846331c7c26f2c5bda0b1b`. Reviewed pages: 8, 9, 15, 20, 21, 22, 23, 31, 50. `reference/draft6-weapons-v1.json`, version `draft6-weapons/1`, contains 33 Classic-only records for small arms, RPG/LAW, AGS-17, mortars, flamethrowers, thermobaric rockets, Soviet ATGMs and SAMs.

All 125 profiles in the current catalog have an explicit display classification: 86 vehicles, 29 carried-weapon/unit-equipment bindings, seven personnel/formation containers/non-weapon equipment and three unverified weapons. Infantry do not require invented armor data. RPK-74 is LMG with RoF 3 under p.20, not SAW 5. SVD Marksman retains p.31 restrictions without borrowing spotter-assisted sniper range. AK-74 unit equipment states each firer's properties, not inferred rifle counts or total firepower.

ATGM data includes generation, back-blast, tandem/unreliable flags, HE effect and penetration bands. SAM data uses its own system/radar type, attack modifier and damage. SA-7's zero attack modifier remains known zero; do not invent penetration or range. The general weapon table's 5–10 band does not overwrite vehicle-card 0–10 labels.

## Version and evaluation boundary

Supplements are independent read-only versioned data, validated with Classic schemas and bound by exact catalog identity plus profile ID. The bytes/hashes and unknown stats of purchase catalogs 1.0.0/1.1.0 remain unchanged. Old rosters can display supplements without changing their original versions, choices, totals or legality coverage.

Presentation reads actual profiles, weapons and quantities from the current evaluation subtree. Selecting a fixed company platoon shows only that subtree. Vehicle/PKM/RPG/SA-14 replacements follow evaluated choices. Konkurs/Svir bindings use target tags and keep upgraded/unupgraded vehicle configurations separate. A selected missile replacement hides that vehicle's replaced base-card ATGM row and displays the corresponding Draft 6 data.

References do not participate in pricing, legality checks or save writes. See [printing](../contracts/printing.md) for aggregation and appendix behavior.

## Explicit gaps and source differences

- Generic trucks, helicopters and unmatched variants remain unverified. Do not substitute a normal vehicle card for a command variant. Demolition charges, 100mm T-12/MT-12 and 125mm Sprut-B need verified weapon sources.
- Personnel, observers, loaders, formation containers and non-weapon equipment receive no invented vehicle attributes. Missing personal weapons are not inferred from headcount.
- A T-72B1 card's optional Svir is not automatically equipped. Selected Svir can display missile data while T-72B hull attributes remain unverified. T-62MB/Bastion can similarly display the known missile without an unbound hull card.
- Preserve source differences: BMP-1P's Spigot card permits the 10–20 band while Draft 6 p.15 Fagot has a dash; general Refleks/Svir tandem is No while some vehicle cards say Tandem. Do not reconcile by real-world equipment knowledge or overwrite one table with another.
- Retain notes for suspected source issues, including missing Reactive Armour on T-80BV, SA-8/SA-11 vehicle rows, PMM-2's GSP row and Spandrel missile numbering. Do not silently correct original values.
- Display card special rules as reference information; this does not extend roster-legality coverage or implement battle procedures.

## Verification boundary

Maintained checks cover real catalog identity/classification, rejection of foreign bindings, source hashes, independent values, optional missiles, invalid packs, nested/zero quantities and single-target upgrades. SAM schemas reject ATGM penetration data. Build data gates validate both supplements.

Browser checks include T-72A armor 17/8/3/2, T-72B1 21/9/5/2, a +30 upgrade changing the baseline from 398 to 428 Points and reversing correctly; conditional AK-74 fire, RPK RoF 3, one-squad PKM/RPG replacement, SA-7 zero / D3 and one-vehicle Konkurs replacement without changing the other two vehicles. A combined reference example independently totals 451 Points. At 360px, tables scroll inside their panel without page overflow.

The actual catalogId is `soviet-armoured-division-v4_1`, not its static asset directory name. Tests bind directly to the real manifest to prevent a recurrence of that mismatch. Temporary screenshots/logs remain under .tmp/unit-data/ and are not published.