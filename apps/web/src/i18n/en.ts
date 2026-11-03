/**
 * English UI dictionary. All user-facing strings live here so later
 * translations can be added as sibling dictionaries without touching
 * components. Keys are dot paths resolved by `t()` in i18n/index.ts.
 */
export const en = {
  app: {
    title: 'Battlegroup Army Builder',
    tagline: 'Community roster editor for Battlegroup cold-war rulesets',
  },
  nav: {
    home: 'My Rosters',
    editor: 'Editor',
    roadmap: 'Roadmap',
  },
  home: {
    myRostersTitle: 'My Rosters',
    createTitle: 'Create a roster',
  },
  roadmap: {
    title: 'Roadmap',
    intro: 'Engineering milestones and their honest current status.',
    m01Label: 'M01 — Source verification and coverage baseline',
    m01Status:
      'Delivered: manually verified fixture accounts, including a 398 points / 23 battle rating sample baseline.',
    m02Label: 'M02 — Engineering and build foundation',
    m02Status:
      'Delivered: this web shell, npm workspaces, type checks, unit tests, browser checks and a static build.',
    m03Label: 'M03–M07 — Domain contracts, catalogue, commands, evaluation, Classic rules',
    m03Status: 'Delivered: versioned Classic data, atomic editing commands, pricing and scoped Classic checks. Coverage remains partial.',
    m08Label: 'M08 — Web roster editing',
    m08Status: 'Delivered: session rosters, purchases, options, totals, issue navigation and undo/redo. Refreshing the page clears the session.',
    m09Label: 'M09–M12 — Storage, import/export, print, deployment',
    m09Status: 'Planned: not started.',
  },
  editor: {
    preview: 'Classic preview — session only',
    sessionOnly: 'Rosters stay in this open page only. Refreshing or closing it discards them. Local saving arrives in M09.',
    sessionBadge: 'Not saved to disk',
    loading: 'Loading the Classic catalog…', ready: 'Classic catalog ready.',
    loadFailed: 'Catalog verification failed in this browser. Retry loading the catalog.',
    omittedOptions: 'Certain Restricted/Unique upgrades and MANPADS combinations await clarification.',
    retry: 'Retry catalog loading', updated: 'Roster updated.', created: 'Roster created.',
    emptyLibrary: 'No rosters in this session. Create one below or open the example.',
    emptyRoster: 'Your roster is empty. Add a formation from the catalog.',
    open: 'Open', deleteRoster: 'Discard roster',
    exampleName: 'Soviet sample roster', createExample: 'Create the 398 Points / 23 BR example',
    coverageTitle: 'Available data',
    coverageBody: 'Classic Cold War · Soviet Armoured Division V4.1. Ten purchase entries are available, including four platoon attachments. Rule and profile coverage is partial; this preview cannot certify a complete legal army.',
    noRoster: 'Create or open a roster first', back: 'Back to My Rosters',
    catalogVersion: 'Catalog', points: 'Points', br: 'Battle rating', remaining: 'Budget remaining',
    checks: 'Rule checks', violations: 'Issues found', incomplete: 'Partial coverage',
    knownSubtotal: 'Known subtotal', unknown: 'Unknown', notApplicable: 'Not applicable',
    charges: 'Price breakdown', baseCost: 'Base price (fixed members included)', support: 'Support use & statistics',
    undo: 'Undo', redo: 'Redo', copy: 'Copy formation', remove: 'Remove formation',
    catalog: 'Catalog', roster: 'Roster', details: 'Details & checks', panels: 'Editor panels',
    search: 'Search units', add: 'Add', attachments: 'Platoon attachments',
    chooseParent: 'Select a platoon to see its attachments.',
    chooseSelection: 'Select a purchased formation to configure it.',
    composition: 'Current composition', noEntities: 'This purchase has no on-table entities.',
    attributesUnknown: 'Combat attributes have not been verified for this release. Unknown values are not zero.',
    sources: 'Sources', problems: 'Problems', noProblems: 'No violations found within implemented checks. Coverage is partial.',
    coverage: 'Check coverage', target: 'target', name: 'Roster name', ruleset: 'Ruleset', army: 'Army list',
    budget: 'Points budget', gameSize: 'Game size', create: 'Create roster', applySettings: 'Apply settings',
  },
  notFound: {
    title: 'Page not found',
    body: 'This hash route does not exist.',
    backHome: 'Back to My Rosters',
  },
  footer: {
    license:
      'A free community tool under the MIT license. Not affiliated with the rules authors or publishers.',
    docs: 'Design documents live in the repository docs/ folder.',
  },
} as const;

export type EnglishDictionary = typeof en;
