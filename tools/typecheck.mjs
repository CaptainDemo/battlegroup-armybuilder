import { existsSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

// Every ruleset workspace is checked; adding a module must not silently skip it.
const projects = ['packages/core', ...readdirSync('packages/rulesets', {withFileTypes:true})
  .filter(entry => entry.isDirectory() && existsSync(`packages/rulesets/${entry.name}/package.json`))
  .map(entry => `packages/rulesets/${entry.name}`).sort(), 'apps/web'];
for (const project of projects) {
  const result = spawnSync(process.execPath, ['node_modules/typescript/bin/tsc', '--noEmit', '-p', `${project}/tsconfig.json`], {stdio:'inherit'});
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
