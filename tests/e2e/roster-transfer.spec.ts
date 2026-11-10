import { readFileSync, writeFileSync } from 'node:fs';
import { expect, test, type Download, type Page } from '@playwright/test';
import { TRANSFER_LIMITS } from '@battlegroup/core';

/**
 * M10 acceptance checks for import/export: real file downloads, real file
 * selection, a preview that writes nothing until confirmed, copy and
 * overwrite flows, hostile/degraded inputs staying out of the editor, and
 * the r2 additions — two-tab overwrite conflicts, exporting a draft whose
 * autosave failed, whole-batch rejection of backups with error records, and
 * consistent single-roster size gates applied before file bytes are read.
 */

const FILE_INPUT = 'input[type="file"]';

async function createExample(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Create the 398 Points / 23 BR example' }).click();
  await expect(page).toHaveURL(/#\/editor$/);
  await expect(page.getByTestId('points-total')).toHaveText('398');
}

/** Triggers a real browser download via `click` and persists it for re-upload. */
async function downloadVia(page: Page, name: string, click: () => Promise<void>): Promise<string> {
  const pending = page.waitForEvent('download');
  await click();
  const download: Download = await pending;
  const path = test.info().outputPath(name);
  await download.saveAs(path);
  return path;
}

async function openLibraryItem(page: Page, index: number): Promise<void> {
  await page.locator('.library-item').nth(index).getByRole('button', { name: 'Open', exact: true }).click();
  await expect(page).toHaveURL(/#\/editor$/);
}

test.describe('roster transfer', () => {
  test('exports the in-memory draft and re-imports it as a copy with identical totals', async ({ page }) => {
    await page.goto('/?debug=1');
    await createExample(page);
    // Export reads the memory draft; the button lives in the editor toolbar.
    const envelopePath = await downloadVia(page, 'example-envelope.json', () =>
      page.getByRole('button', { name: 'Export JSON', exact: true }).first().click(),
    );
    const envelope = JSON.parse(readFileSync(envelopePath, 'utf8')) as {
      formatVersion: string;
      kind: string;
      document: Record<string, unknown>;
    };
    expect(envelope.formatVersion).toBe('roster-file/1');
    expect(envelope.kind).toBe('single-roster');

    // The M09 recovery shape (bare document) stays importable legacy input.
    const barePath = test.info().outputPath('example-bare.json');
    writeFileSync(barePath, JSON.stringify(envelope.document, null, 2));

    await page.goto('/?debug=1');
    await page.setInputFiles(FILE_INPUT, envelopePath);
    await expect(page.getByRole('heading', { name: /Import preview/ })).toBeVisible();
    await expect(page.locator('.import-record')).toHaveCount(1);
    await expect(page.locator('.import-record').first()).toHaveAttribute('data-status', 'ready');
    await expect(page.locator('.import-record').first()).toContainText('1.1.0');
    await page.getByRole('button', { name: 'Import', exact: true }).click();
    await expect(page.locator('.library-item')).toHaveCount(2);

    // The copy keeps selections and catalog version, with a new roster id.
    await openLibraryItem(page, 1);
    await expect(page.getByTestId('points-total')).toHaveText('398');
    await expect(page.getByTestId('br-total')).toHaveText('23');

    await page.goto('/?debug=1');
    await page.setInputFiles(FILE_INPUT, barePath);
    await expect(page.locator('.import-record').first()).toHaveAttribute('data-status', 'ready');
    await page.getByRole('button', { name: 'Import', exact: true }).click();
    await expect(page.locator('.library-item')).toHaveCount(3);
    await openLibraryItem(page, 2);
    await expect(page.getByTestId('points-total')).toHaveText('398');
  });

  test('cancelling the preview writes nothing', async ({ page }) => {
    await page.goto('/?debug=1');
    await createExample(page);
    const envelopePath = await downloadVia(page, 'cancel.json', () =>
      page.getByRole('button', { name: 'Export JSON', exact: true }).first().click(),
    );
    await page.goto('/?debug=1');
    await page.setInputFiles(FILE_INPUT, envelopePath);
    await expect(page.getByRole('heading', { name: /Import preview/ })).toBeVisible();
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(page.getByRole('heading', { name: /Import preview/ })).toHaveCount(0);
    await expect(page.locator('.library-item')).toHaveCount(1);
    // The same file can be chosen again afterwards.
    await page.setInputFiles(FILE_INPUT, envelopePath);
    await expect(page.getByRole('heading', { name: /Import preview/ })).toBeVisible();
    await expect(page.locator('.library-item')).toHaveCount(1);
  });

  test('round-trips a full backup including an unsaved memory draft', async ({ page }) => {
    await page.goto('/?debug=1');
    await createExample(page);
    await page.getByRole('link', { name: 'Back to My Rosters' }).click();
    await page.getByLabel('Roster name').fill('Second roster');
    await page.getByRole('button', { name: 'Create roster', exact: true }).click();
    // Unsaved edit on the second roster: rename before exporting.
    await page.getByLabel('Roster name').fill('Second renamed');
    await page.getByRole('button', { name: 'Apply settings' }).click();
    await page.getByRole('link', { name: 'Back to My Rosters' }).click();

    const backupPath = await downloadVia(page, 'backup.json', () =>
      page.getByRole('button', { name: 'Download all rosters (backup)' }).click(),
    );
    const backup = JSON.parse(readFileSync(backupPath, 'utf8')) as {
      formatVersion: string;
      rosters: { rosterId: string; document: { name: string } | null }[];
    };
    expect(backup.formatVersion).toBe('library-backup/1');
    expect(backup.rosters).toHaveLength(2);
    expect(backup.rosters.map((entry) => entry.document?.name).sort()).toEqual([
      'Second renamed',
      'Soviet sample roster',
    ]);

    await page.setInputFiles(FILE_INPUT, backupPath);
    await expect(page.locator('.import-record')).toHaveCount(2);
    await expect(page.locator('.import-record').first()).toHaveAttribute('data-status', 'ready');
    await page.getByRole('button', { name: 'Import', exact: true }).click();
    await expect(page.locator('.library-item')).toHaveCount(4);
    await expect(page.getByRole('heading', { name: 'Second renamed' })).toHaveCount(2);
  });

  test('rejects corrupt JSON without offering an import', async ({ page }) => {
    await page.goto('/?debug=1');
    await page.setInputFiles(FILE_INPUT, {
      name: 'corrupt.json',
      mimeType: 'application/json',
      buffer: Buffer.from('{ this is not json'),
    });
    await expect(page.getByRole('alert')).toContainText('not valid JSON');
    await expect(page.getByRole('button', { name: 'Import', exact: true })).toHaveCount(0);
    await expect(page.locator('.library-item')).toHaveCount(0);
  });

  test('imports the exact old 1.0.0 catalog and keeps unknown versions as originals', async ({ page }) => {
    await page.goto('/?debug=1');
    const document = (catalogRevision: string) => ({
      formatVersion: 'roster/1',
      rosterId: 'legacy-' + catalogRevision,
      name: 'Old catalog roster ' + catalogRevision,
      revision: 'r1',
      catalogRef: {
        rulesetId: 'classic-coldwar',
        catalogId: 'soviet-armoured-division-v4_1',
        catalogRevision,
      },
      armyListId: 'soviet-armoured-division-v4_1',
      settings: { budgetPoints: 500, gameSizeId: 'platoon', optionalRules: [] },
      selections: [],
    });
    // 1.0.0 is indexed and supported: the roster imports editable and stays
    // on its exact old catalog — never silently switched to 1.1.0.
    await page.setInputFiles(FILE_INPUT, {
      name: 'old.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(document('1.0.0'))),
    });
    await expect(page.locator('.import-record').first()).toHaveAttribute('data-status', 'ready');
    await page.getByRole('button', { name: 'Import', exact: true }).click();
    await expect(page.locator('.library-item')).toHaveCount(1);
    await openLibraryItem(page, 0);
    await expect(page.locator('.editor-heading')).toContainText('1.0.0');
    await page.goto('/?debug=1');

    // A truly unknown version is preserved as an original, not converted.
    await page.setInputFiles(FILE_INPUT, {
      name: 'unknown.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(document('9.9.9'))),
    });
    await expect(page.locator('.import-record').first()).toHaveAttribute('data-status', 'original');
    await expect(page.locator('.import-record').first()).toContainText('Original kept');
    await page.getByRole('button', { name: 'Import', exact: true }).click();
    // It lands in the recovery list as a non-editable original, not the library.
    await expect(page.locator('.library-item').getByRole('button', { name: 'Open', exact: true })).toHaveCount(1);
    await expect(page.getByText('needs a catalog or format this app cannot currently open')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Download recovery JSON' })).toHaveCount(1);
  });

  test('overwrites an explicitly chosen roster and keeps autosave anchored', async ({ page }) => {
    await page.goto('/?debug=1');
    await createExample(page);
    // Export first: the file holds the example's original name.
    const exportedPath = await downloadVia(page, 'overwrite-source.json', () =>
      page.getByRole('button', { name: 'Export JSON', exact: true }).first().click(),
    );
    // Then rename in memory, so the overwrite replaces a diverged draft.
    await page.getByLabel('Roster name').fill('Overwrite me');
    await page.getByRole('button', { name: 'Apply settings' }).click();
    await expect(page.locator('.editor-heading h2')).toHaveText('Overwrite me');

    await page.goto('/?debug=1');
    await page.setInputFiles(FILE_INPUT, exportedPath);
    await page.getByLabel('Overwrite an existing roster…').check();
    await page.getByLabel('Roster to overwrite').selectOption({ index: 1 });
    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: 'Import', exact: true }).click();
    await expect(page.locator('.library-item')).toHaveCount(1);
    // The file contained the pre-rename example: its name is back.
    await expect(page.getByRole('heading', { name: 'Soviet sample roster' })).toHaveCount(1);

    // The queue is re-anchored: a fresh edit saves cleanly on top.
    await openLibraryItem(page, 0);
    await page.getByLabel('Roster name').fill('After overwrite');
    await page.getByRole('button', { name: 'Apply settings' }).click();
    await expect(page.getByText('Saved locally', { exact: true })).toBeVisible();
    await page.reload();
    // After a cold reload the library list is the way back into the roster.
    await page.goto('/?debug=1');
    await expect(page.locator('.library-item').getByRole('button', { name: 'Open', exact: true })).toHaveCount(1);
    await openLibraryItem(page, 0);
    await expect(page.locator('.editor-heading h2')).toHaveText('After overwrite');
    await expect(page.getByTestId('points-total')).toHaveText('398');
  });

  test('keeps the import panel usable on a small screen without overflow', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 640 });
    await page.goto('/?debug=1');
    await expect(page.getByRole('heading', { name: 'Import & backup' })).toBeVisible();
    await page.setInputFiles(FILE_INPUT, {
      name: 'tiny.json',
      mimeType: 'application/json',
      buffer: Buffer.from('[]'),
    });
    await expect(page.getByRole('alert')).toBeVisible();
    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test('rejects a mixed backup with error records instead of silently skipping them', async ({ page }) => {
    await page.goto('/?debug=1');
    await createExample(page);
    const exportedPath = await downloadVia(page, 'mixed-source.json', () =>
      page.getByRole('button', { name: 'Export JSON', exact: true }).first().click(),
    );
    const good = (JSON.parse(readFileSync(exportedPath, 'utf8')) as { document: Record<string, unknown> }).document;
    const bad = structuredClone(good);
    (bad as { selections: { entryReference: { rulesetId: string } }[] }).selections[0]!.entryReference.rulesetId = 'northag';
    const backup = {
      formatVersion: 'library-backup/1',
      kind: 'library-backup',
      savedAt: '2026-11-09T00:00:00.000Z',
      rosters: [
        { rosterId: 'good', document: good },
        { rosterId: 'bad', document: bad },
      ],
    };
    await page.goto('/?debug=1');
    await page.setInputFiles(FILE_INPUT, {
      name: 'mixed-backup.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(backup)),
    });
    await expect(page.locator('.import-record[data-status="ready"]')).toHaveCount(1);
    await expect(page.locator('.import-record[data-status="error"]')).toHaveCount(1);
    // The whole batch is rejected: confirm stays disabled and explains why.
    await expect(page.getByRole('button', { name: 'Import', exact: true })).toBeDisabled();
    await expect(page.getByText(/whole batch is rejected and nothing is written/i)).toBeVisible();
    await expect(page.locator('.library-item')).toHaveCount(1);
  });

  test('applies the single-roster size cap to every single-file shape without reading oversized files', async ({ page }) => {
    await page.goto('/?debug=1');
    await createExample(page);
    const exportedPath = await downloadVia(page, 'gate-source.json', () =>
      page.getByRole('button', { name: 'Export JSON', exact: true }).first().click(),
    );
    const document = (JSON.parse(readFileSync(exportedPath, 'utf8')) as { document: Record<string, unknown> }).document;
    // A bare M09 document above 2 MiB (but under 20 MiB) is refused.
    const bigBare = { ...document, notes: 'x'.repeat(TRANSFER_LIMITS.singleFileBytes) };
    await page.goto('/?debug=1');
    await page.setInputFiles(FILE_INPUT, {
      name: 'big-bare.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(bigBare)),
    });
    await expect(page.getByRole('alert')).toContainText('exceeds the import size limit');
    await expect(page.getByRole('button', { name: 'Import', exact: true })).toHaveCount(0);

    // A file above the 20 MiB global gate is refused before file.text() runs.
    await page.evaluate(() => {
      const counter = { reads: 0 };
      const original = File.prototype.text;
      (window as unknown as Record<string, unknown>).__textReads = counter;
      (window as unknown as Record<string, unknown>).__textOriginal = original;
      File.prototype.text = function (this: File, ...args: Parameters<File['text']>) {
        counter.reads += 1;
        return original.apply(this, args);
      };
    });
    const huge = Buffer.concat([
      Buffer.from('{"pad":"'),
      Buffer.alloc(TRANSFER_LIMITS.maxFileBytes + 1024 * 1024, 0x61),
      Buffer.from('"}'),
    ]);
    await page.setInputFiles(FILE_INPUT, {
      name: 'huge.json',
      mimeType: 'application/json',
      buffer: huge,
    });
    await expect(page.getByRole('alert')).toContainText('exceeds the import size limit');
    const reads = await page.evaluate(
      () => (window as unknown as { __textReads: { reads: number } }).__textReads.reads,
    );
    expect(reads).toBe(0);
  });

  test('two tabs: an overwrite conflicts with a newer remote save and keeps both drafts', async ({ browser }) => {
    const context = await browser.newContext();
    const page1 = await context.newPage();
    const page2 = await context.newPage();
    await page1.goto('/?debug=1');
    await createExample(page1);
    await expect(page1.getByText('Saved locally', { exact: true })).toBeVisible();
    const exportedPath = await downloadVia(page1, 'two-tab-source.json', () =>
      page1.getByRole('button', { name: 'Export JSON', exact: true }).first().click(),
    );

    // Tab 2 opens the saved roster and commits an update.
    await page2.goto('/?debug=1');
    await page2.locator('.library-item').first().getByRole('button', { name: 'Open', exact: true }).click();
    await page2.getByLabel('Roster name').fill('Remote edit wins');
    await page2.getByRole('button', { name: 'Apply settings' }).click();
    await expect(page2.getByText('Saved locally', { exact: true })).toBeVisible();

    // Tab 1 still only knows revision 1. Going home via the in-app link keeps
    // the same document (a page.goto would reload and re-anchor the queue).
    await page1.getByRole('link', { name: 'Back to My Rosters' }).click();
    await expect(page1).toHaveURL(/#\/$/);
    await page1.setInputFiles(FILE_INPUT, exportedPath);
    await page1.getByLabel('Overwrite an existing roster…').check();
    await page1.getByLabel('Roster to overwrite').selectOption({ index: 1 });
    page1.once('dialog', (dialog) => dialog.accept());
    await page1.getByRole('button', { name: 'Import', exact: true }).click();
    await expect(page1.getByText(/conflicted with a newer saved version/i)).toBeVisible();
    // Tab 1's memory draft is untouched.
    await expect(page1.getByRole('heading', { name: 'Soviet sample roster' })).toHaveCount(1);

    // The remote update survives; a cold reload reads it back.
    await page1.reload();
    await page1.locator('.library-item').first().getByRole('button', { name: 'Open', exact: true }).click();
    await expect(page1.locator('.editor-heading h2')).toHaveText('Remote edit wins');
    await expect(page1.getByTestId('points-total')).toHaveText('398');
    await context.close();
  });

  test('exports the in-memory draft after a storage failure and re-imports it', async ({ page }) => {
    await page.goto('/?debug=1');
    await createExample(page);
    // Break every IndexedDB write inside the page; reads still work. The
    // patch throws synchronously so Dexie aborts its transaction and the
    // queue surfaces a real error instead of hanging on a broken request.
    await page.evaluate(() => {
      const original = IDBObjectStore.prototype.put;
      (window as unknown as Record<string, unknown>).__restorePut = () => {
        IDBObjectStore.prototype.put = original;
      };
      IDBObjectStore.prototype.put = function () {
        throw new DOMException('simulated quota exceeded', 'QuotaExceededError');
      };
    });
    // Add a purchase: the autosave fails, the draft must survive in memory.
    await page.getByRole('button', { name: /^Add to:/ }).first().click();
    await page.locator('#editor-actions').getByRole('button', { name: /^Add / }).first().click();
    await expect(page.getByText('Not saved. Your draft is still available in this page.', { exact: true })).toBeVisible();
    const pointsAfterEdit = await page.getByTestId('points-total').textContent();
    expect(Number(pointsAfterEdit)).toBeGreaterThan(398);

    // The export reads the memory draft, not the last persisted row.
    const failedPath = await downloadVia(page, 'failed-save-draft.json', () =>
      page.getByRole('button', { name: 'Export JSON', exact: true }).first().click(),
    );
    const envelope = JSON.parse(readFileSync(failedPath, 'utf8')) as {
      formatVersion: string;
      document: { selections: unknown[]; name: string };
    };
    expect(envelope.formatVersion).toBe('roster-file/1');
    expect(envelope.document.selections).toHaveLength(10);

    // Once writes recover, the failed-save draft previews and imports.
    await page.evaluate(
      () => (window as unknown as { __restorePut: () => void }).__restorePut(),
    );
    await page.goto('/?debug=1');
    await page.setInputFiles(FILE_INPUT, failedPath);
    await expect(page.locator('.import-record').first()).toHaveAttribute('data-status', 'ready');
    await expect(page.locator('.import-record').first()).toContainText('10 purchases');
    await page.getByRole('button', { name: 'Import', exact: true }).click();
    await expect(page.locator('.library-item')).toHaveCount(2);
    await openLibraryItem(page, 1);
    await expect(page.getByTestId('points-total')).toHaveText(pointsAfterEdit ?? '');
  });
});
