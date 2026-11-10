# Deployment

This guide retains the existing test-site identity and deployment boundary. Recorded hosted facts below are from the 2026-11-09 deployment; access and hosting state were not queried again during the 2026-11-10 documentation cleanup.

## Existing Sites test

| Item | Recorded value |
|---|---|
| Site | https://battlegroup-armybuilder-test-20261109.w2y3q2.chatgpt.site |
| Sites project_id | appgprj_6af1cc72fcd48191be12838703daf7e1 |
| Saved version | appgprj_6af1cc72fcd48191be12838703daf7e1~appgver_53b05c6014b08191bf98991ecd9b4fba |
| Deployment ID | appgdep_6af1cd952f008191bf2b6f10cc7d7a7b |
| Main-repository source commit | 4591a216c72f33e3656280d65eac39a42cbb548c |
| Hosting source snapshot | cb2fe2ad4cb95c14908878869f1265a39726c00e |
| Deployment result | succeeded, 2026-11-09T13:41:56Z |
| Initial audience | Owner-only custom access: one allowed user, no groups |
| Last recorded audience | public, queried 2026-11-09; owner unchanged |
| Supported catalogs | Exact Classic Soviet V4.1 releases 1.0.0 and 1.1.0 |
| Archive SHA-256 | d8854490d0d96c75aff98ab67ea54f1f91dd45c4e7485f7360b76a12bfe76484 |

That deployment contains M01–M10. Subsequent vehicle/weapon references, printing/PDF and UI cleanup are local changes until separately published. A local commit or build does not update Sites automatically.

## Source and artifact boundary

The main repository is the application source of truth. A dedicated Sites source snapshot contains static dist, .openai/hosting.json and SOURCE.json with the main commit/build fingerprints. The deployment archive contains only static assets and the hosting manifest, not application-source directories, fixtures, AGENTS.md, original PDFs or temporary state.

The hosting source checkout was .tmp/m12-site/; package fingerprints and checks were .tmp/m12/. These local directories are not prerequisites for a new clone. If absent, obtain a fresh source credential for the same project_id and recover its source repository into a new empty directory. Reuse the existing project rather than register another site.

## Update workflow

1. Read the currently installed Sites workflow and tools, then retrieve the existing project/access state. Preserve its audience unless the user asks to change it.
2. Build/validate the main checkout and record the exact source/data identity. Verify the static artifact allowlist and asset base.
3. Open the same hosting source repository using the supported helper/credential flow. Update the static snapshot and provenance; do not maintain a separately evolving copy of application code.
4. Package the verified source commit and archive using the supported helper, save/deploy that exact version, and retain the returned identifiers/result.
5. Verify the intended hosted workflow, explicitly including newer printing/data features when they are first published. Distinguish native deployment success from browser-flow acceptance.

Keep credentials and service-access tokens out of source files, command arguments, archives and logs. The source helper's required hosting manifest uses the actual returned project identity; do not invent a replacement ID or assume an old credential remains valid.

## Recorded hosted verification

The first deployment verified all six selected static assets against local SHA-256, creation/configuration, exact catalog loading, single-roster and full-backup round trips, conflicting two-tab overwrite, direct editor navigation and actual Chrome process reopen. A restored/exported example retained 583 Points and its original choices. Small-screen checks found no horizontal overflow/pageerror in the checked flow. Printing was not part of that hosted snapshot.

Logs, downloads and screenshots remain in .tmp/m12/. Historical failed Node access-header/Cloudflare checks remain evidence of those attempts; a later standard Chrome flow succeeded. Do not treat those failures as proof that a user-facing site is unavailable now or bypass a platform access control.

## Management and origin-bound data

Manage the site from [Sites](https://chatgpt.com/sites), selecting this project and using Share for audience and the site menu for settings/analytics. Recorded public status is historical; query current state before making hosting/access changes.

Each visitor's rosters remain in that browser's IndexedDB. HTTP/HTTPS, host and port define different origins. Export a library backup at the old origin and import it at the new one; localhost data does not automatically appear at the hosted site.

## Later hosting

Cloudflare Workers Static Assets and GitHub Pages are project-selected candidates, with no migration performed. Recheck current capabilities/limits when implementing one. Keep Vite assets, hash routes, indexed catalog URLs and browser printing independent of the provider. Verify subpaths, direct links/refresh and data loading on the actual target; hash routing alone does not verify asset paths. A new origin requires the backup/import process.