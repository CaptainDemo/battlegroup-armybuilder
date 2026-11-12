import { expect, test } from '@playwright/test';

test('shows unit rules and independently toggles a deduplicated print appendix', async ({page}) => {
  await page.goto('/?debug=1');
  await page.getByRole('button',{name:'Create the 398 Points / 23 BR example'}).click();
  await page.locator('.purchase-card').first().click();
  const panel=page.locator('.special-rules');
  await expect(panel).toContainText('Senior Officer');
  await expect(panel).toContainText('reroll one Orders die');
  await expect(panel).toContainText('Battlegroup Rulebook');
  await expect(page.locator('.purchase-card').first()).toContainText('Senior Officer');
  await page.getByRole('button',{name:'Print / PDF',exact:true}).click();
  await expect(page.locator('.special-rules-appendix')).toHaveCount(0);
  const toggle=page.getByRole('checkbox',{name:'Include special rule texts'});
  await toggle.check();
  const appendix=page.locator('.special-rules-appendix');
  await expect(appendix.getByRole('heading',{name:'Senior Officer',exact:true})).toHaveCount(1);
  await expect(appendix).toContainText('reroll one Orders die');
  await expect(appendix).toContainText('Scout');
  await expect(appendix).not.toContainText('Rule text has not been added');
  await expect(appendix).not.toContainText('max-per-parent');
  await page.emulateMedia({media:'print'});
  await expect(appendix).toBeVisible();
  await page.emulateMedia({media:'screen'});
  await toggle.uncheck();
  await expect(appendix).toHaveCount(0);
});
