import { expect, test } from '@playwright/test';

/**
 * M02 acceptance checks for the web shell: page load, hash routing in both
 * directions (click navigation and direct deep links), a graceful not-found
 * route, and a basic small-screen layout without horizontal overflow.
 */

test.describe('web shell', () => {
  test('loads the home page with the session-only preview notice', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle('Battlegroup Army Builder');
    await expect(page.getByRole('heading', { level: 1, name: 'Battlegroup Army Builder' })).toBeVisible();
    await expect(page.getByText('Classic preview — session only', { exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name: 'My Rosters' })).toBeVisible();
  });

  test('navigates between hash routes via the nav links', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'Roadmap' }).click();
    await expect(page).toHaveURL(/#\/roadmap$/);
    await expect(page.getByRole('heading', { level: 2, name: 'Roadmap' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 3, name: /M02/ })).toBeVisible();

    await page.getByRole('link', { name: 'My Rosters' }).click();
    await expect(page).toHaveURL(/#\/$/);
    await expect(page.getByRole('heading', { level: 2, name: 'My Rosters' })).toBeVisible();
  });

  test('deep-links directly to a hash route', async ({ page }) => {
    await page.goto('/#/roadmap');
    await expect(page.getByRole('heading', { level: 2, name: 'Roadmap' })).toBeVisible();
  });

  test('shows Infantry as the second Soviet roster section and catalog destination', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Create roster', exact: true }).click();

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
    await expect(page.getByRole('link', { name: 'Roadmap' })).toBeVisible();

    const horizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(horizontalOverflow).toBeLessThanOrEqual(0);
  });
});
