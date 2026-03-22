'use strict';

const fs   = require('fs');
const path = require('path');

const workspace = process.env.GITHUB_WORKSPACE;

const packages = [
  { name: 'shared/Bowltie', file: path.join(workspace, 'bowltie-results.json') },
  { name: 'shared/Bugle',   file: path.join(workspace, 'bugle-results.json') },
  { name: 'shared/Synapse', file: path.join(workspace, 'synapse-results.json') },
  { name: 'bff-gateway',    file: path.join(workspace, 'bff-gateway-results.json') },
  { name: 'users-api',      file: path.join(workspace, 'users-api-results.json') },
];

let totalPassed  = 0;
let totalFailed  = 0;
let totalSkipped = 0;
const rows = [];

for (const pkg of packages) {
  if (!fs.existsSync(pkg.file)) {
    rows.push('| ' + pkg.name + ' | ⚠️ No results | — | — | — |');
    continue;
  }

  let results;
  try {
    results = JSON.parse(fs.readFileSync(pkg.file, 'utf-8'));
  } catch (err) {
    rows.push('| ' + pkg.name + ' | ⚠️ Invalid results | — | — | — |');
    continue;
  }

  const passed   = results.numPassedTests  || 0;
  const failed   = results.numFailedTests  || 0;
  const skipped  = results.numPendingTests || 0;
  const status   = results.success ? '✅ Passed' : '❌ Failed';

  totalPassed  += passed;
  totalFailed  += failed;
  totalSkipped += skipped;

  rows.push('| ' + pkg.name + ' | ' + status + ' | ' + passed + ' | ' + failed + ' | ' + skipped + ' |');
}

const headline = totalFailed === 0
  ? '> ✅ All tests passed!'
  : '> ❌ **' + totalFailed + '** test(s) failed across all packages.';

const lines = [
  '## 🧪 Test Results',
  '',
  headline,
  '',
  '| Package | Status | ✅ Passed | ❌ Failed | ⏭️ Skipped |',
  '|---------|--------|----------:|----------:|----------:|',
  ...rows,
  '| **Total** | | **' + totalPassed + '** | **' + totalFailed + '** | **' + totalSkipped + '** |',
  '',
  '> ℹ️ This check is informational and will never block a PR from being merged.',
];

fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, lines.join('\n') + '\n');
