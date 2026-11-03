import { expect, test } from '@playwright/test';

test('serves only indexed catalog data with its immutable fingerprint', async({page})=>{
  await page.goto('/');
  const result = await page.evaluate(async()=>{
    const index = await (await fetch('./catalogs/index.json')).json();
    const record = index.releases[0];
    const response = await fetch('./'+record.assetPath);
    const bytes = await response.arrayBuffer();
    const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),byte=>byte.toString(16).padStart(2,'0')).join('');
    const release = JSON.parse(new TextDecoder().decode(bytes));
    return {ok:response.ok,expected:record.sha256,digest,count:release.catalog.entries.length,identity:release.catalog.manifest.identity,expectedIdentity:record.identity};
  });
  expect(result.ok).toBe(true);
  expect(result.digest).toBe(result.expected);
  expect(result.count).toBe(10);
  expect(result.identity).toEqual(result.expectedIdentity);
});
