import { expect, test } from '@playwright/test';

/**
 * Acceptance checks for the application shell: page load, hash routing in both
 * directions (click navigation and direct deep links), a graceful not-found
 * route, and a basic small-screen layout without horizontal overflow.
 */

test.describe('web shell', () => {
  test('loads the roster workflow without engineering or debug panels', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle('Battlegroup Army Builder');
    await expect(page.getByRole('heading', { level: 1, name: 'Battlegroup Army Builder' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name: 'My Rosters' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create roster', exact: true })).toBeEnabled();
    await expect(page.getByText('Classic preview — local autosave', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Classic catalog ready.', { exact: true })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Roadmap' })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Debug tools', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Create the 398 Points / 23 BR example' })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Available data', exact: true })).toHaveCount(0);
    await expect(page.locator('.app-footer')).not.toContainText('docs/');
  });

  test('navigates between hash routes via the nav links', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'Editor', exact: true }).click();
    await expect(page).toHaveURL(/#\/editor$/);
    await expect(page.getByRole('heading', { level: 2, name: 'Create or open a roster first' })).toBeVisible();

    await page.getByRole('link', { name: 'My Rosters', exact: true }).click();
    await expect(page).toHaveURL(/#\/$/);
    await expect(page.getByRole('heading', { level: 2, name: 'My Rosters' })).toBeVisible();
  });

  test('deep-links directly to a hash route', async ({ page }) => {
    await page.goto('/#/editor');
    await expect(page.getByRole('heading', { level: 2, name: 'Create or open a roster first' })).toBeVisible();
  });

  test('shows Infantry as the second Soviet roster section and catalog destination', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Create roster', exact: true }).click();

    await page.getByText('Rule coverage', { exact: true }).click();
    await expect(page.getByText('Automatic checks cover part of the army-list rules.', { exact: false })).toBeVisible();
    await expect(page.getByText('Check diagnostics', { exact: true })).toHaveCount(0);
    await expect(page.getByText('classic/full-army-coverage', { exact: false })).toHaveCount(0);

    const roster = page.getByRole('region', { name: 'Roster', exact: true });
    await expect(roster.getByRole('heading', { level: 4 }).nth(1)).toHaveText('Infantry');
    await roster.getByRole('button', { name: 'Add to: Infantry', exact: true }).click();

    const catalog = page.getByRole('region', { name: 'Catalog', exact: true });
    await expect(catalog.getByRole('heading', { name: 'Add to: Infantry', exact: true })).toBeVisible();
    await expect(catalog.getByRole('button', { name: 'Add BMP-1 Motor Rifle Platoon', exact: true })).toBeVisible();
  });

  test('shows a not-found page for unknown hash routes with a way back', async ({ page }) => {
    await page.goto('/#/missing-page');
    await expect(page.getByRole('heading', { level: 2, name: 'Page not found' })).toBeVisible();
    await page.getByRole('link', { name: 'Back to My Rosters' }).click();
    await expect(page).toHaveURL(/#\/$/);
    await expect(page.getByRole('heading', { level: 2, name: 'My Rosters' })).toBeVisible();
  });

  test('keeps content usable on a small viewport without horizontal overflow', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 640 });
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1, name: 'Battlegroup Army Builder' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'My Rosters', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Editor', exact: true })).toBeVisible();

    const horizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(horizontalOverflow).toBeLessThanOrEqual(0);
  });
});
