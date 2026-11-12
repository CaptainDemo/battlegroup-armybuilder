import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

async function add(page: Page, destination: string | RegExp, name: string) {
  await page.getByRole('button', { name: destination, exact: true }).click();
  await page.getByRole('button', { name: 'Add ' + name, exact: true }).click();
  await page.getByRole('button', { name: 'Done adding' }).click();
}

test('creates, configures, prints, and restores a NORTHAG Soviet roster alongside Classic', async ({ page }) => {
  await page.goto('/?debug=1');
  await page.getByRole('button', { name: 'Create the 398 Points / 23 BR example' }).click();
  await expect(page.getByTestId('points-total')).toHaveText('398');
  await expect(page.getByText('Saved locally', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'My Rosters', exact: true }).click();

  await page.getByRole('combobox', { name: 'Ruleset', exact: true }).selectOption('northag');
  await expect(page.getByRole('combobox', { name: 'Army list' })).toContainText('Russian Armoured Battlegroup');
  await expect(page.getByRole('combobox', { name: 'Game size' })).not.toContainText('squad');
  await expect(page.getByLabel('Points budget')).toHaveValue('500');
  await page.getByRole('button', { name: 'Create roster', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'New NORTHAG Soviet roster' })).toBeVisible();
  await expect(page.locator('.issue-list')).toContainText('Choose exactly one Vanguard formation');

  await add(page, 'Add to: Forward Screen', 'Forward Observation Officer');
  await expect(page.getByRole('checkbox', { name: /Artillery Spotter/ })).toHaveCount(0);
  await add(page, 'Add to: Vanguard', 'Tank Company');
  await page.getByRole('checkbox', { name: 'Replace all T-62s with T-64As', exact: true }).check();
  const tank = page.locator('[data-member-path=\'["tank-4"]\'] > button');
  await tank.click();
  await page.getByRole('checkbox', { name: 'KMT Mine Plough', exact: true }).check();
  await expect(page.getByRole('region', { name: 'Current composition' }).locator('.composition-rule')).toHaveText('KMT Mine Plough');
  await expect(tank.locator('.rule-tag')).toHaveText('KMT Mine Plough');
  const selectedRules = page.locator('details.special-rule-cards');
  await selectedRules.locator('summary').click();
  await expect(selectedRules).toContainText('The chosen tank carries the KMT mine plough upgrade.');
  await expect(selectedRules.locator('.special-rule-source')).toHaveText('NORTHAG pp.70–72');
  await page.locator('summary').filter({ hasText: /^Unit data$/ }).click();
  await expect(page.getByRole('region', { name: 'Unit data' })).toContainText('5 / 3 / 1');
  await expect(page.getByRole('region', { name: 'Unit data' })).toContainText('50–70');
  const company = page.getByRole('button', { name: /^Tank Company · 1/ });
  await company.click();
  await expect(company).not.toContainText('KMT Mine Plough');
  const composition = page.getByRole('region', { name: 'Current composition' });
  const tankComposition = composition.locator('[data-composition-path=\'["tank-4"]\']');
  await expect(tankComposition.getByText('KMT Mine Plough', { exact: true })).toBeVisible();
  await expect(composition.locator('details')).toHaveCount(0);
  await expect(composition).not.toContainText('The chosen tank carries the KMT mine plough upgrade.');
  const companyRule = selectedRules.getByRole('heading', { name: 'KMT Mine Plough', exact: true });
  await expect(companyRule).toBeHidden();
  await selectedRules.locator('summary').click();
  await expect(companyRule).toHaveCount(1);
  await expect(companyRule).toBeVisible();

  await add(page, 'Add to: Main Column', 'Tactical Command Centre');
  for (const child of ['Forward Air Controller', 'Electronic Warfare Team', 'Supply Truck', 'Ambulance']) {
    await add(page, /^Add attached unit to: Tactical Command Centre/, child);
  }
  await expect(page.getByTestId('points-total')).toHaveText('290');
  await expect(page.getByTestId('br-total')).toHaveText('30');

  const requestDestination = page.getByRole('button', { name: 'Add to: Reinforcement Requests', exact: true });
  await requestDestination.click();
  await expect(page.getByRole('button', { name: 'Add Additional Reinforcement Request' })).toBeDisabled();
  await expect(page.getByText(/Enable Reinforcement Requests in roster settings first/)).toBeVisible();
  await page.getByRole('checkbox', { name: 'Reinforcement Requests', exact: true }).check();
  await page.getByRole('button', { name: 'Apply settings', exact: true }).click();
  await add(page, 'Add to: Reinforcement Requests', 'Additional Reinforcement Request');
  await expect(page.getByRole('region', { name: 'Reinforcement Requests' })).toContainText('+1 included');
  await expect(page.getByTestId('points-total')).toHaveText('320');
  await expect(page.getByTestId('br-total')).toHaveText('30');

  await page.getByRole('button', { name: 'Print / PDF', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Append vehicle and weapon data' }).check();
  await page.getByRole('checkbox', { name: 'Include special rule texts' }).check();
  await expect(page.getByTestId('print-points-total')).toHaveText('320');
  await expect(page.getByTestId('print-br-total')).toHaveText('30');
  await expect(page.getByTestId('print-data-appendix')).toContainText('1 × T-64A · KMT Mine Plough');
  await expect(page.locator('.special-rules-appendix')).toContainText('NORTHAG official v9');
  await expect(page.locator('#print-sheet')).toContainText('northag-2020+errata-v9');
  await expect(page.locator('#print-sheet .print-composition li').filter({hasText: /tank 4 · T-64A/})).toContainText('KMT Mine Plough');
  await page.getByRole('button', { name: 'Close preview' }).click();

  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export JSON', exact: true }).click();
  const path = test.info().outputPath('northag-roster.json');
  await (await pending).saveAs(path);
  const exported = JSON.parse(readFileSync(path, 'utf8'));
  expect(exported.document.catalogRef.rulesetId).toBe('northag');
  expect(exported.document.selections.flatMap((selection: { optionChoices: unknown[] }) => selection.optionChoices))
    .toContainEqual(expect.objectContaining({ optionLocalId: 'kmt', targets: [{ kind: 'member-path', nodePath: ['tank-4'] }] }));

  await page.reload();
  await page.getByRole('link', { name: 'My Rosters', exact: true }).click();
  await expect(page.locator('.library-item')).toHaveCount(2);
  await page.setInputFiles('input[type="file"]', path);
  await expect(page.locator('.import-record').first()).toHaveAttribute('data-status', 'ready');
  await page.getByRole('button', { name: 'Import', exact: true }).click();
  await expect(page.locator('.library-item')).toHaveCount(3);
  await page.locator('.library-item').filter({ hasText: 'New NORTHAG Soviet roster' }).first()
    .getByRole('button', { name: 'Open', exact: true }).click();
  await expect(page.getByTestId('points-total')).toHaveText('320');
  await expect(page.getByTestId('br-total')).toHaveText('30');
});

test('adds one shared vehicle to a company platoon and converts it without an extra charge', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('combobox', { name: 'Ruleset', exact: true }).selectOption('northag');
  await page.getByRole('button', { name: 'Create roster', exact: true }).click();
  await add(page, 'Add to: Forward Screen', 'Armoured Car Patrol');
  await expect(page.getByTestId('scouts-total')).toHaveText('1');
  await add(page, 'Add to: Vanguard', 'Motor Rifle Company');

  const destination = /^Add platoon support to: platoon 2/;
  await add(page, destination, 'sPKM GPMG Weapons Team');
  await add(page, destination, 'AT-3 Sagger Weapons Team');
  const platoon = page.locator('[data-member-path=\'["platoon-2"]\']');
  const sharedVehicle = platoon.getByRole('button', { name: /^Shared weapon-team transport/ });
  await expect(sharedVehicle).toHaveCount(1);
  await expect(sharedVehicle).toHaveAccessibleName(/BTR-60/);
  await platoon.locator(':scope > .purchase-card').click();
  await page.getByRole('checkbox', { name: 'Use BTR-70 for attached weapon teams', exact: true }).check();
  await expect(sharedVehicle).toHaveAccessibleName(/BTR-70/);

  await page.getByRole('region', { name: 'Vanguard', exact: true }).locator('.purchase-row > .purchase-card').first().click();
  await page.getByRole('checkbox', { name: 'Replace all BTRs with BMP-1s', exact: true }).check();
  await expect(sharedVehicle).toHaveAccessibleName(/BMP-1/);
  await expect(page.getByTestId('points-total')).toHaveText('278');
  await expect(page.getByTestId('br-total')).toHaveText('32');

  await sharedVehicle.click();
  await page.locator('summary').filter({ hasText: /^Unit data$/ }).click();
  const unitData = page.getByRole('region', { name: 'Unit data', exact: true });
  const vehicleCard = unitData.locator('article[data-profile-id="bmp-1"]');
  await expect(vehicleCard).toContainText('Fast Track');
  await expect(vehicleCard).toContainText('1 / 0 / 0');
  await expect(vehicleCard).toContainText('2 stands');
  const mounted = vehicleCard.getByRole('table', { name: 'Mounted weapons' });
  await expect(unitData.getByRole('table')).toHaveCount(1);
  await expect(mounted.locator('tbody[data-weapon-id="grom"] tr').first().locator('td'))
    .toHaveText(['AP', '—', '—', '2', '2', '2', '—', '—']);
  await expect(mounted.locator('tbody[data-weapon-id="mg"]')).toContainText('Max 30″');
  await expect(vehicleCard).toContainText('AT-3 Sagger has no effect under 30″');
  await page.setViewportSize({ width: 360, height: 760 });
  await expect(vehicleCard).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth === window.innerWidth)).toBe(true);
  const scroll = vehicleCard.getByRole('region', { name: 'Mounted weapons' });
  expect(await scroll.evaluate(element => element.scrollWidth > element.clientWidth)).toBe(true);
  await page.setViewportSize({ width: 1280, height: 720 });

  await page.getByRole('button', { name: 'Print / PDF', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Append vehicle and weapon data' }).check();
  const appendix = page.getByTestId('print-data-appendix');
  await expect(appendix.getByRole('heading', { name: '10 × BMP-1', exact: true })).toBeVisible();
  await expect(appendix.locator('tbody[data-weapon-id="grom"]')).toHaveCount(1);
  await expect(appendix.getByRole('heading', { name: '73mm Grom', exact: true })).toHaveCount(0);
  await expect(appendix.locator('article[data-profile-id="bmp-1"] tbody[data-weapon-id="at-3"]')).toHaveCount(1);
  await expect(appendix.locator('article[data-profile-id="at-3-team"] tbody[data-weapon-id="at-3"]')).toHaveCount(1);
});
