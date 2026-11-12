# Deployment

## Sites entry points

- [Battlegroup Army Builder test site](https://battlegroup-armybuilder-test-20261109.w2y3q2.chatgpt.site)
- [Sites dashboard](https://chatgpt.com/sites)

Reuse the existing Sites project (`appgprj_6af1cc72fcd48191be12838703daf7e1`). The main Git repository holds the application source. The separate Sites checkout holds the published static snapshot and its provenance.

## Build and publish

1. Select the application commit to publish and confirm the checkout matches it. Install locked dependencies with `npm ci` when needed. Run `npm run typecheck`, `npm test`, and `npm run build`. The build validates released catalogs and writes static files to `apps/web/dist/`. For browser checks against that build, run `npx playwright test` from the repository root. See the [development guide](development.md) for browser setup.
2. In Sites, confirm the project and its current audience. Obtain a fresh source repository write credential and open the dedicated checkout with the installed Sites plugin's `scripts/site-workflow.mjs` helper. If the checkout is missing, open the same project in a new empty directory. Pass credentials through the helper's hidden standard input.
3. Replace the hosting checkout's `dist/` with the verified build. Keep `.openai/hosting.json` pointed at `dist` and preserve the project ID. Update `SOURCE.json` with the application commit and fingerprints of the shipped assets and catalogs. The deployment archive may contain only the application build, released catalog data, and the hosting manifest. Keep source references, fixtures, and local evidence outside it.
4. Use the helper to commit and push the hosting snapshot and package its archive. Save a Sites version using the returned hosting commit and its exact archive, then deploy that saved version with the operation appropriate to the current audience. Follow the deployment to a terminal status and verify the changed workflow on the live URL.
5. Look up publication status and version history in Sites. Use the matching snapshot's `SOURCE.json` to identify the application commit.

## Manage access

Open the project in the [Sites dashboard](https://chatgpt.com/sites). Use **Share** to inspect or change who can visit. Keep the existing audience when publishing an update unless an access change has been requested.

## Back up and restore rosters

Rosters are stored in IndexedDB for each browser profile and site origin. A change of browser profile, device, protocol, hostname, or port requires transferring the library.

1. In the original browser and site, open **My Rosters** → **Import & backup** and select **Download all rosters (backup)**. Keep the JSON file somewhere you can access after the move.
2. In the destination browser and site, open **Import & backup** and select **Choose JSON file…**. Review the preview and confirm the import.
3. Open a restored roster and verify its choices and totals before clearing the original browser data.
