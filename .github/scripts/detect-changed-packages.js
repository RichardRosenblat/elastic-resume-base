'use strict';

/**
 * Determines which packages need testing based on:
 *   1. [skip tests] in the latest commit message — skips everything.
 *   2. ALL_PACKAGES=true env var — runs every package.
 *   3. Git diff against the PR base commit (BASE_SHA) or base branch (BASE_REF) —
 *      runs only packages with changed files; falls back to all on detection failure.
 *
 * Outputs `matrix` (JSON array of package objects) and `has-packages` ('true'/'false')
 * to GITHUB_OUTPUT so the caller job can feed them into a matrix strategy.
 */

const fs         = require('fs');
const path       = require('path');
const { spawnSync } = require('child_process');

// ── Config ─────────────────────────────────────────────────────────────────
const configPath  = path.resolve(__dirname, '../ci-config/test-packages.json');
const allPackages = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

const runAll  = process.env.ALL_PACKAGES === 'true';
const baseSha = process.env.BASE_SHA  || '';
// Allow only characters that are valid in git branch/ref names; strip everything else.
// Using spawnSync (not a shell) so there is no command-injection risk, but we sanitise
// anyway to avoid passing unexpected refspecs to git.
const baseRef = (process.env.BASE_REF || 'main').replace(/[^a-zA-Z0-9_\-/]/g, '');

// ── Check for [skip tests] ─────────────────────────────────────────────────
let skipTests = false;
try {
  const log = spawnSync('git', ['log', '-1', '--pretty=%B', 'HEAD'], { encoding: 'utf-8' });
  if (log.stdout && log.stdout.includes('[skip tests]')) {
    skipTests = true;
    console.log('Detected [skip tests] in commit message — skipping all tests.');
  }
} catch (err) {
  console.warn('Could not read commit message:', err.message);
}

// ── Select packages ────────────────────────────────────────────────────────
let selected = [];

if (!skipTests) {
  if (runAll) {
    selected = allPackages;
    console.log('ALL_PACKAGES=true — running all packages.');
  } else {
    try {
      // Prefer the exact base-commit SHA (available for pull_request events);
      // fall back to branch-tip comparison for workflow_dispatch.
      const diffRef = baseSha
        ? `${baseSha}...HEAD`
        : `origin/${baseRef}...HEAD`;

      const diff = spawnSync('git', ['diff', '--name-only', diffRef], { encoding: 'utf-8' });
      if (diff.error) throw diff.error;

      const changedFiles = (diff.stdout || '').trim().split('\n').filter(Boolean);
      console.log(`Changed files (${changedFiles.length}): ${changedFiles.slice(0, 10).join(', ')}${changedFiles.length > 10 ? '…' : ''}`);

      selected = allPackages.filter(pkg =>
        changedFiles.some(f => f.startsWith(pkg.path + '/'))
      );

      if (selected.length === 0) {
        console.log('No package-specific changes detected — falling back to all packages.');
        selected = allPackages;
      } else {
        console.log(`Packages to test: ${selected.map(p => p.name).join(', ')}`);
      }
    } catch (err) {
      console.warn('Change detection failed — falling back to all packages:', err.message);
      selected = allPackages;
    }
  }
}

// ── Write outputs ──────────────────────────────────────────────────────────
const matrixJson  = JSON.stringify(selected);
const hasPackages = selected.length > 0 ? 'true' : 'false';

const outputFile = process.env.GITHUB_OUTPUT;
if (outputFile) {
  fs.appendFileSync(outputFile, `matrix=${matrixJson}\n`);
  fs.appendFileSync(outputFile, `has-packages=${hasPackages}\n`);
} else {
  // Local testing convenience
  console.log(`matrix=${matrixJson}`);
  console.log(`has-packages=${hasPackages}`);
}
