#!/usr/bin/env node
/** Copy root VERSION into backend/frontend/ide package.json files. */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const version = readFileSync(join(root, 'VERSION'), 'utf8').trim();

for (const rel of ['backend/package.json', 'frontend/package.json', 'ide/autostart/package.json']) {
  const path = join(root, rel);
  const pkg = JSON.parse(readFileSync(path, 'utf8'));
  pkg.version = version;
  writeFileSync(path, `${JSON.stringify(pkg, null, 2)}\n`);
}

console.log(`Synced Proxima ${version} to package manifests.`);
