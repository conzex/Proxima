#!/usr/bin/env node
/**
 * Proxima product versioning (Conzex Global Private Limited).
 * Base line: 1.2.0 — patch 0..9, then minor += 1 and patch = 0;
 * when minor would pass 11, major += 1 and minor = patch = 0.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const versionFile = join(root, 'VERSION');

const PKG_PATHS = [
  join(root, 'backend/package.json'),
  join(root, 'frontend/package.json'),
  join(root, 'ide/autostart/package.json'),
];

function readVersion() {
  return readFileSync(versionFile, 'utf8').trim();
}

function parse(v) {
  const [major, minor, patch] = v.split('.').map((n) => parseInt(n, 10) || 0);
  return { major, minor, patch };
}

export function bumpProximaVersion(current) {
  let { major, minor, patch } = parse(current);
  if (patch < 9) {
    patch += 1;
  } else {
    patch = 0;
    if (minor < 11) {
      minor += 1;
    } else {
      minor = 0;
      major += 1;
    }
  }
  return `${major}.${minor}.${patch}`;
}

function syncPackages(version) {
  for (const path of PKG_PATHS) {
    const pkg = JSON.parse(readFileSync(path, 'utf8'));
    pkg.version = version;
    writeFileSync(path, `${JSON.stringify(pkg, null, 2)}\n`);
  }
}

const current = readVersion();
const next = bumpProximaVersion(current);
writeFileSync(versionFile, `${next}\n`);
syncPackages(next);
console.log(`Proxima version: ${current} → ${next}`);
