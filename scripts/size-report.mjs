#!/usr/bin/env node
/**
 * Bundle budget check. Run after `vite build`:  npm run size
 *
 * Walks the real import graph from dist/.vite/manifest.json, gzips every JS
 * file, and checks the budgets from the README. Exits 1 on any violation, so
 * CI fails before a regression is deployed.
 *
 *  - Hub first load      : entry + its static imports            < 80 KB gz
 *  - Each project chunk  : its own code, excl. hub + 3D vendor   < 50 KB gz
 *  - 2D projects         : must NOT reach the three-vendor chunk
 */
import { appendFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const DIST = 'dist';
const BUDGET_HUB = 80 * 1024;
const BUDGET_PROJECT = 50 * 1024;

const manifest = JSON.parse(readFileSync(join(DIST, '.vite/manifest.json'), 'utf8'));
const registry = readFileSync('src/projects/registry.ts', 'utf8');

const gz = (file) => gzipSync(readFileSync(join(DIST, file))).length;
const raw = (file) => readFileSync(join(DIST, file)).length;
const kb = (n) => `${(n / 1024).toFixed(1)} KB`;

/** All files statically reachable from a manifest key (what loads together). */
function closure(key, seen = new Set()) {
  const chunk = manifest[key];
  if (!chunk || seen.has(key)) return seen;
  seen.add(key);
  for (const dep of chunk.imports ?? []) closure(dep, seen);
  return seen;
}
const filesOf = (keys) => [...keys].map((k) => manifest[k].file).filter((f) => f.endsWith('.js'));
const cssOf = (keys) => [...keys].flatMap((k) => manifest[k].css ?? []);
const sum = (files) => files.reduce((t, f) => t + gz(f), 0);

let failed = false;
const rows = [];
const check = (label, size, budget, extra = '') => {
  const ok = budget == null || size <= budget;
  if (!ok) failed = true;
  rows.push([label, kb(size), budget == null ? '—' : `< ${kb(budget)}`, ok ? 'ok' : 'OVER', extra]);
};

// ---- hub
const entryKey = Object.keys(manifest).find((k) => manifest[k].isEntry);
const hubKeys = closure(entryKey);
const hubFiles = filesOf(hubKeys);
check(
  'Hub first load (JS)',
  sum(hubFiles),
  BUDGET_HUB,
  hubFiles.map((f) => f.replace('assets/', '')).join(' + '),
);
const hubCss = cssOf(hubKeys);
check(
  'Hub CSS',
  hubCss.reduce((t, f) => t + gz(f), 0),
  null,
  hubCss.join(', '),
);

// ---- 3D vendor
const vendorKey = Object.keys(manifest).find((k) => manifest[k].file.includes('three-vendor'));
const vendorFile = vendorKey ? manifest[vendorKey].file : null;
if (vendorFile)
  check(
    'Shared 3D vendor (three + R3F + drei bits)',
    gz(vendorFile),
    null,
    `${kb(raw(vendorFile))} raw`,
  );

// ---- projects
const projectRe = /slug:\s*'([^']+)'[\s\S]*?is3D:\s*(true|false)/g;
for (const [, slug, is3D] of registry.matchAll(projectRe)) {
  const key = `src/projects/${slug}/index.tsx`;
  if (!manifest[key]) {
    console.error(`✗ ${slug}: no chunk found in manifest (${key})`);
    failed = true;
    continue;
  }
  const keys = closure(key);
  const reachesVendor = vendorKey ? keys.has(vendorKey) : false;
  const own = [...keys].filter((k) => !hubKeys.has(k) && k !== vendorKey);
  const ownFiles = filesOf(own);
  const note = `${is3D === 'true' ? '3D' : '2D'} · loads three-vendor: ${reachesVendor ? 'YES' : 'no'}`;
  check(`Project "${slug}"`, sum(ownFiles), BUDGET_PROJECT, note);
  if (is3D === 'false' && reachesVendor) {
    console.error(`✗ 2D project "${slug}" pulls in the three-vendor chunk!`);
    failed = true;
  }
}

// ---- print
const widths = rows[0].map((_, i) => Math.max(...rows.map((r) => String(r[i]).length)));
const line = (r) => r.map((c, i) => String(c).padEnd(widths[i])).join('  ');
console.log('\nBundle budgets (gzip)\n');
console.log(line(['Chunk', 'Size', 'Budget', 'Status', 'Notes']));
console.log(widths.map((w) => '-'.repeat(w)).join('  '));
rows.forEach((r) => console.log(line(r)));

console.log('\nAll JS chunks (gzip):');
for (const k of Object.keys(manifest)) {
  const f = manifest[k].file;
  if (f.endsWith('.js')) console.log(`  ${kb(gz(f)).padStart(9)}  ${f}`);
}
console.log('');

// ---- GitHub Actions job summary (shown on the run page and in PR checks)
if (process.env.GITHUB_STEP_SUMMARY) {
  const md = [
    `## Bundle budgets ${failed ? '❌' : '✅'}`,
    '',
    '| Chunk | Size (gzip) | Budget | Status | Notes |',
    '| --- | ---: | ---: | :---: | --- |',
    ...rows.map(
      ([l, s, b, ok, n]) => `| ${l} | ${s} | ${b} | ${ok === 'ok' ? '✅' : '❌'} | ${n} |`,
    ),
    '',
  ].join('\n');
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, md + '\n');
}

if (failed) {
  console.error('Budget check FAILED.');
  process.exit(1);
}
console.log('All budgets met.');
