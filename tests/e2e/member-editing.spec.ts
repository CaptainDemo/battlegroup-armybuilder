import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

const release=JSON.parse(readFileSync('packages/catalogs/classic-coldwar/public/catalogs/classic-coldwar/soviet-armoured-division/1-1-0/catalog.json','utf8'));
const catalog=release.catalog;
function member(page: Page, selectionId: string, path: string[]) {
  return page.locator('[id='+JSON.stringify('selection-'+selectionId+'-member-'+encodeURIComponent(JSON.stringify(path)))+']');
}
test('edits squads and tanks independently through nested roster members and restores choices', async ({page}) => {
  const document={formatVersion:'roster/1',rosterId:'member-browser',revision:'1',name:'Member editing',catalogRef:catalog.manifest.identity,armyListId:'soviet-armoured-division-v4_1',settings:{budgetPoints:1500,gameSizeId:'company',optionalRules:[]},selections:[['infantry','bmp1-platoon'],['company','bmp1-company'],['tanks','t72-platoon']].map(([id,entryId])=>({selectionId:id,entryReference:{...catalog.manifest.identity,localId:entryId},parentSelectionId:null,sectionId:catalog.entries.find((entry:{localId:string})=>entry.localId===entryId).sectionIds[0],optionChoices:[]}))};
  await page.goto('/');
  await page.setInputFiles('input[type="file"]',{name:'members.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(document))});
  await page.getByRole('button',{name:'Import',exact:true}).click();
  await page.locator('.library-item').getByRole('button',{name:'Open',exact:true}).click();
  // Import-as-copy remaps instance IDs; obtain them from their purchase cards.
  const ids=await page.locator('.purchase-row > .purchase-card').evaluateAll(cards=>cards.map(card=>card.id.slice('selection-'.length)));
  const [infantry, company, tanks]=ids as [string,string,string];
  await member(page,infantry,['command']).click();
  await page.getByRole('checkbox',{name:'BG-15 UGL per squad',exact:true}).check();
  await member(page,infantry,['rifle']).click();
  await expect(page.getByRole('checkbox',{name:'BG-15 UGL per squad',exact:true})).not.toBeChecked();
  await page.getByRole('checkbox',{name:'BG-15 UGL per squad',exact:true}).check();
  await member(page,infantry,['command']).click();
  await expect(page.getByRole('checkbox',{name:'BG-15 UGL per squad',exact:true})).toBeChecked();
  await page.getByRole('checkbox',{name:'BG-15 UGL per squad',exact:true}).uncheck();
  await member(page,infantry,['rifle']).click();
  await expect(page.getByRole('checkbox',{name:'BG-15 UGL per squad',exact:true})).toBeChecked();
  await member(page,company,['platoon-2','rifle']).click();
  await expect(page.getByText(/^Shared maximum: 3\b/)).toHaveCount(0);
  await expect(page.getByText('Shared maximum: 1 (platoon 2)', { exact: true })).toHaveCount(2);
  await page.getByRole('checkbox',{name:'RPG-18 per squad',exact:true}).check();
  for (const path of [['platoon-2', 'command'], ['platoon-2', 'assistant'], ['platoon-1', 'rifle']]) {
    await member(page, company, path).click();
    const upgrade = page.getByRole('checkbox', { name: 'RPG-18 per squad', exact: true });
    await expect(upgrade).not.toBeChecked();
    await upgrade.check();
  }
  await expect(page.locator('.issue-list')).not.toContainText('option/own-limit');
  await member(page,tanks,['ordinary-1']).click();
  await expect(page.getByText('Shared maximum: 1 (T-72 MBT Platoon)', { exact: true })).toBeVisible();
  await page.getByRole('checkbox',{name:'KMT mine plough on individual tank',exact:true}).check();
  await member(page,tanks,['ordinary-2']).click();
  await expect(page.getByRole('checkbox',{name:'KMT mine plough on individual tank',exact:true})).not.toBeChecked();
  await page.getByRole('checkbox',{name:'KMT mine plough on individual tank',exact:true}).check();
  await expect(page.locator('.issue-list')).toContainText('option/own-limit');
  await page.getByRole('checkbox',{name:'KMT mine plough on individual tank',exact:true}).uncheck();
  await expect(page.getByText('Saved locally',{exact:true})).toBeVisible();
  await page.reload();
  await page.getByRole('link',{name:'My Rosters',exact:true}).click();
  await page.locator('.library-item').getByRole('button',{name:'Open',exact:true}).click();
  await member(page,company,['platoon-2','rifle']).click();
  await expect(page.getByRole('checkbox',{name:'RPG-18 per squad',exact:true})).toBeChecked();
  await member(page,tanks,['ordinary-1']).click();
  await expect(page.getByRole('checkbox',{name:'KMT mine plough on individual tank',exact:true})).toBeChecked();
  await member(page,infantry,['command']).click();
  await page.getByRole('checkbox',{name:'One squad: SVD marksman',exact:true}).check();
  await member(page,infantry,['rifle']).click();
  await expect(page.getByText(/Selecting here moves/)).toBeVisible();
  await page.getByRole('checkbox',{name:'One squad: SVD marksman',exact:true}).check();
  await member(page,infantry,['command']).click();
  await expect(page.getByRole('checkbox',{name:'One squad: SVD marksman',exact:true})).not.toBeChecked();
  await page.locator('[id='+JSON.stringify('selection-'+infantry)+']').click();
  const bmpConversion = page.locator('.option-row').filter({ has: page.getByRole('checkbox', { name: /Upgrade all BMP-1 to BMP-1P/ }) });
  await expect(bmpConversion).toContainText('per matching member');
  await expect(bmpConversion).not.toContainText('Shared maximum');
  await page.getByRole('checkbox',{name:'Replace all BMP-1 transports with 1 Mi-8 Hip C',exact:true}).check();
  await expect(member(page,infantry,['rifle','transport'])).toHaveCount(0);
  await member(page,infantry,['hip-transport']).click();
  await page.getByRole('button',{name:'Undo',exact:true}).click();
  await expect(member(page,infantry,['hip-transport'])).toHaveCount(0);
  await expect(member(page,infantry,['rifle','transport'])).toBeVisible();
  await page.setViewportSize({width:360,height:800});
  await page.getByRole('button',{name:'Roster',exact:true}).click();
  await member(page,company,['platoon-2','rifle','transport']).click();
  await expect(page.getByRole('checkbox',{name:/Konkurs/})).toBeVisible();
  await expect(page.getByText('Shared maximum:', { exact: false })).toHaveCount(0);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await page.screenshot({path:'.tmp/member-editing-mobile.png',fullPage:true});
});

test('charges whole-company conversions per tank and keeps the real company equipment limits', async ({ page }) => {
  const entry = catalog.entries.find((item: { localId: string }) => item.localId === 't72-company');
  const document = {
    formatVersion: 'roster/1',
    rosterId: 'tank-company-limits',
    revision: '1',
    name: 'Tank company limits',
    catalogRef: catalog.manifest.identity,
    armyListId: 'soviet-armoured-division-v4_1',
    settings: { budgetPoints: 1000, gameSizeId: 'company', optionalRules: [] },
    selections: [{
      selectionId: 'company',
      entryReference: { ...catalog.manifest.identity, localId: entry.localId },
      parentSelectionId: null,
      sectionId: entry.sectionIds[0],
      optionChoices: [],
    }],
  };
  await page.goto('/');
  await page.setInputFiles('input[type="file"]', { name: 'company.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(document)) });
  await page.getByRole('button', { name: 'Import', exact: true }).click();
  await page.locator('.library-item').getByRole('button', { name: 'Open', exact: true }).click();

  const company = page.locator('.purchase-row > .purchase-card');
  const companyId = (await company.getAttribute('id'))!.slice('selection-'.length);
  await company.click();
  const conversion = page.getByRole('checkbox', { name: 'Upgrade all T-72A to T-72B', exact: true });
  const conversionRow = page.locator('.option-row').filter({ has: conversion });
  await expect(conversionRow).toContainText('+10 Points / +0 BR');
  await expect(conversionRow).toContainText('per matching member');
  await expect(conversionRow).not.toContainText('Shared maximum');
  await conversion.check();
  await expect(page.getByText('700', { exact: true })).toBeVisible();
  const branch = company.locator('../..');
  await branch.getByRole('button', { name: /^Collapse composition for T-72 MBT Company/ }).click();
  await expect(company).toContainText('10 × T-72B');
  await expect(company).toContainText('700 Points');
  await expect(member(page, companyId, ['company-command'])).toBeHidden();
  await branch.getByRole('button', { name: /^Expand composition for T-72 MBT Company/ }).click();
  await expect(member(page, companyId, ['company-command'])).toBeVisible();
  await expect(branch).not.toContainText('Included in the formation price');

  const kmt = page.getByRole('checkbox', { name: 'KMT mine plough on individual tank', exact: true });
  const svir = page.getByRole('checkbox', { name: '9M119 Svir ATGM load-out', exact: true });
  for (const path of [['company-command'], ['platoon-1', 'ordinary-1'], ['platoon-2', 'ordinary-1']]) {
    await member(page, companyId, path).click();
    await expect(page.locator('.option-row').filter({ has: kmt })).toContainText('Shared maximum: 3 (T-72 MBT Company)');
    await expect(page.locator('.option-row').filter({ has: svir })).toContainText('Shared maximum: 3 (T-72 MBT Company)');
    await expect(kmt).not.toBeChecked();
    await kmt.check();
  }
  await expect(page.getByText('option/own-limit', { exact: true })).toHaveCount(0);
  await member(page, companyId, ['platoon-3', 'ordinary-1']).click();
  await svir.check();
  await expect(page.getByText('option/own-limit', { exact: true })).toHaveCount(0);
  await kmt.check();
  await expect(page.locator('.issue-list')).toContainText('option/own-limit');
});
