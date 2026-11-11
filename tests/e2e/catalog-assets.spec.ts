import { expect, test } from '@playwright/test';

test('serves only indexed catalog data with its immutable fingerprint', async({page})=>{
  await page.goto('/');
  const result = await page.evaluate(async()=>{
    const index = await (await fetch('./catalogs/index.json')).json();
    return Promise.all(index.releases.map(async (record: {assetPath: string; sha256: string; identity: {rulesetId: string; catalogRevision: string}}) => {
    const response = await fetch('./'+record.assetPath);
    const bytes = await response.arrayBuffer();
    const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),byte=>byte.toString(16).padStart(2,'0')).join('');
    const release = JSON.parse(new TextDecoder().decode(bytes));
    return {ok:response.ok,expected:record.sha256,digest,count:release.catalog.entries.length,identity:release.catalog.manifest.identity,expectedIdentity:record.identity};
    }));
  });
  expect(result.length).toBeGreaterThan(0);
  for (const release of result) {
    expect(release.ok).toBe(true);
    expect(release.digest).toBe(release.expected);
    expect(release.count).toBeGreaterThan(0);
    expect(release.identity).toEqual(release.expectedIdentity);
  }
  expect(result.find(release => release.identity.rulesetId === 'classic-coldwar' && release.identity.catalogRevision === '1.1.0')?.count).toBe(151);
});
