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
    roadmap: 'Roadmap',
  },
  status: {
    bannerTitle: 'Early development — planning stage',
    bannerBody:
      'This page is an engineering shell (milestone M02). Roster building, points and battle-rating calculation, and rule checks are not implemented yet.',
  },
  home: {
    myRostersTitle: 'My Rosters',
    myRostersEmpty:
      'No rosters yet. Local roster storage arrives with milestone M09; this build does not save anything.',
    createTitle: 'Create a roster',
    createBody:
      'Roster creation opens once the Classic Cold War sample list is connected to a rule engine (milestone M07).',
    coverageTitle: 'Planned data coverage',
    coverageIntro: 'First ruleset in scope:',
    coverageSample:
      'Sample list: Soviet Armoured Division V4.1. A manually verified baseline of 398 points / 23 battle rating exists in project fixtures; it is not wired to an engine yet.',
    coverageStatus: 'Ruleset module status: planned — no catalogue data is loaded yet.',
    coverageIsolation:
      'Classic Cold War, AirLand and NORTHAG keep their game data fully separate. Only code and UI are shared.',
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
    m03Status: 'Planned: not started. No roster editing or rule evaluation exists yet.',
    m08Label: 'M08–M12 — Web editing, storage, import/export, print, deployment',
    m08Status: 'Planned: not started.',
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
