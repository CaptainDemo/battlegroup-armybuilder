import { mkdirSync, readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

/**
 * M11 acceptance checks for the print/PDF view: the preview reads the current
 * in-memory draft and the same evaluation as the editor, survives close/reopen
 * without touching undo history, prints long multi-page rosters (companies,
 * fixed sub-platoons, member-anchored attachments, per-target upgrades, long
 * notes) to real A4 PDFs, and keeps confirmed violations / coverage gaps /
 * player-entered text honest on paper.
 *
 * The r2 revision adds regressions for the a1 review findings: every fixed
 * composition member prints exactly once (counted on paper), selected
 * optional rules are printed, and the exact legacy 1.0.0 catalog keeps its
 * leaf composition root (BRDM-2) with its own version line.
 *
 * PDFs and screenshots are written to .tmp/m11/ as acceptance evidence for
 * manual review; they are never part of the published app.
 */

const EVIDENCE_DIR = '.tmp/m11';
const CATALOG = {
  rulesetId: 'classic-coldwar',
  catalogId: 'soviet-armoured-division-v4_1',
  catalogRevision: '1.1.0',
};

function selection(
  selectionId: string,
  localId: string,
  options: {
    sectionId?: string;
    parent?: string;
    memberPath?: string[];
    choices?: unknown[];
  } = {},
): Record<string, unknown> {
  return {
    selectionId,
    entryReference: { ...CATALOG, localId },
    parentSelectionId: options.parent ?? null,
    ...(options.parent ? {} : { sectionId: options.sectionId }),
    ...(options.memberPath ? { targetMemberPath: options.memberPath } : {}),
    optionChoices: options.choices ?? [],
  };
}

function rosterFile(name: string, document: Record<string, unknown>) {
  return {
    name,
    mimeType: 'application/json',
    buffer: Buffer.from(
      JSON.stringify({
        formatVersion: 'roster-file/1',
        kind: 'single-roster',
        savedAt: '2026-11-10T00:00:00.000Z',
        document,
      }),
    ),
  };
}

const longNotes = [
  'Battalion attack exercise — notes for the table.',
  'Companies deploy abreast; the BMP company holds the wood line with its fixed platoons and attached support sections.',
  'Long reference token that must wrap instead of clipping: ' + 'Reconnaissance-dispatch-authentication-token-' + '0123456789'.repeat(6),
  'Reminder: unknown values on this sheet stay unknown; coverage gaps are listed at the end.',
].join('\n');

const longDocument = {
  formatVersion: 'roster/1',
  rosterId: 'long-print-roster',
  revision: 'long-edit-1',
  name: 'Long print roster — companies, fixed platoons & attachments',
  catalogRef: CATALOG,
  armyListId: 'soviet-armoured-division-v4_1',
  settings: { budgetPoints: 5000, gameSizeId: 'battalion', optionalRules: ['long-print-optional-rule'] },
  notes: longNotes,
  selections: [
    selection('fhq1', 'fhq', { sectionId: 'hq' }),
    selection('c1', 't72-company', { sectionId: 'tank' }),
    selection('c2', 't72-company', { sectionId: 'tank' }),
    selection('c3', 't72-company', { sectionId: 'tank' }),
    selection('bc1', 'bmp1-company', { sectionId: 'motor-rifle' }),
    selection('bc1-fs', 'bmp1-company-fire-support', { parent: 'bc1', memberPath: ['platoon-1'] }),
    selection('bc1-medic', 'bmp1-company-medic', { parent: 'bc1', memberPath: ['platoon-2'] }),
    selection('bc1-agl', 'bmp1-company-agl', { parent: 'bc1', memberPath: ['platoon-3'] }),
    selection('p1', 'bmp1-platoon', {
      sectionId: 'motor-rifle',
      choices: [
        {
          optionGroupLocalId: 'bmp1-platoon-infantry',
          optionLocalId: 'bg-15-ugl',
          targets: ['command', 'assistant', 'rifle'].map((nodeId) => ({
            kind: 'member-path',
            nodePath: [nodeId],
          })),
        },
      ],
    }),
    selection('p1-medic', 'bmp1-platoon-medic', { parent: 'p1' }),
    selection('zsu1', 'zsu23-4', { sectionId: 'specialist' }),
    selection('brdm1', 'brdm2-recon', { sectionId: 'reconnaissance' }),
    selection('art1', 'artillery-request-priority3', { sectionId: 'additional-fire-support' }),
  ],
};

const legacyDocument = {
  formatVersion: 'roster/1',
  rosterId: 'legacy-print-roster',
  revision: 'legacy-edit-1',
  name: 'Legacy 1.0.0 print roster',
  catalogRef: { ...CATALOG, catalogRevision: '1.0.0' },
  armyListId: 'soviet-armoured-division-v4_1',
  settings: { budgetPoints: 100, gameSizeId: 'platoon', optionalRules: [] },
  selections: [
    {
      selectionId: 'brdm1',
      entryReference: { ...CATALOG, catalogRevision: '1.0.0', localId: 'brdm2-recon' },
      parentSelectionId: null,
      sectionId: 'reconnaissance',
      optionChoices: [],
    },
  ],
};

const violationDocument = {
  formatVersion: 'roster/1',
  rosterId: 'violation-print-roster',
  revision: 'violation-edit-1',
  name: 'Violations & coverage print roster',
  catalogRef: CATALOG,
  armyListId: 'soviet-armoured-division-v4_1',
  settings: { budgetPoints: 100, gameSizeId: 'battalion', optionalRules: [] },
  notes: 'Tally draft. <img src=x onerror="window.__printXss=1"> and <script> tags must stay text on paper.',
  selections: [
    selection('tp1', 't72-platoon', { sectionId: 'tank' }),
    selection('pt1', 'pt76', { sectionId: 'reconnaissance' }),
    selection('p1', 'bmp1-platoon', { sectionId: 'motor-rifle' }),
    selection('m1', 'bmp1-platoon-medic', { parent: 'p1' }),
    selection('m2', 'bmp1-platoon-medic', { parent: 'p1' }),
    selection('art1', 'artillery-request-priority3', { sectionId: 'additional-fire-support' }),
  ],
};

async function createExample(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Create the 398 Points / 23 BR example' }).click();
  await expect(page).toHaveURL(/#\/editor$/);
  await expect(page.getByTestId('points-total')).toHaveText('398');
}

async function importAndOpen(page: Page, file: ReturnType<typeof rosterFile>): Promise<void> {
  await page.setInputFiles('input[type="file"]', file);
  await expect(page.locator('.import-record').first()).toHaveAttribute('data-status', 'ready');
  await page.getByRole('button', { name: 'Import', exact: true }).click();
  await expect(page.locator('.library-item')).toHaveCount(1);
  await page.locator('.library-item').first().getByRole('button', { name: 'Open', exact: true }).click();
  await expect(page).toHaveURL(/#\/editor$/);
}

function countPdfPages(path: string): number {
  const raw = readFileSync(path).toString('latin1');
  const matches = raw.match(/\/Type\s*\/Page(?![s/w])/g);
  return matches ? matches.length : 0;
}

async function openPrint(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Print / PDF', exact: true }).click();
  await expect(page.locator('#print-sheet')).toBeVisible();
}

test.describe('roster print', () => {
  test('optionally appends the roster vehicle and weapon data without changing its snapshot', async ({page})=>{
    test.slow();
    await page.goto('/?debug=1');
    await createExample(page);
    await openPrint(page);
    const option=page.getByRole('checkbox',{name:'Append vehicle and weapon data',exact:true});
    const appendix=page.getByTestId('print-data-appendix');
    await expect(option).not.toBeChecked();
    await expect(appendix).toHaveCount(0);
    const revision=await page.getByTestId('print-edit-revision').textContent();
    mkdirSync('.tmp/m11-appendix',{recursive:true});
    await page.pdf({path:'.tmp/m11-appendix/without-data.pdf',format:'A4',preferCSSPageSize:true,printBackground:true});
    await option.check();
    await expect(appendix.locator('article[data-profile-id]')).toHaveCount(5);
    await expect(appendix.locator('article[data-weapon-id]')).toHaveCount(5);
    await expect(appendix.locator('details')).toHaveCount(0);
    const tank=appendix.locator('article[data-profile-id="t-72a"]');
    await expect(tank).toContainText('17 / 8 / 3 / 2');
    await expect(tank).toContainText('125mm 2A46M-1 Early');
    await expect(appendix.locator('article[data-weapon-id="rpg7v"]')).toHaveCount(1);
    await expect(appendix.locator('article[data-profile-id="t-80u"]')).toHaveCount(0);
    await expect(page.getByTestId('print-points-total')).toHaveText('398');
    await expect(page.getByTestId('print-edit-revision')).toHaveText(revision!);
    await page.getByRole('button',{name:'Refresh snapshot',exact:true}).click();
    await expect(option).toBeChecked();
    await expect(appendix).toBeVisible();
    await page.setViewportSize({width:360,height:760});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
    await page.setViewportSize({width:1280,height:900});
    await page.emulateMedia({media:'print'});
    await expect(option).toBeHidden();
    await expect(appendix).toBeVisible();
    await page.pdf({path:'.tmp/m11-appendix/with-data.pdf',format:'A4',preferCSSPageSize:true,printBackground:true});
    expect(countPdfPages('.tmp/m11-appendix/with-data.pdf')).toBeGreaterThan(countPdfPages('.tmp/m11-appendix/without-data.pdf'));
    await page.emulateMedia({media:null});
    await option.uncheck();
    await expect(appendix).toHaveCount(0);
    await page.getByRole('button',{name:'Close preview',exact:true}).click();
    await expect(page.getByTestId('points-total')).toHaveText('398');
    await openPrint(page);
    await expect(option).not.toBeChecked();
  });

  test('appends selected missile upgrades, SAM properties and missing vehicle markers',async({page})=>{
    test.slow();
    await page.goto('/?debug=1');
    const document={...longDocument,rosterId:'appendix-upgrades',name:'Appendix with targeted upgrades',notes:'Appendix acceptance roster.',selections:[
      selection('p','bmp1-platoon',{sectionId:'motor-rifle',choices:[
        {optionGroupLocalId:'bmp1-platoon-infantry',optionLocalId:'all-bmp1-to-p',targets:['command','assistant','rifle'].map(id=>({kind:'member-path',nodePath:[id,'transport']}))},
        {optionGroupLocalId:'bmp1-platoon-infantry',optionLocalId:'konkurs',targets:[{kind:'member-path',nodePath:['command','transport']}]},
        {optionGroupLocalId:'bmp1-platoon-infantry',optionLocalId:'sa-7',targets:[{kind:'member-path',nodePath:['command']}]},
      ]}),
      selection('t','t72-platoon',{sectionId:'tank',choices:[{optionGroupLocalId:'t72-platoon-upgrades',optionLocalId:'platoon-to-b',targets:[{kind:'whole-selection'}]}]}),
    ]};
    await importAndOpen(page,rosterFile('appendix-upgrades.json',document));
    await openPrint(page);
    await page.getByRole('checkbox',{name:'Append vehicle and weapon data',exact:true}).check();
    const appendix=page.getByTestId('print-data-appendix');
    const upgraded=appendix.locator('article[data-profile-id="bmp-1p"][data-upgraded="true"]');
    await expect(upgraded).toContainText('1 × BMP-1P');
    await expect(upgraded).not.toContainText('Spigot ATGM');
    await expect(appendix.locator('article[data-profile-id="bmp-1p"][data-upgraded="false"]')).toContainText('2 × BMP-1P');
    await expect(appendix.locator('article[data-weapon-id="konkurs"]')).toHaveCount(1);
    await expect(appendix.locator('article[data-weapon-id="konkurs"]')).toContainText('GEN 2');
    const sam=appendix.locator('article[data-weapon-id="sa7"]');
    await expect(sam).toContainText(/Attack modifier\s*0/);
    await expect(sam).toContainText('Light (D3)');
    const unknown=appendix.locator('article[data-profile-id="t-72b"]');
    await expect(unknown).toContainText('3 × T-72B');
    await expect(unknown).toContainText('independent attributes have not yet been verified');
    await expect(unknown.locator('.unit-data-stats')).toHaveCount(0);
    mkdirSync('.tmp/m11-appendix',{recursive:true});
    await page.pdf({path:'.tmp/m11-appendix/upgraded-data.pdf',format:'A4',preferCSSPageSize:true,printBackground:true});
  });

  test('prints the current draft, refreshes after edits and keeps the editor intact', async ({ page }) => {
    await page.goto('/?debug=1');
    await createExample(page);
    await openPrint(page);
    const sheet = page.locator('#print-sheet');
    await expect(page.getByTestId('print-points-total')).toHaveText(/^398/);
    await expect(page.getByTestId('print-br-total')).toHaveText(/^23/);
    // The paper carries no editing controls at all.
    await expect(sheet.locator('button, input, select')).toHaveCount(0);
    // Header versions and the frozen snapshot revision are printed.
    await expect(sheet).toContainText('cw-draft6+sov-v4.1+formations1');
    await expect(sheet).toContainText('soviet-armoured-division-v4_1 · 1.1.0');
    await expect(sheet).toContainText('roster/1');
    const firstRevision = await page.getByTestId('print-edit-revision').textContent();
    // Everything the (collapsed) editor tree shows as separate units prints in full.
    await expect(sheet).toContainText('T-72 MBT Platoon · 1');
    await expect(sheet).toContainText('BMP-1 Motor Rifle Platoon · 1');
    await expect(sheet).toContainText('Fire Support Section');
    await expect(sheet).toContainText('Off-Table Artillery Support Request');

    await page.getByRole('button', { name: 'Close preview' }).click();
    await expect(page.locator('#print-sheet')).toHaveCount(0);
    await expect(page.getByTestId('points-total')).toHaveText('398');

    // Edit the draft, then reopen: the sheet must reflect the newest choices.
    await page.getByRole('button', { name: /^Add to:/ }).first().click();
    await page.locator('#editor-actions').getByRole('button', { name: /^Add / }).first().click();
    const editedPoints = await page.getByTestId('points-total').textContent();
    expect(Number(editedPoints)).toBeGreaterThan(398);
    await openPrint(page);
    await expect(page.getByTestId('print-points-total')).toHaveText(editedPoints ?? '');
    const secondRevision = await page.getByTestId('print-edit-revision').textContent();
    expect(secondRevision).not.toBe(firstRevision);
    await page.getByRole('button', { name: 'Close preview' }).click();

    // Undo history survived printing: one step returns to the example total.
    await page.getByRole('button', { name: 'Undo', exact: true }).click();
    await expect(page.getByTestId('points-total')).toHaveText('398');
  });

  test('prints a long multi-page roster to a real A4 PDF with fixed platoons and anchored attachments', async ({ page }) => {
    test.slow();
    await page.goto('/?debug=1');
    await importAndOpen(page, rosterFile('long-print-roster.json', longDocument));
    const editorPoints = await page.getByTestId('points-total').textContent();
    await openPrint(page);
    const sheet = page.locator('#print-sheet');
    // Same snapshot as the editor: totals identical.
    await expect(page.getByTestId('print-points-total')).toHaveText(editorPoints ?? '');
    await expect(page.getByTestId('print-br-total')).toHaveText(/^\d+$/);
    // This long roster breaks no implemented rule; coverage stays partial.
    await expect(page.getByTestId('print-legality')).toContainText('Not fully determined');
    // Three companies, each with its fixed platoons; attachments anchor to the
    // exact fixed platoon, not to a name guess.
    await expect(sheet).toContainText('T-72 MBT Company · 3');
    await expect(sheet).toContainText('BMP-1 Motor Rifle Company · 1 — platoon 2');
    await expect(sheet).toContainText('Included in the company price');
    await expect(sheet).toContainText('Combat Medic');
    await expect(sheet).toContainText('Fire Support Section');
    await expect(sheet).toContainText('Automatic GL Section');
    // Per-target upgrade with its member targets and per-target billing note.
    await expect(sheet).toContainText('BG-15 UGL per squad');
    await expect(sheet).toContainText('per selected target');
    await expect(sheet).toContainText('assistant');
    // Selected optional rules print as settings text.
    await expect(sheet).toContainText('Optional rules');
    await expect(sheet).toContainText('long-print-optional-rule');
    // Every composition member prints exactly once: the BMP-1 company owns
    // 10 (1 command + 3 platoons × 3), its anchored fire-support and AGL
    // sections add one BMP-1 each, and the standalone BMP-1 platoon has 3.
    const bmpRows = await page.evaluate(
      () =>
        [...document.querySelectorAll('#print-sheet .print-composition li')].filter((li) =>
          li.textContent!.replace(/\s+/g, ' ').trim() === '1 × BMP-1',
        ).length,
    );
    expect(bmpRows).toBe(15);
    // Same guarantee for the tank companies: 3 × (1 command + 3 platoons × 3).
    const tankRows = await page.evaluate(
      () =>
        [...document.querySelectorAll('#print-sheet .print-composition li')].filter((li) =>
          li.textContent!.replace(/\s+/g, ' ').trim() === '1 × T-72A',
        ).length,
    );
    expect(tankRows).toBe(30);
    // No-entities purchase prints its reason instead of a roster gap.
    await expect(sheet).toContainText('Off-Table Artillery Support Request');
    // Long notes print and wrap.
    await expect(sheet).toContainText('Long reference token that must wrap');
    // The paper itself carries no editing controls.
    await expect(sheet.locator('button, input, select')).toHaveCount(0);

    // Print media emulation hides everything except the sheet.
    await page.emulateMedia({ media: 'print' });
    await expect(page.locator('.app-header')).toBeHidden();
    await expect(page.locator('.app-footer')).toBeHidden();
    await expect(page.locator('.print-overlay-bar')).toBeHidden();
    await expect(sheet).toBeVisible();
    // Nothing may stick out horizontally in print layout either.
    const printOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(printOverflow).toBeLessThanOrEqual(0);
    await page.emulateMedia({ media: null });

    // Small screens can still operate the preview without horizontal overflow.
    await page.setViewportSize({ width: 360, height: 640 });
    await expect(page.getByRole('button', { name: 'Print / Save as PDF' })).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
    await page.setViewportSize({ width: 1280, height: 900 });

    // Real browser PDF output (A4). This is the paper evidence for manual review.
    mkdirSync(EVIDENCE_DIR, { recursive: true });
    await page.pdf({
      path: `${EVIDENCE_DIR}/roster-long.pdf`,
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
    });
    const pages = countPdfPages(`${EVIDENCE_DIR}/roster-long.pdf`);
    test.info().annotations.push({ type: 'pdf', description: `roster-long.pdf pages=${pages}` });
    expect(pages).toBeGreaterThanOrEqual(3);
    await page.screenshot({ path: `${EVIDENCE_DIR}/roster-long-preview.png`, fullPage: true });
  });

  test('prints violations, coverage gaps and unknown markers without blocking the draft', async ({ page }) => {
    test.slow();
    await page.goto('/?debug=1');
    await importAndOpen(page, rosterFile('violation-print-roster.json', violationDocument));
    await openPrint(page);
    const sheet = page.locator('#print-sheet');
    await expect(page.getByTestId('print-legality')).toHaveText('Violations confirmed');
    const issues = page.getByTestId('print-issues');
    await expect(issues).toContainText('C01');
    await expect(issues).toContainText('C02');
    await expect(issues).toContainText('C16');
    await expect(issues.locator('li[data-severity="error"]').first()).toBeVisible();
    // Coverage stays independent from confirmed violations.
    await expect(page.getByTestId('print-coverage')).toContainText('Automatic checks cover part of the army-list rules.');
    await expect(page.getByTestId('print-coverage')).not.toContainText('classic/full-army-coverage');
    await expect(page.getByTestId('print-coverage')).not.toContainText('user clarification');
    // Player-entered markup renders as text, never as HTML in the printout.
    await expect(sheet).toContainText('<img src=x onerror="window.__printXss=1">');
    await expect(sheet.locator('img')).toHaveCount(0);
    expect(await page.evaluate(() => (window as { __printXss?: number }).__printXss)).toBeUndefined();
    // Off-table purchase keeps its no-entities note.
    await expect(sheet).toContainText('Static purchased support');

    await page.pdf({
      path: `${EVIDENCE_DIR}/roster-violations.pdf`,
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
    });
    const pages = countPdfPages(`${EVIDENCE_DIR}/roster-violations.pdf`);
    test.info().annotations.push({ type: 'pdf', description: `roster-violations.pdf pages=${pages}` });
    expect(pages).toBeGreaterThanOrEqual(1);
    await page.screenshot({ path: `${EVIDENCE_DIR}/roster-violations-preview.png`, fullPage: true });

    // Closing the preview returns to an editable draft that still shows the problems.
    await page.getByRole('button', { name: 'Close preview' }).click();
    await expect(page.getByTestId('points-total')).toBeVisible();
    await expect(page.locator('.totals-strip')).toContainText('Issues found');
  });

  test('prints the exact legacy 1.0.0 catalog with its leaf composition root', async ({ page }) => {
    await page.goto('/?debug=1');
    await importAndOpen(page, rosterFile('legacy-print-roster.json', legacyDocument));
    await openPrint(page);
    const sheet = page.locator('#print-sheet');
    // The paper names the exact legacy release, not the current one.
    await expect(sheet).toContainText('soviet-armoured-division-v4_1 · 1.0.0');
    await expect(sheet).toContainText('cw-draft6+sov-v4.1');
    await expect(sheet).not.toContainText('cw-draft6+sov-v4.1+formations1');
    // The 1.0.0 BRDM-2 entry has the vehicle as its composition ROOT: that
    // leaf member must print (with its training level), an empty block would
    // drop it.
    const brdmRows = await page.evaluate(
      () =>
        [...document.querySelectorAll('#print-sheet .print-composition li')].filter((li) =>
          li.textContent!.replace(/\s+/g, ' ').trim() === '1 × BRDM-2 (Regular)',
        ).length,
    );
    expect(brdmRows).toBe(1);
    // Paper evidence for the legacy leaf-root fix as well.
    await page.pdf({
      path: `${EVIDENCE_DIR}/roster-legacy-1-0-0.pdf`,
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
    });
    await page.getByRole('button', { name: 'Close preview' }).click();
    await expect(page.locator('.editor-heading')).toContainText('1.0.0');
  });
});
